-- Conservative delegation: managers operate assigned branches; finance reads
-- masked reports and reviews reconciliation. Neither inherits administrator
-- refunds, customer-directory, role-grant, pricing or privacy-review authority.
-- Preserve historical admin+staff rows for inventory, but never combine two
-- different delegated branch roles through an invitation or alternate writer.
CREATE UNIQUE INDEX identity_one_branch_role ON public.user_roles(user_id) WHERE role IN ('staff','manager','finance');
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID,_role public.app_role) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.privacy_account_live() AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
    AND (_role='user' OR (_user_id=auth.uid() AND public.identity_aal2()
      AND (_role NOT IN ('staff','manager','finance') OR EXISTS(SELECT 1 FROM public.staff_memberships WHERE user_id=_user_id AND active))))
$$;
CREATE OR REPLACE FUNCTION public.staff_assignment(p_store UUID,p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='admin') OR
    (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role IN ('staff','manager')) AND
      EXISTS(SELECT 1 FROM public.staff_memberships WHERE user_id=p_actor AND store_id=p_store AND active))
$$;
CREATE OR REPLACE FUNCTION public.staff_branch_member(p_store UUID,p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role IN ('staff','manager')) AND
    EXISTS(SELECT 1 FROM public.staff_memberships WHERE user_id=p_actor AND store_id=p_store AND active)
$$;
CREATE FUNCTION public.finance_branch_access(p_store UUID,p_review BOOLEAN DEFAULT false) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.privacy_account_live() AND public.identity_aal2() AND (public.has_role(auth.uid(),'admin') OR
    (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND (role='finance' OR (NOT p_review AND role='manager')))
      AND EXISTS(SELECT 1 FROM public.staff_memberships WHERE user_id=auth.uid() AND store_id=p_store AND active)))
$$;
REVOKE ALL ON FUNCTION public.finance_branch_access(UUID,BOOLEAN) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_branch_access(UUID,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_identity_access(p_user_id UUID,p_role public.app_role,p_store_ids UUID[],p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before JSONB;v_store UUID;v_scoped BOOLEAN:=p_role IN ('staff','manager','finance');
BEGIN
  PERFORM public.privacy_assert_account_available();
  PERFORM public.privacy_assert_target_available(p_user_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('identity-role-governance',0));
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE='42501'; END IF;
  IF p_role IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 OR
    NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL) OR
    p_store_ids IS NULL OR cardinality(p_store_ids)>3 OR (v_scoped AND cardinality(p_store_ids)=0) OR
    (NOT v_scoped AND cardinality(p_store_ids)<>0) OR
    (SELECT count(DISTINCT branch.id) FROM unnest(p_store_ids) AS branch(id))<>cardinality(p_store_ids) OR
    EXISTS(SELECT 1 FROM unnest(p_store_ids) AS branch(id) WHERE branch.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores WHERE stores.id=branch.id))
    THEN RAISE EXCEPTION 'Check verified account, role, distinct branches and reason' USING ERRCODE='22023'; END IF;
  IF p_role<>'admin' AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND role='admin') AND
    (SELECT count(*) FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id WHERE r.role='admin' AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL)<=1
    THEN RAISE EXCEPTION 'The last administrator cannot be removed' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('roles',(SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id=p_user_id),
    'stores',(SELECT jsonb_agg(store_id ORDER BY store_id) FROM public.staff_memberships WHERE user_id=p_user_id AND active)) INTO v_before;
  DELETE FROM public.user_roles WHERE user_id=p_user_id AND role<>'user';
  INSERT INTO public.user_roles(user_id,role) VALUES(p_user_id,'user') ON CONFLICT DO NOTHING;
  IF p_role<>'user' THEN INSERT INTO public.user_roles(user_id,role,staff_store_id) VALUES(p_user_id,p_role,CASE WHEN v_scoped THEN p_store_ids[1] END); END IF;
  UPDATE public.staff_memberships SET active=false,updated_at=now() WHERE user_id=p_user_id;
  IF v_scoped THEN FOREACH v_store IN ARRAY p_store_ids LOOP
    INSERT INTO public.staff_memberships(user_id,store_id,active,granted_by) VALUES(p_user_id,v_store,true,auth.uid())
      ON CONFLICT(user_id,store_id) DO UPDATE SET active=true,granted_by=EXCLUDED.granted_by,updated_at=now();
  END LOOP; END IF;
  UPDATE public.staff_invitations SET revoked_at=now() WHERE email=(SELECT lower(email) FROM auth.users WHERE id=p_user_id) AND revoked_at IS NULL;
  UPDATE public.cash_branch_cashiers SET active=false WHERE user_id=p_user_id AND (p_role NOT IN ('staff','manager') OR NOT(store_id=ANY(p_store_ids)));
  INSERT INTO public.identity_access_events(actor_id,subject_id,action,details)
    VALUES(auth.uid(),p_user_id,'set_access',jsonb_build_object('before',v_before,'role',p_role,'stores',p_store_ids,'reason',btrim(p_reason)));
END; $$;

-- Preserve transactional command bodies, privacy guards, invitations and push
-- delivery checks. Finance never becomes an operational staff assignment.
DO $$ DECLARE f TEXT;d TEXT;old TEXT;BEGIN
  d:=pg_get_functiondef('public.operate_cash_order(uuid,uuid,integer,text,jsonb)'::regprocedure);
  old:='public.has_role(v_actor, ''admin'') OR public.has_role(v_actor, ''staff'')';
  IF strpos(d,old)=0 THEN RAISE EXCEPTION 'Cash manager access overlay drift'; END IF;
  EXECUTE replace(d,old,old||' OR public.has_role(v_actor, ''manager'')');
  d:=pg_get_functiondef('public.accept_staff_invitation(uuid)'::regprocedure);
  old:='IF NOT public.identity_aal2() THEN';
  IF strpos(d,old)=0 THEN RAISE EXCEPTION 'Invitation role overlay drift'; END IF;
  EXECUTE replace(d,old,'IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN (''manager'',''finance'',''admin'')) THEN RAISE EXCEPTION ''Use an administrator access change for privileged branch assignments'' USING ERRCODE=''42501''; END IF; '||old);
  FOREACH f IN ARRAY ARRAY['public.privacy_recent_identity()','public.privacy_deletion_blocker(uuid)',
    'public.complete_privacy_deletion(uuid,integer,text)','public.push_device_eligible(uuid)',
    'public.register_push_device(uuid,text,text,uuid,text)','public.enqueue_transaction_notification()',
    'public.my_notification_inbox(timestamptz,uuid)','public.resolve_transaction_notification(uuid)'] LOOP
    d:=pg_get_functiondef(f::regprocedure);old:='role IN (''staff'',''admin'')';
    IF strpos(d,old)=0 THEN RAISE EXCEPTION 'Privileged role guard overlay drift: %',f;END IF;
    EXECUTE replace(d,old,'role IN (''staff'',''manager'',''finance'',''admin'')');
  END LOOP;
END; $$;

-- Staff grants are explicit, multi-branch, audited and evaluated from live rows.
-- No hosted accounts are created and no invitation email is sent by this schema.
CREATE TABLE public.staff_memberships (
  user_id UUID NOT NULL REFERENCES auth.users(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  active BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store_id)
);
INSERT INTO public.staff_memberships(user_id, store_id)
  SELECT user_id, staff_store_id FROM public.user_roles WHERE role = 'staff' AND staff_store_id IS NOT NULL;
CREATE TABLE public.staff_invitations (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES auth.users(id), accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.identity_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID NOT NULL REFERENCES auth.users(id),
  subject_id UUID REFERENCES auth.users(id), invitation_id UUID REFERENCES public.staff_invitations(id),
  action TEXT NOT NULL, details JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_memberships, public.staff_invitations, public.identity_access_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.staff_memberships, public.staff_invitations, public.identity_access_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.identity_access_events FROM service_role;
CREATE FUNCTION public.protect_identity_audit() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
  RAISE EXCEPTION 'Identity access audit is immutable' USING ERRCODE = '42501';
END; $$;
CREATE TRIGGER identity_audit_immutable BEFORE UPDATE OR DELETE ON public.identity_access_events FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
-- Even administrators use commands; remove legacy column grants as well.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM PUBLIC, anon, authenticated;
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.user_roles FROM PUBLIC, anon, authenticated', c.column_name, c.column_name);
  END LOOP;
END; $$;
CREATE FUNCTION public.identity_aal2() RETURNS BOOLEAN LANGUAGE SQL STABLE SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role = _role)
    AND (_role = 'user' OR (_user_id = auth.uid() AND public.identity_aal2()
      AND (_role <> 'staff' OR EXISTS (SELECT 1 FROM public.staff_memberships m WHERE m.user_id = _user_id AND m.active))))
$$;
CREATE FUNCTION public.staff_assignment(p_store UUID, p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin') OR
    (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'staff') AND
     EXISTS (SELECT 1 FROM public.staff_memberships WHERE user_id = p_actor AND store_id = p_store AND active))
$$;
CREATE FUNCTION public.staff_branch_member(p_store UUID, p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'staff') AND
    EXISTS (SELECT 1 FROM public.staff_memberships WHERE user_id = p_actor AND store_id = p_store AND active)
$$;
CREATE OR REPLACE FUNCTION public.cash_staff_access(p_store UUID, p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_actor = auth.uid() AND public.identity_aal2() AND public.staff_assignment(p_store, p_actor)
$$;
CREATE OR REPLACE FUNCTION public.cash_is_cashier(p_store UUID, p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.staff_assignment(p_store, p_actor) AND EXISTS (SELECT 1 FROM public.cash_branch_cashiers WHERE store_id = p_store AND user_id = p_actor AND active)
$$;
-- The order boundary also evaluates for anonymous reads. This public boolean
-- helper denies those callers before exposing any assignment information.
GRANT EXECUTE ON FUNCTION public.cash_staff_access(UUID, UUID) TO anon;
-- These internal helpers disclose no callable roster/privileged API surface.
REVOKE ALL ON FUNCTION public.staff_assignment(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.identity_aal2() TO authenticated;
CREATE POLICY "Own or admin memberships" ON public.staff_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin invitations" ON public.staff_invitations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin access audit" ON public.identity_access_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Restrictive bounds close direct EXISTS policies in the historical schema too.
DROP POLICY "Order access boundary" ON public.orders;
CREATE POLICY "Order access boundary" ON public.orders AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR public.cash_staff_access(store_id, auth.uid())));
DROP POLICY "Staff read assigned branch orders" ON public.orders;
CREATE POLICY "Staff read assigned branch orders" ON public.orders FOR SELECT TO authenticated USING (public.cash_staff_access(store_id, auth.uid()));
-- Legacy inline administrator policies must enforce MFA as well.
CREATE POLICY "Store insert MFA" ON public.stores AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Store update MFA" ON public.stores AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Store delete MFA" ON public.stores AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles read boundary" ON public.user_roles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "GAAP config MFA" ON public.gaap_config AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "GAAP log MFA" ON public.gaap_sync_log AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "GAAP links boundary" ON public.gaap_customer_links AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.invite_branch_staff(p_id UUID, p_email TEXT, p_store_id UUID, p_reason TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_old public.staff_invitations%ROWTYPE; v_email TEXT := lower(btrim(p_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE = '42501'; END IF;
  IF p_id IS NULL OR v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR length(v_email) > 254 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500
    OR NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN RAISE EXCEPTION 'Check invitation email, branch and reason' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('staff-invite:' || p_id, 0));
  SELECT * INTO v_old FROM public.staff_invitations WHERE id = p_id;
  IF FOUND THEN
    IF v_old.invited_by <> auth.uid() OR v_old.email <> v_email OR v_old.store_id <> p_store_id OR v_old.reason <> btrim(p_reason) THEN RAISE EXCEPTION 'Invitation request changed' USING ERRCODE = '22023'; END IF;
    RETURN p_id;
  END IF;
  INSERT INTO public.staff_invitations(id, email, store_id, invited_by, reason, expires_at)
    VALUES (p_id, v_email, p_store_id, auth.uid(), btrim(p_reason), now() + interval '7 days');
  INSERT INTO public.identity_access_events(actor_id, invitation_id, action, details)
    VALUES (auth.uid(), p_id, 'invite', jsonb_build_object('store_id', p_store_id, 'reason', btrim(p_reason)));
  RETURN p_id;
END; $$;
CREATE FUNCTION public.my_staff_invitations() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.identity_aal2() THEN RAISE EXCEPTION 'Complete MFA first' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'store_id', i.store_id, 'store_name', s.name, 'expires_at', i.expires_at))
    FROM public.staff_invitations i JOIN public.stores s ON s.id = i.store_id JOIN auth.users u ON u.id = auth.uid()
    WHERE u.email_confirmed_at IS NOT NULL AND lower(u.email) = i.email AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at > now()), '[]'::jsonb);
END; $$;
CREATE FUNCTION public.accept_staff_invitation(p_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invite public.staff_invitations%ROWTYPE;
BEGIN
  IF NOT public.identity_aal2() THEN RAISE EXCEPTION 'Complete MFA first' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('identity-role-governance', 0));
  SELECT * INTO v_invite FROM public.staff_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL AND lower(email) = v_invite.email)
    THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE = '42501'; END IF;
  IF v_invite.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation revoked' USING ERRCODE = '42501'; END IF;
  IF v_invite.accepted_by = auth.uid() THEN RETURN v_invite.store_id; END IF;
  IF v_invite.accepted_at IS NOT NULL OR v_invite.expires_at <= now() THEN RAISE EXCEPTION 'Invitation expired or unavailable' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.user_roles(user_id, role, staff_store_id) VALUES (auth.uid(), 'staff', v_invite.store_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.staff_memberships(user_id, store_id, active, granted_by) VALUES (auth.uid(), v_invite.store_id, true, v_invite.invited_by)
    ON CONFLICT (user_id, store_id) DO UPDATE SET active = true, granted_by = EXCLUDED.granted_by, updated_at = now();
  UPDATE public.staff_invitations SET accepted_by = auth.uid(), accepted_at = now() WHERE id = p_id;
  INSERT INTO public.identity_access_events(actor_id, subject_id, invitation_id, action, details)
    VALUES (auth.uid(), auth.uid(), p_id, 'accept', jsonb_build_object('store_id', v_invite.store_id));
  RETURN v_invite.store_id;
END; $$;
CREATE FUNCTION public.revoke_staff_invitation(p_id UUID, p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invite public.staff_invitations%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE = '42501'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Provide a reason' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_invite FROM public.staff_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Use membership revocation for accepted invitations' USING ERRCODE = '22023'; END IF;
  IF v_invite.revoked_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.staff_invitations SET revoked_at = now() WHERE id = p_id;
  INSERT INTO public.identity_access_events(actor_id, invitation_id, action, details) VALUES (auth.uid(), p_id, 'revoke_invitation', jsonb_build_object('reason', btrim(p_reason)));
END; $$;
CREATE FUNCTION public.set_identity_access(p_user_id UUID, p_role public.app_role, p_store_ids UUID[], p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before JSONB; v_store UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('identity-role-governance', 0));
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE = '42501'; END IF;
  IF p_role IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL)
    OR p_store_ids IS NULL OR cardinality(p_store_ids) > 3 OR (p_role = 'staff' AND cardinality(p_store_ids) = 0)
    OR (p_role <> 'staff' AND cardinality(p_store_ids) <> 0)
    OR EXISTS (SELECT 1 FROM unnest(p_store_ids) s WHERE s IS NULL OR NOT EXISTS (SELECT 1 FROM public.stores WHERE id = s))
    THEN RAISE EXCEPTION 'Check verified account, role, branches and reason' USING ERRCODE = '22023'; END IF;
  IF p_role <> 'admin' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin')
    AND (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN RAISE EXCEPTION 'The last administrator cannot be removed' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object('roles', (SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id = p_user_id),
    'stores', (SELECT jsonb_agg(store_id) FROM public.staff_memberships WHERE user_id = p_user_id AND active)) INTO v_before;
  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role <> 'user';
  INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  IF p_role <> 'user' THEN INSERT INTO public.user_roles(user_id, role, staff_store_id) VALUES (p_user_id, p_role, CASE WHEN p_role = 'staff' THEN p_store_ids[1] END); END IF;
  UPDATE public.staff_memberships SET active = false, updated_at = now() WHERE user_id = p_user_id;
  IF p_role = 'staff' THEN FOREACH v_store IN ARRAY p_store_ids LOOP
    INSERT INTO public.staff_memberships(user_id, store_id, active, granted_by) VALUES (p_user_id, v_store, true, auth.uid())
      ON CONFLICT (user_id, store_id) DO UPDATE SET active = true, granted_by = EXCLUDED.granted_by, updated_at = now();
  END LOOP; END IF;
  -- A revoked account cannot reactivate itself through an old unaccepted invite.
  UPDATE public.staff_invitations SET revoked_at = now() WHERE lower(email) = (SELECT lower(email) FROM auth.users WHERE id = p_user_id) AND revoked_at IS NULL;
  UPDATE public.cash_branch_cashiers SET active = false WHERE user_id = p_user_id AND (p_role <> 'staff' OR NOT (store_id = ANY(p_store_ids)));
  INSERT INTO public.identity_access_events(actor_id, subject_id, action, details)
    VALUES (auth.uid(), p_user_id, 'set_access', jsonb_build_object('before', v_before, 'role', p_role, 'stores', p_store_ids, 'reason', btrim(p_reason)));
END; $$;
CREATE OR REPLACE FUNCTION public.list_cash_branch_staff(p_store_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  IF NOT public.cash_staff_access(p_store_id, auth.uid()) THEN RAISE EXCEPTION 'Branch access required' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', p.id, 'name', coalesce(nullif(p.full_name, ''), 'Staff member'),
    'cashier', public.cash_is_cashier(p_store_id, p.id)) ORDER BY p.full_name, p.id) FROM public.profiles p
    WHERE public.staff_assignment(p_store_id, p.id)), '[]'::jsonb);
END; $$;
-- The dispatch recipient test used a historical single-branch column. Replace
-- just that predicate in the existing transactional command, preserving its body.
DO $$ DECLARE v_definition TEXT; v_old TEXT; BEGIN
  v_old := 'IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_recipient AND role = ''staff'' AND staff_store_id = v_order.store_id) THEN';
  v_definition := pg_get_functiondef('public.operate_cash_order(uuid,uuid,integer,text,jsonb)'::regprocedure);
  IF position(v_old IN v_definition) = 0 THEN RAISE EXCEPTION 'Dispatch membership predicate drift'; END IF;
  EXECUTE replace(v_definition, v_old, 'IF NOT public.staff_branch_member(v_order.store_id, v_recipient) THEN');
END; $$;
-- Availability checks ask whether a cashier is assigned, rather than whether
-- the customer requesting a quotation is that cashier's MFA session.
DO $$ DECLARE v_definition TEXT; v_old TEXT; BEGIN
  v_old := 'public.cash_staff_access(v_store, c.user_id)';
  v_definition := pg_get_functiondef('public.quote_cash_order(jsonb)'::regprocedure);
  IF position(v_old IN v_definition) = 0 THEN RAISE EXCEPTION 'Quotation cashier predicate drift'; END IF;
  EXECUTE replace(v_definition, v_old, 'public.staff_assignment(v_store, c.user_id)');
  v_old := 'public.cash_staff_access(NEW.store_id, c.user_id)';
  v_definition := pg_get_functiondef('public.initialise_cash_fulfilment()'::regprocedure);
  IF position(v_old IN v_definition) = 0 THEN RAISE EXCEPTION 'Fulfilment cashier predicate drift'; END IF;
  EXECUTE replace(v_definition, v_old, 'public.staff_assignment(NEW.store_id, c.user_id)');
END; $$;
GRANT EXECUTE ON FUNCTION public.invite_branch_staff(UUID, TEXT, UUID, TEXT), public.my_staff_invitations(),
  public.accept_staff_invitation(UUID), public.revoke_staff_invitation(UUID, TEXT),
  public.set_identity_access(UUID, public.app_role, UUID[], TEXT) TO authenticated;

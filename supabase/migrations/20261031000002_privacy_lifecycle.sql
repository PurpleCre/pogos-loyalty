-- Privacy request/consent/export workflow. No legal notice, retention rule or
-- erasure approval is inferred, and no existing account is erased by migration.
CREATE TABLE public.privacy_notices (
  version TEXT PRIMARY KEY CHECK (length(version) BETWEEN 1 AND 80),
  controller_name TEXT NOT NULL CHECK (length(btrim(controller_name)) > 2),
  body TEXT NOT NULL CHECK (length(btrim(body)) > 40),
  support_email TEXT NOT NULL,
  approval_reference TEXT NOT NULL CHECK (length(btrim(approval_reference)) > 2),
  approved_by TEXT NOT NULL CHECK (length(btrim(approved_by)) > 2),
  approved_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.privacy_retention_approvals (
  version TEXT PRIMARY KEY, policy_reference TEXT NOT NULL CHECK (length(btrim(policy_reference)) > 2),
  approved_by TEXT NOT NULL CHECK (length(btrim(approved_by)) > 2), approved_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.privacy_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  support_email TEXT NOT NULL DEFAULT 'pgonese6@gmail.com',
  active_notice_version TEXT REFERENCES public.privacy_notices(version),
  retention_policy_version TEXT REFERENCES public.privacy_retention_approvals(version),
  deletion_processing_enabled BOOLEAN NOT NULL DEFAULT false,
  CHECK (NOT deletion_processing_enabled OR (active_notice_version IS NOT NULL AND retention_policy_version IS NOT NULL))
);
INSERT INTO public.privacy_settings(singleton) VALUES (true);
CREATE TABLE public.privacy_reviewers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id), active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE public.privacy_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id), marketing_email BOOLEAN NOT NULL DEFAULT false,
  notice_version TEXT REFERENCES public.privacy_notices(version), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.privacy_consent_events (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id),
  marketing_email BOOLEAN NOT NULL, notice_version TEXT REFERENCES public.privacy_notices(version),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.privacy_requests (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id),
  kind TEXT NOT NULL CHECK (kind IN ('export','deletion')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','blocked','reviewing','processing','completed','cancelled')),
  version INTEGER NOT NULL DEFAULT 0,
  blocker TEXT, reviewed_by UUID REFERENCES auth.users(id),
  notice_version TEXT REFERENCES public.privacy_notices(version),
  retention_policy_version TEXT REFERENCES public.privacy_retention_approvals(version),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_open_privacy_request ON public.privacy_requests(user_id,kind) WHERE status IN ('submitted','blocked','reviewing','processing');
CREATE TABLE public.privacy_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL REFERENCES public.privacy_requests(id),
  actor_id UUID REFERENCES auth.users(id), event_type TEXT NOT NULL, public_message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.privacy_request_tasks (
  request_id UUID NOT NULL REFERENCES public.privacy_requests(id),
  system TEXT NOT NULL CHECK (system IN ('application','authentication','gaap','email','monitoring','backups')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','not_applicable')),
  evidence_reference TEXT, recorded_by TEXT, recorded_at TIMESTAMPTZ,
  PRIMARY KEY(request_id,system),
  CHECK (status='pending' OR (evidence_reference IS NOT NULL AND recorded_by IS NOT NULL AND length(btrim(evidence_reference)) >= 3 AND length(btrim(recorded_by)) >= 3 AND recorded_at IS NOT NULL))
);
CREATE TABLE public.privacy_export_progress (
  request_id UUID NOT NULL REFERENCES public.privacy_requests(id), section TEXT NOT NULL,
  cursor UUID, previous_cursor UUID, finished BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY(request_id,section)
);
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['privacy_notices','privacy_retention_approvals','privacy_settings','privacy_reviewers','privacy_preferences','privacy_consent_events','privacy_requests','privacy_request_events','privacy_request_tasks','privacy_export_progress'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
END; $$;
GRANT SELECT ON public.privacy_notices, public.privacy_settings TO anon,authenticated;
GRANT SELECT ON public.privacy_preferences,public.privacy_consent_events,public.privacy_requests TO authenticated;
CREATE POLICY "Published privacy settings" ON public.privacy_settings FOR SELECT USING (true);
CREATE POLICY "Published active notice" ON public.privacy_notices FOR SELECT USING (version=(SELECT active_notice_version FROM public.privacy_settings));
CREATE POLICY "Own privacy preferences" ON public.privacy_preferences FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "Own consent history" ON public.privacy_consent_events FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "Own privacy requests" ON public.privacy_requests FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE TRIGGER immutable_privacy_notices BEFORE UPDATE OR DELETE ON public.privacy_notices FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE TRIGGER immutable_retention_approvals BEFORE UPDATE OR DELETE ON public.privacy_retention_approvals FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE TRIGGER immutable_consent_events BEFORE UPDATE OR DELETE ON public.privacy_consent_events FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE TRIGGER immutable_privacy_events BEFORE UPDATE OR DELETE ON public.privacy_request_events FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE FUNCTION public.privacy_is_reviewer() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.privacy_reviewers WHERE user_id=auth.uid() AND active)
$$;
-- Issued-at/token refresh is not proof that a password was just entered.
CREATE FUNCTION public.privacy_recent_identity() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_claims JSONB:=auth.jwt(); v_recent BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your data' USING ERRCODE='42501'; END IF;
  IF NOT public.privacy_account_live() THEN RAISE EXCEPTION 'Account is no longer active' USING ERRCODE='42501'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_claims->'amr')='array' THEN v_claims->'amr' ELSE '[]'::jsonb END) item
    WHERE item->>'method'='password' AND CASE WHEN coalesce(item->>'timestamp','') ~ '^[0-9]{1,12}$' THEN
      (item->>'timestamp')::bigint BETWEEN extract(epoch FROM now())::bigint-300 AND extract(epoch FROM now())::bigint+30 ELSE false END) INTO v_recent;
  IF NOT v_recent THEN RAISE EXCEPTION 'Sign in again with your password before requesting export or deletion' USING ERRCODE='42501'; END IF;
  IF (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')) OR
      EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id=auth.uid() AND status='verified')) AND NOT public.identity_aal2()
    THEN RAISE EXCEPTION 'Complete authenticator verification first' USING ERRCODE='42501'; END IF;
END; $$;
CREATE FUNCTION public.set_privacy_marketing(p_id UUID,p_enabled BOOLEAN,p_notice_version TEXT DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old public.privacy_consent_events%ROWTYPE; v_active TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage preferences' USING ERRCODE='42501'; END IF;
  IF NOT public.privacy_account_live() THEN RAISE EXCEPTION 'Account is no longer active' USING ERRCODE='42501'; END IF;
  IF p_enabled THEN PERFORM public.privacy_assert_account_available(); END IF;
  IF p_id IS NULL OR p_enabled IS NULL THEN RAISE EXCEPTION 'Invalid preference request' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy:'||auth.uid(),0));
  SELECT * INTO v_old FROM public.privacy_consent_events WHERE id=p_id;
  IF FOUND THEN
    IF v_old.user_id<>auth.uid() OR v_old.marketing_email<>p_enabled OR v_old.notice_version IS DISTINCT FROM p_notice_version THEN RAISE EXCEPTION 'Preference request changed' USING ERRCODE='22023'; END IF;
    RETURN p_enabled;
  END IF;
  SELECT active_notice_version INTO v_active FROM public.privacy_settings WHERE singleton;
  IF p_enabled AND (p_notice_version IS NULL OR p_notice_version IS DISTINCT FROM v_active OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL))
    THEN RAISE EXCEPTION 'Read the approved notice and verify your email before opting in' USING ERRCODE='22023'; END IF;
  INSERT INTO public.privacy_preferences(user_id,marketing_email,notice_version) VALUES(auth.uid(),p_enabled,p_notice_version)
    ON CONFLICT(user_id) DO UPDATE SET marketing_email=p_enabled,notice_version=p_notice_version,updated_at=now();
  INSERT INTO public.privacy_consent_events(id,user_id,marketing_email,notice_version) VALUES(p_id,auth.uid(),p_enabled,p_notice_version);
  RETURN p_enabled;
END; $$;
CREATE FUNCTION public.privacy_deletion_blocker(p_user UUID) RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id=p_user AND (status NOT IN ('completed','cancelled') OR cash_custody_status IN ('held','handover_pending')))
    THEN RETURN 'active_orders'; END IF;
  IF EXISTS (SELECT 1 FROM public.cash_receipts WHERE (current_holder_id=p_user OR pending_receiver_id=p_user) AND settled_at IS NULL) THEN RETURN 'cash_custody'; END IF;
  IF EXISTS (SELECT 1 FROM public.reward_reservations WHERE (user_id=p_user OR claimed_by=p_user) AND status IN ('reserved','claiming')) THEN RETURN 'active_rewards'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role IN ('staff','admin')) THEN RETURN 'staff_access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.privacy_settings WHERE singleton AND deletion_processing_enabled AND active_notice_version IS NOT NULL AND retention_policy_version IS NOT NULL) THEN RETURN 'policy_approval'; END IF;
  RETURN NULL;
END; $$;
CREATE FUNCTION public.submit_privacy_request(p_id UUID,p_kind TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE; v_blocker TEXT;
BEGIN
  PERFORM public.privacy_recent_identity();
  IF p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('export','deletion') THEN RAISE EXCEPTION 'Invalid privacy request' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy:'||auth.uid(),0));
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id;
  IF FOUND THEN
    IF v_request.user_id<>auth.uid() OR v_request.kind<>p_kind THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
    RETURN jsonb_build_object('id',v_request.id,'kind',v_request.kind,'status',v_request.status,'version',v_request.version,'blocker',v_request.blocker);
  END IF;
  SELECT * INTO v_request FROM public.privacy_requests WHERE user_id=auth.uid() AND kind=p_kind AND status IN ('submitted','blocked','reviewing','processing');
  IF FOUND THEN RETURN jsonb_build_object('id',v_request.id,'kind',v_request.kind,'status',v_request.status,'version',v_request.version,'blocker',v_request.blocker); END IF;
  IF (SELECT count(*) FROM public.privacy_requests WHERE user_id=auth.uid() AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'Too many requests; contact the privacy team' USING ERRCODE='22023'; END IF;
  IF p_kind='deletion' THEN v_blocker:=public.privacy_deletion_blocker(auth.uid()); END IF;
  INSERT INTO public.privacy_requests(id,user_id,kind,status,blocker) VALUES(p_id,auth.uid(),p_kind,CASE WHEN v_blocker IS NULL THEN 'submitted' ELSE 'blocked' END,v_blocker) RETURNING * INTO v_request;
  INSERT INTO public.privacy_request_events(request_id,actor_id,event_type,public_message) VALUES(p_id,auth.uid(),'submitted',CASE WHEN p_kind='deletion' THEN 'Your deletion request has been recorded. It has not erased your account yet.' ELSE 'Your account export was requested.' END);
  RETURN jsonb_build_object('id',v_request.id,'kind',v_request.kind,'status',v_request.status,'version',v_request.version,'blocker',v_request.blocker);
END; $$;
CREATE FUNCTION public.cancel_privacy_request(p_id UUID,p_expected_version INTEGER) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to cancel your request' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  IF v_request.status='cancelled' THEN RETURN; END IF;
  IF v_request.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Refresh your request' USING ERRCODE='40001'; END IF;
  IF v_request.status NOT IN ('submitted','blocked','reviewing') THEN RAISE EXCEPTION 'Contact privacy support about a request already being processed' USING ERRCODE='22023'; END IF;
  UPDATE public.privacy_requests SET status='cancelled',version=version+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.privacy_request_events(request_id,actor_id,event_type,public_message) VALUES(p_id,auth.uid(),'cancelled','You cancelled this request.');
END; $$;
CREATE FUNCTION public.my_privacy_request_events(p_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.privacy_requests WHERE id=p_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event_type',event_type,'message',public_message,'created_at',created_at) ORDER BY created_at,id) FROM public.privacy_request_events WHERE request_id=p_id),'[]'::jsonb);
END; $$;
CREATE FUNCTION public.privacy_export_sections() RETURNS TEXT[] LANGUAGE SQL IMMUTABLE SET search_path='' AS $$
  SELECT ARRAY['account','addresses','preferences','consent_history','quotes','orders','order_items','order_events','receipts','transactions','loyalty_ledger','reward_reservations','reward_events','notifications','devices','achievements','referral_codes','referrals','gifts','pos_links','pos_activity','staff_memberships','staff_invitations','access_history','privacy_requests']::text[]
$$;
-- Closed section list and field allowlists. Never export auth/QR/push secrets,
-- privileged configuration, another person's contacts, or internal audit notes.
CREATE FUNCTION public.privacy_export_rows(p_user UUID,p_section TEXT,p_after UUID,p_before TIMESTAMPTZ,p_limit INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_sql TEXT; v_rows JSONB;
BEGIN
  v_sql:=CASE p_section
    WHEN 'account' THEN $q$SELECT u.id,u.created_at,jsonb_build_object('id',u.id,'email',u.email,'email_confirmed_at',u.email_confirmed_at,'created_at',u.created_at,
      'full_name',p.full_name,'profile_email',p.email,'gaap_customer_id',p.gaap_customer_id,'avatar',u.raw_user_meta_data->>'avatar',
      'points',(SELECT jsonb_build_object('current',x.current_points::text,'earned',x.total_earned::text,'redeemed',x.total_redeemed::text,'held',x.reserved_points::text) FROM public.user_points x WHERE x.user_id=u.id),
      'roles',(SELECT jsonb_agg(role) FROM public.user_roles r WHERE r.user_id=u.id)) AS data FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE u.id=$1$q$
    WHEN 'addresses' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'address',address,'latitude',latitude,'longitude',longitude,'tag',tag,'created_at',created_at,'updated_at',updated_at) AS data FROM public.user_locations WHERE user_id=$1$q$
    WHEN 'preferences' THEN $q$SELECT user_id AS id,NULL::timestamptz AS created_at,jsonb_build_object('marketing_email',marketing_email,'notice_version',notice_version,'updated_at',updated_at) AS data FROM public.privacy_preferences WHERE user_id=$1$q$
    WHEN 'consent_history' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'marketing_email',marketing_email,'notice_version',notice_version,'created_at',created_at) AS data FROM public.privacy_consent_events WHERE user_id=$1$q$
    WHEN 'quotes' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'store_id',store_id,'request',request,'snapshot',snapshot,'expires_at',expires_at,'order_id',order_id,'created_at',created_at) AS data FROM public.cash_order_quotes WHERE user_id=$1$q$
    WHEN 'orders' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'status',status,'currency',currency,'total_amount',total_amount::text,'total_minor',total_minor::text,'subtotal_minor',subtotal_minor::text,'delivery_fee_minor',delivery_fee_minor::text,
      'contact',contact_snapshot,'delivery',delivery_snapshot,'branch',branch_snapshot,'payment_method',payment_method,'payment_status',payment_status,'fulfilment_mode',fulfilment_mode,'points_earned',points_earned,'points_reversed',points_reversed,'created_at',created_at,'updated_at',updated_at) AS data FROM public.orders WHERE user_id=$1$q$
    WHEN 'order_items' THEN $q$SELECT i.id,o.created_at,jsonb_build_object('id',i.id,'order_id',i.order_id,'name',i.item_name,'quantity',i.quantity,'unit_price',i.unit_price::text,'unit_price_minor',i.unit_price_minor::text,'line_total_minor',i.line_total_minor::text,'modifiers',i.modifiers_snapshot) AS data FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE o.user_id=$1$q$
    WHEN 'order_events' THEN $q$SELECT e.id,e.created_at,jsonb_build_object('id',e.id,'order_id',e.order_id,'status',e.status,'event_type',e.event_type,'created_at',e.created_at) AS data FROM public.order_status_events e JOIN public.orders o ON o.id=e.order_id WHERE o.user_id=$1$q$
    WHEN 'receipts' THEN $q$SELECT r.order_id AS id,r.created_at,jsonb_build_object('order_id',r.order_id,'sale_reference',r.sale_reference,'currency',r.currency,'amount_minor',r.amount_minor::text,'tendered_minor',r.tendered_minor::text,'change_minor',r.change_minor::text,'settled_at',r.settled_at,'created_at',r.created_at) AS data FROM public.cash_receipts r JOIN public.orders o ON o.id=r.order_id WHERE o.user_id=$1$q$
    WHEN 'transactions' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'type',transaction_type,'amount',amount::text,'amount_minor',amount_minor::text,'currency',currency,'points_earned',points_earned,'points_redeemed',points_redeemed,'items',items,'source',source,'order_id',order_id,'reservation_id',reservation_id,'created_at',created_at) AS data FROM public.transactions WHERE user_id=$1$q$
    WHEN 'loyalty_ledger' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'kind',kind,'points_delta',points_delta::text,'held_delta',reserved_delta::text,'redemption_points',redemption_points::text,'order_id',order_id,'reservation_id',reservation_id,'created_at',created_at) AS data FROM public.loyalty_ledger WHERE user_id=$1$q$
    WHEN 'reward_reservations' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'store_id',store_id,'offer_id',offer_id,'points_cost',points_cost,'snapshot',snapshot,'customer_name',customer_name,'status',status,'expires_at',expires_at,'created_at',created_at,'updated_at',updated_at) AS data FROM public.reward_reservations WHERE user_id=$1$q$
    WHEN 'reward_events' THEN $q$SELECT e.id,e.created_at,jsonb_build_object('id',e.id,'reservation_id',e.reservation_id,'event_type',e.event_type,'version',e.version,'created_at',e.created_at) AS data FROM public.reward_events e JOIN public.reward_reservations r ON r.id=e.reservation_id WHERE r.user_id=$1$q$
    WHEN 'notifications' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'title',title,'body',body,'sent_at',sent_at,'read_at',read_at,'delivery_status',delivery_status,'created_at',created_at) AS data FROM public.notifications WHERE sent_to=$1$q$
    WHEN 'devices' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'user_agent',user_agent,'created_at',created_at,'updated_at',updated_at) AS data FROM public.push_subscriptions WHERE user_id=$1$q$
    WHEN 'achievements' THEN $q$SELECT u.id,u.earned_at AS created_at,jsonb_build_object('id',u.id,'name',a.name,'description',a.description,'earned_at',u.earned_at) AS data FROM public.user_achievements u JOIN public.achievements a ON a.id=u.achievement_id WHERE u.user_id=$1$q$
    WHEN 'referral_codes' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'code',code,'created_at',created_at) AS data FROM public.referral_codes WHERE user_id=$1$q$
    WHEN 'referrals' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'direction',CASE WHEN referrer_id=$1 THEN 'referred_someone' ELSE 'was_referred' END,'points_awarded',points_awarded,'created_at',created_at) AS data FROM public.referrals WHERE referrer_id=$1 OR referred_id=$1$q$
    WHEN 'gifts' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'direction',CASE WHEN sender_id=$1 THEN 'sent' ELSE 'received' END,'points',points,'message',message,'status',status,'created_at',created_at) AS data FROM public.point_gifts WHERE sender_id=$1 OR recipient_id=$1$q$
    WHEN 'pos_links' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'customer_reference',gaap_customer_id,'phone',gaap_customer_phone,'email',gaap_customer_email,'verified',verified,'linked_at',linked_at,'last_synced_at',last_synced_at) AS data FROM public.gaap_customer_links WHERE user_id=$1$q$
    WHEN 'pos_activity' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'transaction_reference',gaap_transaction_id,'receipt_reference',gaap_receipt_number,'amount',transaction_amount::text,'points_awarded',points_awarded,'status',sync_status,'synced_at',synced_at,'created_at',created_at) AS data FROM public.gaap_sync_log WHERE user_id=$1$q$
    WHEN 'staff_memberships' THEN $q$SELECT store_id AS id,NULL::timestamptz AS created_at,jsonb_build_object('store_id',store_id,'active',active,'updated_at',updated_at) AS data FROM public.staff_memberships WHERE user_id=$1$q$
    WHEN 'staff_invitations' THEN $q$SELECT i.id,i.created_at,jsonb_build_object('id',i.id,'store_id',i.store_id,'email',i.email,'created_at',i.created_at,'expires_at',i.expires_at,'accepted_at',i.accepted_at,'revoked_at',i.revoked_at) AS data FROM public.staff_invitations i WHERE i.accepted_by=$1 OR i.email=(SELECT lower(email) FROM auth.users WHERE id=$1)$q$
    WHEN 'access_history' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'action',action,'was_actor',actor_id=$1,'was_subject',subject_id=$1,'created_at',created_at) AS data FROM public.identity_access_events WHERE actor_id=$1 OR subject_id=$1$q$
    WHEN 'privacy_requests' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'kind',kind,'status',status,'blocker',blocker,'created_at',created_at,'updated_at',updated_at,'completed_at',completed_at) AS data FROM public.privacy_requests WHERE user_id=$1$q$
    ELSE NULL END;
  IF v_sql IS NULL THEN RAISE EXCEPTION 'Unknown export section' USING ERRCODE='22023'; END IF;
  EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''key'',page.id,''data'',page.data) ORDER BY page.id),''[]''::jsonb) FROM (' ||
    'SELECT q.id,q.data FROM ('||v_sql||') q WHERE ($2 IS NULL OR q.id>$2) AND (q.created_at IS NULL OR q.created_at<=$3) ORDER BY q.id LIMIT $4) page'
    INTO v_rows USING p_user,p_after,p_before,p_limit;
  RETURN v_rows;
END; $$;
CREATE FUNCTION public.export_privacy_section(p_id UUID,p_section TEXT,p_after UUID DEFAULT NULL,p_limit INTEGER DEFAULT 100) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE; v_progress public.privacy_export_progress%ROWTYPE; v_rows JSONB; v_next UUID; v_more BOOLEAN;
BEGIN
  PERFORM public.privacy_recent_identity();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_section IS NULL OR NOT (p_section=ANY(public.privacy_export_sections())) THEN RAISE EXCEPTION 'Invalid export page' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND user_id=auth.uid() AND kind='export' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501'; END IF;
  IF v_request.status NOT IN ('submitted','processing') THEN RAISE EXCEPTION 'Request a fresh export' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_progress FROM public.privacy_export_progress WHERE request_id=p_id AND section=p_section;
  IF NOT FOUND THEN
    IF p_after IS NOT NULL THEN RAISE EXCEPTION 'Start at the first export page' USING ERRCODE='22023'; END IF;
    INSERT INTO public.privacy_export_progress(request_id,section) VALUES(p_id,p_section) RETURNING * INTO v_progress;
  ELSIF (v_progress.finished AND p_after IS DISTINCT FROM v_progress.previous_cursor) OR
    (p_after IS DISTINCT FROM v_progress.cursor AND p_after IS DISTINCT FROM v_progress.previous_cursor) THEN RAISE EXCEPTION 'Export cursor changed' USING ERRCODE='22023'; END IF;
  v_rows:=public.privacy_export_rows(auth.uid(),p_section,p_after,v_request.created_at,p_limit+1);
  v_more:=jsonb_array_length(v_rows)>p_limit;
  IF v_more THEN v_rows:=v_rows- p_limit; v_next:=(v_rows->(p_limit-1)->>'key')::uuid; END IF;
  -- A replay of the immediately previous page must not regress progress.
  IF p_after IS NOT DISTINCT FROM v_progress.cursor THEN
    UPDATE public.privacy_export_progress SET previous_cursor=p_after,cursor=v_next,finished=NOT v_more WHERE request_id=p_id AND section=p_section;
  END IF;
  UPDATE public.privacy_requests SET status='processing',updated_at=now() WHERE id=p_id;
  RETURN jsonb_build_object('section',p_section,'rows',coalesce((SELECT jsonb_agg(value->'data') FROM jsonb_array_elements(v_rows)),'[]'::jsonb),'next_cursor',v_next,'generated_at',now(),'created_before',v_request.created_at);
END; $$;
CREATE FUNCTION public.finish_privacy_export(p_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE;
BEGIN
  PERFORM public.privacy_recent_identity();
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND user_id=auth.uid() AND kind='export' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501'; END IF;
  IF v_request.status='completed' THEN RETURN; END IF;
  IF v_request.status NOT IN ('submitted','processing') OR EXISTS (SELECT 1 FROM unnest(public.privacy_export_sections()) AS expected(section_name)
    WHERE NOT EXISTS (SELECT 1 FROM public.privacy_export_progress p WHERE p.request_id=p_id AND p.section=expected.section_name AND finished))
    THEN RAISE EXCEPTION 'Read every export section before completing it' USING ERRCODE='22023'; END IF;
  UPDATE public.privacy_requests SET status='completed',version=version+1,completed_at=now(),updated_at=now() WHERE id=p_id;
  INSERT INTO public.privacy_request_events(request_id,actor_id,event_type,public_message) VALUES(p_id,auth.uid(),'export_prepared','Your account export was prepared. Keep the downloaded file private.');
END; $$;
CREATE FUNCTION public.privacy_account_live() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.privacy_requests WHERE user_id=auth.uid() AND kind='deletion' AND status='completed')
$$;
CREATE FUNCTION public.account_privacy_state() RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('deleted',NOT public.privacy_account_live(),'deletion_in_progress',EXISTS (SELECT 1 FROM public.privacy_requests WHERE user_id=auth.uid() AND kind='deletion' AND status='processing'))
$$;
CREATE FUNCTION public.privacy_assert_account_available() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy-business:'||auth.uid(),0));
  IF EXISTS (SELECT 1 FROM public.privacy_requests WHERE user_id=auth.uid() AND kind='deletion' AND status IN ('processing','completed'))
    THEN RAISE EXCEPTION 'Account deletion is being processed; contact privacy support' USING ERRCODE='42501'; END IF;
END; $$;
CREATE FUNCTION public.review_privacy_deletion(p_id UUID,p_expected_version INTEGER,p_action TEXT,p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE; v_blocker TEXT; v_user UUID; v_notice TEXT; v_retention TEXT;
BEGIN
  IF NOT public.privacy_is_reviewer() THEN RAISE EXCEPTION 'Assigned privacy reviewer with administrator MFA required' USING ERRCODE='42501'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('review','start','pause','resume') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Provide an action and review reason' USING ERRCODE='22023'; END IF;
  SELECT user_id INTO v_user FROM public.privacy_requests WHERE id=p_id AND kind='deletion';
  IF v_user IS NULL OR v_user=auth.uid() THEN RAISE EXCEPTION 'Another reviewer must handle this request' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy-business:'||v_user,0));
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND kind='deletion' FOR UPDATE;
  IF v_request.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Refresh this request before changing it' USING ERRCODE='40001'; END IF;
  IF v_request.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Request is closed' USING ERRCODE='22023'; END IF;
  IF p_action='review' THEN
    IF v_request.status='processing' THEN RAISE EXCEPTION 'Use pause for an in-progress request' USING ERRCODE='22023'; END IF;
    UPDATE public.privacy_requests SET status='reviewing',version=version+1,reviewed_by=auth.uid(),updated_at=now() WHERE id=p_id;
  ELSIF p_action='pause' THEN
    -- Pausing does not reactivate a partially erased account or permit trading.
    IF v_request.status<>'processing' THEN RAISE EXCEPTION 'Only processing requests can be paused' USING ERRCODE='22023'; END IF;
    UPDATE public.privacy_requests SET blocker='operator_review',version=version+1,updated_at=now() WHERE id=p_id;
  ELSIF p_action='resume' THEN
    IF v_request.status<>'processing' THEN RAISE EXCEPTION 'Only a processing request can be resumed' USING ERRCODE='22023'; END IF;
    v_blocker:=public.privacy_deletion_blocker(v_user);
    SELECT active_notice_version,retention_policy_version INTO v_notice,v_retention FROM public.privacy_settings WHERE singleton;
    IF v_blocker IS NULL AND (v_request.notice_version IS DISTINCT FROM v_notice OR v_request.retention_policy_version IS DISTINCT FROM v_retention) THEN
      UPDATE public.privacy_request_tasks SET status='pending',evidence_reference=NULL,recorded_by=NULL,recorded_at=NULL WHERE request_id=p_id;
    END IF;
    UPDATE public.privacy_requests SET blocker=v_blocker,version=version+1,updated_at=now(),
      notice_version=CASE WHEN v_blocker IS NULL THEN v_notice ELSE notice_version END,
      retention_policy_version=CASE WHEN v_blocker IS NULL THEN v_retention ELSE retention_policy_version END WHERE id=p_id;
  ELSE
    IF v_request.status='processing' THEN RAISE EXCEPTION 'Request is already processing' USING ERRCODE='22023'; END IF;
    v_blocker:=public.privacy_deletion_blocker(v_user);
    SELECT active_notice_version,retention_policy_version INTO v_notice,v_retention FROM public.privacy_settings WHERE singleton;
    UPDATE public.privacy_requests SET status=CASE WHEN v_blocker IS NULL THEN 'processing' ELSE 'blocked' END,
      blocker=v_blocker,reviewed_by=auth.uid(),notice_version=CASE WHEN v_blocker IS NULL THEN v_notice END,
      retention_policy_version=CASE WHEN v_blocker IS NULL THEN v_retention END,version=version+1,updated_at=now() WHERE id=p_id;
    IF v_blocker IS NULL THEN
      INSERT INTO public.privacy_request_tasks(request_id,system) SELECT p_id,unnest(ARRAY['application','authentication','gaap','email','monitoring','backups']) ON CONFLICT DO NOTHING;
      UPDATE public.privacy_preferences SET marketing_email=false,updated_at=now() WHERE user_id=v_user;
      UPDATE public.staff_invitations SET revoked_at=now() WHERE revoked_at IS NULL AND email=(SELECT lower(email) FROM auth.users WHERE id=v_user);
    END IF;
  END IF;
  INSERT INTO public.privacy_request_events(request_id,actor_id,event_type,public_message,details) VALUES(p_id,auth.uid(),p_action,
    CASE p_action WHEN 'review' THEN 'The privacy team is reviewing your request.' WHEN 'pause' THEN 'Processing needs further review; contact the privacy team for an update.' WHEN 'resume' THEN CASE WHEN v_blocker IS NULL THEN 'Processing was reviewed and resumed.' ELSE 'Processing still needs further review.' END ELSE CASE WHEN v_blocker IS NULL THEN 'Deletion processing has started. New orders and reward reservations are paused for this account.' ELSE 'Your request is recorded and needs further review before processing.' END END,
    jsonb_build_object('reason',btrim(p_reason)));
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id;
  RETURN jsonb_build_object('id',v_request.id,'status',v_request.status,'version',v_request.version,'blocker',v_request.blocker);
END; $$;
CREATE FUNCTION public.privacy_review_queue(p_before TIMESTAMPTZ DEFAULT NULL,p_limit INTEGER DEFAULT 50,p_before_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.privacy_is_reviewer() THEN RAISE EXCEPTION 'Assigned privacy reviewer with administrator MFA required' USING ERRCODE='42501'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid request limit' USING ERRCODE='22023'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'kind',r.kind,'status',r.status,'version',r.version,'blocker',r.blocker,'created_at',r.created_at,
    'tasks',(SELECT coalesce(jsonb_agg(jsonb_build_object('system',t.system,'status',t.status,'evidence_reference',t.evidence_reference,'recorded_at',t.recorded_at)),'[]'::jsonb) FROM public.privacy_request_tasks t WHERE t.request_id=r.id)) ORDER BY r.created_at DESC,r.id)
    FROM (SELECT * FROM public.privacy_requests WHERE kind='deletion' AND status NOT IN ('completed','cancelled') AND (p_before IS NULL OR created_at<p_before OR (created_at=p_before AND p_before_id IS NOT NULL AND id>p_before_id)) ORDER BY created_at DESC,id LIMIT p_limit) r),'[]'::jsonb);
END; $$;
-- Processing evidence is recorded only by a server-side operator. It does not
-- perform deletion or call vendors; the reviewed runbook supplies that work.
CREATE FUNCTION public.record_privacy_task(p_id UUID,p_system TEXT,p_status TEXT,p_evidence TEXT,p_operator TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND kind='deletion' FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'processing' OR v_request.blocker IS NOT NULL THEN RAISE EXCEPTION 'Request is not approved for processing' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.privacy_settings WHERE singleton AND deletion_processing_enabled AND active_notice_version=v_request.notice_version AND retention_policy_version=v_request.retention_policy_version)
    THEN RAISE EXCEPTION 'Privacy approvals changed; reviewer must reassess' USING ERRCODE='42501'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('completed','not_applicable') OR p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 3 AND 500 OR p_operator IS NULL OR length(btrim(p_operator)) NOT BETWEEN 3 AND 160
    OR (p_system IN ('application','authentication') AND p_status<>'completed') THEN RAISE EXCEPTION 'Provide an actual completion record and operator' USING ERRCODE='22023'; END IF;
  UPDATE public.privacy_request_tasks SET status=p_status,evidence_reference=btrim(p_evidence),recorded_by=btrim(p_operator),recorded_at=now() WHERE request_id=p_id AND system=p_system;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown privacy system' USING ERRCODE='22023'; END IF;
  INSERT INTO public.privacy_request_events(request_id,event_type,public_message,details) VALUES(p_id,'task_recorded','Processing is in progress.',jsonb_build_object('system',p_system,'status',p_status,'evidence',btrim(p_evidence),'operator',btrim(p_operator)));
END; $$;
CREATE FUNCTION public.complete_privacy_deletion(p_id UUID,p_expected_version INTEGER,p_completion_reference TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE; v_user UUID;
BEGIN
  SELECT user_id INTO v_user FROM public.privacy_requests WHERE id=p_id AND kind='deletion';
  IF v_user IS NULL THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy-business:'||v_user,0));
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND kind='deletion' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='22023'; END IF;
  IF v_request.status='completed' THEN RETURN; END IF;
  IF v_request.version IS DISTINCT FROM p_expected_version OR v_request.status<>'processing' OR v_request.blocker IS NOT NULL THEN RAISE EXCEPTION 'Request must be reviewed before completion' USING ERRCODE='40001'; END IF;
  IF p_completion_reference IS NULL OR length(btrim(p_completion_reference)) NOT BETWEEN 3 AND 500 OR
    NOT EXISTS (SELECT 1 FROM public.privacy_settings WHERE singleton AND deletion_processing_enabled AND active_notice_version=v_request.notice_version AND retention_policy_version=v_request.retention_policy_version)
    THEN RAISE EXCEPTION 'Approved policy and completion evidence required' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.privacy_request_tasks WHERE request_id=p_id)<>6 OR EXISTS (SELECT 1 FROM public.privacy_request_tasks WHERE request_id=p_id AND status='pending')
    THEN RAISE EXCEPTION 'Complete every system task first' USING ERRCODE='22023'; END IF;
  -- These checks catch obvious incomplete erasure; the signed policy/runbook
  -- and external receipts remain necessary for unstructured/retained records.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=v_request.user_id AND deleted_at IS NOT NULL) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id=v_request.user_id AND (email IS NOT NULL OR full_name IS NOT NULL OR gaap_customer_id IS NOT NULL)) OR
    EXISTS (SELECT 1 FROM public.user_locations WHERE user_id=v_request.user_id) OR
    EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id=v_request.user_id) OR
    EXISTS (SELECT 1 FROM public.gaap_customer_links WHERE user_id=v_request.user_id) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_request.user_id AND role IN ('staff','admin')) OR
    EXISTS (SELECT 1 FROM public.orders WHERE user_id=v_request.user_id AND (status NOT IN ('completed','cancelled') OR cash_custody_status IN ('held','handover_pending'))) OR
    EXISTS (SELECT 1 FROM public.cash_receipts WHERE (current_holder_id=v_request.user_id OR pending_receiver_id=v_request.user_id) AND settled_at IS NULL) OR
    EXISTS (SELECT 1 FROM public.reward_reservations WHERE (user_id=v_request.user_id OR claimed_by=v_request.user_id) AND status IN ('reserved','claiming'))
    THEN RAISE EXCEPTION 'Account erasure or operational reconciliation is incomplete' USING ERRCODE='22023'; END IF;
  UPDATE public.privacy_requests SET status='completed',version=version+1,updated_at=now(),completed_at=now() WHERE id=p_id;
  INSERT INTO public.privacy_request_events(request_id,event_type,public_message,details) VALUES(p_id,'deletion_completed','Your account deletion has been completed under the approved retention policy.',jsonb_build_object('completion_reference',btrim(p_completion_reference)));
END; $$;
CREATE FUNCTION public.privacy_marketing_recipients(p_after UUID DEFAULT NULL,p_limit INTEGER DEFAULT 100) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid recipient page size' USING ERRCODE='22023'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(recipient) ORDER BY recipient.user_id) FROM (
  SELECT u.id AS user_id,u.email,p.full_name FROM auth.users u JOIN public.privacy_preferences pref ON pref.user_id=u.id
    LEFT JOIN public.profiles p ON p.id=u.id JOIN public.privacy_settings s ON s.singleton
  WHERE pref.marketing_email AND pref.notice_version=s.active_notice_version AND s.active_notice_version IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (p_after IS NULL OR u.id>p_after) AND NOT EXISTS (SELECT 1 FROM public.privacy_requests r WHERE r.user_id=u.id AND r.kind='deletion' AND r.status IN ('processing','completed'))
    ORDER BY u.id LIMIT p_limit) recipient),'[]'::jsonb);
END;
$$;
-- Apply a tombstone boundary to direct reads/writes, including legacy policies.
-- Requests are not tombstones: customers may still use their account until
-- processing starts; retained fiscal/ledger records are not cascade-deleted.
GRANT EXECUTE ON FUNCTION public.privacy_account_live() TO anon,authenticated;
DO $$ DECLARE t RECORD; f TEXT; v_definition TEXT; v_position INTEGER; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('CREATE POLICY "Privacy account boundary" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.privacy_account_live()) WITH CHECK (public.privacy_account_live())',t.tablename);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.quote_cash_order(jsonb)','public.place_cash_order(uuid,uuid)','public.reserve_reward(uuid,uuid)','public.get_my_reward_ticket(uuid)','public.operate_reward_reservation(uuid,uuid,integer,text,jsonb)','public.accept_staff_invitation(uuid)'] LOOP
    v_definition:=pg_get_functiondef(f::regprocedure);
    v_position:=position(E'BEGIN\n' IN v_definition);
    IF v_position=0 THEN RAISE EXCEPTION 'Privacy entrypoint guard placement drift: %',f; END IF;
    EXECUTE overlay(v_definition PLACING E'BEGIN\n  PERFORM public.privacy_assert_account_available();\n' FROM v_position FOR length(E'BEGIN\n'));
  END LOOP;
END; $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID,_role public.app_role) RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.privacy_account_live() AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=_user_id AND r.role=_role)
    AND (_role='user' OR (_user_id=auth.uid() AND public.identity_aal2() AND (_role<>'staff' OR EXISTS (SELECT 1 FROM public.staff_memberships m WHERE m.user_id=_user_id AND m.active))))
$$;
CREATE OR REPLACE FUNCTION public.cash_staff_access(p_store UUID,p_actor UUID) RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_actor=auth.uid() AND public.privacy_account_live() AND public.identity_aal2() AND public.staff_assignment(p_store,p_actor)
$$;
GRANT EXECUTE ON FUNCTION public.account_privacy_state(),public.set_privacy_marketing(UUID,BOOLEAN,TEXT),public.submit_privacy_request(UUID,TEXT),
  public.cancel_privacy_request(UUID,INTEGER),public.my_privacy_request_events(UUID),public.privacy_export_sections(),
  public.export_privacy_section(UUID,TEXT,UUID,INTEGER),public.finish_privacy_export(UUID),public.privacy_is_reviewer(),
  public.review_privacy_deletion(UUID,INTEGER,TEXT,TEXT),public.privacy_review_queue(TIMESTAMPTZ,INTEGER,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_privacy_task(UUID,TEXT,TEXT,TEXT,TEXT),public.complete_privacy_deletion(UUID,INTEGER,TEXT),public.privacy_marketing_recipients(UUID,INTEGER) TO service_role;
CREATE FUNCTION public.restart_privacy_export(p_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_requests%ROWTYPE;
BEGIN
  PERFORM public.privacy_recent_identity();
  SELECT * INTO v_request FROM public.privacy_requests WHERE id=p_id AND user_id=auth.uid() AND kind='export' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501'; END IF;
  IF v_request.status NOT IN ('submitted','processing') THEN RAISE EXCEPTION 'Request a fresh export' USING ERRCODE='22023'; END IF;
  DELETE FROM public.privacy_export_progress WHERE request_id=p_id;
  UPDATE public.privacy_requests SET status='submitted',version=version+1,updated_at=now() WHERE id=p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.restart_privacy_export(UUID) TO authenticated;
-- Live grants may not restore a processing/deleted account's staff authority.
CREATE FUNCTION public.privacy_assert_target_available(p_user UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy-business:'||p_user,0));
  IF EXISTS (SELECT 1 FROM public.privacy_requests WHERE user_id=p_user AND kind='deletion' AND status IN ('processing','completed')) THEN RAISE EXCEPTION 'Account deletion must be resolved before changing access' USING ERRCODE='42501'; END IF;
END; $$;
DO $$ DECLARE v_definition TEXT; v_position INTEGER; BEGIN
  v_definition:=pg_get_functiondef('public.set_identity_access(uuid,public.app_role,uuid[],text)'::regprocedure);
  v_position:=position(E'BEGIN\n' IN v_definition);
  IF v_position=0 THEN RAISE EXCEPTION 'Identity target guard placement drift'; END IF;
  EXECUTE overlay(v_definition PLACING E'BEGIN\n  PERFORM public.privacy_assert_target_available(p_user_id);\n' FROM v_position FOR length(E'BEGIN\n'));
END; $$;
-- Reviewer identities and internal task/audit notes are not customer columns.
REVOKE SELECT ON public.privacy_requests FROM authenticated;
GRANT SELECT(id,user_id,kind,status,version,blocker,created_at,updated_at,completed_at) ON public.privacy_requests TO authenticated;
-- A published notice is public; internal legal approval references/identities
-- and processing control flags are not part of the public endpoint.
REVOKE SELECT ON public.privacy_notices,public.privacy_settings FROM anon,authenticated;
GRANT SELECT(version,controller_name,body,support_email,approved_at) ON public.privacy_notices TO anon,authenticated;
GRANT SELECT(support_email,active_notice_version) ON public.privacy_settings TO anon,authenticated;
-- Explicitly protect raw export helpers and operator APIs even if a deployed
-- role's default function privileges differ from the clean baseline.
REVOKE ALL ON FUNCTION public.privacy_recent_identity(),public.privacy_deletion_blocker(UUID),
  public.privacy_export_rows(UUID,TEXT,UUID,TIMESTAMPTZ,INTEGER),public.privacy_assert_account_available(),
  public.privacy_assert_target_available(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.record_privacy_task(UUID,TEXT,TEXT,TEXT,TEXT),
  public.complete_privacy_deletion(UUID,INTEGER,TEXT),public.privacy_marketing_recipients(UUID,INTEGER) FROM PUBLIC,anon,authenticated;
-- Freeze direct application writes too, so a stale client cannot recreate
-- contacts after operator scrubbing. VOLATILE rechecks after the account lock.
CREATE FUNCTION public.privacy_account_mutable() RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('privacy-business:'||auth.uid(),0));
  RETURN NOT EXISTS (SELECT 1 FROM public.privacy_requests WHERE user_id=auth.uid() AND kind='deletion' AND status IN ('processing','completed'));
END; $$;
GRANT EXECUTE ON FUNCTION public.privacy_account_mutable() TO authenticated;
DO $$ DECLARE t RECORD; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('CREATE POLICY "Privacy account insert boundary" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.privacy_account_mutable())',t.tablename);
    EXECUTE format('CREATE POLICY "Privacy account update boundary" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.privacy_account_mutable()) WITH CHECK (public.privacy_account_mutable())',t.tablename);
    EXECUTE format('CREATE POLICY "Privacy account delete boundary" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.privacy_account_mutable())',t.tablename);
  END LOOP;
END; $$;

-- Disabled until named owners approve retention/field coverage and an actual
-- provider-revocation procedure. Never seed policy or erase data in migration.
CREATE TABLE public.privacy_application_policies (
  version TEXT PRIMARY KEY,
  retention_version TEXT NOT NULL REFERENCES public.privacy_retention_approvals(version),
  schema_fingerprint TEXT NOT NULL CHECK(schema_fingerprint~'^[a-f0-9]{64}$'),
  operation_version TEXT NOT NULL CHECK(operation_version='core-contact-v1'),
  field_decisions JSONB NOT NULL,
  approval_reference TEXT NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 3 AND 500),
  approved_by TEXT NOT NULL CHECK(length(btrim(approved_by)) BETWEEN 3 AND 160),
  approved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>approved_at)
);
ALTER TABLE public.privacy_settings
  ADD COLUMN application_erasure_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN application_policy_version TEXT REFERENCES public.privacy_application_policies(version),
  ADD CHECK(NOT application_erasure_enabled OR application_policy_version IS NOT NULL);
CREATE TABLE public.privacy_application_runs (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.privacy_requests(id),
  request_version INTEGER NOT NULL,
  policy_version TEXT NOT NULL REFERENCES public.privacy_application_policies(version),
  policy_fingerprint TEXT NOT NULL,
  financial_fingerprint TEXT NOT NULL,
  operator_reference TEXT NOT NULL,
  row_limit INTEGER NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  manual_reference TEXT,
  manual_operator TEXT,
  manual_at TIMESTAMPTZ,
  UNIQUE(request_id,request_version,policy_version)
);
-- Transaction-local capability, never writable through an API role. No GUC,
-- trigger-disable, arbitrary SQL, row-filter or table-name parameter is used.
CREATE TABLE public.privacy_application_context (
  transaction_id BIGINT PRIMARY KEY,
  backend_id INTEGER NOT NULL,
  request_id UUID NOT NULL REFERENCES public.privacy_requests(id)
);
DO $$ DECLARE t TEXT;BEGIN
 FOREACH t IN ARRAY ARRAY['privacy_application_policies','privacy_application_runs','privacy_application_context'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END; $$;
CREATE TRIGGER immutable_privacy_application_policy BEFORE UPDATE OR DELETE ON public.privacy_application_policies
 FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE FUNCTION public.protect_privacy_application_run() RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['manual_reference','manual_operator','manual_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['manual_reference','manual_operator','manual_at']) OR OLD.manual_at IS NOT NULL THEN
  RAISE EXCEPTION 'Application erasure receipts are immutable' USING ERRCODE='42501';END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER immutable_privacy_application_run BEFORE UPDATE OR DELETE ON public.privacy_application_runs
 FOR EACH ROW EXECUTE FUNCTION public.protect_privacy_application_run();

CREATE FUNCTION public.privacy_application_schema() RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(string_agg(table_name||'.'||column_name,E'\n' ORDER BY table_name,ordinal_position),'UTF8')),'hex')
 FROM information_schema.columns WHERE table_schema='public'
$$;
CREATE FUNCTION public.privacy_core_fields() RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v JSONB:='{"profiles":["email","full_name","gaap_customer_id"],"orders":["contact_snapshot","delivery_snapshot"],"cash_order_quotes":["request","snapshot"],"reward_reservations":["customer_name"],"gaap_sync_log":["raw_payload","error_message","line_items"],"point_gifts":["message"],"staff_invitations":["email","reason"],"privacy_preferences":["marketing_email"]}';t TEXT;
BEGIN
 FOREACH t IN ARRAY ARRAY['user_locations','gaap_customer_links','push_subscriptions','notification_events','push_devices','push_deliveries','push_delivery_results','notifications','reward_claim_secrets','privacy_export_progress'] LOOP
  v:=v||jsonb_build_object(t,(SELECT jsonb_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name=t));
 END LOOP;RETURN v;
END; $$;
CREATE FUNCTION public.validate_privacy_application_policy(p_version TEXT) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.privacy_application_policies%ROWTYPE;c RECORD;d JSONB;v_core JSONB:=public.privacy_core_fields();v_end TIMESTAMPTZ;
BEGIN
 SELECT * INTO p FROM public.privacy_application_policies WHERE version=p_version;
 IF NOT FOUND OR p.schema_fingerprint IS DISTINCT FROM public.privacy_application_schema() OR p.approved_at>clock_timestamp() OR p.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'Current approved application policy and exact schema coverage required' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p.field_decisions)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p.field_decisions))<>(SELECT count(*) FROM information_schema.columns WHERE table_schema='public') THEN
  RAISE EXCEPTION 'Every public field needs an explicit reviewed decision' USING ERRCODE='22023';END IF;
 FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' LOOP
  d:=p.field_decisions->(c.table_name||'.'||c.column_name);
  IF d IS NULL OR jsonb_typeof(d) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(d))<>3 OR jsonb_typeof(d->'action') IS DISTINCT FROM 'string' OR
   jsonb_typeof(d->'reason_reference') IS DISTINCT FROM 'string' OR length(btrim(d->>'reason_reference')) NOT BETWEEN 3 AND 500 OR NOT(d?'retain_until') THEN
   RAISE EXCEPTION 'Invalid field review coverage' USING ERRCODE='22023';END IF;
  IF coalesce((v_core->c.table_name)?c.column_name,false) THEN
   IF d->>'action'<>'core' OR d->'retain_until'<>'null'::jsonb THEN RAISE EXCEPTION 'Core fields must use the documented core operation' USING ERRCODE='22023';END IF;
  ELSIF d->>'action' IN ('retain','manual') THEN
   IF jsonb_typeof(d->'retain_until')<>'string' THEN RAISE EXCEPTION 'Approved retained/manual records need a deadline' USING ERRCODE='22023';END IF;
   v_end:=(d->>'retain_until')::timestamptz;
   IF NOT isfinite(v_end) OR v_end<=clock_timestamp() THEN RAISE EXCEPTION 'Retained record review deadline is overdue' USING ERRCODE='42501';END IF;
  ELSIF d->>'action'='not_subject' AND c.table_name IN ('achievements','menu_categories','menu_items','menu_item_options','menu_item_option_choices','stores','rewards','cash_delivery_zones','cash_order_settings','cash_loyalty_rules','branch_menu_availability','reward_branch_offers','reward_branch_settings','push_settings') AND d->'retain_until'='null'::jsonb THEN
   NULL;
  ELSE RAISE EXCEPTION 'No erasure implementation or retention decision for a field' USING ERRCODE='22023';END IF;
 END LOOP;
 RETURN encode(sha256(convert_to(jsonb_build_object('version',p.version,'retention',p.retention_version,'schema',p.schema_fingerprint,'operation',p.operation_version,
  'decisions',p.field_decisions,'approval',p.approval_reference,'approver',p.approved_by,'approved_epoch',extract(epoch FROM p.approved_at)::text,'expires_epoch',extract(epoch FROM p.expires_at)::text)::text,'UTF8')),'hex');
END; $$;

CREATE FUNCTION public.privacy_core_request(p_request UUID,p_expected INTEGER,p_policy TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.privacy_requests%ROWTYPE;s public.privacy_settings%ROWTYPE;h TEXT;u UUID;b TEXT;
BEGIN
 SELECT user_id INTO u FROM public.privacy_requests WHERE id=p_request AND kind='deletion';
 IF u IS NULL THEN RAISE EXCEPTION 'Deletion request unavailable' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('privacy-business:'||u,0));
 SELECT * INTO r FROM public.privacy_requests WHERE id=p_request FOR UPDATE;
 SELECT * INTO s FROM public.privacy_settings WHERE singleton FOR SHARE;
 IF r.version IS DISTINCT FROM p_expected OR r.status<>'processing' OR r.blocker IS NOT NULL THEN RAISE EXCEPTION 'Reviewer must reassess this processing case' USING ERRCODE='40001';END IF;
 IF NOT s.deletion_processing_enabled OR NOT s.application_erasure_enabled OR s.application_policy_version IS DISTINCT FROM p_policy OR
  s.active_notice_version IS DISTINCT FROM r.notice_version OR s.retention_policy_version IS DISTINCT FROM r.retention_policy_version OR
  NOT EXISTS(SELECT 1 FROM public.privacy_application_policies WHERE version=p_policy AND retention_version=r.retention_policy_version) THEN
  RAISE EXCEPTION 'Application erasure is disabled or approvals changed' USING ERRCODE='42501';END IF;
 h:=public.validate_privacy_application_policy(p_policy);
 b:=public.privacy_deletion_blocker(u);
 IF b IS NOT NULL THEN RAISE EXCEPTION 'Operational or policy obligations remain' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND deleted_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Revoke provider access and confirm provider deletion before application minimisation' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('user_id',u,'policy_fingerprint',h);
END; $$;

CREATE FUNCTION public.privacy_financial_fingerprint(p_user UUID) RETURNS TEXT LANGUAGE SQL VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object(
  'orders',(SELECT jsonb_agg(to_jsonb(o)-ARRAY['contact_snapshot','delivery_snapshot','updated_at'] ORDER BY id) FROM public.orders o WHERE user_id=p_user),
  'quotes',(SELECT jsonb_agg((to_jsonb(q)-ARRAY['request','snapshot'])||jsonb_build_object('snapshot',snapshot-ARRAY['contact','address']) ORDER BY id) FROM public.cash_order_quotes q WHERE user_id=p_user),
  'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE o.user_id=p_user),
  'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.order_id) FROM public.cash_receipts r JOIN public.orders o ON o.id=r.order_id WHERE o.user_id=p_user OR r.received_by=p_user OR r.current_holder_id=p_user),
  'movements',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.cash_movements m WHERE actor_id=p_user OR order_id IN(SELECT id FROM public.orders WHERE user_id=p_user)),
  'fiscal',(SELECT jsonb_agg(to_jsonb(f) ORDER BY store_id,document_type,reference) FROM public.branch_fiscal_references f WHERE cash_order_id IN(SELECT id FROM public.orders WHERE user_id=p_user) OR reward_reservation_id IN(SELECT id FROM public.reward_reservations WHERE user_id=p_user)),
  'ledger',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM public.loyalty_ledger l WHERE user_id=p_user OR actor_id=p_user),
  'accounts',(SELECT to_jsonb(a) FROM public.loyalty_accounts a WHERE user_id=p_user),
  'points',(SELECT to_jsonb(p) FROM public.user_points p WHERE user_id=p_user),
  'reward_reservations',(SELECT jsonb_agg(to_jsonb(r)-ARRAY['customer_name','updated_at'] ORDER BY id) FROM public.reward_reservations r WHERE user_id=p_user),
  'reward_fulfilments',(SELECT jsonb_agg(to_jsonb(f) ORDER BY reservation_id) FROM public.reward_fulfilments f WHERE actor_id=p_user OR reservation_id IN(SELECT id FROM public.reward_reservations WHERE user_id=p_user)),
  'reward_voids',(SELECT jsonb_agg(to_jsonb(v) ORDER BY reservation_id) FROM public.reward_voids v WHERE actor_id=p_user OR reservation_id IN(SELECT id FROM public.reward_reservations WHERE user_id=p_user)),
  'finance',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.finance_reconciliations f WHERE submitted_by=p_user OR reviewed_by=p_user)
 )::text,'UTF8')),'hex')
$$;

CREATE FUNCTION public.privacy_push_purge_allowed(p_delivery UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.privacy_application_context c JOIN public.privacy_requests r ON r.id=c.request_id
  JOIN public.push_deliveries j ON j.id=p_delivery JOIN public.push_devices d ON d.id=j.device_id JOIN public.notification_events e ON e.id=j.event_id
  WHERE c.transaction_id=txid_current() AND c.backend_id=pg_backend_pid() AND r.status='processing' AND r.blocker IS NULL
    AND (d.user_id=r.user_id OR e.recipient_id=r.user_id) AND j.state IN ('provider_accepted','failed','cancelled','expired'))
$$;
CREATE OR REPLACE FUNCTION public.protect_identity_audit() RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' AND TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='push_delivery_results' THEN
  IF public.privacy_push_purge_allowed(OLD.delivery_id) THEN RETURN OLD;END IF;
 END IF;
 RAISE EXCEPTION 'Identity access audit is immutable' USING ERRCODE='42501';
END; $$;

-- A prior receipt is not proof that a privileged/background writer has not
-- reintroduced mutable core contacts since the run. Check them again at every
-- evidence/completion boundary; arbitrary residual text still needs review.
CREATE FUNCTION public.privacy_core_clean(p_user UUID) RETURNS BOOLEAN
LANGUAGE SQL VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user AND (email IS NOT NULL OR full_name IS NOT NULL OR gaap_customer_id IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM public.orders WHERE user_id=p_user AND (contact_snapshot IS DISTINCT FROM CASE WHEN quote_id IS NULL THEN NULL::jsonb ELSE '{}'::jsonb END OR delivery_snapshot IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM public.cash_order_quotes WHERE user_id=p_user AND (request<>'{}'::jsonb OR snapshot?'contact' OR snapshot?'address'))
 AND NOT EXISTS(SELECT 1 FROM public.reward_reservations WHERE user_id=p_user AND customer_name IS DISTINCT FROM '[Deleted]')
 AND NOT EXISTS(SELECT 1 FROM public.gaap_sync_log WHERE user_id=p_user AND (raw_payload IS DISTINCT FROM '{}'::jsonb OR line_items IS DISTINCT FROM '[]'::jsonb OR error_message IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM public.point_gifts WHERE (sender_id=p_user OR recipient_id=p_user) AND message IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.staff_invitations WHERE accepted_by=p_user AND (email IS DISTINCT FROM 'deleted-'||p_user||'@invalid.test' OR reason IS DISTINCT FROM '[Deleted]'))
 AND NOT EXISTS(SELECT 1 FROM public.privacy_preferences WHERE user_id=p_user AND marketing_email)
 AND NOT EXISTS(SELECT 1 FROM public.user_locations WHERE user_id=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.gaap_customer_links WHERE user_id=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.push_subscriptions WHERE user_id=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.push_devices WHERE user_id=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.notification_events WHERE recipient_id=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.notifications WHERE sent_to=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.reward_claim_secrets s JOIN public.reward_reservations r ON r.id=s.reservation_id WHERE r.user_id=p_user)
 AND NOT EXISTS(SELECT 1 FROM public.privacy_export_progress p JOIN public.privacy_requests r ON r.id=p.request_id WHERE r.user_id=p_user)
$$;

CREATE FUNCTION public.minimize_privacy_application(p_request UUID,p_expected_version INTEGER,p_policy TEXT,p_run UUID,p_operator TEXT,p_row_limit INTEGER DEFAULT 10000) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE gate JSONB;u UUID;old public.privacy_application_runs%ROWTYPE;before_hash TEXT;after_hash TEXT;counts JSONB:='{}';n BIGINT;total BIGINT:=0;v_result JSONB;
BEGIN
 IF p_run IS NULL OR p_operator IS NULL OR length(btrim(p_operator)) NOT BETWEEN 3 AND 160 OR p_row_limit IS NULL OR p_row_limit NOT BETWEEN 1 AND 50000 THEN
  RAISE EXCEPTION 'Supply a stable run, named operator and bounded row budget' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('privacy-core-run:'||p_run,0));
 gate:=public.privacy_core_request(p_request,p_expected_version,p_policy);u:=(gate->>'user_id')::uuid;
 SELECT * INTO old FROM public.privacy_application_runs WHERE id=p_run;
 IF FOUND THEN
  IF old.request_id<>p_request OR old.request_version<>p_expected_version OR old.policy_version<>p_policy OR old.policy_fingerprint<>gate->>'policy_fingerprint' OR
    old.operator_reference<>btrim(p_operator) OR old.row_limit<>p_row_limit THEN RAISE EXCEPTION 'Erasure run identity changed' USING ERRCODE='22023';END IF;
  IF old.financial_fingerprint<>public.privacy_financial_fingerprint(u) OR NOT public.privacy_core_clean(u) THEN RAISE EXCEPTION 'Application or financial source changed; reviewer must reassess' USING ERRCODE='40001';END IF;
  RETURN old.result;
 END IF;
 IF EXISTS(SELECT 1 FROM public.privacy_application_runs WHERE request_id=p_request AND request_version=p_expected_version AND policy_version=p_policy) THEN
  RAISE EXCEPTION 'Recover the existing application run for this case version' USING ERRCODE='22023';END IF;
 -- Lock target jobs before checking terminal states. Do not delete uncertain or
 -- in-flight provider evidence merely to make deletion appear complete.
 PERFORM j.id FROM public.push_deliveries j JOIN public.push_devices d ON d.id=j.device_id JOIN public.notification_events e ON e.id=j.event_id
  WHERE d.user_id=u OR e.recipient_id=u ORDER BY j.id FOR UPDATE OF j;
 IF EXISTS(SELECT 1 FROM public.push_deliveries j JOIN public.push_devices d ON d.id=j.device_id JOIN public.notification_events e ON e.id=j.event_id
  WHERE (d.user_id=u OR e.recipient_id=u) AND j.state NOT IN ('provider_accepted','failed','cancelled','expired')) THEN
  RAISE EXCEPTION 'Resolve pending, leased or uncertain provider delivery first' USING ERRCODE='22023';END IF;
 before_hash:=public.privacy_financial_fingerprint(u);
 INSERT INTO public.privacy_application_context(transaction_id,backend_id,request_id) VALUES(txid_current(),pg_backend_pid(),p_request);
 DELETE FROM public.push_delivery_results WHERE delivery_id IN(SELECT j.id FROM public.push_deliveries j JOIN public.push_devices d ON d.id=j.device_id JOIN public.notification_events e ON e.id=j.event_id WHERE d.user_id=u OR e.recipient_id=u);
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('push_results',n::text);
 DELETE FROM public.push_deliveries WHERE event_id IN(SELECT id FROM public.notification_events WHERE recipient_id=u) OR device_id IN(SELECT id FROM public.push_devices WHERE user_id=u);
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('push_deliveries',n::text);
 DELETE FROM public.notification_events WHERE recipient_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('notification_events',n::text);
 DELETE FROM public.push_devices WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('push_devices',n::text);
 DELETE FROM public.push_subscriptions WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('legacy_push',n::text);
 DELETE FROM public.user_locations WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('addresses',n::text);
 DELETE FROM public.gaap_customer_links WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('pos_links',n::text);
 DELETE FROM public.notifications WHERE sent_to=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('legacy_notifications',n::text);
 DELETE FROM public.reward_claim_secrets WHERE reservation_id IN(SELECT id FROM public.reward_reservations WHERE user_id=u);
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('reward_secrets',n::text);
 DELETE FROM public.privacy_export_progress WHERE request_id IN(SELECT id FROM public.privacy_requests WHERE user_id=u);
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('export_cursors',n::text);
 UPDATE public.cash_order_quotes SET request='{}',snapshot=snapshot-ARRAY['contact','address'] WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('quotes',n::text);
 UPDATE public.orders SET contact_snapshot=CASE WHEN quote_id IS NULL THEN NULL ELSE '{}'::jsonb END,delivery_snapshot=NULL WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('orders',n::text);
 UPDATE public.reward_reservations SET customer_name='[Deleted]' WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('reward_names',n::text);
 UPDATE public.gaap_sync_log SET raw_payload='{}',line_items='[]',error_message=NULL WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('pos_payloads',n::text);
 UPDATE public.point_gifts SET message=NULL WHERE sender_id=u OR recipient_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('gift_messages',n::text);
 UPDATE public.staff_invitations SET email='deleted-'||u||'@invalid.test',reason='[Deleted]' WHERE accepted_by=u OR email IN(SELECT lower(email) FROM auth.users WHERE id=u UNION SELECT lower(email) FROM public.profiles WHERE id=u);
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('invitations',n::text);
 UPDATE public.privacy_preferences SET marketing_email=false,updated_at=now() WHERE user_id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('preferences',n::text);
 UPDATE public.profiles SET email=NULL,full_name=NULL,gaap_customer_id=NULL WHERE id=u;
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;counts:=counts||jsonb_build_object('profiles',n::text);
 IF total>p_row_limit THEN RAISE EXCEPTION 'Account exceeds the approved transaction budget; use a reviewed batch procedure' USING ERRCODE='54000';END IF;
 after_hash:=public.privacy_financial_fingerprint(u);
 IF before_hash IS DISTINCT FROM after_hash THEN RAISE EXCEPTION 'Financial invariant changed; application minimisation rolled back' USING ERRCODE='23514';END IF;
 IF NOT public.privacy_core_clean(u) THEN RAISE EXCEPTION 'Core application data remains; minimisation rolled back' USING ERRCODE='23514';END IF;
 DELETE FROM public.privacy_application_context WHERE transaction_id=txid_current() AND backend_id=pg_backend_pid();
 v_result:=jsonb_build_object('run_id',p_run,'request_id',p_request,'request_version',p_expected_version,'policy_version',p_policy,'policy_fingerprint',gate->>'policy_fingerprint','financial_fingerprint',after_hash,'counts',counts,'affected_rows',total::text,'application_task_completed',false);
 INSERT INTO public.privacy_application_runs(id,request_id,request_version,policy_version,policy_fingerprint,financial_fingerprint,operator_reference,row_limit,result)
  VALUES(p_run,p_request,p_expected_version,p_policy,gate->>'policy_fingerprint',after_hash,btrim(p_operator),p_row_limit,v_result);
 INSERT INTO public.privacy_request_events(request_id,event_type,public_message,details) VALUES(p_request,'application_minimized','Privacy processing is in progress.',jsonb_build_object('run_id',p_run,'policy_version',p_policy));
 RETURN v_result;
END; $$;

CREATE FUNCTION public.attest_privacy_application_review(p_request UUID,p_expected_version INTEGER,p_policy TEXT,p_run UUID,p_evidence TEXT,p_operator TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g JSONB;v public.privacy_application_runs%ROWTYPE;
BEGIN
 IF p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 3 AND 500 OR p_operator IS NULL OR length(btrim(p_operator)) NOT BETWEEN 3 AND 160 THEN RAISE EXCEPTION 'Record actual manual review evidence and operator' USING ERRCODE='22023';END IF;
 g:=public.privacy_core_request(p_request,p_expected_version,p_policy);
 SELECT * INTO v FROM public.privacy_application_runs WHERE id=p_run AND request_id=p_request FOR UPDATE;
 IF NOT FOUND OR v.request_version<>p_expected_version OR v.policy_version<>p_policy OR v.policy_fingerprint<>g->>'policy_fingerprint' OR v.financial_fingerprint<>public.privacy_financial_fingerprint((g->>'user_id')::uuid) OR NOT public.privacy_core_clean((g->>'user_id')::uuid) THEN
  RAISE EXCEPTION 'Current successful minimisation receipt required' USING ERRCODE='40001';END IF;
 IF v.manual_at IS NOT NULL THEN
  IF v.manual_reference<>btrim(p_evidence) OR v.manual_operator<>btrim(p_operator) THEN RAISE EXCEPTION 'Manual evidence already recorded' USING ERRCODE='22023';END IF;RETURN;
 END IF;
 UPDATE public.privacy_application_runs SET manual_reference=btrim(p_evidence),manual_operator=btrim(p_operator),manual_at=clock_timestamp() WHERE id=p_run;
END; $$;

-- Completion and evidence cannot substitute a typed receipt for this operation.
DO $$ DECLARE d TEXT;mark TEXT;BEGIN
 d:=pg_get_functiondef('public.record_privacy_task(uuid,text,text,text,text)'::regprocedure);mark:='  UPDATE public.privacy_request_tasks SET';
 IF strpos(d,mark)=0 THEN RAISE EXCEPTION 'Application task guard overlay drift';END IF;
 EXECUTE replace(d,mark,$patch$  IF p_system='application' AND NOT EXISTS(SELECT 1 FROM public.privacy_application_runs x JOIN public.privacy_settings s ON s.singleton
   WHERE x.request_id=p_id AND x.request_version=v_request.version AND x.policy_version=s.application_policy_version AND s.application_erasure_enabled
    AND x.manual_at IS NOT NULL AND x.manual_reference=btrim(p_evidence) AND x.manual_operator=btrim(p_operator)
    AND x.policy_fingerprint=public.validate_privacy_application_policy(x.policy_version)
    AND public.privacy_core_clean(v_request.user_id)
    AND x.financial_fingerprint=public.privacy_financial_fingerprint(v_request.user_id)) THEN
   RAISE EXCEPTION 'Core minimisation and explicit retained/unstructured-record review are required' USING ERRCODE='22023';END IF;
  UPDATE public.privacy_request_tasks SET$patch$);
 d:=pg_get_functiondef('public.complete_privacy_deletion(uuid,integer,text)'::regprocedure);mark:='  -- These checks catch';
 IF strpos(d,mark)=0 THEN RAISE EXCEPTION 'Application completion guard overlay drift';END IF;
 EXECUTE replace(d,mark,$patch$  IF NOT EXISTS(SELECT 1 FROM public.privacy_application_runs x JOIN public.privacy_settings s ON s.singleton
   WHERE x.request_id=p_id AND x.request_version=v_request.version AND x.policy_version=s.application_policy_version AND s.application_erasure_enabled
    AND x.manual_at IS NOT NULL AND x.policy_fingerprint=public.validate_privacy_application_policy(x.policy_version)
    AND public.privacy_core_clean(v_request.user_id)
    AND x.financial_fingerprint=public.privacy_financial_fingerprint(v_request.user_id)
    AND EXISTS(SELECT 1 FROM public.privacy_request_tasks t WHERE t.request_id=p_id AND t.system='application' AND t.status='completed'
      AND t.evidence_reference=x.manual_reference AND t.recorded_by=x.manual_operator)) THEN
   RAISE EXCEPTION 'Current application minimisation and retained-record review required' USING ERRCODE='22023';END IF;
  -- These checks catch$patch$);
END; $$;

REVOKE ALL ON FUNCTION public.protect_privacy_application_run(),public.privacy_application_schema(),public.privacy_core_fields(),public.validate_privacy_application_policy(TEXT),
 public.privacy_core_request(UUID,INTEGER,TEXT),public.privacy_financial_fingerprint(UUID),public.privacy_push_purge_allowed(UUID),public.privacy_core_clean(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.minimize_privacy_application(UUID,INTEGER,TEXT,UUID,TEXT,INTEGER),public.attest_privacy_application_review(UUID,INTEGER,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minimize_privacy_application(UUID,INTEGER,TEXT,UUID,TEXT,INTEGER),public.attest_privacy_application_review(UUID,INTEGER,TEXT,UUID,TEXT,TEXT) TO service_role;

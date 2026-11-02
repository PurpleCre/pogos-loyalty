-- Disabled until the environment/project, provider credentials, scheduler and
-- physical-device acceptance have been approved. No vendor call runs in SQL.
CREATE TABLE public.push_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled BOOLEAN NOT NULL DEFAULT false,
  expo_project_id UUID,
  enabled_since TIMESTAMPTZ,
  CHECK(NOT enabled OR (expo_project_id IS NOT NULL AND enabled_since IS NOT NULL))
);
INSERT INTO public.push_settings(singleton) VALUES(true);
CREATE TABLE public.push_devices (
  id UUID PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  expo_token TEXT UNIQUE,
  project_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('android','ios')),
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  aal2 BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('order','reward','branch')),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  order_id UUID REFERENCES public.orders(id),
  reservation_id UUID REFERENCES public.reward_reservations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 minutes',
  read_at TIMESTAMPTZ,
  UNIQUE(source_id,kind,recipient_id)
);
CREATE INDEX notification_inbox_idx ON public.notification_events(recipient_id,created_at DESC,id DESC);
CREATE TABLE public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.notification_events(id),
  device_id UUID NOT NULL REFERENCES public.push_devices(id),
  device_version INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','retry','ticket','checking','provider_accepted','failed','cancelled','expired','unknown')),
  attempts INTEGER NOT NULL DEFAULT 0,
  receipt_attempts INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_id UUID,
  lease_until TIMESTAMPTZ,
  dispatch_started_at TIMESTAMPTZ,
  ticket_id TEXT,
  ticket_at TIMESTAMPTZ,
  last_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id,device_id)
);
CREATE INDEX push_delivery_queue_idx ON public.push_deliveries(state,available_at);
CREATE TABLE public.push_delivery_results (
  id UUID PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.push_deliveries(id),
  stage TEXT NOT NULL CHECK(stage IN ('send','receipt','operator')),
  outcome TEXT NOT NULL,
  provider_reference TEXT,
  actor_id UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_push_results BEFORE UPDATE OR DELETE ON public.push_delivery_results
  FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['push_settings','push_devices','notification_events','push_deliveries','push_delivery_results'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
END; $$;
-- Legacy VAPID/Capacitor subscriptions are not Expo installations. Preserve
-- historical rows, but stop new direct subscriptions/forged delivery evidence.
REVOKE INSERT,UPDATE,DELETE ON public.push_subscriptions,public.notifications FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.push_recipient_available(p_user UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM public.privacy_requests WHERE user_id=p_user AND kind='deletion' AND status IN ('processing','completed'))
$$;
CREATE FUNCTION public.push_event_allowed(p_event UUID,p_user UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.notification_events e WHERE e.id=p_event AND e.recipient_id=p_user
    AND public.push_recipient_available(p_user) AND (
      (e.kind='order' AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=e.order_id AND o.user_id=p_user)) OR
      (e.kind='reward' AND EXISTS(SELECT 1 FROM public.reward_reservations r WHERE r.id=e.reservation_id AND r.user_id=p_user)) OR
      (e.kind='branch' AND public.staff_assignment(e.store_id,p_user))))
$$;
CREATE FUNCTION public.push_device_eligible(p_delivery UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.push_deliveries j JOIN public.push_devices d ON d.id=j.device_id
    JOIN public.notification_events e ON e.id=j.event_id JOIN public.push_settings s ON s.singleton
    WHERE j.id=p_delivery AND s.enabled AND d.project_id=s.expo_project_id AND e.created_at>=s.enabled_since
    AND d.version=j.device_version AND d.active AND d.expo_token IS NOT NULL AND d.expires_at>clock_timestamp()
    AND d.user_id=e.recipient_id AND public.push_event_allowed(e.id,d.user_id)
    AND e.created_at>=d.bound_at
    AND (NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=d.user_id AND role IN ('staff','admin'))
      OR (d.aal2 AND d.verified_at>clock_timestamp()-interval '24 hours')))
$$;

CREATE FUNCTION public.register_push_device(p_id UUID,p_secret TEXT,p_token TEXT,p_project UUID,p_platform TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old public.push_devices%ROWTYPE; v_hash TEXT;
BEGIN
  PERFORM public.privacy_assert_account_available();
  IF NOT public.push_recipient_available(auth.uid()) THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')) AND NOT public.identity_aal2()
    THEN RAISE EXCEPTION 'Staff MFA required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_secret IS NULL OR p_secret !~ '^[a-f0-9]{64}$' OR p_token IS NULL OR
    p_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,200}\]$' OR p_platform IS NULL OR p_platform NOT IN ('android','ios')
    THEN RAISE EXCEPTION 'Invalid installation' USING ERRCODE='22023'; END IF;
  IF p_project IS NULL OR NOT EXISTS(SELECT 1 FROM public.push_settings WHERE singleton AND expo_project_id=p_project)
    THEN RAISE EXCEPTION 'Push is not configured for this environment' USING ERRCODE='22023'; END IF;
  v_hash:=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('push-device:'||p_id,0));
  SELECT * INTO v_old FROM public.push_devices WHERE id=p_id FOR UPDATE;
  IF FOUND AND v_old.secret_hash<>v_hash THEN RAISE EXCEPTION 'Installation proof mismatch' USING ERRCODE='42501'; END IF;
  IF NOT FOUND AND (SELECT count(*) FROM public.push_devices WHERE user_id=auth.uid())>=10
    THEN RAISE EXCEPTION 'Device limit reached; contact support' USING ERRCODE='22023'; END IF;
  INSERT INTO public.push_devices(id,secret_hash,user_id,expo_token,project_id,platform,aal2,expires_at)
    VALUES(p_id,v_hash,auth.uid(),p_token,p_project,p_platform,public.identity_aal2(),now()+interval '7 days')
    ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,expo_token=EXCLUDED.expo_token,project_id=EXCLUDED.project_id,
      platform=EXCLUDED.platform,active=true,aal2=EXCLUDED.aal2,verified_at=now(),expires_at=EXCLUDED.expires_at,updated_at=now(),
      bound_at=CASE WHEN public.push_devices.user_id IS DISTINCT FROM EXCLUDED.user_id OR NOT public.push_devices.active THEN now() ELSE public.push_devices.bound_at END,
      version=public.push_devices.version+CASE WHEN public.push_devices.user_id IS DISTINCT FROM EXCLUDED.user_id OR
        public.push_devices.expo_token IS DISTINCT FROM EXCLUDED.expo_token OR NOT public.push_devices.active OR public.push_devices.project_id<>EXCLUDED.project_id THEN 1 ELSE 0 END;
  RETURN jsonb_build_object('id',p_id,'active',true);
END; $$;
CREATE FUNCTION public.unregister_push_device(p_id UUID,p_secret TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  -- Withdrawal/logout remains possible during privacy processing and AAL1.
  IF auth.uid() IS NULL OR p_secret IS NULL OR p_secret !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Sign in with installation proof' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('push-device:'||p_id,0));
  IF EXISTS(SELECT 1 FROM public.push_devices WHERE id=p_id AND user_id=auth.uid() AND secret_hash<>encode(sha256(convert_to(p_secret,'UTF8')),'hex'))
    THEN RAISE EXCEPTION 'Installation proof mismatch' USING ERRCODE='42501'; END IF;
  UPDATE public.push_devices SET active=false,expo_token=NULL,version=version+1,updated_at=now()
    WHERE id=p_id AND user_id=auth.uid() AND active AND secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
  RETURN true;
END; $$;

CREATE FUNCTION public.enqueue_transaction_notification() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user UUID; v_store UUID; v_order UUID; v_reservation UUID;
BEGIN
  IF TG_TABLE_NAME='order_status_events' THEN
    IF NEW.event_type NOT IN ('status','accept','prepare','ready','dispatch','complete','cancel','expired','refund') THEN RETURN NEW; END IF;
    SELECT user_id,store_id INTO v_user,v_store FROM public.orders WHERE id=NEW.order_id AND quote_id IS NOT NULL;
    v_order:=NEW.order_id;
  ELSE
    SELECT user_id,store_id INTO v_user,v_store FROM public.reward_reservations WHERE id=NEW.reservation_id;
    v_reservation:=NEW.reservation_id;
  END IF;
  IF v_user IS NULL OR NOT public.push_recipient_available(v_user) THEN RETURN NEW; END IF;
  INSERT INTO public.notification_events(source_id,kind,recipient_id,store_id,order_id,reservation_id)
    VALUES(NEW.id,CASE WHEN v_order IS NULL THEN 'reward' ELSE 'order' END,v_user,v_store,v_order,v_reservation) ON CONFLICT DO NOTHING;
  -- Nested guards matter: a reward-event record has no status field, and SQL
  -- expression planning need not short-circuit record field resolution.
  IF TG_TABLE_NAME='order_status_events' THEN
   IF NEW.status='pending' AND NEW.event_type='status' THEN
    INSERT INTO public.notification_events(source_id,kind,recipient_id,store_id,order_id)
      SELECT NEW.id,'branch',r.user_id,v_store,v_order FROM public.user_roles r
      WHERE r.role IN ('staff','admin') AND public.staff_assignment(v_store,r.user_id) AND public.push_recipient_available(r.user_id)
      ON CONFLICT DO NOTHING;
   END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER outbox_order_event AFTER INSERT ON public.order_status_events FOR EACH ROW EXECUTE FUNCTION public.enqueue_transaction_notification();
CREATE TRIGGER outbox_reward_event AFTER INSERT ON public.reward_events FOR EACH ROW EXECUTE FUNCTION public.enqueue_transaction_notification();

CREATE FUNCTION public.claim_push_deliveries(p_limit INTEGER DEFAULT 10) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows JSONB;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid batch size' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.push_settings WHERE singleton AND enabled) THEN RETURN '[]'::jsonb; END IF;
  -- An abandoned dispatched send is ambiguous, never blindly sent again.
  UPDATE public.push_deliveries SET state=CASE WHEN state='checking' THEN 'ticket' WHEN dispatch_started_at IS NULL THEN 'retry' ELSE 'unknown' END,
    last_code='lease_expired',claim_id=NULL,lease_until=NULL,version=version+1 WHERE state IN ('sending','checking') AND lease_until<clock_timestamp();
  UPDATE public.push_deliveries SET state='failed',last_code='attempts_exhausted',version=version+1 WHERE state IN ('queued','retry') AND attempts>=5;
  UPDATE public.push_deliveries SET state='unknown',last_code='receipts_exhausted',version=version+1 WHERE state='ticket' AND receipt_attempts>=20;
  INSERT INTO public.push_deliveries(event_id,device_id,device_version)
    SELECT e.id,d.id,d.version FROM public.notification_events e JOIN public.push_devices d ON d.user_id=e.recipient_id
    JOIN public.push_settings s ON s.singleton WHERE s.enabled AND d.project_id=s.expo_project_id AND d.active AND d.expo_token IS NOT NULL
    AND d.expires_at>clock_timestamp() AND d.bound_at<=e.created_at AND e.created_at>=s.enabled_since AND e.expires_at>clock_timestamp()
    AND public.push_event_allowed(e.id,d.user_id) ON CONFLICT DO NOTHING;
  UPDATE public.push_deliveries j SET state='expired',last_code='expired',version=version+1
    WHERE state IN ('queued','retry') AND EXISTS(SELECT 1 FROM public.notification_events e WHERE e.id=j.event_id AND e.expires_at<=clock_timestamp());
  UPDATE public.push_deliveries SET state='cancelled',last_code='recipient_changed',version=version+1
    WHERE state IN ('queued','retry') AND NOT public.push_device_eligible(id);
  WITH jobs AS (SELECT id,state FROM public.push_deliveries WHERE available_at<=clock_timestamp() AND
    ((state IN ('queued','retry') AND attempts<5) OR (state='ticket' AND receipt_attempts<20))
    ORDER BY available_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED), leased AS (
    UPDATE public.push_deliveries j SET state=CASE WHEN jobs.state='ticket' THEN 'checking' ELSE 'sending' END,
      claim_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',dispatch_started_at=NULL,version=version+1,
      attempts=attempts+CASE WHEN jobs.state='ticket' THEN 0 ELSE 1 END,
      receipt_attempts=receipt_attempts+CASE WHEN jobs.state='ticket' THEN 1 ELSE 0 END
    FROM jobs WHERE j.id=jobs.id RETURNING j.id,j.claim_id,CASE WHEN j.state='checking' THEN 'receipt' ELSE 'send' END AS stage
  ) SELECT coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) INTO v_rows FROM leased;
  RETURN v_rows;
END; $$;

CREATE FUNCTION public.prepare_push_dispatch(p_id UUID,p_claim UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.push_deliveries%ROWTYPE; v_payload JSONB;
BEGIN
  SELECT * INTO v_job FROM public.push_deliveries WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_job.claim_id IS DISTINCT FROM p_claim OR v_job.state NOT IN ('sending','checking') OR
    v_job.lease_until<=clock_timestamp() OR v_job.dispatch_started_at IS NOT NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.push_settings WHERE singleton AND enabled) THEN RETURN NULL; END IF;
  IF v_job.state='checking' THEN v_payload:=jsonb_build_object('stage','receipt','ticket_id',v_job.ticket_id);
  ELSE
    IF NOT public.push_device_eligible(p_id) OR EXISTS(SELECT 1 FROM public.notification_events WHERE id=v_job.event_id AND expires_at<=clock_timestamp()) THEN
      UPDATE public.push_deliveries SET state='cancelled',last_code='recipient_changed',claim_id=NULL,lease_until=NULL,version=version+1 WHERE id=p_id; RETURN NULL;
    END IF;
    SELECT jsonb_build_object('stage','send','to',d.expo_token,'title','Pogo’s update','body','Open Pogo’s to check your updates.',
      'sound','default','channelId','transactions','ttl',greatest(1,extract(epoch FROM e.expires_at-clock_timestamp())::int),
      'data',jsonb_build_object('kind','pogos-transaction','event_id',e.id,'recipient_id',e.recipient_id)) INTO v_payload
      FROM public.push_devices d JOIN public.notification_events e ON e.id=v_job.event_id WHERE d.id=v_job.device_id;
  END IF;
  UPDATE public.push_deliveries SET dispatch_started_at=clock_timestamp() WHERE id=p_id;
  RETURN v_payload;
END; $$;

CREATE FUNCTION public.record_push_result(p_id UUID,p_claim UUID,p_outcome TEXT,p_reference TEXT DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.push_deliveries%ROWTYPE; v_previous public.push_delivery_results%ROWTYPE; v_stage TEXT; v_state TEXT;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('ticket','provider_accepted','receipt_pending','device_unregistered','rate_limited','provider_error','unknown','permanent_error') OR
    (p_outcome='ticket' AND (p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9_-]{1,200}$')) OR
    (p_outcome<>'ticket' AND p_reference IS NOT NULL) THEN RAISE EXCEPTION 'Invalid provider result' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_job FROM public.push_deliveries WHERE id=p_id FOR UPDATE;
  SELECT * INTO v_previous FROM public.push_delivery_results WHERE id=p_claim;
  IF FOUND THEN
    IF v_previous.delivery_id IS DISTINCT FROM p_id OR v_previous.outcome IS DISTINCT FROM p_outcome OR v_previous.provider_reference IS DISTINCT FROM p_reference
      THEN RAISE EXCEPTION 'Result reference already used' USING ERRCODE='22023'; END IF; RETURN true;
  END IF;
  IF v_job.id IS NULL OR v_job.claim_id IS DISTINCT FROM p_claim OR v_job.state NOT IN ('sending','checking') OR v_job.dispatch_started_at IS NULL
    THEN RAISE EXCEPTION 'Stale worker claim' USING ERRCODE='40001'; END IF;
  v_stage:=CASE WHEN v_job.state='checking' THEN 'receipt' ELSE 'send' END;
  IF (v_stage='send' AND p_outcome IN ('provider_accepted','receipt_pending')) OR (v_stage='receipt' AND p_outcome='ticket')
    THEN RAISE EXCEPTION 'Result stage mismatch' USING ERRCODE='22023'; END IF;
  v_state:=CASE p_outcome WHEN 'ticket' THEN 'ticket' WHEN 'provider_accepted' THEN 'provider_accepted'
    WHEN 'receipt_pending' THEN CASE WHEN v_job.receipt_attempts>=20 THEN 'unknown' ELSE 'ticket' END
    WHEN 'device_unregistered' THEN 'failed' WHEN 'permanent_error' THEN 'failed' WHEN 'unknown' THEN 'unknown'
    ELSE CASE WHEN v_stage='receipt' THEN CASE WHEN v_job.receipt_attempts>=20 THEN 'unknown' ELSE 'ticket' END
      WHEN v_job.attempts>=5 THEN 'failed' ELSE 'retry' END END;
  UPDATE public.push_deliveries SET state=v_state,claim_id=NULL,lease_until=NULL,version=version+1,last_code=p_outcome,
    ticket_id=CASE WHEN p_outcome='ticket' THEN p_reference ELSE ticket_id END,
    ticket_at=CASE WHEN p_outcome='ticket' THEN clock_timestamp() ELSE ticket_at END,
    available_at=clock_timestamp()+CASE WHEN p_outcome='ticket' THEN interval '15 minutes'
      WHEN v_stage='receipt' THEN interval '2 minutes' ELSE make_interval(secs=>least(900,30*(2^least(v_job.attempts,5))::int)) END,
    updated_at=clock_timestamp() WHERE id=p_id;
  IF p_outcome='device_unregistered' THEN UPDATE public.push_devices SET active=false,expo_token=NULL,version=version+1,updated_at=now()
    WHERE id=v_job.device_id AND version=v_job.device_version; END IF;
  INSERT INTO public.push_delivery_results(id,delivery_id,stage,outcome,provider_reference) VALUES(p_claim,p_id,v_stage,p_outcome,p_reference);
  RETURN true;
END; $$;

CREATE FUNCTION public.my_notification_inbox(p_before TIMESTAMPTZ DEFAULT NULL,p_before_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.push_recipient_available(auth.uid()) THEN RAISE EXCEPTION 'Sign in to view updates' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')) AND NOT public.identity_aal2()
    THEN RAISE EXCEPTION 'Staff MFA required' USING ERRCODE='42501'; END IF;
  IF (p_before IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Supply both cursor fields' USING ERRCODE='22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id DESC),'[]'::jsonb) FROM (
    SELECT id,kind,created_at,read_at FROM public.notification_events WHERE recipient_id=auth.uid() AND public.push_event_allowed(id,auth.uid())
      AND (p_before IS NULL OR (created_at,id)<(p_before,p_before_id)) ORDER BY created_at DESC,id DESC LIMIT 50) page);
END; $$;
CREATE FUNCTION public.resolve_transaction_notification(p_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.notification_events%ROWTYPE;
BEGIN
  IF NOT public.push_event_allowed(p_id,auth.uid()) THEN RAISE EXCEPTION 'Update unavailable for this account' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')) AND NOT public.identity_aal2()
    THEN RAISE EXCEPTION 'Staff MFA required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_event FROM public.notification_events WHERE id=p_id;
  UPDATE public.notification_events SET read_at=coalesce(read_at,now()) WHERE id=p_id;
  RETURN jsonb_build_object('kind',v_event.kind,'store_id',v_event.store_id,'order_id',v_event.order_id,'reservation_id',v_event.reservation_id);
END; $$;
CREATE FUNCTION public.push_operations_summary() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('enabled',(SELECT enabled FROM public.push_settings WHERE singleton),
    'counts',(SELECT coalesce(jsonb_object_agg(state,n),'{}'::jsonb) FROM (SELECT state,count(*) AS n FROM public.push_deliveries GROUP BY state) x),
    'oldest_pending',(SELECT min(created_at) FROM public.push_deliveries WHERE state IN ('queued','retry','unknown')),
    'exceptions',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (SELECT id,version,last_code,created_at FROM public.push_deliveries WHERE state='unknown' ORDER BY created_at,id LIMIT 20) x));
END; $$;
CREATE FUNCTION public.review_unknown_push(p_id UUID,p_expected_version INTEGER,p_retry BOOLEAN,p_reason TEXT,p_allow_duplicate BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job public.push_deliveries%ROWTYPE;
BEGIN
  PERFORM public.privacy_assert_account_available();
  PERFORM public.privacy_recent_identity();
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required' USING ERRCODE='42501'; END IF;
  IF p_retry IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 300 OR (p_retry AND p_allow_duplicate IS DISTINCT FROM true)
    THEN RAISE EXCEPTION 'Provide a review reason and explicitly accept duplicate-notification risk for a retry' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_job FROM public.push_deliveries WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_job.state<>'unknown' OR v_job.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Exception changed; refresh before review' USING ERRCODE='40001'; END IF;
  IF p_retry AND (v_job.attempts>=5 OR NOT public.push_device_eligible(p_id) OR EXISTS(SELECT 1 FROM public.notification_events WHERE id=v_job.event_id AND expires_at<=clock_timestamp()))
    THEN RAISE EXCEPTION 'This update cannot be resent; use the live queue or inbox' USING ERRCODE='22023'; END IF;
  UPDATE public.push_deliveries SET state=CASE WHEN p_retry THEN 'retry' ELSE 'failed' END,version=version+1,available_at=now(),
    last_code=CASE WHEN p_retry THEN 'operator_retry' ELSE 'operator_closed' END,updated_at=now() WHERE id=p_id RETURNING * INTO v_job;
  INSERT INTO public.push_delivery_results(id,delivery_id,stage,outcome,actor_id,reason)
    VALUES(gen_random_uuid(),p_id,'operator',v_job.last_code,auth.uid(),btrim(p_reason));
  RETURN jsonb_build_object('id',p_id,'state',v_job.state,'version',v_job.version);
END; $$;

-- Private helpers/triggers and worker methods are not user-callable APIs.
REVOKE ALL ON FUNCTION public.push_recipient_available(UUID),public.push_event_allowed(UUID,UUID),public.push_device_eligible(UUID),
  public.enqueue_transaction_notification() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_push_deliveries(INTEGER),public.prepare_push_dispatch(UUID,UUID),public.record_push_result(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_deliveries(INTEGER),public.prepare_push_dispatch(UUID,UUID),public.record_push_result(UUID,UUID,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.register_push_device(UUID,TEXT,TEXT,UUID,TEXT),public.unregister_push_device(UUID,TEXT),
  public.my_notification_inbox(TIMESTAMPTZ,UUID),public.resolve_transaction_notification(UUID),public.push_operations_summary() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.register_push_device(UUID,TEXT,TEXT,UUID,TEXT),public.unregister_push_device(UUID,TEXT),
  public.my_notification_inbox(TIMESTAMPTZ,UUID),public.resolve_transaction_notification(UUID),public.push_operations_summary() TO authenticated;
REVOKE ALL ON FUNCTION public.review_unknown_push(UUID,INTEGER,BOOLEAN,TEXT,BOOLEAN) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.review_unknown_push(UUID,INTEGER,BOOLEAN,TEXT,BOOLEAN) TO authenticated;

-- Extend private export allowlists; raw device tokens/proof and worker payloads
-- never become customer-readable. Pending erasure must account for these stores.
DO $$ DECLARE v_definition TEXT; v_old TEXT; v_new TEXT; BEGIN
  v_definition:=pg_get_functiondef('public.privacy_export_rows(uuid,text,uuid,timestamptz,integer)'::regprocedure);
  v_old:='WHEN ''access_history'' THEN';
  v_new:=$patch$WHEN 'transaction_updates' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'kind',kind,'created_at',created_at,'read_at',read_at) AS data FROM public.notification_events WHERE recipient_id=$1$q$
    WHEN 'push_devices' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'platform',platform,'active',active,'created_at',created_at,'expires_at',expires_at) AS data FROM public.push_devices WHERE user_id=$1$q$
    WHEN 'access_history' THEN$patch$;
  IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Push privacy overlay missing'; END IF;
  EXECUTE replace(v_definition,v_old,v_new);
  v_definition:=pg_get_functiondef('public.privacy_export_sections()'::regprocedure);
  EXECUTE replace(v_definition,'''branch_operations''','''branch_operations'',''transaction_updates'',''push_devices''');
  v_definition:=pg_get_functiondef('public.complete_privacy_deletion(uuid,integer,text)'::regprocedure);
  v_old:='EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id=v_request.user_id)';
  IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Push erasure completion overlay missing'; END IF;
  EXECUTE replace(v_definition,v_old,v_old||' OR EXISTS (SELECT 1 FROM public.push_devices WHERE user_id=v_request.user_id) OR EXISTS (SELECT 1 FROM public.notification_events WHERE recipient_id=v_request.user_id)');
END; $$;

-- Observations/evidence do not alter sales, cash, refunds, balances or fiscal
-- records. Accepted reconciliation is a two-person statement about a snapshot.
CREATE TABLE public.finance_reconciliations (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  business_day DATE NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('USD','ZWG')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  observed JSONB NOT NULL,
  snapshot JSONB NOT NULL,
  signature TEXT NOT NULL,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('matched','variance','accepted','rejected','stale')),
  version INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL CHECK(revision>0),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  previous_id UUID REFERENCES public.finance_reconciliations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX finance_one_open_period ON public.finance_reconciliations(store_id,business_day,currency) WHERE status IN ('matched','variance');
CREATE UNIQUE INDEX finance_period_revision ON public.finance_reconciliations(store_id,business_day,currency,revision);
CREATE INDEX finance_cases_branch_idx ON public.finance_reconciliations(store_id,created_at DESC,id DESC);
CREATE TABLE public.finance_reconciliation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES public.finance_reconciliations(id),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_commands (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  reconciliation_id UUID NOT NULL REFERENCES public.finance_reconciliations(id),
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_finance_events BEFORE UPDATE OR DELETE ON public.finance_reconciliation_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE TRIGGER immutable_finance_commands BEFORE UPDATE OR DELETE ON public.finance_commands
  FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE FUNCTION public.protect_finance_observation() RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status','version','reviewed_by','reviewed_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','version','reviewed_by','reviewed_at']) THEN RAISE EXCEPTION 'Reconciliation observations and snapshots are immutable' USING ERRCODE='42501';END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER immutable_finance_observation BEFORE UPDATE OR DELETE ON public.finance_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.protect_finance_observation();
DO $$ DECLARE t TEXT;BEGIN
  FOREACH t IN ARRAY ARRAY['finance_reconciliations','finance_reconciliation_events','finance_commands'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
END; $$;

CREATE FUNCTION public.finance_period_key(p_store UUID,p_day DATE,p_currency TEXT) RETURNS BIGINT
LANGUAGE SQL IMMUTABLE SET search_path='' AS $$
  SELECT hashtextextended('finance-period:'||p_store||':'||to_char(p_day,'YYYY-MM-DD')||':'||p_currency,0)
$$;
CREATE FUNCTION public.lock_finance_cash_source() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NEW.event_type IN ('received','refunded','settled') THEN
    PERFORM pg_advisory_xact_lock_shared(public.finance_period_key(NEW.store_id,(NEW.created_at AT TIME ZONE 'Africa/Harare')::date,NEW.currency));
  END IF;RETURN NEW;
END; $$;
CREATE TRIGGER finance_cash_source_lock BEFORE INSERT ON public.cash_movements FOR EACH ROW EXECUTE FUNCTION public.lock_finance_cash_source();

CREATE FUNCTION public.finance_period_snapshot(p_store UUID,p_day DATE,p_currency TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_start TIMESTAMPTZ;v_end TIMESTAMPTZ;v_result JSONB;
BEGIN
  IF p_store IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores WHERE id=p_store) OR p_day IS NULL OR
    p_day<DATE '2000-01-01' OR p_day>(clock_timestamp() AT TIME ZONE 'Africa/Harare')::date OR p_currency IS NULL OR p_currency NOT IN ('USD','ZWG')
    THEN RAISE EXCEPTION 'Choose a valid branch, past/current Harare day and currency' USING ERRCODE='22023';END IF;
  v_start:=p_day::timestamp AT TIME ZONE 'Africa/Harare';v_end:=(p_day+1)::timestamp AT TIME ZONE 'Africa/Harare';
  WITH source AS (SELECT id,event_type,amount_minor,reference,created_at FROM public.cash_movements WHERE store_id=p_store AND currency=p_currency
    AND created_at>=v_start AND created_at<v_end AND event_type IN ('received','refunded','settled'))
  SELECT jsonb_build_object('store_id',p_store,'business_day',to_char(p_day,'YYYY-MM-DD'),'currency',p_currency,'period_start',v_start,'period_end',v_end,
    'received_minor',coalesce(sum(amount_minor) FILTER(WHERE event_type='received'),0)::text,
    'refunded_minor',(-coalesce(sum(amount_minor) FILTER(WHERE event_type='refunded'),0))::text,
    'settled_minor',coalesce(sum(amount_minor) FILTER(WHERE event_type='settled'),0)::text,
    'net_received_minor',(coalesce(sum(amount_minor) FILTER(WHERE event_type='received'),0)+coalesce(sum(amount_minor) FILTER(WHERE event_type='refunded'),0))::text,
    'net_till_movement_minor',(coalesce(sum(amount_minor) FILTER(WHERE event_type='settled'),0)+coalesce(sum(amount_minor) FILTER(WHERE event_type='refunded'),0))::text,
    'sale_count',count(*) FILTER(WHERE event_type='received')::text,'refund_count',count(*) FILTER(WHERE event_type='refunded')::text,'entry_count',count(*)::text,
    'signature',encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(id,event_type,amount_minor::text,reference,extract(epoch FROM created_at)::text) ORDER BY id),'[]'::jsonb)::text,'UTF8')),'hex'))
    INTO v_result FROM source;
  RETURN v_result;
END; $$;
CREATE FUNCTION public.finance_branch_report(p_store UUID,p_day DATE,p_currency TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_period JSONB;v_start TIMESTAMPTZ;v_end TIMESTAMPTZ;
BEGIN
  IF NOT public.finance_branch_access(p_store) THEN RAISE EXCEPTION 'Assigned manager/finance access with MFA required' USING ERRCODE='42501';END IF;
  v_period:=public.finance_period_snapshot(p_store,p_day,p_currency);
  v_start:=(v_period->>'period_start')::timestamptz;v_end:=(v_period->>'period_end')::timestamptz;
  RETURN jsonb_build_object('as_of',clock_timestamp(),'period',v_period,
    'outstanding_all_dates_minor',(SELECT coalesce(sum(amount_minor),0)::text FROM public.cash_receipts WHERE store_id=p_store AND currency=p_currency AND settled_at IS NULL),
    'pending_handovers_all_dates',(SELECT count(*)::text FROM public.cash_receipts WHERE store_id=p_store AND currency=p_currency AND settled_at IS NULL AND pending_receiver_id IS NOT NULL),
    'missing_receipts_all_dates',(SELECT count(*)::text FROM public.orders o WHERE store_id=p_store AND currency=p_currency AND quote_id IS NOT NULL AND payment_status IN ('paid','refunded') AND NOT EXISTS(SELECT 1 FROM public.cash_receipts r WHERE r.order_id=o.id)),
    'reward_handovers_day',(SELECT count(*)::text FROM public.reward_fulfilments WHERE store_id=p_store AND created_at>=v_start AND created_at<v_end),
    'reward_voids_day',(SELECT count(*)::text FROM public.reward_voids WHERE store_id=p_store AND created_at>=v_start AND created_at<v_end),
    'held_reward_points_all_dates',(SELECT coalesce(sum(points_cost),0)::text FROM public.reward_reservations WHERE store_id=p_store AND status IN ('reserved','claiming')),
    'latest_reconciliation',(SELECT jsonb_build_object('id',id,'status',status,'signature_current',signature=v_period->>'signature','version',version,'created_at',created_at)
      FROM public.finance_reconciliations WHERE store_id=p_store AND business_day=p_day AND currency=p_currency ORDER BY revision DESC LIMIT 1));
END; $$;
CREATE FUNCTION public.finance_entries(p_store UUID,p_day DATE,p_currency TEXT,p_signature TEXT,p_after UUID DEFAULT NULL,p_limit INTEGER DEFAULT 100) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_period JSONB;v_rows JSONB;v_more BOOLEAN;v_next UUID;
BEGIN
  IF NOT public.finance_branch_access(p_store) THEN RAISE EXCEPTION 'Assigned manager/finance access with MFA required' USING ERRCODE='42501';END IF;
  v_period:=public.finance_period_snapshot(p_store,p_day,p_currency);
  IF p_signature IS DISTINCT FROM v_period->>'signature' THEN RAISE EXCEPTION 'Period changed; restart report collection' USING ERRCODE='40001';END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid page size' USING ERRCODE='22023';END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY id),'[]'::jsonb) INTO v_rows FROM (
    SELECT id,order_id,event_type,amount_minor::text AS amount_minor,reference,created_at FROM public.cash_movements
    WHERE store_id=p_store AND currency=p_currency AND event_type IN ('received','refunded','settled') AND
      created_at>=(v_period->>'period_start')::timestamptz AND created_at<(v_period->>'period_end')::timestamptz AND(p_after IS NULL OR id>p_after)
    ORDER BY id LIMIT p_limit+1) page;
  v_more:=jsonb_array_length(v_rows)>p_limit;
  IF v_more THEN v_rows:=v_rows-p_limit;v_next:=(v_rows->(p_limit-1)->>'id')::uuid;END IF;
  RETURN jsonb_build_object('signature',p_signature,'store_id',p_store,'business_day',to_char(p_day,'YYYY-MM-DD'),'currency',p_currency,'entries',v_rows,'next_after',v_next);
END; $$;
CREATE FUNCTION public.finance_chain_points() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator MFA required for chain-wide account totals' USING ERRCODE='42501';END IF;
  RETURN jsonb_build_object('as_of',clock_timestamp(),
    'spendable_points',(SELECT coalesce(sum(current_points),0)::text FROM public.user_points),
    'held_points',(SELECT coalesce(sum(reserved_points),0)::text FROM public.user_points),
    'unreviewed_openings',(SELECT count(*)::text FROM public.loyalty_accounts WHERE NOT opening_reviewed),
    'projection_differences',jsonb_array_length(public.loyalty_reconciliation())::text,
    'valuation_currency',NULL,'valuation_minor',NULL);
END; $$;

CREATE FUNCTION public.submit_finance_reconciliation(p_id UUID,p_store UUID,p_day DATE,p_currency TEXT,p_observed JSONB,p_evidence TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request JSONB;v_old public.finance_commands%ROWTYPE;v_snapshot JSONB;v_status TEXT;v_result JSONB;v_key TEXT;v_previous UUID;v_revision INTEGER;
BEGIN
  PERFORM public.privacy_assert_account_available();
  IF NOT public.finance_branch_access(p_store) THEN RAISE EXCEPTION 'Assigned manager/finance access with MFA required' USING ERRCODE='42501';END IF;
  IF p_id IS NULL OR p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 3 AND 500 OR p_evidence~'[[:cntrl:]]' OR
    jsonb_typeof(p_observed) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_observed))<>3 OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(p_observed) key WHERE key NOT IN ('received_minor','refunded_minor','settled_minor')) THEN RAISE EXCEPTION 'Supply exact observed amounts and an evidence reference' USING ERRCODE='22023';END IF;
  FOREACH v_key IN ARRAY ARRAY['received_minor','refunded_minor','settled_minor'] LOOP
    IF jsonb_typeof(p_observed->v_key) IS DISTINCT FROM 'string' OR (p_observed->>v_key)!~'^(0|[1-9][0-9]{0,23})$' THEN RAISE EXCEPTION 'Observed amounts must be non-negative canonical minor-unit strings' USING ERRCODE='22023';END IF;
  END LOOP;
  v_request:=jsonb_build_object('action','submit','store',p_store,'day',p_day,'currency',p_currency,'observed',p_observed,'evidence',btrim(p_evidence));
  PERFORM pg_advisory_xact_lock(hashtextextended('finance-command:'||p_id,0));
  SELECT * INTO v_old FROM public.finance_commands WHERE id=p_id;
  IF FOUND THEN
    IF v_old.actor_id<>auth.uid() OR v_old.request<>v_request THEN RAISE EXCEPTION 'Finance command reference changed' USING ERRCODE='22023';END IF;RETURN v_old.result;
  END IF;
  PERFORM pg_advisory_xact_lock(public.finance_period_key(p_store,p_day,p_currency));
  v_snapshot:=public.finance_period_snapshot(p_store,p_day,p_currency);
  IF EXISTS(SELECT 1 FROM public.finance_reconciliations WHERE store_id=p_store AND business_day=p_day AND currency=p_currency AND
    status IN ('matched','variance'))
    THEN RAISE EXCEPTION 'Review the existing period case before submitting another' USING ERRCODE='22023';END IF;
  SELECT id,revision INTO v_previous,v_revision FROM public.finance_reconciliations WHERE store_id=p_store AND business_day=p_day AND currency=p_currency ORDER BY revision DESC LIMIT 1;
  IF EXISTS(SELECT 1 FROM public.finance_reconciliations WHERE id=v_previous AND status='accepted'
    AND signature=v_snapshot->>'signature' AND observed=p_observed AND evidence=btrim(p_evidence)) THEN RAISE EXCEPTION 'This exact evidence is already accepted; provide the new external evidence for a revision' USING ERRCODE='22023';END IF;
  v_status:=CASE WHEN p_observed=jsonb_build_object('received_minor',v_snapshot->>'received_minor','refunded_minor',v_snapshot->>'refunded_minor','settled_minor',v_snapshot->>'settled_minor') THEN 'matched' ELSE 'variance' END;
  INSERT INTO public.finance_reconciliations(id,store_id,business_day,currency,submitted_by,observed,snapshot,signature,evidence,status,previous_id,revision)
    VALUES(p_id,p_store,p_day,p_currency,auth.uid(),p_observed,v_snapshot,v_snapshot->>'signature',btrim(p_evidence),v_status,v_previous,coalesce(v_revision,0)+1);
  INSERT INTO public.finance_reconciliation_events(reconciliation_id,actor_id,action,details)
    VALUES(p_id,auth.uid(),'submit',jsonb_build_object('status',v_status,'evidence',btrim(p_evidence)));
  v_result:=jsonb_build_object('id',p_id,'store_id',p_store,'status',v_status,'version',0);
  INSERT INTO public.finance_commands(id,actor_id,reconciliation_id,request,result) VALUES(p_id,auth.uid(),p_id,v_request,v_result);
  RETURN v_result;
END; $$;
CREATE FUNCTION public.review_finance_reconciliation(p_id UUID,p_command UUID,p_expected_version INTEGER,p_accept BOOLEAN,p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_case public.finance_reconciliations%ROWTYPE;v_old public.finance_commands%ROWTYPE;v_request JSONB;v_result JSONB;v_snapshot JSONB;v_status TEXT;
BEGIN
  PERFORM public.privacy_assert_account_available();
  SELECT * INTO v_case FROM public.finance_reconciliations WHERE id=p_id;
  IF NOT FOUND OR NOT public.finance_branch_access(v_case.store_id,true) THEN RAISE EXCEPTION 'Assigned finance reviewer with MFA required' USING ERRCODE='42501';END IF;
  IF p_command IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_accept IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500
    THEN RAISE EXCEPTION 'Supply a version, decision and review evidence/reason' USING ERRCODE='22023';END IF;
  IF v_case.submitted_by=auth.uid() THEN RAISE EXCEPTION 'A different finance reviewer must review this case' USING ERRCODE='42501';END IF;
  v_request:=jsonb_build_object('action','review','id',p_id,'version',p_expected_version,'accept',p_accept,'reason',btrim(p_reason));
  PERFORM pg_advisory_xact_lock(hashtextextended('finance-command:'||p_command,0));
  SELECT * INTO v_old FROM public.finance_commands WHERE id=p_command;
  IF FOUND THEN
    IF v_old.actor_id<>auth.uid() OR v_old.request<>v_request THEN RAISE EXCEPTION 'Finance command reference changed' USING ERRCODE='22023';END IF;RETURN v_old.result;
  END IF;
  PERFORM pg_advisory_xact_lock(public.finance_period_key(v_case.store_id,v_case.business_day,v_case.currency));
  SELECT * INTO v_case FROM public.finance_reconciliations WHERE id=p_id FOR UPDATE;
  IF v_case.version IS DISTINCT FROM p_expected_version OR v_case.status NOT IN ('matched','variance') THEN RAISE EXCEPTION 'Reconciliation changed; refresh before review' USING ERRCODE='40001';END IF;
  v_snapshot:=public.finance_period_snapshot(v_case.store_id,v_case.business_day,v_case.currency);
  v_status:=CASE WHEN v_snapshot->>'signature'<>v_case.signature THEN 'stale' WHEN p_accept THEN 'accepted' ELSE 'rejected' END;
  -- A variance is never labelled reconciled by reviewer acknowledgement.
  IF p_accept AND v_case.status='variance' AND v_status<>'stale' THEN RAISE EXCEPTION 'Investigate the variance, reject this case and submit corrected evidence; balances are not adjusted here' USING ERRCODE='22023';END IF;
  UPDATE public.finance_reconciliations SET status=v_status,version=version+1,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_id;
  INSERT INTO public.finance_reconciliation_events(reconciliation_id,actor_id,action,details)
    VALUES(p_id,auth.uid(),v_status,jsonb_build_object('reason',btrim(p_reason),'prior_version',p_expected_version));
  v_result:=jsonb_build_object('id',p_id,'store_id',v_case.store_id,'status',v_status,'version',p_expected_version+1);
  INSERT INTO public.finance_commands(id,actor_id,reconciliation_id,request,result) VALUES(p_command,auth.uid(),p_id,v_request,v_result);
  RETURN v_result;
END; $$;
CREATE FUNCTION public.list_finance_reconciliations(p_store UUID,p_before TIMESTAMPTZ DEFAULT NULL,p_before_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.finance_branch_access(p_store) THEN RAISE EXCEPTION 'Assigned manager/finance access with MFA required' USING ERRCODE='42501';END IF;
  IF (p_before IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Supply both cursor fields' USING ERRCODE='22023';END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id DESC),'[]'::jsonb) FROM (
    SELECT id,business_day,currency,observed,snapshot,evidence,status,version,revision,previous_id,submitted_by=auth.uid() AS submitted_by_me,created_at,
      signature=(public.finance_period_snapshot(store_id,business_day,currency)->>'signature') AS signature_current,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('action',e.action,'reason',e.details->>'reason','created_at',e.created_at) ORDER BY e.created_at,e.id),'[]'::jsonb)
        FROM public.finance_reconciliation_events e WHERE e.reconciliation_id=r.id) AS history
    FROM public.finance_reconciliations r WHERE store_id=p_store AND(p_before IS NULL OR(created_at,id)<(p_before,p_before_id)) ORDER BY created_at DESC,id DESC LIMIT 20) page);
END; $$;

REVOKE ALL ON FUNCTION public.finance_period_key(UUID,DATE,TEXT),public.finance_period_snapshot(UUID,DATE,TEXT),public.lock_finance_cash_source(),public.protect_finance_observation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.finance_branch_report(UUID,DATE,TEXT),public.finance_entries(UUID,DATE,TEXT,TEXT,UUID,INTEGER),public.finance_chain_points(),
  public.submit_finance_reconciliation(UUID,UUID,DATE,TEXT,JSONB,TEXT),public.review_finance_reconciliation(UUID,UUID,INTEGER,BOOLEAN,TEXT),public.list_finance_reconciliations(UUID,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_branch_report(UUID,DATE,TEXT),public.finance_entries(UUID,DATE,TEXT,TEXT,UUID,INTEGER),public.finance_chain_points(),
  public.submit_finance_reconciliation(UUID,UUID,DATE,TEXT,JSONB,TEXT),public.review_finance_reconciliation(UUID,UUID,INTEGER,BOOLEAN,TEXT),public.list_finance_reconciliations(UUID,TIMESTAMPTZ,UUID) TO authenticated;

DO $$ DECLARE d TEXT;old TEXT;BEGIN
  d:=pg_get_functiondef('public.privacy_export_rows(uuid,text,uuid,timestamptz,integer)'::regprocedure);old:='WHEN ''access_history'' THEN';
  IF strpos(d,old)=0 THEN RAISE EXCEPTION 'Finance export overlay drift';END IF;
  EXECUTE replace(d,old,$patch$WHEN 'finance_activity' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'reconciliation_id',reconciliation_id,'action',action,'created_at',created_at) AS data FROM public.finance_reconciliation_events WHERE actor_id=$1$q$
    WHEN 'access_history' THEN$patch$);
  d:=pg_get_functiondef('public.privacy_export_sections()'::regprocedure);
  IF strpos(d,'''push_devices''')=0 THEN RAISE EXCEPTION 'Finance section overlay drift';END IF;
  EXECUTE replace(d,'''push_devices''','''push_devices'',''finance_activity''');
END; $$;

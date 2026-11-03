-- Three bounded operational rows; no customer identity, payload or provider key.
CREATE TABLE public.worker_observations (
  worker TEXT PRIMARY KEY CHECK(worker IN ('push','cash-expiry','reward-expiry')),
  run_id UUID,
  outcome TEXT NOT NULL DEFAULT 'never' CHECK(outcome IN ('never','running','success','failed','unresolved')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  CHECK((outcome='never' AND run_id IS NULL AND started_at IS NULL AND completed_at IS NULL) OR
    (outcome='running' AND run_id IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL) OR
    (outcome IN ('success','failed','unresolved') AND run_id IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NOT NULL))
);
INSERT INTO public.worker_observations(worker) VALUES('push'),('cash-expiry'),('reward-expiry');
ALTER TABLE public.worker_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_observations FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.record_worker_observation(p_worker TEXT,p_run UUID,p_outcome TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.worker_observations%ROWTYPE;v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_worker IS NULL OR p_worker NOT IN ('push','cash-expiry','reward-expiry') OR p_run IS NULL OR
    p_outcome IS NULL OR p_outcome NOT IN ('running','success','failed','unresolved') THEN
    RAISE EXCEPTION 'Invalid worker observation' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_row FROM public.worker_observations WHERE worker=p_worker FOR UPDATE;
  IF p_outcome='running' THEN
    IF v_row.run_id=p_run THEN RETURN v_row.outcome='running';END IF;
    UPDATE public.worker_observations SET run_id=p_run,outcome='running',started_at=v_now,completed_at=NULL WHERE worker=p_worker;
    RETURN true;
  END IF;
  -- A slow older invocation cannot overwrite the newest run. Same-result
  -- terminal replays acknowledge without moving timestamps or redoing work.
  IF v_row.run_id IS DISTINCT FROM p_run THEN RETURN false;END IF;
  IF v_row.outcome<>'running' THEN RETURN v_row.outcome=p_outcome;END IF;
  UPDATE public.worker_observations SET outcome=p_outcome,completed_at=v_now,
    last_success_at=CASE WHEN p_outcome='success' THEN v_now ELSE last_success_at END WHERE worker=p_worker;
  RETURN true;
END;$$;

CREATE FUNCTION public.worker_health_snapshot() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('schema_version',1,'observed_at',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'workers',jsonb_object_agg(worker,jsonb_build_object('outcome',outcome,
      'started_age_seconds',floor(extract(epoch FROM statement_timestamp()-started_at))::bigint,
      'completed_age_seconds',floor(extract(epoch FROM statement_timestamp()-completed_at))::bigint,
      'last_success_age_seconds',floor(extract(epoch FROM statement_timestamp()-last_success_at))::bigint)))
  FROM public.worker_observations;
$$;
REVOKE ALL ON FUNCTION public.record_worker_observation(TEXT,UUID,TEXT),public.worker_health_snapshot() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_worker_observation(TEXT,UUID,TEXT),public.worker_health_snapshot() TO service_role;

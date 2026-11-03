-- ON CONFLICT may wait on another worker's uncommitted insert/update before
-- the later SKIP LOCKED lease query is reached. Skip committed pairs and try a
-- transaction-scoped pair lock for new materialisation; a busy pair is retried
-- on a later claim. Keep the unique constraint and conflict handling as backup.
DO $$
DECLARE definition TEXT; marker TEXT:='AND public.push_event_allowed(e.id,d.user_id) ON CONFLICT DO NOTHING;';
BEGIN
  definition:=pg_get_functiondef('public.claim_push_deliveries(integer)'::regprocedure);
  IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Push materialisation concurrency overlay drift'; END IF;
  EXECUTE replace(definition,marker,$patch$AND public.push_event_allowed(e.id,d.user_id)
    AND NOT EXISTS(SELECT 1 FROM public.push_deliveries existing WHERE existing.event_id=e.id AND existing.device_id=d.id)
    AND pg_try_advisory_xact_lock(hashtextextended('push-materialize:'||e.id||':'||d.id,0))
    ON CONFLICT DO NOTHING;$patch$);
END;
$$;

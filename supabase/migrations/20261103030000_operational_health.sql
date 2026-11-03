-- Aggregate queue observations only. No dispatch, expiry, ledger write,
-- acknowledgement or scheduler heartbeat is performed by this function.
CREATE INDEX health_push_leases ON public.push_deliveries(lease_until)
  WHERE state IN ('sending','checking');
CREATE INDEX health_push_unknown ON public.push_deliveries(updated_at) WHERE state='unknown';
CREATE INDEX health_cash_custody ON public.cash_receipts(created_at) WHERE settled_at IS NULL;
CREATE INDEX health_finance_variances ON public.finance_reconciliations(created_at) WHERE status='variance';

CREATE FUNCTION public.operational_health_snapshot() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH samples AS (
    SELECT 'cash_expiry_due'::text AS signal, at FROM (
      SELECT acceptance_deadline AS at FROM public.orders
      WHERE status='pending' AND payment_method='cash' AND payment_status='unpaid'
        AND acceptance_deadline<=statement_timestamp()
      ORDER BY acceptance_deadline LIMIT 1001
    ) q
    UNION ALL SELECT 'reward_expiry_due',at FROM (
      SELECT expires_at AS at FROM public.reward_reservations
      WHERE status='reserved' AND expires_at<=statement_timestamp()
      ORDER BY expires_at LIMIT 1001
    ) q
    UNION ALL SELECT 'push_send_due',at FROM (
      SELECT available_at AS at FROM public.push_deliveries
      WHERE state IN ('queued','retry') AND available_at<=statement_timestamp()
      ORDER BY available_at LIMIT 1001
    ) q
    UNION ALL SELECT 'push_receipt_due',at FROM (
      SELECT available_at AS at FROM public.push_deliveries
      WHERE state='ticket' AND available_at<=statement_timestamp()
      ORDER BY available_at LIMIT 1001
    ) q
    UNION ALL SELECT 'push_lease_overdue',at FROM (
      SELECT lease_until AS at FROM public.push_deliveries
      WHERE state IN ('sending','checking') AND lease_until<=statement_timestamp()
      ORDER BY lease_until LIMIT 1001
    ) q
    UNION ALL SELECT 'push_unknown',at FROM (
      SELECT updated_at AS at FROM public.push_deliveries WHERE state='unknown'
      ORDER BY updated_at LIMIT 1001
    ) q
    UNION ALL SELECT 'cash_custody_open',at FROM (
      SELECT created_at AS at FROM public.cash_receipts WHERE settled_at IS NULL
      ORDER BY created_at LIMIT 1001
    ) q
    UNION ALL SELECT 'finance_variance_open',at FROM (
      SELECT created_at AS at FROM public.finance_reconciliations WHERE status='variance'
      ORDER BY created_at LIMIT 1001
    ) q
  ), signals(signal) AS (VALUES ('cash_expiry_due'),('reward_expiry_due'),('push_send_due'),
    ('push_receipt_due'),('push_lease_overdue'),('push_unknown'),('cash_custody_open'),('finance_variance_open')),
  metrics AS (
    SELECT n.signal, jsonb_build_object(
      'count',least(count(s.at),1000), 'clipped',count(s.at)>1000,
      'oldest_age_seconds',CASE WHEN count(s.at)=0 THEN NULL ELSE
        floor(extract(epoch FROM statement_timestamp()-min(s.at)))::bigint END
    ) AS value
    FROM signals n LEFT JOIN samples s USING(signal) GROUP BY n.signal
  )
  SELECT jsonb_build_object('schema_version',1,'scope','all-branches','coverage','queue-state-only',
    'observed_at',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'metrics',(SELECT jsonb_object_agg(signal,value) FROM metrics));
$$;
REVOKE ALL ON FUNCTION public.operational_health_snapshot() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.operational_health_snapshot() TO service_role;
COMMENT ON FUNCTION public.operational_health_snapshot() IS
  'Service-only bounded aggregate queue gauges. Counts cap at 1000 with clipping. No identities, amounts or worker heartbeat proof.';

-- Scale the read-only observer without changing dispatch or ledger authority.
-- Replaces per-pair nested recipient helper calls with equivalent relational
-- predicates. Parity cases compare the result to the authoritative helper.
-- Existing grants, stability, empty search_path and output schema are retained.
CREATE OR REPLACE FUNCTION public.operational_integrity_snapshot() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH ledger AS (
    SELECT user_id,sum(points_delta) AS balance,sum(reserved_delta) AS reserved,
      sum(redemption_points) AS redeemed,coalesce(sum(points_delta) FILTER(WHERE kind='earn'),0) AS earned,
      count(*) FILTER(WHERE kind='opening') AS openings,
      sum(points_delta) FILTER(WHERE kind='opening') AS opening_balance
    FROM public.loyalty_ledger GROUP BY user_id
  ), holds AS (
    SELECT user_id,sum(points_cost) AS points FROM public.reward_reservations
    WHERE status IN ('reserved','claiming') GROUP BY user_id
  ), subjects AS (
    SELECT user_id FROM public.loyalty_accounts UNION SELECT user_id FROM public.user_points
    UNION SELECT user_id FROM ledger UNION SELECT user_id FROM holds
  ), mismatches AS (
    SELECT s.user_id FROM subjects s
    LEFT JOIN public.loyalty_accounts a USING(user_id)
    LEFT JOIN public.user_points p USING(user_id)
    LEFT JOIN ledger l USING(user_id) LEFT JOIN holds h USING(user_id)
    WHERE a.user_id IS NULL OR p.user_id IS NULL OR l.user_id IS NULL OR l.openings<>1
      OR a.opening_balance IS DISTINCT FROM l.opening_balance
      OR a.balance IS DISTINCT FROM l.balance OR a.balance IS DISTINCT FROM p.current_points
      OR a.reserved_points IS DISTINCT FROM l.reserved OR a.reserved_points IS DISTINCT FROM p.reserved_points
      OR a.reserved_points IS DISTINCT FROM coalesce(h.points,0)
      OR a.earned_gross IS DISTINCT FROM a.opening_earned+l.earned
      OR a.redeemed_gross IS DISTINCT FROM a.opening_redeemed+l.redeemed
      OR a.earned_gross IS DISTINCT FROM p.total_earned OR a.redeemed_gross IS DISTINCT FROM p.total_redeemed
    LIMIT 1001
  ), missing_pairs AS (
    -- Match worker materialisation plus its final current-recipient/MFA fence.
    -- Existing pairs in any state are not a missing materialisation. This
    -- reads no advisory locks and never creates or leases delivery rows.
    SELECT e.created_at FROM public.notification_events e
    JOIN public.push_devices d ON d.user_id=e.recipient_id
    JOIN public.push_settings s ON s.singleton
    WHERE s.enabled AND d.project_id=s.expo_project_id AND d.active AND d.expo_token IS NOT NULL
      AND d.expires_at>statement_timestamp() AND d.bound_at<=e.created_at
      AND e.created_at>=s.enabled_since AND e.expires_at>statement_timestamp()
      -- Evaluate the same current-recipient fences as push_event_allowed in
      -- relational form. Calling nested SECURITY DEFINER SQL helpers for every
      -- candidate pair executes nested queries and dominates the
      -- observer at scale. Branch assignment stays on its authoritative helper.
      AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=e.recipient_id AND u.deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.privacy_requests p WHERE p.user_id=e.recipient_id
        AND p.kind='deletion' AND p.status IN ('processing','completed'))
      AND ((e.kind='order' AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=e.order_id AND o.user_id=e.recipient_id))
        OR (e.kind='reward' AND EXISTS(SELECT 1 FROM public.reward_reservations r WHERE r.id=e.reservation_id AND r.user_id=e.recipient_id))
        OR (e.kind='branch' AND public.staff_assignment(e.store_id,e.recipient_id)))
      AND (NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=d.user_id AND r.role IN ('staff','manager','finance','admin'))
        OR (d.aal2 AND d.verified_at>statement_timestamp()-interval '24 hours'))
      AND NOT EXISTS(SELECT 1 FROM public.push_deliveries j WHERE j.event_id=e.id AND j.device_id=d.id)
    ORDER BY e.created_at,e.id,d.id LIMIT 1001
  )
  SELECT jsonb_build_object('schema_version',1,'scope','all-branches','coverage','loyalty-and-push-materialisation',
    'observed_at',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'push_enabled',coalesce((SELECT enabled FROM public.push_settings WHERE singleton),false),
    'metrics',jsonb_build_object(
      'loyalty_mismatches',(SELECT jsonb_build_object('count',least(count(*),1000),'clipped',count(*)>1000) FROM mismatches),
      'push_materialisation_due',(SELECT jsonb_build_object('count',least(count(*),1000),'clipped',count(*)>1000,
        'oldest_age_seconds',CASE WHEN count(*)=0 THEN NULL ELSE floor(extract(epoch FROM statement_timestamp()-min(created_at)))::bigint END) FROM missing_pairs)));
$$;
COMMENT ON FUNCTION public.operational_integrity_snapshot() IS
  'Service-only whole-ledger and eligible missing-pair aggregates. Set-based recipient fences; no identities, values, repair, locks or dispatch. Full scan cost still requires hosted review.';

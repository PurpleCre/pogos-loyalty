-- Cash fulfilment is enabled per branch only after real procedures/cashiers are
-- approved. No rate, cashier, opening approval, or operational flag is seeded.
ALTER TABLE public.cash_order_settings
  ADD COLUMN fulfilment_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN acceptance_minutes INTEGER CHECK (acceptance_minutes BETWEEN 1 AND 120);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'));
ALTER TABLE public.orders
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN acceptance_deadline TIMESTAMPTZ,
  ADD COLUMN assigned_collector_id UUID REFERENCES public.profiles(id),
  ADD COLUMN cash_custody_status TEXT CHECK (cash_custody_status IN ('held', 'handover_pending', 'settled')),
  ADD COLUMN loyalty_status TEXT NOT NULL DEFAULT 'not_eligible'
    CHECK (loyalty_status IN ('not_eligible', 'no_rule', 'awaiting_review', 'awarded', 'reversed', 'voided')),
  ADD COLUMN points_reversed BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.order_status_events
  ALTER COLUMN actor_id DROP NOT NULL,
  ADD COLUMN event_type TEXT NOT NULL DEFAULT 'status',
  ADD COLUMN details JSONB NOT NULL DEFAULT '{}';

CREATE TABLE public.cash_branch_cashiers (
  store_id UUID NOT NULL REFERENCES public.stores(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  active BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (store_id, user_id)
);
CREATE TABLE public.cash_loyalty_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'ZWG')),
  basis TEXT NOT NULL CHECK (basis IN ('subtotal', 'total')),
  points_per_unit INTEGER NOT NULL CHECK (points_per_unit BETWEEN 1 AND 1000000),
  spend_unit_minor BIGINT NOT NULL CHECK (spend_unit_minor BETWEEN 1 AND 100000000),
  max_points INTEGER NOT NULL CHECK (max_points BETWEEN 1 AND 1000000),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT false
);
CREATE FUNCTION public.protect_cash_loyalty_rule() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - 'active') IS DISTINCT FROM (to_jsonb(OLD) - 'active') THEN
    RAISE EXCEPTION 'Create a new version of the earning rule' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_cash_loyalty_rule BEFORE UPDATE OR DELETE ON public.cash_loyalty_rules
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_loyalty_rule();
ALTER TABLE public.cash_order_quotes ADD COLUMN earning_rule_id UUID REFERENCES public.cash_loyalty_rules(id);
ALTER TABLE public.orders ADD COLUMN earning_rule_id UUID REFERENCES public.cash_loyalty_rules(id);

CREATE TABLE public.cash_order_commands (
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  command_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, command_id)
);
CREATE TABLE public.cash_receipts (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  sale_reference TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  tendered_minor BIGINT NOT NULL,
  change_minor BIGINT NOT NULL CHECK (change_minor >= 0),
  received_by UUID NOT NULL REFERENCES public.profiles(id),
  current_holder_id UUID NOT NULL REFERENCES public.profiles(id),
  pending_receiver_id UUID REFERENCES public.profiles(id),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tendered_minor - change_minor = amount_minor),
  UNIQUE (store_id, sale_reference)
);
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('received', 'handover_requested', 'handover_cancelled', 'settled', 'refunded')),
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL,
  reference TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cash_receipts_unsettled_branch ON public.cash_receipts(store_id, currency) WHERE settled_at IS NULL;
CREATE INDEX cash_movements_branch_day ON public.cash_movements(store_id, created_at);
CREATE INDEX cash_orders_acceptance_expiry ON public.orders(acceptance_deadline) WHERE status = 'pending' AND payment_method = 'cash';
CREATE INDEX cash_orders_branch_worklist ON public.orders(store_id, created_at) WHERE status IN ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery')
  OR cash_custody_status IN ('held', 'handover_pending') OR loyalty_status = 'awaiting_review';
CREATE UNIQUE INDEX cash_movement_once ON public.cash_movements(order_id, event_type)
  WHERE event_type IN ('received', 'settled', 'refunded');
CREATE UNIQUE INDEX cash_refund_reference ON public.cash_movements(store_id, reference) WHERE event_type = 'refunded';

ALTER TABLE public.user_points
  ALTER COLUMN current_points TYPE BIGINT,
  ALTER COLUMN total_earned TYPE BIGINT,
  ALTER COLUMN total_redeemed TYPE BIGINT;
CREATE TABLE public.loyalty_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  opening_balance BIGINT NOT NULL,
  opening_earned BIGINT NOT NULL,
  opening_redeemed BIGINT NOT NULL,
  balance BIGINT NOT NULL,
  earned_gross BIGINT NOT NULL,
  redeemed_gross BIGINT NOT NULL,
  opening_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ
);
CREATE TABLE public.loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  order_id UUID REFERENCES public.orders(id),
  actor_id UUID REFERENCES public.profiles(id),
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'opening_review', 'earn', 'reversal')),
  points_delta BIGINT NOT NULL,
  rule_id UUID REFERENCES public.cash_loyalty_rules(id),
  reverses_id UUID UNIQUE REFERENCES public.loyalty_ledger(id),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'earn' AND points_delta >= 0 AND order_id IS NOT NULL AND rule_id IS NOT NULL) OR
    (kind = 'reversal' AND points_delta <= 0 AND reverses_id IS NOT NULL AND order_id IS NOT NULL) OR
    (kind = 'opening_review' AND points_delta = 0) OR kind = 'opening')
);
CREATE INDEX loyalty_ledger_user_idx ON public.loyalty_ledger(user_id, created_at DESC);
CREATE UNIQUE INDEX loyalty_opening_once ON public.loyalty_ledger(user_id) WHERE kind = 'opening';
CREATE UNIQUE INDEX loyalty_opening_review_once ON public.loyalty_ledger(user_id) WHERE kind = 'opening_review';
INSERT INTO public.loyalty_accounts(user_id, opening_balance, opening_earned, opening_redeemed, balance, earned_gross, redeemed_gross)
  SELECT user_id, coalesce(current_points, 0), coalesce(total_earned, 0), coalesce(total_redeemed, 0),
    coalesce(current_points, 0), coalesce(total_earned, 0), coalesce(total_redeemed, 0) FROM public.user_points;
INSERT INTO public.loyalty_ledger(user_id, event_key, kind, points_delta, details)
  SELECT user_id, 'opening:' || user_id, 'opening', opening_balance,
    jsonb_build_object('legacy_earned', opening_earned, 'legacy_redeemed', opening_redeemed, 'requires_review', true)
  FROM public.loyalty_accounts;

CREATE FUNCTION public.protect_cash_audit_record() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
  RAISE EXCEPTION 'Audit records are append only' USING ERRCODE = '42501';
END; $$;
CREATE TRIGGER immutable_loyalty_ledger BEFORE UPDATE OR DELETE ON public.loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_audit_record();
CREATE TRIGGER immutable_cash_movements BEFORE UPDATE OR DELETE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_audit_record();
CREATE TRIGGER immutable_cash_commands BEFORE UPDATE OR DELETE ON public.cash_order_commands
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_audit_record();
CREATE TRIGGER immutable_order_events BEFORE UPDATE OR DELETE ON public.order_status_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_audit_record();
CREATE FUNCTION public.protect_cash_receipt() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - ARRAY['current_holder_id', 'pending_receiver_id', 'settled_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['current_holder_id', 'pending_receiver_id', 'settled_at']) THEN
    RAISE EXCEPTION 'Original cash receipt details are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER immutable_cash_receipt BEFORE UPDATE OR DELETE ON public.cash_receipts
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_receipt();

CREATE FUNCTION public.project_loyalty_entry() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.loyalty_accounts%ROWTYPE;
BEGIN
  UPDATE public.loyalty_accounts SET balance = balance + NEW.points_delta,
    earned_gross = earned_gross + CASE WHEN NEW.kind = 'earn' THEN NEW.points_delta ELSE 0 END
    WHERE user_id = NEW.user_id RETURNING * INTO v_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing loyalty account'; END IF;
  UPDATE public.user_points SET current_points = v_account.balance, total_earned = v_account.earned_gross,
    total_redeemed = v_account.redeemed_gross, updated_at = now() WHERE user_id = NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER project_loyalty_entry AFTER INSERT ON public.loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION public.project_loyalty_entry();
CREATE FUNCTION public.initialise_loyalty_account() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  INSERT INTO public.loyalty_accounts(user_id, opening_balance, opening_earned, opening_redeemed,
    balance, earned_gross, redeemed_gross, opening_reviewed)
  VALUES (NEW.user_id, coalesce(NEW.current_points, 0), coalesce(NEW.total_earned, 0), coalesce(NEW.total_redeemed, 0),
    0, coalesce(NEW.total_earned, 0), coalesce(NEW.total_redeemed, 0),
    coalesce(NEW.current_points, 0) = 0 AND coalesce(NEW.total_earned, 0) = 0 AND coalesce(NEW.total_redeemed, 0) = 0);
  INSERT INTO public.loyalty_ledger(user_id, event_key, kind, points_delta)
    VALUES (NEW.user_id, 'opening:' || NEW.user_id, 'opening', coalesce(NEW.current_points, 0));
  RETURN NEW;
END; $$;
CREATE TRIGGER initialise_loyalty_account AFTER INSERT ON public.user_points
  FOR EACH ROW EXECUTE FUNCTION public.initialise_loyalty_account();

-- Disable legacy side effects and the old POS processor until it uses this ledger.
DROP TRIGGER IF EXISTS check_achievements_after_transaction ON public.transactions;
REVOKE EXECUTE ON FUNCTION public.process_gaap_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, NUMERIC, JSONB, JSONB) FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.user_points FROM service_role;
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_points' LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.user_points FROM service_role', c.column_name, c.column_name);
  END LOOP;
END; $$;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check CHECK (transaction_type IN ('purchase', 'redemption', 'refund'));
ALTER TABLE public.transactions ADD COLUMN order_id UUID REFERENCES public.orders(id),
  ADD COLUMN ledger_entry_id UUID UNIQUE REFERENCES public.loyalty_ledger(id),
  ADD COLUMN currency TEXT, ADD COLUMN amount_minor BIGINT;
CREATE UNIQUE INDEX cash_transaction_once ON public.transactions(order_id, transaction_type) WHERE order_id IS NOT NULL;

CREATE FUNCTION public.cash_staff_access(p_store UUID, p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_role(p_actor, 'admin') OR EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor AND role = 'staff' AND staff_store_id = p_store)
$$;
CREATE FUNCTION public.cash_is_cashier(p_store UUID, p_actor UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.cash_staff_access(p_store, p_actor) AND EXISTS (SELECT 1 FROM public.cash_branch_cashiers
    WHERE store_id = p_store AND user_id = p_actor AND active)
$$;
CREATE FUNCTION public.cash_reference(p_value TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$ BEGIN
  IF p_value IS NULL OR length(btrim(p_value)) NOT BETWEEN 1 AND 160 OR p_value ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Enter a complete unique GAAP or till reference' USING ERRCODE = '22023';
  END IF;
  RETURN upper(regexp_replace(btrim(p_value), '[[:space:]]+', ' ', 'g'));
END; $$;

-- Wrap the existing validated price engine; only this wrapper remains callable.
ALTER FUNCTION public.quote_cash_order(JSONB) RENAME TO quote_cash_order_internal;
REVOKE ALL ON FUNCTION public.quote_cash_order_internal(JSONB) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.quote_cash_order(p_request JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_store UUID; v_quote JSONB; v_rule public.cash_loyalty_rules%ROWTYPE; v_points BIGINT := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a total' USING ERRCODE = '42501'; END IF;
  v_store := (p_request->>'store_id')::uuid;
  PERFORM 1 FROM public.cash_order_settings WHERE store_id = v_store AND fulfilment_enabled
    AND acceptance_minutes IS NOT NULL FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.cash_branch_cashiers c WHERE c.store_id = v_store
    AND c.active AND public.cash_staff_access(v_store, c.user_id)) THEN
    RAISE EXCEPTION 'This branch is not accepting app orders yet' USING ERRCODE = '22023';
  END IF;
  v_quote := public.quote_cash_order_internal(p_request);
  SELECT * INTO v_rule FROM public.cash_loyalty_rules WHERE store_id = v_store AND currency = v_quote->>'currency'
    AND active AND effective_from <= clock_timestamp() ORDER BY effective_from DESC, id LIMIT 1 FOR SHARE;
  IF FOUND THEN
    v_points := least(v_rule.max_points, floor((CASE WHEN v_rule.basis = 'subtotal'
      THEN (v_quote->>'subtotal_minor')::numeric ELSE (v_quote->>'total_minor')::numeric END)
      * v_rule.points_per_unit / v_rule.spend_unit_minor));
    UPDATE public.cash_order_quotes SET earning_rule_id = v_rule.id WHERE id = (v_quote->>'quote_id')::uuid;
  END IF;
  RETURN v_quote || jsonb_build_object('estimated_points', v_points, 'loyalty_earn_configured', v_rule.id IS NOT NULL);
END; $$;
CREATE FUNCTION public.initialise_cash_fulfilment() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_minutes INTEGER; v_rule UUID;
BEGIN
  IF NEW.quote_id IS NULL THEN RETURN NEW; END IF;
  SELECT acceptance_minutes INTO v_minutes FROM public.cash_order_settings
    WHERE store_id = NEW.store_id AND fulfilment_enabled FOR SHARE;
  IF v_minutes IS NULL OR NOT EXISTS (SELECT 1 FROM public.cash_branch_cashiers c WHERE c.store_id = NEW.store_id
    AND c.active AND public.cash_staff_access(NEW.store_id, c.user_id)) THEN
    RAISE EXCEPTION 'Branch fulfilment is unavailable' USING ERRCODE = '22023'; END IF;
  SELECT earning_rule_id INTO v_rule FROM public.cash_order_quotes WHERE id = NEW.quote_id;
  NEW.earning_rule_id := v_rule;
  NEW.acceptance_deadline := clock_timestamp() + make_interval(mins => v_minutes);
  RETURN NEW;
END; $$;
CREATE TRIGGER initialise_cash_fulfilment BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.initialise_cash_fulfilment();

CREATE FUNCTION public.apply_cash_order_earning(p_order UUID, p_actor UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.orders%ROWTYPE; v_account public.loyalty_accounts%ROWTYPE;
  v_rule public.cash_loyalty_rules%ROWTYPE; v_points BIGINT; v_entry UUID;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order FOR UPDATE;
  IF v_order.status <> 'completed' OR v_order.payment_status <> 'paid' OR v_order.loyalty_status IN ('awarded', 'reversed', 'voided') THEN RETURN; END IF;
  IF v_order.earning_rule_id IS NULL THEN
    UPDATE public.orders SET loyalty_status = 'no_rule' WHERE id = p_order; RETURN;
  END IF;
  SELECT * INTO v_account FROM public.loyalty_accounts WHERE user_id = v_order.user_id FOR UPDATE;
  IF NOT FOUND OR NOT v_account.opening_reviewed THEN
    UPDATE public.orders SET loyalty_status = 'awaiting_review' WHERE id = p_order; RETURN;
  END IF;
  SELECT * INTO STRICT v_rule FROM public.cash_loyalty_rules WHERE id = v_order.earning_rule_id;
  v_points := least(v_rule.max_points, floor((CASE WHEN v_rule.basis = 'subtotal'
    THEN v_order.subtotal_minor::numeric ELSE v_order.total_minor::numeric END) * v_rule.points_per_unit / v_rule.spend_unit_minor));
  INSERT INTO public.loyalty_ledger(user_id, order_id, actor_id, event_key, kind, points_delta, rule_id, details)
    VALUES (v_order.user_id, p_order, p_actor, 'earn:' || p_order, 'earn', v_points, v_rule.id,
      jsonb_build_object('basis', v_rule.basis, 'currency', v_order.currency)) RETURNING id INTO v_entry;
  UPDATE public.orders SET points_earned = v_points, loyalty_status = 'awarded' WHERE id = p_order;
  UPDATE public.transactions SET points_earned = v_points, ledger_entry_id = v_entry
    WHERE order_id = p_order AND transaction_type = 'purchase';
END; $$;

CREATE FUNCTION public.operate_cash_order(p_order_id UUID, p_command_id UUID, p_expected_version INTEGER,
  p_action TEXT, p_details JSONB DEFAULT '{}') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_order public.orders%ROWTYPE; v_previous public.cash_order_commands%ROWTYPE;
  v_receipt public.cash_receipts%ROWTYPE; v_request JSONB; v_result JSONB; v_reference TEXT;
  v_reason TEXT; v_tender BIGINT; v_recipient UUID; v_earn public.loyalty_ledger%ROWTYPE;
  v_reversal UUID; v_admin BOOLEAN; v_new_status TEXT; v_allowed TEXT[];
BEGIN
  IF v_actor IS NULL OR NOT (public.has_role(v_actor, 'admin') OR public.has_role(v_actor, 'staff')) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501'; END IF;
  IF p_order_id IS NULL OR p_command_id IS NULL OR p_expected_version IS NULL OR p_action IS NULL
    OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid staff command' USING ERRCODE = '22023'; END IF;
  v_allowed := CASE p_action
    WHEN 'dispatch' THEN ARRAY['reason', 'collector_id']
    WHEN 'complete' THEN ARRAY['reason', 'cash_received', 'handover_confirmed', 'cash_currency', 'tendered_minor', 'sale_reference']
    WHEN 'request_cash_handover' THEN ARRAY['reason', 'receiver_id']
    WHEN 'accept_cash_handover' THEN ARRAY['reason', 'cash_counted', 'till_reference']
    WHEN 'settle_cash' THEN ARRAY['reason', 'cash_counted', 'till_reference']
    WHEN 'refund' THEN ARRAY['reason', 'refund_confirmed', 'refund_source', 'credit_note_reference']
    ELSE ARRAY['reason'] END;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_details) k WHERE NOT k = ANY(v_allowed)) OR
    (p_details ? 'reason' AND jsonb_typeof(p_details->'reason') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Unknown command details' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || ':staff:' || p_command_id::text, 0));
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND public.cash_staff_access(store_id, v_actor) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable for this staff member' USING ERRCODE = '42501'; END IF;
  v_request := jsonb_build_object('order_id', p_order_id, 'version', p_expected_version, 'action', p_action, 'details', p_details);
  SELECT * INTO v_previous FROM public.cash_order_commands WHERE actor_id = v_actor AND command_id = p_command_id;
  IF FOUND THEN
    IF v_previous.request <> v_request THEN RAISE EXCEPTION 'Command reference was already used for another request' USING ERRCODE = '22023'; END IF;
    RETURN v_previous.result;
  END IF;
  IF v_order.quote_id IS NULL OR v_order.payment_method <> 'cash' THEN
    RAISE EXCEPTION 'This legacy order requires a reviewed support process' USING ERRCODE = '22023'; END IF;
  IF v_order.version <> p_expected_version THEN RAISE EXCEPTION 'Order changed. Refresh before trying again' USING ERRCODE = '40001'; END IF;
  v_admin := public.has_role(v_actor, 'admin');
  v_reason := btrim(coalesce(p_details->>'reason', ''));
  IF length(v_reason) > 500 THEN RAISE EXCEPTION 'Reason is too long' USING ERRCODE = '22023'; END IF;
  v_new_status := v_order.status;

  IF p_action = 'accept' THEN
    IF v_order.status <> 'pending' OR v_order.acceptance_deadline <= clock_timestamp() THEN
      RAISE EXCEPTION 'Order can no longer be accepted' USING ERRCODE = '22023'; END IF;
    v_new_status := 'accepted';
  ELSIF p_action = 'prepare' THEN
    IF v_order.status <> 'accepted' THEN RAISE EXCEPTION 'Accept this order first' USING ERRCODE = '22023'; END IF;
    v_new_status := 'preparing';
  ELSIF p_action = 'ready' THEN
    IF v_order.status <> 'preparing' THEN RAISE EXCEPTION 'Order is not being prepared' USING ERRCODE = '22023'; END IF;
    v_new_status := 'ready';
  ELSIF p_action = 'dispatch' THEN
    IF v_order.status <> 'ready' OR v_order.fulfilment_mode <> 'delivery' THEN RAISE EXCEPTION 'Delivery is not ready for dispatch' USING ERRCODE = '22023'; END IF;
    v_recipient := (p_details->>'collector_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_recipient AND role = 'staff' AND staff_store_id = v_order.store_id) THEN
      RAISE EXCEPTION 'Choose a staff collector assigned to this branch' USING ERRCODE = '22023'; END IF;
    UPDATE public.orders SET assigned_collector_id = v_recipient WHERE id = p_order_id;
    v_new_status := 'out_for_delivery';
  ELSIF p_action = 'complete' THEN
    IF v_order.payment_status <> 'unpaid' OR
      (v_order.fulfilment_mode = 'collection' AND v_order.status <> 'ready') OR
      (v_order.fulfilment_mode = 'delivery' AND v_order.status <> 'out_for_delivery') THEN
      RAISE EXCEPTION 'Order is not ready for cash handover' USING ERRCODE = '22023'; END IF;
    IF v_order.fulfilment_mode = 'delivery' AND v_actor IS DISTINCT FROM v_order.assigned_collector_id
      AND (NOT v_admin OR length(v_reason) < 3) THEN
      RAISE EXCEPTION 'Only the assigned collector can complete delivery; supervisor overrides require a reason' USING ERRCODE = '42501'; END IF;
    IF p_details->'cash_received' IS DISTINCT FROM 'true'::jsonb OR p_details->'handover_confirmed' IS DISTINCT FROM 'true'::jsonb
      OR (p_details->>'cash_currency') IS DISTINCT FROM v_order.currency OR
      jsonb_typeof(p_details->'tendered_minor') IS DISTINCT FROM 'number' OR (p_details->>'tendered_minor') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Confirm cash currency, amount received and customer handover' USING ERRCODE = '22023'; END IF;
    v_tender := (p_details->>'tendered_minor')::bigint;
    IF v_tender < v_order.total_minor OR v_tender > 200000000 THEN
      RAISE EXCEPTION 'Cash tender must cover the exact order total' USING ERRCODE = '22023'; END IF;
    v_reference := public.cash_reference(p_details->>'sale_reference');
    INSERT INTO public.cash_receipts(order_id, store_id, sale_reference, currency, amount_minor, tendered_minor, change_minor, received_by, current_holder_id)
      VALUES (p_order_id, v_order.store_id, v_reference, v_order.currency, v_order.total_minor, v_tender, v_tender - v_order.total_minor, v_actor, v_actor);
    INSERT INTO public.cash_movements(order_id, store_id, actor_id, event_type, amount_minor, currency, reference, details)
      VALUES (p_order_id, v_order.store_id, v_actor, 'received', v_order.total_minor, v_order.currency, v_reference,
        jsonb_build_object('tendered_minor', v_tender, 'change_minor', v_tender - v_order.total_minor, 'reason', v_reason));
    UPDATE public.orders SET payment_status = 'paid', cash_custody_status = 'held' WHERE id = p_order_id;
    INSERT INTO public.transactions(user_id, amount, amount_minor, currency, order_id, points_earned, transaction_type, source, items)
      VALUES (v_order.user_id, v_order.total_amount, v_order.total_minor, v_order.currency, p_order_id, 0, 'purchase', 'app',
        ARRAY(SELECT item_name FROM public.order_items WHERE order_id = p_order_id));
    v_new_status := 'completed';
  ELSIF p_action IN ('cancel', 'expire') THEN
    IF v_order.payment_status <> 'unpaid' OR v_order.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Paid or terminal orders cannot be cancelled; use the approved refund process' USING ERRCODE = '22023'; END IF;
    IF p_action = 'expire' THEN
      IF v_order.status <> 'pending' OR v_order.acceptance_deadline > clock_timestamp() THEN
        RAISE EXCEPTION 'This order has not expired' USING ERRCODE = '22023'; END IF;
    ELSIF length(v_reason) < 3 THEN RAISE EXCEPTION 'Enter a cancellation reason' USING ERRCODE = '22023'; END IF;
    IF v_order.status = 'out_for_delivery' AND v_actor IS DISTINCT FROM v_order.assigned_collector_id AND NOT v_admin THEN
      RAISE EXCEPTION 'Only the collector or supervisor can cancel a dispatched delivery' USING ERRCODE = '42501'; END IF;
    v_new_status := 'cancelled';
  ELSIF p_action IN ('request_cash_handover', 'cancel_cash_handover', 'accept_cash_handover', 'settle_cash') THEN
    SELECT * INTO v_receipt FROM public.cash_receipts WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND OR v_receipt.settled_at IS NOT NULL THEN RAISE EXCEPTION 'There is no unsettled cash for this order' USING ERRCODE = '22023'; END IF;
    IF p_action IN ('request_cash_handover', 'cancel_cash_handover') THEN
      IF v_receipt.current_holder_id <> v_actor THEN RAISE EXCEPTION 'Only the current cash holder can arrange handover' USING ERRCODE = '42501'; END IF;
      IF p_action = 'request_cash_handover' THEN
        v_recipient := (p_details->>'receiver_id')::uuid;
        IF v_receipt.pending_receiver_id IS NOT NULL OR v_recipient = v_actor OR NOT public.cash_is_cashier(v_order.store_id, v_recipient) THEN
          RAISE EXCEPTION 'Choose another authorised branch cashier; resolve any pending handover first' USING ERRCODE = '22023'; END IF;
        UPDATE public.cash_receipts SET pending_receiver_id = v_recipient WHERE order_id = p_order_id;
        UPDATE public.orders SET cash_custody_status = 'handover_pending' WHERE id = p_order_id;
        v_reference := 'HANDOVER:' || p_command_id;
      ELSE
        IF v_receipt.pending_receiver_id IS NULL OR length(v_reason) < 3 THEN RAISE EXCEPTION 'A pending handover and cancellation reason are required' USING ERRCODE = '22023'; END IF;
        UPDATE public.cash_receipts SET pending_receiver_id = NULL WHERE order_id = p_order_id;
        UPDATE public.orders SET cash_custody_status = 'held' WHERE id = p_order_id;
        v_reference := 'CANCEL:' || p_command_id;
      END IF;
      INSERT INTO public.cash_movements(order_id, store_id, actor_id, event_type, amount_minor, currency, reference, details)
        VALUES (p_order_id, v_order.store_id, v_actor, CASE WHEN p_action = 'request_cash_handover' THEN 'handover_requested' ELSE 'handover_cancelled' END,
          v_order.total_minor, v_order.currency, v_reference, jsonb_build_object('receiver_id', v_recipient, 'reason', v_reason));
    ELSE
      IF NOT public.cash_is_cashier(v_order.store_id, v_actor) OR
        (p_action = 'accept_cash_handover' AND v_receipt.pending_receiver_id IS DISTINCT FROM v_actor) OR
        (p_action = 'settle_cash' AND (v_receipt.current_holder_id <> v_actor OR v_receipt.pending_receiver_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'Only the responsible branch cashier can acknowledge this cash' USING ERRCODE = '42501'; END IF;
      IF p_details->'cash_counted' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Confirm that the cash was counted' USING ERRCODE = '22023'; END IF;
      v_reference := public.cash_reference(p_details->>'till_reference');
      UPDATE public.cash_receipts SET current_holder_id = v_actor, pending_receiver_id = NULL, settled_at = clock_timestamp() WHERE order_id = p_order_id;
      UPDATE public.orders SET cash_custody_status = 'settled' WHERE id = p_order_id;
      INSERT INTO public.cash_movements(order_id, store_id, actor_id, event_type, amount_minor, currency, reference, details)
        VALUES (p_order_id, v_order.store_id, v_actor, 'settled', v_order.total_minor, v_order.currency, v_reference,
          jsonb_build_object('previous_holder_id', v_receipt.current_holder_id));
    END IF;
  ELSIF p_action = 'refund' THEN
    IF NOT v_admin THEN RAISE EXCEPTION 'Administrator approval is required for refunds' USING ERRCODE = '42501'; END IF;
    IF v_order.status <> 'completed' OR v_order.payment_status <> 'paid' OR length(v_reason) < 3
      OR p_details->'refund_confirmed' IS DISTINCT FROM 'true'::jsonb OR (p_details->>'refund_source') IS DISTINCT FROM 'till' THEN
      RAISE EXCEPTION 'Confirm the full refund paid from the till and provide a reason' USING ERRCODE = '22023'; END IF;
    v_reference := public.cash_reference(p_details->>'credit_note_reference');
    INSERT INTO public.cash_movements(order_id, store_id, actor_id, event_type, amount_minor, currency, reference, details)
      VALUES (p_order_id, v_order.store_id, v_actor, 'refunded', -v_order.total_minor, v_order.currency, v_reference,
        jsonb_build_object('reason', v_reason, 'refund_source', 'till'));
    SELECT * INTO v_earn FROM public.loyalty_ledger WHERE order_id = p_order_id AND kind = 'earn';
    IF FOUND THEN
      INSERT INTO public.loyalty_ledger(user_id, order_id, actor_id, event_key, kind, points_delta, rule_id, reverses_id, details)
        VALUES (v_order.user_id, p_order_id, v_actor, 'refund:' || p_order_id, 'reversal', -v_earn.points_delta, v_earn.rule_id, v_earn.id,
          jsonb_build_object('credit_note_reference', v_reference, 'reason', v_reason)) RETURNING id INTO v_reversal;
    END IF;
    UPDATE public.orders SET payment_status = 'refunded', points_reversed = coalesce(v_earn.points_delta, 0),
      loyalty_status = CASE WHEN v_reversal IS NULL THEN 'voided' ELSE 'reversed' END WHERE id = p_order_id;
    INSERT INTO public.transactions(user_id, amount, amount_minor, currency, order_id, ledger_entry_id, points_redeemed, transaction_type, source, items)
      VALUES (v_order.user_id, -v_order.total_amount, -v_order.total_minor, v_order.currency, p_order_id, v_reversal,
        coalesce(v_earn.points_delta, 0), 'refund', 'app', ARRAY['Full cash refund']);
  ELSIF p_action = 'retry_loyalty' THEN
    IF NOT v_admin THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
    IF v_order.status <> 'completed' OR v_order.payment_status <> 'paid' THEN RAISE EXCEPTION 'Only settled purchases can earn points' USING ERRCODE = '22023'; END IF;
  ELSE RAISE EXCEPTION 'Unknown staff action' USING ERRCODE = '22023';
  END IF;
  UPDATE public.orders SET status = v_new_status, version = version + 1, updated_at = now() WHERE id = p_order_id;
  IF p_action IN ('complete', 'retry_loyalty') THEN PERFORM public.apply_cash_order_earning(p_order_id, v_actor); END IF;
  INSERT INTO public.order_status_events(order_id, actor_id, status, event_type, details)
    VALUES (p_order_id, v_actor, v_new_status, p_action, p_details);
  SELECT jsonb_build_object('order_id', id, 'status', status, 'version', version,
    'payment_status', payment_status, 'cash_custody_status', cash_custody_status, 'points_earned', points_earned,
    'loyalty_status', loyalty_status) INTO v_result FROM public.orders WHERE id = p_order_id;
  INSERT INTO public.cash_order_commands(actor_id, command_id, order_id, request, result) VALUES (v_actor, p_command_id, p_order_id, v_request, v_result);
  RETURN v_result;
END; $$;

CREATE FUNCTION public.approve_loyalty_opening(p_user_id UUID, p_expected_balance BIGINT, p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.loyalty_accounts%ROWTYPE; v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN RAISE EXCEPTION 'Administrator review required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_account FROM public.loyalty_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_account.opening_balance IS DISTINCT FROM p_expected_balance OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Check the opening balance and provide a review reason' USING ERRCODE = '22023'; END IF;
  IF NOT v_account.opening_reviewed THEN
    UPDATE public.loyalty_accounts SET opening_reviewed = true, reviewed_by = v_actor, reviewed_at = now() WHERE user_id = p_user_id;
    INSERT INTO public.loyalty_ledger(user_id, actor_id, event_key, kind, points_delta, details)
      VALUES (p_user_id, v_actor, 'opening-review:' || p_user_id, 'opening_review', 0, jsonb_build_object('reason', btrim(p_reason)));
  END IF;
  RETURN jsonb_build_object('reviewed', true);
END; $$;

CREATE FUNCTION public.list_cash_branch_staff(p_store_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.cash_staff_access(p_store_id, auth.uid()) THEN RAISE EXCEPTION 'Branch access required' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', p.id, 'name', coalesce(nullif(p.full_name, ''), 'Staff member'),
    'cashier', public.cash_is_cashier(p_store_id, p.id)) ORDER BY p.full_name, p.id) FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'staff' AND r.staff_store_id = p_store_id)
      OR public.cash_is_cashier(p_store_id, p.id)), '[]'::jsonb);
END; $$;

CREATE FUNCTION public.expire_pending_cash_orders(p_limit INTEGER DEFAULT 100) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order RECORD; v_count INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid expiry batch size' USING ERRCODE = '22023'; END IF;
  FOR v_order IN SELECT id FROM public.orders WHERE status = 'pending' AND payment_method = 'cash'
    AND payment_status = 'unpaid' AND acceptance_deadline <= clock_timestamp() ORDER BY acceptance_deadline LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.orders SET status = 'cancelled', version = version + 1, updated_at = now() WHERE id = v_order.id;
    INSERT INTO public.order_status_events(order_id, actor_id, status, event_type) VALUES (v_order.id, NULL, 'cancelled', 'expired');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['cash_branch_cashiers', 'cash_loyalty_rules', 'cash_order_commands', 'cash_receipts', 'cash_movements', 'loyalty_accounts', 'loyalty_ledger'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
END; $$;
GRANT SELECT ON public.cash_receipts, public.cash_movements, public.loyalty_accounts, public.loyalty_ledger TO authenticated;
CREATE POLICY "Staff read branch cash receipts" ON public.cash_receipts FOR SELECT TO authenticated USING (public.cash_staff_access(store_id, auth.uid()));
CREATE POLICY "Staff read branch cash movements" ON public.cash_movements FOR SELECT TO authenticated USING (public.cash_staff_access(store_id, auth.uid()));
DROP POLICY "Read visible order events" ON public.order_status_events;
CREATE POLICY "Staff read branch order audit" ON public.order_status_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.cash_staff_access(o.store_id, auth.uid())));
CREATE POLICY "Read own or admin loyalty accounts" ON public.loyalty_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Read own or admin ledger" ON public.loyalty_ledger FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Policy helpers accept explicit users but expose only boolean membership.
GRANT EXECUTE ON FUNCTION public.cash_staff_access(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.quote_cash_order(JSONB), public.operate_cash_order(UUID, UUID, INTEGER, TEXT, JSONB),
  public.approve_loyalty_opening(UUID, BIGINT, TEXT), public.list_cash_branch_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_cash_order(JSONB), public.operate_cash_order(UUID, UUID, INTEGER, TEXT, JSONB),
  public.approve_loyalty_opening(UUID, BIGINT, TEXT), public.list_cash_branch_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_cash_orders(INTEGER) TO service_role;

CREATE FUNCTION public.cash_branch_summary(p_store_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_start TIMESTAMPTZ := date_trunc('day', clock_timestamp() AT TIME ZONE 'Africa/Harare') AT TIME ZONE 'Africa/Harare';
BEGIN
  IF auth.uid() IS NULL OR NOT public.cash_staff_access(p_store_id, auth.uid()) THEN RAISE EXCEPTION 'Branch access required' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('business_day_start', v_start, 'currencies', coalesce((
    SELECT jsonb_agg(jsonb_build_object('currency', currency, 'received_minor', received, 'refunded_minor', refunded,
      'net_minor', received - refunded, 'settled_minor', settled, 'held_minor', held)) FROM (
      SELECT currency,
        coalesce(sum(amount_minor) FILTER (WHERE event_type = 'received' AND created_at >= v_start), 0) AS received,
        -coalesce(sum(amount_minor) FILTER (WHERE event_type = 'refunded' AND created_at >= v_start), 0) AS refunded,
        coalesce(sum(amount_minor) FILTER (WHERE event_type = 'settled' AND created_at >= v_start), 0) AS settled,
        (SELECT coalesce(sum(r.amount_minor), 0) FROM public.cash_receipts r WHERE r.store_id = p_store_id
          AND r.currency = m.currency AND r.settled_at IS NULL) AS held
      FROM public.cash_movements m WHERE store_id = p_store_id GROUP BY currency
    ) totals), '[]'::jsonb));
END; $$;
CREATE FUNCTION public.loyalty_reconciliation() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', coalesce(a.user_id, p.user_id, l.user_id), 'ledger_balance', l.balance,
    'account_balance', a.balance, 'display_balance', p.current_points)) FROM public.loyalty_accounts a
    FULL JOIN public.user_points p ON p.user_id = a.user_id
    FULL JOIN (SELECT user_id, sum(points_delta) AS balance,
      coalesce(sum(points_delta) FILTER (WHERE kind = 'earn'), 0) AS earned
      FROM public.loyalty_ledger GROUP BY user_id) l ON l.user_id = coalesce(a.user_id, p.user_id)
    WHERE a.user_id IS NULL OR p.user_id IS NULL OR l.user_id IS NULL
      OR l.balance IS DISTINCT FROM a.balance OR a.balance IS DISTINCT FROM p.current_points
      OR a.opening_earned + l.earned <> a.earned_gross OR a.opening_redeemed <> a.redeemed_gross
      OR a.earned_gross IS DISTINCT FROM p.total_earned OR a.redeemed_gross IS DISTINCT FROM p.total_redeemed), '[]'::jsonb);
END; $$;
GRANT EXECUTE ON FUNCTION public.cash_branch_summary(UUID), public.loyalty_reconciliation() TO authenticated;

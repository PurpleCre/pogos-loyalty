-- Standalone, branch-collected item rewards only. No trading configuration is
-- seeded: operations must approve benefits, stock, points, expiry and GAAP use.
CREATE TABLE public.reward_branch_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  terms_approved BOOLEAN NOT NULL DEFAULT false,
  max_active_per_customer INTEGER NOT NULL CHECK (max_active_per_customer BETWEEN 1 AND 20)
);
CREATE TABLE public.reward_branch_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  reward_id UUID NOT NULL REFERENCES public.rewards(id),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL CHECK (length(btrim(terms)) BETWEEN 3 AND 2000),
  gaap_product_reference TEXT NOT NULL CHECK (length(btrim(gaap_product_reference)) BETWEEN 1 AND 160),
  points_cost INTEGER NOT NULL CHECK (points_cost BETWEEN 1 AND 1000000),
  reservation_minutes INTEGER NOT NULL CHECK (reservation_minutes BETWEEN 1 AND 1440),
  available_units BIGINT NOT NULL DEFAULT 0 CHECK (available_units >= 0),
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION public.protect_reward_offer() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - ARRAY['enabled', 'available_units']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['enabled', 'available_units']) THEN
    RAISE EXCEPTION 'Create a new version of the approved reward offer' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_reward_offer BEFORE UPDATE OR DELETE ON public.reward_branch_offers
  FOR EACH ROW EXECUTE FUNCTION public.protect_reward_offer();
CREATE TABLE public.reward_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  offer_id UUID NOT NULL REFERENCES public.reward_branch_offers(id),
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  snapshot JSONB NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'claiming', 'fulfilled', 'cancelled', 'expired', 'voided')),
  claimed_by UUID REFERENCES public.profiles(id),
  claimed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reward_reservations_customer ON public.reward_reservations(user_id, created_at DESC);
CREATE INDEX reward_reservations_branch_queue ON public.reward_reservations(store_id, created_at) WHERE status IN ('reserved', 'claiming');
CREATE INDEX reward_reservations_expiry ON public.reward_reservations(expires_at) WHERE status = 'reserved';
-- Claims are never included in branch/customer list reads, audits or commands.
-- Only the owning customer's ticket RPC can retrieve the original bearer code.
CREATE TABLE public.reward_claim_secrets (
  reservation_id UUID PRIMARY KEY REFERENCES public.reward_reservations(id),
  claim_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
CREATE TABLE public.reward_commands (
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  command_id UUID NOT NULL,
  reservation_id UUID NOT NULL REFERENCES public.reward_reservations(id),
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id, command_id)
);
CREATE TABLE public.reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reward_reservations(id),
  actor_id UUID REFERENCES public.profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('reserved', 'claimed', 'fulfilled', 'cancelled', 'released', 'expired', 'voided')),
  version INTEGER NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reservation_id, version)
);
CREATE TABLE public.reward_fulfilments (
  reservation_id UUID PRIMARY KEY REFERENCES public.reward_reservations(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  gaap_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, gaap_reference)
);
CREATE TABLE public.reward_voids (
  reservation_id UUID PRIMARY KEY REFERENCES public.reward_reservations(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  credit_note_reference TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, credit_note_reference)
);
-- Cash and standalone rewards cannot reuse a branch sale/credit note identity.
CREATE TABLE public.branch_fiscal_references (
  store_id UUID NOT NULL REFERENCES public.stores(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('sale', 'credit_note')),
  reference TEXT NOT NULL,
  cash_order_id UUID REFERENCES public.orders(id),
  reward_reservation_id UUID REFERENCES public.reward_reservations(id),
  PRIMARY KEY(store_id, document_type, reference),
  CHECK ((cash_order_id IS NULL) <> (reward_reservation_id IS NULL))
);
INSERT INTO public.branch_fiscal_references(store_id, document_type, reference, cash_order_id)
  SELECT store_id, 'sale', sale_reference, order_id FROM public.cash_receipts;
INSERT INTO public.branch_fiscal_references(store_id, document_type, reference, cash_order_id)
  SELECT store_id, 'credit_note', reference, order_id FROM public.cash_movements WHERE event_type = 'refunded';
CREATE FUNCTION public.register_cash_fiscal_reference() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  IF TG_TABLE_NAME = 'cash_receipts' THEN
    INSERT INTO public.branch_fiscal_references(store_id, document_type, reference, cash_order_id)
      VALUES (NEW.store_id, 'sale', NEW.sale_reference, NEW.order_id);
  ELSIF NEW.event_type = 'refunded' THEN
    INSERT INTO public.branch_fiscal_references(store_id, document_type, reference, cash_order_id)
      VALUES (NEW.store_id, 'credit_note', NEW.reference, NEW.order_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER register_cash_sale_reference BEFORE INSERT ON public.cash_receipts
  FOR EACH ROW EXECUTE FUNCTION public.register_cash_fiscal_reference();
CREATE TRIGGER register_cash_credit_reference BEFORE INSERT ON public.cash_movements
  FOR EACH ROW WHEN (NEW.event_type = 'refunded') EXECUTE FUNCTION public.register_cash_fiscal_reference();

ALTER TABLE public.loyalty_accounts ADD COLUMN reserved_points BIGINT NOT NULL DEFAULT 0 CHECK (reserved_points >= 0);
ALTER TABLE public.user_points ADD COLUMN reserved_points BIGINT NOT NULL DEFAULT 0 CHECK (reserved_points >= 0);
ALTER TABLE public.loyalty_ledger
  ADD COLUMN reservation_id UUID REFERENCES public.reward_reservations(id),
  ADD COLUMN reserved_delta BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN redemption_points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.loyalty_ledger DROP CONSTRAINT loyalty_ledger_kind_check;
ALTER TABLE public.loyalty_ledger DROP CONSTRAINT loyalty_ledger_check;
ALTER TABLE public.loyalty_ledger ADD CONSTRAINT loyalty_ledger_kind_check CHECK
  (kind IN ('opening', 'opening_review', 'earn', 'reversal', 'reward_hold', 'reward_release', 'reward_redeem', 'reward_restore'));
ALTER TABLE public.loyalty_ledger ADD CONSTRAINT loyalty_ledger_check CHECK (
  (reservation_id IS NULL AND reserved_delta = 0 AND redemption_points = 0 AND (
    (kind = 'earn' AND points_delta >= 0 AND order_id IS NOT NULL AND rule_id IS NOT NULL) OR
    (kind = 'reversal' AND points_delta <= 0 AND reverses_id IS NOT NULL AND order_id IS NOT NULL) OR
    (kind = 'opening_review' AND points_delta = 0) OR kind = 'opening')) OR
  (reservation_id IS NOT NULL AND order_id IS NULL AND (
    (kind = 'reward_hold' AND points_delta < 0 AND reserved_delta = -points_delta AND redemption_points = 0) OR
    (kind = 'reward_release' AND points_delta > 0 AND reserved_delta = -points_delta AND redemption_points = 0) OR
    (kind = 'reward_redeem' AND points_delta = 0 AND reserved_delta < 0 AND redemption_points = -reserved_delta) OR
    (kind = 'reward_restore' AND points_delta > 0 AND reserved_delta = 0 AND redemption_points = 0 AND reverses_id IS NOT NULL)))
);
CREATE UNIQUE INDEX reward_ledger_once ON public.loyalty_ledger(reservation_id, kind) WHERE reservation_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.project_loyalty_entry() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.loyalty_accounts%ROWTYPE;
BEGIN
  UPDATE public.loyalty_accounts SET balance = balance + NEW.points_delta,
    reserved_points = reserved_points + NEW.reserved_delta,
    earned_gross = earned_gross + CASE WHEN NEW.kind = 'earn' THEN NEW.points_delta ELSE 0 END,
    redeemed_gross = redeemed_gross + NEW.redemption_points
    WHERE user_id = NEW.user_id RETURNING * INTO v_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing loyalty account'; END IF;
  UPDATE public.user_points SET current_points = v_account.balance, reserved_points = v_account.reserved_points,
    total_earned = v_account.earned_gross, total_redeemed = v_account.redeemed_gross, updated_at = now() WHERE user_id = NEW.user_id;
  RETURN NEW;
END; $$;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN ('purchase', 'redemption', 'refund', 'reward_restore'));
ALTER TABLE public.transactions ADD COLUMN reservation_id UUID REFERENCES public.reward_reservations(id);
CREATE UNIQUE INDEX reward_transaction_once ON public.transactions(reservation_id, transaction_type) WHERE reservation_id IS NOT NULL;

CREATE FUNCTION public.reward_result(p_reservation UUID) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('reservation_id', id, 'store_id', store_id, 'status', status, 'version', version,
    'points_cost', points_cost, 'expires_at', expires_at, 'claimed_by', claimed_by) FROM public.reward_reservations WHERE id = p_reservation
$$;
CREATE FUNCTION public.reserve_reward(p_offer_id UUID, p_command_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_offer public.reward_branch_offers%ROWTYPE;
  v_account public.loyalty_accounts%ROWTYPE; v_settings public.reward_branch_settings%ROWTYPE;
  v_old public.reward_commands%ROWTYPE; v_request JSONB; v_result JSONB; v_id UUID := gen_random_uuid();
  v_name TEXT; v_branch TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in to reserve a reward' USING ERRCODE = '42501'; END IF;
  IF p_offer_id IS NULL OR p_command_id IS NULL THEN RAISE EXCEPTION 'Invalid reward reservation' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || ':reward:' || p_command_id::text, 0));
  v_request := jsonb_build_object('action', 'reserve', 'offer_id', p_offer_id);
  SELECT * INTO v_old FROM public.reward_commands WHERE actor_id = v_actor AND command_id = p_command_id;
  IF FOUND THEN
    IF v_old.request <> v_request THEN RAISE EXCEPTION 'Reward command reference already used' USING ERRCODE = '22023'; END IF;
    RETURN v_old.result;
  END IF;
  SELECT * INTO v_offer FROM public.reward_branch_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward unavailable' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_settings FROM public.reward_branch_settings WHERE store_id = v_offer.store_id AND enabled AND terms_approved FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward reservations are unavailable at this branch' USING ERRCODE = '22023'; END IF;
  SELECT name INTO v_branch FROM public.stores WHERE id = v_offer.store_id AND is_open FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This branch is closed for new reservations' USING ERRCODE = '22023'; END IF;
  -- All hold changes lock the account before the offer; cash refund/earn also
  -- locks this account, so concurrent requests cannot spend the same points.
  SELECT * INTO v_account FROM public.loyalty_accounts WHERE user_id = v_actor FOR UPDATE;
  IF NOT FOUND OR NOT v_account.opening_reviewed THEN RAISE EXCEPTION 'Your opening balance needs review before redemption' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_offer FROM public.reward_branch_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT v_offer.enabled OR v_offer.available_units < 1 OR NOT EXISTS
    (SELECT 1 FROM public.rewards WHERE id = v_offer.reward_id AND available) THEN
    RAISE EXCEPTION 'Reward unavailable or out of stock' USING ERRCODE = '22023'; END IF;
  IF v_account.balance < v_offer.points_cost THEN RAISE EXCEPTION 'Insufficient available points' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.reward_reservations WHERE user_id = v_actor AND store_id = v_offer.store_id AND status IN ('reserved', 'claiming')) >= v_settings.max_active_per_customer THEN
    RAISE EXCEPTION 'Resolve an existing reservation before reserving another reward' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(nullif(full_name, ''), 'Customer') INTO v_name FROM public.profiles WHERE id = v_actor;
  INSERT INTO public.reward_reservations(id, user_id, store_id, offer_id, points_cost, customer_name, expires_at, snapshot)
    VALUES (v_id, v_actor, v_offer.store_id, v_offer.id, v_offer.points_cost, v_name,
      clock_timestamp() + make_interval(mins => v_offer.reservation_minutes),
      jsonb_build_object('name', v_offer.name, 'description', v_offer.description, 'terms', v_offer.terms,
        'gaap_product_reference', v_offer.gaap_product_reference, 'branch_name', v_branch));
  INSERT INTO public.reward_claim_secrets(reservation_id) VALUES (v_id);
  UPDATE public.reward_branch_offers SET available_units = available_units - 1 WHERE id = p_offer_id;
  INSERT INTO public.loyalty_ledger(user_id, reservation_id, actor_id, event_key, kind, points_delta, reserved_delta)
    VALUES (v_actor, v_id, v_actor, 'reward:hold:' || v_id, 'reward_hold', -v_offer.points_cost, v_offer.points_cost);
  INSERT INTO public.reward_events(reservation_id, actor_id, event_type, version) VALUES (v_id, v_actor, 'reserved', 0);
  v_result := public.reward_result(v_id);
  INSERT INTO public.reward_commands(actor_id, command_id, reservation_id, request, result) VALUES (v_actor, p_command_id, v_id, v_request, v_result);
  RETURN v_result;
END; $$;

CREATE FUNCTION public.release_reward_hold(p_reservation UUID, p_actor UUID, p_status TEXT, p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r public.reward_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.reward_reservations WHERE id = p_reservation FOR UPDATE;
  IF NOT FOUND OR v_r.status NOT IN ('reserved', 'claiming') OR p_status NOT IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Only reserved rewards can be released' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.loyalty_accounts WHERE user_id = v_r.user_id FOR UPDATE;
  PERFORM 1 FROM public.reward_branch_offers WHERE id = v_r.offer_id FOR UPDATE;
  UPDATE public.reward_branch_offers SET available_units = available_units + 1 WHERE id = v_r.offer_id;
  INSERT INTO public.loyalty_ledger(user_id, reservation_id, actor_id, event_key, kind, points_delta, reserved_delta)
    VALUES (v_r.user_id, v_r.id, p_actor, 'reward:release:' || v_r.id, 'reward_release', v_r.points_cost, -v_r.points_cost);
  UPDATE public.reward_reservations SET status = p_status, version = version + 1, updated_at = now() WHERE id = v_r.id;
END; $$;
CREATE FUNCTION public.operate_reward_reservation(p_reservation_id UUID, p_command_id UUID, p_expected_version INTEGER,
  p_action TEXT, p_details JSONB DEFAULT '{}') RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_r public.reward_reservations%ROWTYPE; v_account public.loyalty_accounts%ROWTYPE;
  v_previous public.reward_commands%ROWTYPE; v_request JSONB; v_result JSONB; v_reference TEXT; v_reason TEXT;
  v_allowed TEXT[]; v_claim UUID; v_entry UUID; v_original UUID; v_event TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in to resolve a reward' USING ERRCODE = '42501'; END IF;
  IF p_reservation_id IS NULL OR p_command_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 0 OR
    jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR p_action IS NULL THEN
    RAISE EXCEPTION 'Invalid reward command' USING ERRCODE = '22023'; END IF;
  v_allowed := CASE p_action
    WHEN 'begin' THEN ARRAY['claim_code', 'reason']
    WHEN 'fulfil' THEN ARRAY['handover_confirmed', 'gaap_reference', 'reason']
    WHEN 'void' THEN ARRAY['benefit_not_provided', 'credit_note_reference', 'reason']
    WHEN 'cancel' THEN ARRAY['reason'] WHEN 'release' THEN ARRAY['reason', 'benefit_not_provided'] ELSE NULL END;
  IF v_allowed IS NULL OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_details) k WHERE NOT k = ANY(v_allowed)) OR
    (p_details ? 'reason' AND jsonb_typeof(p_details->'reason') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Unknown reward command details' USING ERRCODE = '22023'; END IF;
  v_reason := btrim(coalesce(p_details->>'reason', ''));
  IF length(v_reason) > 500 THEN RAISE EXCEPTION 'Reason is too long' USING ERRCODE = '22023'; END IF;
  IF p_action = 'begin' THEN
    BEGIN v_claim := (p_details->>'claim_code')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid reward claim' USING ERRCODE = '22023'; END;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || ':reward:' || p_command_id::text, 0));
  SELECT * INTO v_r FROM public.reward_reservations WHERE id = p_reservation_id AND
    (user_id = v_actor OR public.cash_staff_access(store_id, v_actor)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward unavailable for this account or branch' USING ERRCODE = '42501'; END IF;
  IF p_action = 'cancel' THEN
    IF v_r.user_id <> v_actor THEN RAISE EXCEPTION 'Only the customer can cancel; staff must use a reasoned release' USING ERRCODE = '42501'; END IF;
  ELSIF NOT public.cash_staff_access(v_r.store_id, v_actor) THEN
    RAISE EXCEPTION 'Branch staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'void' AND NOT public.has_role(v_actor, 'admin') THEN RAISE EXCEPTION 'Administrator approval required' USING ERRCODE = '42501'; END IF;
  -- Save a claim fingerprint, never the bearer secret, in the private command.
  v_request := jsonb_build_object('reservation_id', p_reservation_id, 'version', p_expected_version,
    'action', p_action, 'details', p_details - 'claim_code', 'claim_fingerprint',
    CASE WHEN v_claim IS NOT NULL THEN encode(sha256(convert_to(v_claim::text, 'UTF8')), 'hex') ELSE NULL END);
  SELECT * INTO v_previous FROM public.reward_commands WHERE actor_id = v_actor AND command_id = p_command_id;
  IF FOUND THEN
    IF v_previous.request <> v_request THEN RAISE EXCEPTION 'Reward command reference already used' USING ERRCODE = '22023'; END IF;
    RETURN v_previous.result;
  END IF;
  IF v_r.version <> p_expected_version THEN RAISE EXCEPTION 'Reward changed. Refresh before trying again' USING ERRCODE = '40001'; END IF;
  IF p_action IN ('cancel', 'release') THEN
    IF p_action = 'cancel' AND v_r.status <> 'reserved' THEN RAISE EXCEPTION 'Handover is in progress; ask the branch to resolve it' USING ERRCODE = '22023'; END IF;
    IF p_action = 'release' AND length(v_reason) < 3 THEN RAISE EXCEPTION 'Enter a release reason' USING ERRCODE = '22023'; END IF;
    IF v_r.status = 'claiming' AND (p_details->'benefit_not_provided' IS DISTINCT FROM 'true'::jsonb OR
      (v_r.claimed_by <> v_actor AND NOT public.has_role(v_actor, 'admin'))) THEN
      RAISE EXCEPTION 'The responsible operator or administrator must confirm no benefit was provided' USING ERRCODE = '42501'; END IF;
    v_event := CASE WHEN v_r.status = 'reserved' AND v_r.expires_at <= clock_timestamp() THEN 'expired' WHEN p_action = 'cancel' THEN 'cancelled' ELSE 'released' END;
    PERFORM public.release_reward_hold(v_r.id, v_actor, CASE WHEN v_event = 'expired' THEN 'expired' ELSE 'cancelled' END, v_reason);
  ELSIF p_action = 'begin' THEN
    IF v_r.status <> 'reserved' OR v_r.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Reward is no longer claimable' USING ERRCODE = '22023'; END IF;
    IF v_claim IS NULL OR NOT EXISTS (SELECT 1 FROM public.reward_claim_secrets WHERE reservation_id = v_r.id AND claim_code = v_claim) THEN
      RAISE EXCEPTION 'Invalid customer claim' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_account FROM public.loyalty_accounts WHERE user_id = v_r.user_id FOR UPDATE;
    IF NOT FOUND OR NOT v_account.opening_reviewed OR v_account.balance < 0 THEN
      RAISE EXCEPTION 'Points need review before handover' USING ERRCODE = '22023'; END IF;
    UPDATE public.reward_reservations SET status = 'claiming', claimed_by = v_actor, claimed_at = clock_timestamp(), version = version + 1, updated_at = now() WHERE id = v_r.id;
    v_event := 'claimed';
  ELSIF p_action = 'fulfil' THEN
    IF v_r.status <> 'claiming' THEN RAISE EXCEPTION 'Start the customer handover before confirming fulfilment' USING ERRCODE = '22023'; END IF;
    IF v_r.claimed_by <> v_actor AND (NOT public.has_role(v_actor, 'admin') OR length(v_reason) < 3) THEN
      RAISE EXCEPTION 'Only the responsible operator can confirm handover; administrator overrides need a reason' USING ERRCODE = '42501'; END IF;
    IF p_details->'handover_confirmed' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'Check the customer claim and confirm reward handover' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_account FROM public.loyalty_accounts WHERE user_id = v_r.user_id FOR UPDATE;
    IF NOT FOUND OR NOT v_account.opening_reviewed THEN
      RAISE EXCEPTION 'The loyalty account requires administrator review' USING ERRCODE = '22023'; END IF;
    v_reference := public.cash_reference(p_details->>'gaap_reference');
    INSERT INTO public.branch_fiscal_references(store_id, document_type, reference, reward_reservation_id)
      VALUES (v_r.store_id, 'sale', v_reference, v_r.id);
    INSERT INTO public.reward_fulfilments(reservation_id, store_id, actor_id, gaap_reference) VALUES (v_r.id, v_r.store_id, v_actor, v_reference);
    INSERT INTO public.loyalty_ledger(user_id, reservation_id, actor_id, event_key, kind, points_delta, reserved_delta, redemption_points)
      VALUES (v_r.user_id, v_r.id, v_actor, 'reward:redeem:' || v_r.id, 'reward_redeem', 0, -v_r.points_cost, v_r.points_cost) RETURNING id INTO v_entry;
    INSERT INTO public.transactions(user_id, amount, points_redeemed, items, transaction_type, source, reservation_id, ledger_entry_id)
      VALUES (v_r.user_id, 0, v_r.points_cost, ARRAY[v_r.snapshot->>'name'], 'redemption', 'app', v_r.id, v_entry);
    UPDATE public.reward_reservations SET status = 'fulfilled', version = version + 1, updated_at = now() WHERE id = v_r.id;
    v_event := 'fulfilled';
  ELSE
    IF v_r.status <> 'fulfilled' OR length(v_reason) < 3 OR p_details->'benefit_not_provided' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'Only a mistaken fulfilment with no benefit provided can be voided; supply a reason' USING ERRCODE = '22023'; END IF;
    PERFORM 1 FROM public.loyalty_accounts WHERE user_id = v_r.user_id FOR UPDATE;
    PERFORM 1 FROM public.reward_branch_offers WHERE id = v_r.offer_id FOR UPDATE;
    v_reference := public.cash_reference(p_details->>'credit_note_reference');
    INSERT INTO public.branch_fiscal_references(store_id, document_type, reference, reward_reservation_id)
      VALUES (v_r.store_id, 'credit_note', v_reference, v_r.id);
    INSERT INTO public.reward_voids(reservation_id, store_id, actor_id, credit_note_reference, reason) VALUES (v_r.id, v_r.store_id, v_actor, v_reference, v_reason);
    SELECT id INTO STRICT v_original FROM public.loyalty_ledger WHERE reservation_id = v_r.id AND kind = 'reward_redeem';
    INSERT INTO public.loyalty_ledger(user_id, reservation_id, actor_id, event_key, kind, points_delta, reverses_id)
      VALUES (v_r.user_id, v_r.id, v_actor, 'reward:restore:' || v_r.id, 'reward_restore', v_r.points_cost, v_original) RETURNING id INTO v_entry;
    INSERT INTO public.transactions(user_id, amount, points_earned, items, transaction_type, source, reservation_id, ledger_entry_id)
      VALUES (v_r.user_id, 0, v_r.points_cost, ARRAY['Voided reward: ' || (v_r.snapshot->>'name')], 'reward_restore', 'app', v_r.id, v_entry);
    UPDATE public.reward_branch_offers SET available_units = available_units + 1 WHERE id = v_r.offer_id;
    UPDATE public.reward_reservations SET status = 'voided', version = version + 1, updated_at = now() WHERE id = v_r.id;
    v_event := 'voided';
  END IF;
  INSERT INTO public.reward_events(reservation_id, actor_id, event_type, version, details)
    VALUES (v_r.id, v_actor, v_event, v_r.version + 1, p_details - 'claim_code');
  v_result := public.reward_result(v_r.id);
  INSERT INTO public.reward_commands(actor_id, command_id, reservation_id, request, result) VALUES (v_actor, p_command_id, v_r.id, v_request, v_result);
  RETURN v_result;
END; $$;

CREATE FUNCTION public.expire_reward_reservations(p_limit INTEGER DEFAULT 100) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r RECORD; v_count INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid reward expiry batch size' USING ERRCODE = '22023'; END IF;
  FOR v_r IN SELECT id, version FROM public.reward_reservations WHERE status = 'reserved' AND expires_at <= clock_timestamp()
    ORDER BY expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.release_reward_hold(v_r.id, NULL, 'expired', 'Reservation expired');
    INSERT INTO public.reward_events(reservation_id, event_type, version) VALUES (v_r.id, 'expired', v_r.version + 1);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;
CREATE FUNCTION public.get_my_reward_ticket(p_reservation_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r public.reward_reservations%ROWTYPE; v_code UUID;
BEGIN
  SELECT * INTO v_r FROM public.reward_reservations WHERE id = p_reservation_id AND user_id = auth.uid();
  IF auth.uid() IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'Reward unavailable for this account' USING ERRCODE = '42501'; END IF;
  IF v_r.status = 'reserved' AND v_r.expires_at > clock_timestamp() THEN
    SELECT claim_code INTO v_code FROM public.reward_claim_secrets WHERE reservation_id = v_r.id;
  END IF;
  RETURN public.reward_result(v_r.id) || jsonb_build_object('claim_code', v_code, 'snapshot', v_r.snapshot, 'server_now', clock_timestamp());
END; $$;
CREATE FUNCTION public.lookup_reward_claim(p_store_id UUID, p_claim_code UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r public.reward_reservations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.cash_staff_access(p_store_id, auth.uid()) THEN RAISE EXCEPTION 'Branch access required' USING ERRCODE = '42501'; END IF;
  SELECT r.* INTO v_r FROM public.reward_reservations r JOIN public.reward_claim_secrets c ON c.reservation_id = r.id
    WHERE c.claim_code = p_claim_code AND r.store_id = p_store_id AND r.status = 'reserved' AND r.expires_at > clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim unavailable or expired at this branch' USING ERRCODE = '22023'; END IF;
  RETURN public.reward_result(v_r.id) || jsonb_build_object('snapshot', v_r.snapshot, 'customer_name', v_r.customer_name);
END; $$;
CREATE FUNCTION public.list_reward_offers(p_store_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to view branch rewards' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'reward_id', o.reward_id, 'store_id', o.store_id, 'name', o.name,
    'description', o.description, 'terms', o.terms, 'points_cost', o.points_cost, 'reservation_minutes', o.reservation_minutes,
    'can_reserve', o.available_units > 0, 'category', r.category, 'image_url', r.image_url) ORDER BY o.points_cost, o.id)
    FROM public.reward_branch_offers o JOIN public.rewards r ON r.id = o.reward_id
    JOIN public.reward_branch_settings s ON s.store_id = o.store_id JOIN public.stores b ON b.id = o.store_id
    WHERE o.store_id = p_store_id AND o.enabled AND r.available AND s.enabled AND s.terms_approved AND b.is_open), '[]'::jsonb);
END; $$;
CREATE OR REPLACE FUNCTION public.loyalty_reconciliation() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', coalesce(a.user_id, p.user_id, l.user_id), 'ledger_balance', l.balance,
    'account_balance', a.balance, 'display_balance', p.current_points, 'ledger_reserved', l.reserved,
    'account_reserved', a.reserved_points, 'active_hold_points', h.points)) FROM public.loyalty_accounts a
    FULL JOIN public.user_points p ON p.user_id = a.user_id
    FULL JOIN (SELECT user_id, sum(points_delta) AS balance, sum(reserved_delta) AS reserved,
      sum(redemption_points) AS redeemed, coalesce(sum(points_delta) FILTER (WHERE kind = 'earn'), 0) AS earned
      FROM public.loyalty_ledger GROUP BY user_id) l ON l.user_id = coalesce(a.user_id, p.user_id)
    LEFT JOIN (SELECT user_id, sum(points_cost) AS points FROM public.reward_reservations WHERE status IN ('reserved', 'claiming') GROUP BY user_id) h
      ON h.user_id = coalesce(a.user_id, p.user_id, l.user_id)
    WHERE a.user_id IS NULL OR p.user_id IS NULL OR l.user_id IS NULL OR l.balance IS DISTINCT FROM a.balance
      OR a.balance IS DISTINCT FROM p.current_points OR l.reserved IS DISTINCT FROM a.reserved_points
      OR a.reserved_points IS DISTINCT FROM p.reserved_points OR a.reserved_points <> coalesce(h.points, 0)
      OR a.opening_earned + l.earned <> a.earned_gross OR a.opening_redeemed + l.redeemed <> a.redeemed_gross
      OR a.earned_gross IS DISTINCT FROM p.total_earned OR a.redeemed_gross IS DISTINCT FROM p.total_redeemed), '[]'::jsonb);
END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['reward_branch_settings', 'reward_branch_offers', 'reward_reservations', 'reward_claim_secrets',
    'reward_commands', 'reward_events', 'reward_fulfilments', 'reward_voids', 'branch_fiscal_references'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['reward_commands', 'reward_events', 'reward_fulfilments', 'reward_voids', 'branch_fiscal_references'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_cash_audit_record()', 'immutable_' || t, t);
  END LOOP;
END; $$;
GRANT SELECT ON public.reward_reservations, public.reward_fulfilments, public.reward_voids, public.reward_events TO authenticated;
CREATE POLICY "Customer and branch read reservations" ON public.reward_reservations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.cash_staff_access(store_id, auth.uid()));
CREATE POLICY "Staff read reward fulfilments" ON public.reward_fulfilments FOR SELECT TO authenticated USING (public.cash_staff_access(store_id, auth.uid()));
CREATE POLICY "Staff read reward voids" ON public.reward_voids FOR SELECT TO authenticated USING (public.cash_staff_access(store_id, auth.uid()));
CREATE POLICY "Staff read reward audit" ON public.reward_events FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.reward_reservations r WHERE r.id = reservation_id AND public.cash_staff_access(r.store_id, auth.uid())));
GRANT EXECUTE ON FUNCTION public.reserve_reward(UUID, UUID), public.operate_reward_reservation(UUID, UUID, INTEGER, TEXT, JSONB),
  public.get_my_reward_ticket(UUID), public.lookup_reward_claim(UUID, UUID), public.list_reward_offers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_reward_reservations(INTEGER) TO service_role;

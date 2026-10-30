-- All branches remain closed to app checkout until operations/finance approve
-- their actual menu currency, inclusive pricing and fulfilment settings.
CREATE TABLE public.cash_order_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  pricing_approved BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'ZWG')),
  collection_enabled BOOLEAN NOT NULL DEFAULT true,
  delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  minimum_subtotal_minor BIGINT NOT NULL DEFAULT 0 CHECK (minimum_subtotal_minor >= 0),
  max_total_minor BIGINT NOT NULL DEFAULT 100000000 CHECK (max_total_minor BETWEEN 1 AND 100000000)
);
CREATE TABLE public.cash_delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  name TEXT NOT NULL,
  -- Longitude first, latitude second. Small local service polygons, not road ETAs.
  boundary POLYGON NOT NULL CHECK (npoints(boundary) BETWEEN 3 AND 200),
  fee_minor BIGINT NOT NULL CHECK (fee_minor BETWEEN 0 AND 100000000),
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX cash_delivery_zones_store_idx ON public.cash_delivery_zones(store_id);
CREATE TABLE public.cash_order_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  request JSONB NOT NULL,
  snapshot JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + interval '5 minutes'),
  order_id UUID UNIQUE REFERENCES public.orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cash_quotes_owner_idx ON public.cash_order_quotes(user_id, created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN quote_id UUID UNIQUE REFERENCES public.cash_order_quotes(id),
  ADD COLUMN submission_key UUID,
  ADD COLUMN subtotal_minor BIGINT,
  ADD COLUMN delivery_fee_minor BIGINT,
  ADD COLUMN total_minor BIGINT,
  ADD COLUMN fulfilment_mode TEXT CHECK (fulfilment_mode IN ('collection', 'delivery')),
  ADD COLUMN contact_snapshot JSONB,
  ADD COLUMN delivery_snapshot JSONB,
  ADD COLUMN branch_snapshot JSONB,
  ADD COLUMN payment_method TEXT CHECK (payment_method = 'cash'),
  ADD COLUMN payment_status TEXT CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
CREATE UNIQUE INDEX cash_orders_submission_idx ON public.orders(user_id, submission_key);
ALTER TABLE public.orders ADD CONSTRAINT cash_order_amounts_consistent CHECK (
  quote_id IS NULL OR (submission_key IS NOT NULL AND currency IS NOT NULL AND currency IN ('USD', 'ZWG')
    AND subtotal_minor IS NOT NULL AND subtotal_minor >= 0
    AND delivery_fee_minor IS NOT NULL AND delivery_fee_minor >= 0
    AND total_minor IS NOT NULL AND total_minor BETWEEN 1 AND 100000000 AND total_minor = subtotal_minor + delivery_fee_minor
    AND total_amount = total_minor::numeric / 100
    AND payment_method IS NOT NULL AND payment_status IS NOT NULL
    AND fulfilment_mode IS NOT NULL AND contact_snapshot IS NOT NULL AND jsonb_typeof(contact_snapshot) = 'object')
);
ALTER TABLE public.order_items
  ADD COLUMN item_name TEXT,
  ADD COLUMN modifiers_snapshot JSONB,
  ADD COLUMN unit_price_minor BIGINT,
  ADD COLUMN line_total_minor BIGINT;
ALTER TABLE public.order_items ADD CONSTRAINT cash_order_item_amounts_consistent CHECK (
  unit_price_minor IS NULL OR (unit_price_minor >= 0 AND line_total_minor IS NOT NULL
    AND line_total_minor = unit_price_minor * quantity AND unit_price = unit_price_minor::numeric / 100
    AND item_name IS NOT NULL AND modifiers_snapshot IS NOT NULL AND jsonb_typeof(modifiers_snapshot) = 'array')
);
CREATE TABLE public.order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_order_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_order_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_order_settings, public.cash_delivery_zones,
  public.cash_order_quotes, public.order_status_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cash_order_quotes, public.order_status_events TO authenticated;
CREATE POLICY "Customers read own quotes" ON public.cash_order_quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Read visible order events" ON public.order_status_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));

CREATE FUNCTION public.quote_cash_order(p_request JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_store UUID;
  v_settings public.cash_order_settings%ROWTYPE;
  v_branch public.stores%ROWTYPE;
  v_zone public.cash_delivery_zones%ROWTYPE;
  v_mode TEXT;
  v_contact JSONB;
  v_address JSONB;
  v_line JSONB;
  v_item public.menu_items%ROWTYPE;
  v_choice_ids UUID[];
  v_modifiers JSONB;
  v_lines JSONB := '[]'::jsonb;
  v_qty INTEGER;
  v_base BIGINT;
  v_unit BIGINT;
  v_subtotal BIGINT := 0;
  v_fee BIGINT := 0;
  v_quote public.cash_order_quotes%ROWTYPE;
  v_snapshot JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to request an order total' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN ('store_id', 'fulfilment_mode', 'contact', 'address', 'lines')
  ) THEN RAISE EXCEPTION 'Invalid checkout request' USING ERRCODE = '22023'; END IF;
  v_store := (p_request->>'store_id')::uuid;
  v_mode := p_request->>'fulfilment_mode';
  IF v_mode IS NULL OR v_mode NOT IN ('collection', 'delivery') THEN
    RAISE EXCEPTION 'Choose collection or delivery' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_settings FROM public.cash_order_settings WHERE store_id = v_store FOR SHARE;
  IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.pricing_approved THEN
    RAISE EXCEPTION 'This branch is not accepting app orders yet' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_branch FROM public.stores WHERE id = v_store FOR SHARE;
  IF NOT FOUND OR NOT v_branch.is_open THEN RAISE EXCEPTION 'This branch is currently closed' USING ERRCODE = '22023'; END IF;
  IF (v_mode = 'collection' AND NOT v_settings.collection_enabled) OR
     (v_mode = 'delivery' AND NOT v_settings.delivery_enabled) THEN
    RAISE EXCEPTION 'This service is unavailable at this branch' USING ERRCODE = '22023';
  END IF;
  v_contact := p_request->'contact';
  IF jsonb_typeof(v_contact) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Enter your contact name and phone number' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_contact) k WHERE k NOT IN ('name', 'phone')) OR
    jsonb_typeof(v_contact->'name') IS DISTINCT FROM 'string' OR
    length(btrim(v_contact->>'name')) NOT BETWEEN 2 AND 120 OR
    jsonb_typeof(v_contact->'phone') IS DISTINCT FROM 'string' OR
    (v_contact->>'phone') !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'Enter a valid contact name and international phone number' USING ERRCODE = '22023';
  END IF;
  v_contact := jsonb_build_object('name', btrim(v_contact->>'name'), 'phone', v_contact->>'phone');
  v_address := p_request->'address';
  IF v_mode = 'delivery' THEN
    IF jsonb_typeof(v_address) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'A delivery address and map pin are required' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_address) k WHERE k NOT IN ('address', 'latitude', 'longitude', 'instructions')) OR
      jsonb_typeof(v_address->'address') IS DISTINCT FROM 'string' OR
      length(btrim(v_address->>'address')) NOT BETWEEN 5 AND 500 OR
      lower(btrim(v_address->>'address')) IN ('selected from map', 'unknown address') OR
      jsonb_typeof(v_address->'latitude') IS DISTINCT FROM 'number' OR
      jsonb_typeof(v_address->'longitude') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Enter a written address and valid map pin' USING ERRCODE = '22023';
    END IF;
    IF (v_address->>'latitude')::numeric NOT BETWEEN -90 AND 90 OR
      (v_address->>'longitude')::numeric NOT BETWEEN -180 AND 180 OR
      (v_address ? 'instructions' AND (jsonb_typeof(v_address->'instructions') IS DISTINCT FROM 'string'
        OR length(v_address->>'instructions') > 500)) THEN
      RAISE EXCEPTION 'Invalid delivery details' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_zone FROM public.cash_delivery_zones z WHERE z.store_id = v_store AND z.active
      AND z.boundary @> point((v_address->>'longitude')::float8, (v_address->>'latitude')::float8)
      ORDER BY z.priority, z.id LIMIT 1 FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'This address is outside the branch delivery area' USING ERRCODE = '22023'; END IF;
    v_fee := v_zone.fee_minor;
    v_address := jsonb_build_object('address', btrim(v_address->>'address'),
      'latitude', (v_address->>'latitude')::numeric, 'longitude', (v_address->>'longitude')::numeric,
      'instructions', coalesce(v_address->>'instructions', ''), 'zone_id', v_zone.id, 'zone_name', v_zone.name);
  ELSE
    IF v_address IS NOT NULL AND v_address <> 'null'::jsonb THEN
      RAISE EXCEPTION 'Collection orders do not require a delivery address' USING ERRCODE = '22023';
    END IF;
    v_address := NULL;
  END IF;
  IF jsonb_typeof(p_request->'lines') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Your order must contain items' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_request->'lines') NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'An order must have between 1 and 50 item lines' USING ERRCODE = '22023';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_request->'lines') LOOP
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid item' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_line) k WHERE k NOT IN ('menu_item_id', 'quantity', 'choice_ids')) OR
      jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number' OR (v_line->>'quantity') !~ '^[0-9]{1,2}$' THEN
      RAISE EXCEPTION 'Invalid item quantity or fields' USING ERRCODE = '22023';
    END IF;
    v_qty := (v_line->>'quantity')::integer;
    IF v_qty < 1 THEN RAISE EXCEPTION 'Item quantity must be positive' USING ERRCODE = '22023'; END IF;
    SELECT m.* INTO v_item FROM public.menu_items m JOIN public.menu_categories c ON c.id = m.category_id
      WHERE m.id = (v_line->>'menu_item_id')::uuid AND m.is_available AND c.is_active
      AND (m.store_id IS NULL OR m.store_id = v_store) FOR SHARE OF m, c;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is unavailable at this branch' USING ERRCODE = '22023'; END IF;
    IF jsonb_typeof(v_line->'choice_ids') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid meal choices' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_line->'choice_ids') > 50 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_line->'choice_ids') c WHERE jsonb_typeof(c) <> 'string'
    ) THEN RAISE EXCEPTION 'Invalid meal choices' USING ERRCODE = '22023'; END IF;
    SELECT coalesce(array_agg(value::uuid ORDER BY value), '{}'::uuid[]) INTO v_choice_ids
      FROM jsonb_array_elements_text(v_line->'choice_ids');
    IF cardinality(v_choice_ids) <> (SELECT count(DISTINCT id) FROM unnest(v_choice_ids) id) OR
      cardinality(v_choice_ids) <> (SELECT count(*) FROM public.menu_item_option_choices c
        JOIN public.menu_item_options o ON o.id = c.option_id
        WHERE c.id = ANY(v_choice_ids) AND o.menu_item_id = v_item.id) THEN
      RAISE EXCEPTION 'Meal choices do not match this item' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.menu_item_options o WHERE o.menu_item_id = v_item.id AND (
      (coalesce(o.is_required, false) AND NOT EXISTS (SELECT 1 FROM public.menu_item_option_choices c
        WHERE c.option_id = o.id AND c.id = ANY(v_choice_ids))) OR
      (SELECT count(*) FROM public.menu_item_option_choices c WHERE c.option_id = o.id AND c.id = ANY(v_choice_ids)) > coalesce(o.max_choices, 1)
    )) THEN RAISE EXCEPTION 'Check required meal choices and selection limits' USING ERRCODE = '22023'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('choice_id', c.id, 'option_id', o.id,
      'option_name', o.name, 'name', c.name, 'price_adjustment_minor', (coalesce(c.price_adjustment, 0) * 100)::bigint)
      ORDER BY o.sort_order, o.id, c.sort_order, c.id), '[]'::jsonb) INTO v_modifiers
      FROM public.menu_item_option_choices c JOIN public.menu_item_options o ON o.id = c.option_id
      WHERE c.id = ANY(v_choice_ids);
    v_base := (v_item.price * 100)::bigint;
    SELECT v_base + coalesce(sum((m->>'price_adjustment_minor')::bigint), 0) INTO v_unit
      FROM jsonb_array_elements(v_modifiers) m;
    IF v_unit < 0 THEN RAISE EXCEPTION 'This item has an invalid price configuration' USING ERRCODE = '22023'; END IF;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('menu_item_id', v_item.id, 'name', v_item.name,
      'quantity', v_qty, 'base_unit_minor', v_base, 'unit_price_minor', v_unit,
      'line_total_minor', v_unit * v_qty, 'modifiers', v_modifiers));
  END LOOP;
  IF v_subtotal < v_settings.minimum_subtotal_minor OR v_subtotal + v_fee NOT BETWEEN 1 AND v_settings.max_total_minor THEN
    RAISE EXCEPTION 'Order total is outside this branch’s order limits' USING ERRCODE = '22023';
  END IF;
  v_snapshot := jsonb_build_object('store_id', v_store, 'branch_name', v_branch.name, 'currency', v_settings.currency,
    'fulfilment_mode', v_mode, 'contact', v_contact, 'address', v_address, 'lines', v_lines,
    'subtotal_minor', v_subtotal, 'delivery_fee_minor', v_fee, 'total_minor', v_subtotal + v_fee);
  INSERT INTO public.cash_order_quotes(user_id, store_id, request, snapshot)
    VALUES (v_user, v_store, p_request, v_snapshot) RETURNING * INTO v_quote;
  RETURN v_snapshot || jsonb_build_object('quote_id', v_quote.id, 'expires_at', v_quote.expires_at);
END;
$$;

CREATE FUNCTION public.place_cash_order(p_quote_id UUID, p_submission_key UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_quote public.cash_order_quotes%ROWTYPE;
  v_existing public.orders%ROWTYPE;
  v_settings public.cash_order_settings%ROWTYPE;
  v_snapshot JSONB;
  v_line JSONB;
  v_order UUID;
  v_selected UUID[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to place an order' USING ERRCODE = '42501'; END IF;
  IF p_quote_id IS NULL OR p_submission_key IS NULL THEN RAISE EXCEPTION 'Missing order reference' USING ERRCODE = '22023'; END IF;
  -- Serialize retries for this customer/key. The unique index is a second guard.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_submission_key::text, 0));
  SELECT * INTO v_existing FROM public.orders WHERE user_id = v_user AND submission_key = p_submission_key;
  IF FOUND THEN
    IF v_existing.quote_id IS DISTINCT FROM p_quote_id THEN
      RAISE EXCEPTION 'This submission reference belongs to a different order' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('order_id', v_existing.id, 'status', v_existing.status);
  END IF;
  SELECT * INTO v_quote FROM public.cash_order_quotes WHERE id = p_quote_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order quote not found' USING ERRCODE = '22023'; END IF;
  IF v_quote.order_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_quote.order_id, 'status', (SELECT status FROM public.orders WHERE id = v_quote.order_id));
  END IF;
  IF v_quote.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Your quote has expired. Please get a new total' USING ERRCODE = '22023'; END IF;
  v_snapshot := v_quote.snapshot;
  SELECT * INTO v_settings FROM public.cash_order_settings WHERE store_id = v_quote.store_id FOR SHARE;
  IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.pricing_approved OR
    v_settings.currency <> v_snapshot->>'currency' OR
    (v_snapshot->>'fulfilment_mode' = 'collection' AND NOT v_settings.collection_enabled) OR
    (v_snapshot->>'fulfilment_mode' = 'delivery' AND NOT v_settings.delivery_enabled) THEN
    RAISE EXCEPTION 'Branch ordering settings have changed. Please get a new total' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.stores WHERE id = v_quote.store_id AND is_open FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This branch is currently closed' USING ERRCODE = '22023'; END IF;
  -- Quotes fix prices for five minutes, but stock, branch and zone pauses apply immediately.
  IF v_snapshot->>'fulfilment_mode' = 'delivery' THEN
    PERFORM 1 FROM public.cash_delivery_zones WHERE id = (v_snapshot->'address'->>'zone_id')::uuid
      AND store_id = v_quote.store_id AND active AND boundary @> point(
        (v_snapshot->'address'->>'longitude')::float8, (v_snapshot->'address'->>'latitude')::float8) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Delivery is no longer available at this address' USING ERRCODE = '22023'; END IF;
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_snapshot->'lines') LOOP
    PERFORM 1 FROM public.menu_items m JOIN public.menu_categories c ON c.id = m.category_id
      WHERE m.id = (v_line->>'menu_item_id')::uuid AND m.is_available AND c.is_active
      AND (m.store_id IS NULL OR m.store_id = v_quote.store_id) FOR SHARE OF m, c;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available. Please review your order' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_line->'modifiers') selected
      WHERE NOT EXISTS (SELECT 1 FROM public.menu_item_option_choices choice
        JOIN public.menu_item_options option ON option.id = choice.option_id
        WHERE choice.id = (selected->>'choice_id')::uuid AND option.menu_item_id = (v_line->>'menu_item_id')::uuid)) THEN
      RAISE EXCEPTION 'Meal choices have changed. Please get a new total' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(array_agg((selected->>'choice_id')::uuid), '{}'::uuid[]) INTO v_selected
      FROM jsonb_array_elements(v_line->'modifiers') selected;
    IF EXISTS (SELECT 1 FROM public.menu_item_options o WHERE o.menu_item_id = (v_line->>'menu_item_id')::uuid AND (
      (coalesce(o.is_required, false) AND NOT EXISTS (SELECT 1 FROM public.menu_item_option_choices c
        WHERE c.option_id = o.id AND c.id = ANY(v_selected))) OR
      (SELECT count(*) FROM public.menu_item_option_choices c WHERE c.option_id = o.id AND c.id = ANY(v_selected)) > coalesce(o.max_choices, 1)
    )) THEN RAISE EXCEPTION 'Meal choices have changed. Please get a new total' USING ERRCODE = '22023'; END IF;
  END LOOP;
  INSERT INTO public.orders(user_id, store_id, quote_id, submission_key, status, total_amount, points_earned,
    currency, subtotal_minor, delivery_fee_minor, total_minor, fulfilment_mode,
    contact_snapshot, delivery_snapshot, branch_snapshot, payment_method, payment_status)
  VALUES (v_user, v_quote.store_id, v_quote.id, p_submission_key, 'pending', (v_snapshot->>'total_minor')::numeric / 100, 0,
    v_snapshot->>'currency', (v_snapshot->>'subtotal_minor')::bigint, (v_snapshot->>'delivery_fee_minor')::bigint,
    (v_snapshot->>'total_minor')::bigint, v_snapshot->>'fulfilment_mode', v_snapshot->'contact',
    nullif(v_snapshot->'address', 'null'::jsonb), jsonb_build_object('name', v_snapshot->>'branch_name'), 'cash', 'unpaid') RETURNING id INTO v_order;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_snapshot->'lines') LOOP
    INSERT INTO public.order_items(order_id, menu_item_id, quantity, unit_price, item_name,
      modifiers_snapshot, unit_price_minor, line_total_minor)
    VALUES (v_order, (v_line->>'menu_item_id')::uuid, (v_line->>'quantity')::integer,
      (v_line->>'unit_price_minor')::numeric / 100, v_line->>'name', v_line->'modifiers',
      (v_line->>'unit_price_minor')::bigint, (v_line->>'line_total_minor')::bigint);
  END LOOP;
  INSERT INTO public.order_status_events(order_id, actor_id, status) VALUES (v_order, v_user, 'pending');
  UPDATE public.cash_order_quotes SET order_id = v_order WHERE id = v_quote.id;
  RETURN jsonb_build_object('order_id', v_order, 'status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION public.quote_cash_order(JSONB), public.place_cash_order(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_cash_order(JSONB), public.place_cash_order(UUID, UUID) TO authenticated;

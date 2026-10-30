-- Containment only: this does not enable production checkout, receipt claims,
-- redemption or gifting. Trusted commands and fulfilment follow in later work.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS staff_store_id UUID REFERENCES public.stores(id);

-- Block direct financial/loyalty writes even when an old permissive policy exists.
REVOKE INSERT, UPDATE, DELETE ON public.user_points, public.transactions,
  public.user_achievements, public.referrals, public.point_gifts,
  public.gaap_sync_log, public.gaap_customer_links FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can insert their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage user points" ON public.user_points;
DROP POLICY IF EXISTS "System can insert achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can send gifts" ON public.point_gifts;
DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.gaap_sync_log;
DROP POLICY IF EXISTS "Users can create own GAAP link" ON public.gaap_customer_links;
DROP POLICY IF EXISTS "Users can update own GAAP link" ON public.gaap_customer_links;

-- Referral rewards will require a verified qualifying purchase, not signup.
DROP TRIGGER IF EXISTS on_referral_signup ON auth.users;
-- The legacy maintenance script could have installed an unpaid-order award.
DROP TRIGGER IF EXISTS on_order_created ON public.orders;

-- A profile email/POS identifier must not be a customer-editable matching key.
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
-- Table-level REVOKE does not remove grants made on individual columns.
DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN (
      'profiles', 'user_points', 'transactions', 'user_achievements', 'referrals',
      'point_gifts', 'gaap_sync_log', 'gaap_customer_links', 'orders', 'order_items'
    )
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      target.column_name, target.column_name, target.table_name);
  END LOOP;
END;
$$;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- Optional points sharing stays disabled server-side as well as in the client.
-- Replace the vulnerable body too, so a stale explicit grant cannot expose it.
CREATE OR REPLACE FUNCTION public.share_user_points(
  sender_id UUID, receiver_email TEXT, points_to_transfer INTEGER
) RETURNS JSON LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Points sharing is not available yet' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.share_user_points(UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.process_gaap_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, NUMERIC, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_gaap_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, NUMERIC, JSONB, JSONB)
  TO service_role;
ALTER FUNCTION public.process_gaap_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, NUMERIC, JSONB, JSONB)
  SET search_path = public, pg_temp;

-- Legacy clients cannot create unpriced orders while trusted checkout is built.
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM PUBLIC, anon, authenticated;

CREATE POLICY "Customers read own orders" ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff read assigned branch orders" ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid()
    AND r.role = 'staff' AND r.staff_store_id = orders.store_id
  ));
CREATE POLICY "Read visible order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));

-- Restrictive boundaries also constrain permissive SELECT policies left over
-- from manual remote setup. A policy name alone is not an access guarantee.
CREATE POLICY "Order access boundary" ON public.orders AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid()
      AND r.role = 'staff' AND r.staff_store_id = orders.store_id
    )
  ));
CREATE POLICY "Order items access boundary" ON public.order_items AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));

CREATE POLICY "Public active categories" ON public.menu_categories FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public available menu" ON public.menu_items FOR SELECT
  USING (is_available OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins manage categories" ON public.menu_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage menu" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Constrain manually-added permissive catalogue policies too. Staff availability
-- changes will get their own branch-scoped command, not broad table updates.
CREATE POLICY "Menu insert boundary" ON public.menu_items AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Menu update boundary" ON public.menu_items AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Menu delete boundary" ON public.menu_items AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Category insert boundary" ON public.menu_categories AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Category update boundary" ON public.menu_categories AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Category delete boundary" ON public.menu_categories AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Legacy trigger functions are called by triggers, not directly over RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.assign_user_role(),
  public.handle_referral_signup(), public.check_and_award_achievements()
  FROM PUBLIC, anon, authenticated;

-- New privileged functions must opt in to their intended callers explicitly.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- =============================================================
-- GAAP POS Integration Tables
-- Prepares Pogo's Loyalty Buzz for GAAP Unity POS sync
-- =============================================================

-- 1. Track synced GAAP transactions (deduplication + audit trail)
CREATE TABLE IF NOT EXISTS gaap_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gaap_transaction_id TEXT UNIQUE NOT NULL,
  gaap_receipt_number TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  transaction_amount NUMERIC(10, 2),
  line_items JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  sync_status TEXT NOT NULL DEFAULT 'success' CHECK (sync_status IN ('success', 'failed', 'duplicate', 'unmatched')),
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by GAAP transaction ID
CREATE INDEX IF NOT EXISTS idx_gaap_sync_gaap_txn ON gaap_sync_log(gaap_transaction_id);
-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_gaap_sync_user ON gaap_sync_log(user_id);
-- Index for querying by store
CREATE INDEX IF NOT EXISTS idx_gaap_sync_store ON gaap_sync_log(store_id);
-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_gaap_sync_status ON gaap_sync_log(sync_status);

-- 2. Link Pogo's app users to their GAAP customer profiles
CREATE TABLE IF NOT EXISTS gaap_customer_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  gaap_customer_id TEXT NOT NULL,
  gaap_customer_phone TEXT,
  gaap_customer_email TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up by GAAP customer ID
CREATE INDEX IF NOT EXISTS idx_gaap_customer_gaap_id ON gaap_customer_links(gaap_customer_id);
-- Index for looking up by phone (common GAAP identifier)
CREATE INDEX IF NOT EXISTS idx_gaap_customer_phone ON gaap_customer_links(gaap_customer_phone);

-- 3. Store GAAP API configuration per store
CREATE TABLE IF NOT EXISTS gaap_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  api_base_url TEXT DEFAULT 'https://api.gaap.co.za',
  api_key TEXT,
  webhook_secret TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active BOOLEAN DEFAULT FALSE,
  last_webhook_at TIMESTAMPTZ,
  last_sync_error TEXT,
  config_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one config per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_gaap_config_store ON gaap_config(store_id);

-- 4. Add source tracking to existing transactions table
-- This lets us distinguish POS-sourced points from QR-scanned points
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'app' 
      CHECK (source IN ('app', 'qr_scan', 'gaap_pos', 'admin', 'referral', 'gift'));
  END IF;
END $$;

-- 5. Add gaap_customer_id to profiles for quick matching
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'gaap_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gaap_customer_id TEXT;
  END IF;
END $$;

-- 6. RLS policies for gaap tables (admin only for config, user can read own links)
-- Legacy installations may already have these policies without a history row.
-- Replace only their known names; later containment migrations must still run.

-- gaap_sync_log: admin read-only
ALTER TABLE gaap_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all sync logs" ON public.gaap_sync_log;
CREATE POLICY "Admin can view all sync logs" ON gaap_sync_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.gaap_sync_log;
CREATE POLICY "Service role can insert sync logs" ON gaap_sync_log
  FOR INSERT WITH CHECK (true);

-- gaap_customer_links: users can see their own link
ALTER TABLE gaap_customer_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own GAAP link" ON public.gaap_customer_links;
CREATE POLICY "Users can view own GAAP link" ON gaap_customer_links
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own GAAP link" ON public.gaap_customer_links;
CREATE POLICY "Users can create own GAAP link" ON gaap_customer_links
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own GAAP link" ON public.gaap_customer_links;
CREATE POLICY "Users can update own GAAP link" ON gaap_customer_links
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view all GAAP links" ON public.gaap_customer_links;
CREATE POLICY "Admin can view all GAAP links" ON gaap_customer_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- gaap_config: admin only
ALTER TABLE gaap_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage GAAP config" ON public.gaap_config;
CREATE POLICY "Admin can manage GAAP config" ON gaap_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 7. Function to process a GAAP POS transaction and award points
CREATE OR REPLACE FUNCTION process_gaap_transaction(
  p_gaap_transaction_id TEXT,
  p_gaap_receipt_number TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_gaap_customer_id TEXT DEFAULT NULL,
  p_store_id UUID DEFAULT NULL,
  p_transaction_amount NUMERIC DEFAULT 0,
  p_line_items JSONB DEFAULT '[]'::jsonb,
  p_raw_payload JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_points INTEGER;
  v_current_points INTEGER;
  v_total_earned INTEGER;
  v_existing_sync UUID;
  v_result JSONB;
BEGIN
  -- 1. Check for duplicate
  SELECT id INTO v_existing_sync
  FROM gaap_sync_log
  WHERE gaap_transaction_id = p_gaap_transaction_id;
  
  IF v_existing_sync IS NOT NULL THEN
    INSERT INTO gaap_sync_log (gaap_transaction_id, sync_status, error_message, raw_payload)
    VALUES (p_gaap_transaction_id || '_dup_' || gen_random_uuid(), 'duplicate', 'Already processed', p_raw_payload);
    
    RETURN jsonb_build_object('success', false, 'error', 'duplicate', 'message', 'Transaction already processed');
  END IF;

  -- 2. Find the Pogo's user by GAAP customer ID, email, or phone
  IF p_gaap_customer_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM gaap_customer_links
    WHERE gaap_customer_id = p_gaap_customer_id AND verified = true;
  END IF;

  IF v_user_id IS NULL AND p_customer_email IS NOT NULL THEN
    SELECT id INTO v_user_id FROM profiles WHERE email = p_customer_email;
  END IF;

  IF v_user_id IS NULL AND p_customer_phone IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM gaap_customer_links
    WHERE gaap_customer_phone = p_customer_phone;
  END IF;

  -- 3. If no user found, log as unmatched
  IF v_user_id IS NULL THEN
    INSERT INTO gaap_sync_log (
      gaap_transaction_id, gaap_receipt_number, store_id,
      transaction_amount, line_items, raw_payload,
      sync_status, error_message, points_awarded
    ) VALUES (
      p_gaap_transaction_id, p_gaap_receipt_number, p_store_id,
      p_transaction_amount, p_line_items, p_raw_payload,
      'unmatched', 'No matching Pogo''s user found', 0
    );
    
    RETURN jsonb_build_object('success', false, 'error', 'unmatched', 'message', 'No matching user found');
  END IF;

  -- 4. Calculate points (R1 = 1 point, configurable)
  v_points := GREATEST(1, FLOOR(p_transaction_amount));

  -- 5. Create transaction record
  INSERT INTO transactions (user_id, amount, points_earned, items, transaction_type, source)
  VALUES (
    v_user_id,
    p_transaction_amount,
    v_points,
    ARRAY(SELECT jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p_line_items) = 'array' 
        THEN (SELECT jsonb_agg(elem->>'name') FROM jsonb_array_elements(p_line_items) AS elem)
        ELSE '[]'::jsonb 
      END
    )),
    'purchase',
    'gaap_pos'
  );

  -- 6. Update user points
  SELECT current_points, total_earned INTO v_current_points, v_total_earned
  FROM user_points WHERE user_id = v_user_id;

  IF v_current_points IS NULL THEN
    INSERT INTO user_points (user_id, current_points, total_earned, total_redeemed)
    VALUES (v_user_id, v_points, v_points, 0);
  ELSE
    UPDATE user_points
    SET current_points = COALESCE(current_points, 0) + v_points,
        total_earned = COALESCE(total_earned, 0) + v_points,
        updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  -- 7. Log the successful sync
  INSERT INTO gaap_sync_log (
    gaap_transaction_id, gaap_receipt_number, user_id, store_id,
    points_awarded, transaction_amount, line_items, raw_payload,
    sync_status
  ) VALUES (
    p_gaap_transaction_id, p_gaap_receipt_number, v_user_id, p_store_id,
    v_points, p_transaction_amount, p_line_items, p_raw_payload,
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'points_awarded', v_points,
    'new_balance', COALESCE(v_current_points, 0) + v_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

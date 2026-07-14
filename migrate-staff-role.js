const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.secret_key;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('Running Staff role migration...');

  // 1. Extend the app_role enum with 'staff'
  const { error: enumError } = await supabase.rpc('exec_sql', {
    sql: "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';"
  }).single();

  // rpc may not exist, try raw SQL via REST
  // Use the management API directly instead
  const res1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql: "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';" })
  });

  if (!res1.ok) {
    console.log('Note: enum extension via RPC may need to be done via Supabase SQL Editor.');
    console.log('Response:', res1.status, await res1.text());
    console.log('');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log("  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';");
  } else {
    console.log('✓ Extended app_role enum with staff');
  }

  // 2. Add staff_store_id column
  const { error: colError } = await supabase.rpc('exec_sql', {
    sql: "ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS staff_store_id UUID REFERENCES public.stores(id);"
  });

  // Try via fetch as well
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ 
      sql: "ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS staff_store_id UUID REFERENCES public.stores(id);" 
    })
  });

  if (!res2.ok) {
    console.log('Note: column addition via RPC may need to be done via Supabase SQL Editor.');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log("  ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS staff_store_id UUID REFERENCES public.stores(id);");
  } else {
    console.log('✓ Added staff_store_id column to user_roles');
  }

  // 3. RLS policies - print for manual execution
  console.log('');
  console.log('=== RLS Policies (run in Supabase SQL Editor) ===');
  console.log(`
-- Staff can view orders for their assigned store
CREATE POLICY "Staff can view orders for their store"
  ON public.orders FOR SELECT
  USING (
    store_id IN (
      SELECT staff_store_id FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

-- Staff can update order status for their store
CREATE POLICY "Staff can update orders for their store"
  ON public.orders FOR UPDATE
  USING (
    store_id IN (
      SELECT staff_store_id FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

-- Staff can view menu items
CREATE POLICY "Staff can view all menu items"
  ON public.menu_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

-- Staff can update menu item availability for their store
CREATE POLICY "Staff can update menu items for their store"
  ON public.menu_items FOR UPDATE
  USING (
    store_id IS NULL OR store_id IN (
      SELECT staff_store_id FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );
  `);

  console.log('Migration script complete!');
  console.log('');
  console.log('IMPORTANT: If the RPC calls failed, please run the following SQL in your Supabase SQL Editor:');
  console.log('');
  console.log("1. ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';");
  console.log("2. ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS staff_store_id UUID REFERENCES public.stores(id);");
  console.log("3. Run the RLS policies printed above.");
}

runMigration();

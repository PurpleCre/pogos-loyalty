const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.secret_key;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTrigger() {
  const sql = `
    CREATE OR REPLACE FUNCTION public.handle_order_created()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Only process if points_earned is greater than 0
      IF NEW.points_earned > 0 THEN
        
        -- Insert a transaction record
        INSERT INTO public.transactions (
          user_id, amount, points_earned, points_redeemed, transaction_type, items
        ) VALUES (
          NEW.user_id, NEW.total_amount, NEW.points_earned, 0, 'purchase', '{}'
        );

        -- Update user points
        UPDATE public.user_points
        SET 
          current_points = current_points + NEW.points_earned,
          total_earned = total_earned + NEW.points_earned,
          updated_at = NOW()
        WHERE user_id = NEW.user_id;
        
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Drop the trigger if it exists
    DROP TRIGGER IF EXISTS on_order_created ON public.orders;

    -- Create the trigger
    CREATE TRIGGER on_order_created
    AFTER INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_order_created();
  `;

  // We have to execute raw SQL using Supabase rpc or via REST if rpc 'exec_sql' is available.
  // Actually, Supabase free tier doesn't provide a way to run arbitrary SQL from the JS client directly without an RPC function.
  // Is there another way? Maybe just update cart.tsx to use a transaction-like approach or make 2 separate requests?
  console.log("SQL to execute manually in Supabase Dashboard:", sql);
}

createTrigger();

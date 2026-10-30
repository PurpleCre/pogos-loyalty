import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gaap-signature, x-gaap-timestamp',
};

/**
 * GAAP POS Webhook Receiver
 * 
 * Receives transaction events from GAAP Unity POS system and awards
 * loyalty points to matched Pogo's app users automatically.
 * 
 * Expected payload format (will be confirmed once GAAP provides API docs):
 * {
 *   "event_type": "transaction.completed",
 *   "transaction_id": "GAAP-TXN-12345",
 *   "receipt_number": "R-2026-001234",
 *   "store_id": "GAAP-STORE-001",
 *   "customer": {
 *     "id": "GAAP-CUST-789",
 *     "email": "customer@example.com",
 *     "phone": "+27123456789"
 *   },
 *   "total_amount": 125.50,
 *   "currency": "ZAR",
 *   "line_items": [
 *     { "name": "Classic Burger", "quantity": 2, "price": 45.00 },
 *     { "name": "Fries", "quantity": 1, "price": 25.50 },
 *     { "name": "Coke", "quantity": 1, "price": 10.00 }
 *   ],
 *   "timestamp": "2026-10-01T12:30:00+02:00"
 * }
 */

interface GaapLineItem {
  name: string;
  quantity?: number;
  price?: number;
  sku?: string;
}

interface GaapCustomer {
  id?: string;
  email?: string;
  phone?: string;
  name?: string;
}

interface GaapWebhookPayload {
  event_type: string;
  transaction_id: string;
  receipt_number?: string;
  store_id?: string;
  customer?: GaapCustomer;
  total_amount: number;
  currency?: string;
  line_items?: GaapLineItem[];
  timestamp?: string;
  // Catch-all for unknown fields from GAAP
  [key: string]: unknown;
}

/**
 * Verify the webhook signature from GAAP.
 * Implementation will be updated once we get GAAP's signing spec.
 * Common patterns: HMAC-SHA256 of body using shared secret.
 */
async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    // In development/sandbox mode, skip verification if no secret configured
    console.warn('⚠️ Webhook signature verification skipped - no secret configured');
    return true;
  }

  try {
    // Most POS webhooks use HMAC-SHA256
    const expectedSignature = hmac('sha256', secret, body, 'utf8', 'hex');
    
    // Support both raw and prefixed signatures (e.g., "sha256=...")
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    return cleanSignature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Map a GAAP store ID to a Pogo's store UUID.
 * Looks up the gaap_config table for the matching store.
 */
async function resolveStoreId(
  supabase: ReturnType<typeof createClient>,
  gaapStoreId: string | undefined
): Promise<string | null> {
  if (!gaapStoreId) return null;

  const { data } = await supabase
    .from('gaap_config')
    .select('store_id')
    .eq('config_metadata->>gaap_store_id', gaapStoreId)
    .eq('is_active', true)
    .single();

  return data?.store_id || null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Read the raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-gaap-signature');
    const webhookSecret = Deno.env.get('GAAP_WEBHOOK_SECRET') || '';

    // Verify signature
    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse payload
    let payload: GaapWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`📥 GAAP webhook received: ${payload.event_type} | TXN: ${payload.transaction_id}`);

    // Only process completed transactions
    const processableEvents = [
      'transaction.completed',
      'sale.completed',
      'payment.completed',
      // Add more event types as GAAP docs reveal them
    ];

    if (!processableEvents.includes(payload.event_type)) {
      console.log(`ℹ️ Skipping event type: ${payload.event_type}`);
      return new Response(
        JSON.stringify({ success: true, message: `Event type '${payload.event_type}' acknowledged but not processed` }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate required fields
    if (!payload.transaction_id) {
      return new Response(
        JSON.stringify({ error: 'Missing transaction_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!payload.total_amount || payload.total_amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid total_amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Resolve the Pogo's store ID from GAAP store ID
    const pogosStoreId = await resolveStoreId(supabase, payload.store_id);

    // Call the database function to process the transaction
    const { data: result, error } = await supabase.rpc('process_gaap_transaction', {
      p_gaap_transaction_id: payload.transaction_id,
      p_gaap_receipt_number: payload.receipt_number || null,
      p_customer_email: payload.customer?.email || null,
      p_customer_phone: payload.customer?.phone || null,
      p_gaap_customer_id: payload.customer?.id || null,
      p_store_id: pogosStoreId,
      p_transaction_amount: payload.total_amount,
      p_line_items: JSON.stringify(payload.line_items || []),
      p_raw_payload: JSON.stringify(payload),
    });

    if (error) {
      console.error('❌ Error processing GAAP transaction:', error);
      
      // Log the failure
      await supabase.from('gaap_sync_log').insert({
        gaap_transaction_id: payload.transaction_id + '_err_' + Date.now(),
        sync_status: 'failed',
        error_message: error.message,
        transaction_amount: payload.total_amount,
        raw_payload: payload,
      });

      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`✅ GAAP transaction processed:`, result);

    // If points were awarded, trigger a push notification
    if (result?.success && result?.points_awarded > 0) {
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            title: '🎉 Points Earned!',
            body: `You earned ${result.points_awarded} points from your Pogo's purchase!`,
            userIds: [result.user_id],
            data: {
              type: 'gaap_points_earned',
              points: result.points_awarded,
              new_balance: result.new_balance,
            }
          }
        });
      } catch (notifError) {
        // Don't fail the webhook if notification fails
        console.warn('⚠️ Failed to send points notification:', notifError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Unhandled error in gaap-webhook:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);

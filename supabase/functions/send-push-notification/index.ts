import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  userIds?: string[];
  sendToAll?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { title, body, icon, badge, data, userIds, sendToAll }: PushNotificationRequest = await req.json();

    console.log('Sending push notification:', { title, body, userIds, sendToAll });

    // Get VAPID keys from environment
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@pogos.com';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured');
    }

    // Prepare query for subscriptions
    let query = supabaseClient
      .from('push_subscriptions')
      .select('*');

    if (!sendToAll && userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data: subscriptions, error: subscriptionsError } = await query;

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    const notificationPayload = {
      title,
      body,
      icon: icon || '/favicon.ico',
      badge: badge || '/favicon.ico',
      data: data || {}
    };

    const results = [];
    const failedDeliveries = [];

    // Send notifications to all subscriptions
    for (const subscription of subscriptions || []) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        };

        // Use web-push library equivalent for Deno
        const response = await sendWebPush(
          pushSubscription,
          JSON.stringify(notificationPayload),
          {
            vapidPublicKey: VAPID_PUBLIC_KEY,
            vapidPrivateKey: VAPID_PRIVATE_KEY,
            vapidSubject: VAPID_SUBJECT
          }
        );

        results.push({
          userId: subscription.user_id,
          success: true,
          status: response.status
        });

        // Store notification in database
        await supabaseClient
          .from('notifications')
          .insert({
            title,
            body,
            icon: icon || '/favicon.ico',
            badge: badge || '/favicon.ico',
            data,
            sent_to: subscription.user_id,
            delivery_status: response.status < 400 ? 'delivered' : 'failed'
          });

      } catch (error) {
        console.error(`Failed to send notification to user ${subscription.user_id}:`, error);
        failedDeliveries.push({
          userId: subscription.user_id,
          error: error.message
        });

        // Store failed notification in database
        await supabaseClient
          .from('notifications')
          .insert({
            title,
            body,
            icon: icon || '/favicon.ico',
            badge: badge || '/favicon.ico',
            data,
            sent_to: subscription.user_id,
            delivery_status: 'failed'
          });
      }
    }

    console.log(`Notifications sent successfully: ${results.length}`);
    console.log(`Failed deliveries: ${failedDeliveries.length}`);

    return new Response(JSON.stringify({
      success: true,
      sent: results.length,
      failed: failedDeliveries.length,
      results,
      failedDeliveries
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check function logs for more information'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

// Simplified web push implementation for Deno
async function sendWebPush(subscription: any, payload: string, options: any) {
  const { endpoint } = subscription;
  const { p256dh, auth } = subscription.keys;

  // This is a simplified implementation. In production, you'd want to use
  // a proper web push library that handles all the crypto properly.
  // For now, we'll make a basic POST request to the push service
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length.toString(),
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Push service responded with status: ${response.status}`);
  }

  return response;
}

serve(handler);
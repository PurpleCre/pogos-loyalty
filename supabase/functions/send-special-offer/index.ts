import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SpecialOfferRequest {
  subject: string;
  title: string;
  message: string;
  offerDetails?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { subject, title, message, offerDetails }: SpecialOfferRequest = await req.json();

    console.log("Sending special offer email to all users");

    // Get all user profiles with emails
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, full_name");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users found to send emails to" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send emails to all users
    const emailPromises = profiles
      .filter(profile => profile.email)
      .map(async (profile) => {
        try {
          await resend.emails.send({
            from: "Pogo's Loyalty <onboarding@resend.dev>",
            to: [profile.email],
            subject: subject,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2dd4bf, #14b8a6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .offer-box { background: white; border-left: 4px solid #2dd4bf; padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .cta-button { display: inline-block; background: #2dd4bf; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1 style="margin: 0;">${title}</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${profile.full_name || 'Valued Customer'},</p>
                      <p>${message}</p>
                      ${offerDetails ? `
                        <div class="offer-box">
                          <strong>Offer Details:</strong>
                          <p>${offerDetails}</p>
                        </div>
                      ` : ''}
                      <p style="text-align: center;">
                        <a href="${supabaseUrl.replace('https://akxukhkkddfqodqmdtwx.supabase.co', 'https://c1470fda-d52b-4d69-beb6-cb538aa47b85.lovableproject.com')}" class="cta-button">View in App</a>
                      </p>
                      <p>Thank you for being a loyal customer!</p>
                      <p>Best regards,<br>The Pogo's Team</p>
                      <div class="footer">
                        <p>You're receiving this because you're a member of Pogo's Loyalty Program.</p>
                      </div>
                    </div>
                  </div>
                </body>
              </html>
            `,
          });
          console.log(`Email sent to ${profile.email}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${profile.email}:`, emailError);
        }
      });

    await Promise.all(emailPromises);

    console.log(`Special offer emails sent to ${profiles.length} users`);

    return new Response(
      JSON.stringify({ 
        message: `Special offer sent to ${profiles.length} users`,
        recipientCount: profiles.length 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-special-offer function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" || error.message === "Admin access required" ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
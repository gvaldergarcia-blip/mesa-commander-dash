import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CampaignEmailRequest {
  campaign_id: string;
  restaurant_id: string;
  subject: string;
  message: string;
  cta_text?: string;
  cta_url?: string;
  coupon_code?: string;
  expires_at?: string;
  recipients: { email: string; name?: string }[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      campaign_id,
      restaurant_id,
      subject,
      message,
      cta_text,
      cta_url,
      coupon_code,
      expires_at,
      recipients,
    }: CampaignEmailRequest = await req.json();

    console.log(`Sending campaign ${campaign_id} to ${recipients.length} recipients`);

    // Criar cliente Supabase para atualizar status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let successCount = 0;
    let failCount = 0;

    // Enviar para cada destinatário
    for (const recipient of recipients) {
      try {
        // Construir HTML do e-mail
        const expiresText = expires_at 
          ? `<p style="font-size: 12px; color: #888;">Válido até ${new Date(expires_at).toLocaleDateString('pt-BR')}</p>`
          : '';
        
        const couponHtml = coupon_code
          ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; font-size: 12px; color: #666;">Use o código:</p>
              <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #FF6B35; letter-spacing: 2px;">${coupon_code}</p>
              ${expiresText}
            </div>`
          : '';
        
        const ctaHtml = cta_text && cta_url
          ? `<div style="text-align: center; margin: 25px 0;">
              <a href="${cta_url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #FF6B35, #FF8E53); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${cta_text}</a>
            </div>`
          : '';

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%); color: white; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🎉 Promoção Especial</h1>
              <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Olá${recipient.name ? `, ${recipient.name}` : ''}!</p>
            </div>
            
            <div style="background: white; padding: 30px 20px;">
              <div style="white-space: pre-wrap; font-size: 16px; line-height: 1.8;">${message}</div>
              
              ${couponHtml}
              ${ctaHtml}
            </div>
            
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0 0 10px;">Você está recebendo este e-mail porque aceitou receber ofertas deste restaurante.</p>
              <p style="margin: 0;">
                <a href="#" style="color: #FF6B35; text-decoration: none;">Cancelar recebimento</a>
              </p>
              <p style="margin: 10px 0 0; font-size: 11px;">© ${new Date().getFullYear()} MesaClik. Todos os direitos reservados.</p>
            </div>
          </body>
          </html>
        `;

        await resend.emails.send({
          from: "MesaClik <promocoes@mesaclik.app>",
          to: [recipient.email],
          subject: subject,
          html: emailHtml,
        });

        // Atualizar status do destinatário
        await supabase
          .from('restaurant_campaign_recipients')
          .update({ 
            delivery_status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('campaign_id', campaign_id)
          .eq('customer_email', recipient.email);

        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.email}:`, error);
        
        await supabase
          .from('restaurant_campaign_recipients')
          .update({ 
            delivery_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('campaign_id', campaign_id)
          .eq('customer_email', recipient.email);

        failCount++;
      }
    }

    console.log(`Campaign ${campaign_id}: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-campaign-emails function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

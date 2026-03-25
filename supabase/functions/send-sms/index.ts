import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SmsRequest {
  to: string;
  message: string;
}

async function sendMessage(
  to: string,
  from: string,
  body: string,
  lovableKey: string,
  twilioKey: string,
  channel: 'sms' | 'whatsapp'
): Promise<{ success: boolean; sid?: string; error?: string; channel: string }> {
  const formattedTo = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const formattedFrom = channel === 'whatsapp' ? `whatsapp:${from}` : from;

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: formattedFrom,
        Body: body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[send-sms] ${channel} error:`, data);
      return { success: false, error: data.message || `${channel} failed`, channel };
    }

    console.log(`[send-sms] ${channel} sent:`, data.sid);
    return { success: true, sid: data.sid, channel };
  } catch (err: any) {
    console.error(`[send-sms] ${channel} exception:`, err);
    return { success: false, error: err.message || `${channel} error`, channel };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER not configured");

    const { to, message }: SmsRequest = await req.json();
    console.log(`[send-sms] Enviando SMS + WhatsApp para ${to}`);

    const formattedPhone = to.startsWith('+') ? to : `+55${to.replace(/\D/g, '')}`;

    // Send SMS and WhatsApp in parallel
    const [smsResult, whatsappResult] = await Promise.all([
      sendMessage(formattedPhone, TWILIO_PHONE_NUMBER, message, LOVABLE_API_KEY, TWILIO_API_KEY, 'sms'),
      sendMessage(formattedPhone, TWILIO_PHONE_NUMBER, message, LOVABLE_API_KEY, TWILIO_API_KEY, 'whatsapp'),
    ]);

    console.log('[send-sms] Results:', { sms: smsResult, whatsapp: whatsappResult });

    // At least one channel succeeded
    if (smsResult.success || whatsappResult.success) {
      return new Response(
        JSON.stringify({
          success: true,
          sms: smsResult,
          whatsapp: whatsappResult,
          message: "Mensagem enviada com sucesso",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Both failed
    return new Response(
      JSON.stringify({
        success: false,
        error: "SEND_FAILED",
        sms: smsResult,
        whatsapp: whatsappResult,
        message: "Falha ao enviar SMS e WhatsApp",
      }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-sms function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message || "Erro interno ao processar mensagem",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SmsRequest {
  to: string;
  message?: string;
  channel?: 'both' | 'sms' | 'whatsapp';
  contentSid?: string;
  contentVariables?: Record<string, string>;
}

function normalizeE164(phone: string) {
  const trimmed = String(phone || '').trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}

function getWhatsAppFromNumber() {
  const configured = Deno.env.get("TWILIO_WHATSAPP_NUMBER")?.trim();
  if (!configured) {
    throw new Error("TWILIO_WHATSAPP_NUMBER não configurado. Configure o WhatsApp Sender aprovado no Twilio.");
  }

  if (!/^\+\d{10,15}$/.test(configured)) {
    throw new Error("TWILIO_WHATSAPP_NUMBER inválido. Use formato E.164, exemplo: +15559775978.");
  }

  if (configured === "+14155238886") {
    throw new Error("TWILIO_WHATSAPP_NUMBER ainda está no Sandbox do Twilio. Use o WhatsApp Sender aprovado em produção para aparecer o nome da marca.");
  }

  return configured;
}

async function sendMessage(
  to: string,
  from: string,
  body: string,
  lovableKey: string,
  twilioKey: string,
  channel: 'sms' | 'whatsapp',
  contentSid?: string,
  contentVariables?: Record<string, string>,
): Promise<{ success: boolean; sid?: string; error?: string; channel: string }> {
  const formattedTo = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const formattedFrom = channel === 'whatsapp' ? `whatsapp:${from}` : from;

  try {
    const params: Record<string, string> = {
      To: formattedTo,
      From: formattedFrom,
    };
    if (channel === 'whatsapp' && contentSid) {
      params.ContentSid = contentSid;
      if (contentVariables && Object.keys(contentVariables).length) {
        params.ContentVariables = JSON.stringify(contentVariables);
      }
    } else {
      params.Body = body;
    }

    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
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

    // WhatsApp production sender only. Do not fallback to sandbox because sandbox shows Twilio branding.
    const TWILIO_WHATSAPP_NUMBER = getWhatsAppFromNumber();

    const { to, message, channel = 'both', contentSid, contentVariables }: SmsRequest = await req.json();
    console.log(`[send-sms] Enviando ${channel} para ${to} | SMS_FROM=${TWILIO_PHONE_NUMBER} | WA_FROM=${TWILIO_WHATSAPP_NUMBER}`);

    const formattedPhone = normalizeE164(to);

    const skippedSms = { success: false, error: 'Canal SMS não solicitado', channel: 'sms' };
    const skippedWhatsapp = { success: false, error: 'Canal WhatsApp não solicitado', channel: 'whatsapp' };

    const [smsResult, whatsappResult] = await Promise.all([
      channel === 'sms' || channel === 'both'
        ? sendMessage(formattedPhone, TWILIO_PHONE_NUMBER, message || '', LOVABLE_API_KEY, TWILIO_API_KEY, 'sms')
        : Promise.resolve(skippedSms),
      channel === 'whatsapp' || channel === 'both'
        ? sendMessage(formattedPhone, TWILIO_WHATSAPP_NUMBER, message || '', LOVABLE_API_KEY, TWILIO_API_KEY, 'whatsapp', contentSid, contentVariables)
        : Promise.resolve(skippedWhatsapp),
    ]);

    console.log('[send-sms] Results:', { sms: smsResult, whatsapp: whatsappResult });

    const success = channel === 'whatsapp'
      ? whatsappResult.success
      : channel === 'sms'
      ? smsResult.success
      : smsResult.success || whatsappResult.success;

    if (success) {
      return new Response(
        JSON.stringify({
          success: true,
          sms: smsResult,
          whatsapp: whatsappResult,
          message: channel === 'whatsapp' ? "WhatsApp enviado com sucesso" : "Mensagem enviada com sucesso",
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
        message: channel === 'whatsapp'
          ? (whatsappResult.error || "Falha ao enviar WhatsApp")
          : channel === 'sms'
          ? (smsResult.error || "Falha ao enviar SMS")
          : "Falha ao enviar SMS e WhatsApp",
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

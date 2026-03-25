import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsRequest {
  to: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) {
      throw new Error("TWILIO_API_KEY is not configured");
    }

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_PHONE_NUMBER) {
      console.error("TWILIO_PHONE_NUMBER não configurado");
      throw new Error("TWILIO_PHONE_NUMBER not configured");
    }

    const { to, message }: SmsRequest = await req.json();
    console.log(`Enviando SMS para ${to}`);

    const formattedPhone = to.startsWith('+') ? to : `+55${to}`;

    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Erro ao enviar SMS:", responseData);

      const isTwilioTrialError = responseData.code === 21608 ||
        (responseData.message && responseData.message.includes("unverified"));

      if (isTwilioTrialError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "TWILIO_TRIAL_ERROR",
            message: "Número não verificado. Conta Twilio trial só pode enviar para números verificados.",
            details: responseData.message,
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "TWILIO_API_ERROR",
          message: responseData.message || "Erro ao enviar SMS via Twilio",
          code: responseData.code,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("SMS enviado com sucesso:", responseData.sid);

    return new Response(
      JSON.stringify({ success: true, sid: responseData.sid, message: "SMS enviado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-sms function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message || "Erro interno ao processar SMS",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

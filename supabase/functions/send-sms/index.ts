import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsRequest {
  to: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando envio de SMS via Twilio");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("Credenciais do Twilio não configuradas");
      throw new Error("Twilio credentials not configured");
    }

    const { to, message }: SmsRequest = await req.json();
    console.log(`Enviando SMS para ${to}`);

    // Formatar número de telefone para o padrão internacional (+55)
    const formattedPhone = to.startsWith('+') ? to : `+55${to}`;

    // Enviar SMS via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
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
      
      // Detectar erro de conta trial com número não verificado
      const isTwilioTrialError = responseData.code === 21608 || 
        (responseData.message && responseData.message.includes("unverified"));
      
      if (isTwilioTrialError) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "TWILIO_TRIAL_ERROR",
            message: "Número não verificado. Conta Twilio trial só pode enviar para números verificados.",
            details: responseData.message,
            action: "Verifique o número em https://twilio.com/console/phone-numbers/verified ou atualize para conta paga"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
      
      // Outros erros do Twilio
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "TWILIO_API_ERROR",
          message: responseData.message || "Erro ao enviar SMS via Twilio",
          code: responseData.code
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log("SMS enviado com sucesso:", responseData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: responseData.sid,
        message: "SMS enviado com sucesso" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-sms function:", error);
    
    // Erro de configuração (sem credenciais)
    if (error.message.includes("credentials")) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "CONFIG_ERROR",
          message: "Credenciais do Twilio não configuradas corretamente"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Outros erros
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message || "Erro interno ao processar SMS"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

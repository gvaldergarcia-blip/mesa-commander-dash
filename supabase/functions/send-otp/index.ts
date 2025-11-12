import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SID");
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@mesaclik.com";
const SENDGRID_FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "MesaClik";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  contact: string; // email ou telefone
  purpose: 'login' | 'queue' | 'reservation' | 'profile';
  preferredChannel?: 'email' | 'sms';
  userId?: string;
}

// Gera código de 6 dígitos
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash do código para armazenar
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Envia email via SendGrid
async function sendEmail(to: string, code: string): Promise<{ success: boolean; error: string }> {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 32px; letter-spacing: 1px; }
            .content { padding: 40px 30px; text-align: center; }
            .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
            .code-box { background: #f8f8f8; border: 2px solid #FF6B35; border-radius: 8px; padding: 20px; margin: 30px 0; }
            .code { font-size: 36px; font-weight: bold; color: #FF6B35; letter-spacing: 8px; font-family: monospace; }
            .expiry { color: #666; font-size: 14px; margin-top: 20px; }
            .footer { background: #f8f8f8; padding: 20px; text-align: center; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MESA<span style="color:#FFD700;">CLIK</span></h1>
            </div>
            <div class="content">
              <p class="greeting">Olá! Aqui está seu código de verificação:</p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <p class="expiry">⏰ Este código expira em <strong>10 minutos</strong></p>
              <p style="color: #999; font-size: 14px; margin-top: 30px;">
                Se você não solicitou este código, pode ignorar este e-mail com segurança.
              </p>
            </div>
            <div class="footer">
              <p>© 2025 MesaClik - Gestão inteligente de filas e reservas</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: {
          email: SENDGRID_FROM_EMAIL,
          name: SENDGRID_FROM_NAME,
        },
        subject: "Seu código de verificação MesaClik",
        content: [{
          type: "text/html",
          value: html,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid error:", errorText);
      return { success: false, error: errorText };
    }

    return { success: true, error: '' };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Envia SMS via Twilio Verify
async function sendSms(to: string, code: string): Promise<{ success: boolean; error: string }> {
  try {
    // Formatar número para padrão internacional
    const formattedPhone = to.startsWith('+') ? to : `+55${to.replace(/\D/g, '')}`;
    
    const message = `MesaClik: seu código de verificação é ${code}. Ele expira em 10 minutos.`;
    
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
        From: Deno.env.get("TWILIO_PHONE_NUMBER")!,
        Body: message,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", responseData);
      return { success: false, error: responseData.message || "Failed to send SMS" };
    }

    return { success: true, error: '' };
  } catch (error) {
    console.error("Error sending SMS:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact, purpose, preferredChannel, userId }: SendOtpRequest = await req.json();
    
    console.log(`Sending OTP to ${contact} via ${preferredChannel || 'auto'}`);

    // Verificar se há um código válido recente (limite de 1 minuto)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentLogs } = await supabase
      .from('otp_logs')
      .select('*')
      .eq('contact', contact)
      .eq('purpose', purpose)
      .gte('created_at', oneMinuteAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "RATE_LIMIT",
          message: "Por favor, aguarde 1 minuto antes de solicitar um novo código."
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Gerar código e hash
    const code = generateOtp();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 600000).toISOString(); // 10 minutos

    // Determinar canal (email é padrão se não especificado)
    const isEmail = contact.includes('@');
    let channel = preferredChannel || (isEmail ? 'email' : 'sms');
    
    // Tentar enviar
    let result = { success: false, error: '' };
    
    if (channel === 'email' && isEmail) {
      result = await sendEmail(contact, code);
      
      // Fallback para SMS se email falhar e tiver número
      if (!result.success && !isEmail) {
        console.log("Email failed, trying SMS fallback");
        channel = 'sms';
        result = await sendSms(contact, code);
      }
    } else if (channel === 'sms' || !isEmail) {
      result = await sendSms(contact, code);
      
      // Fallback para email se SMS falhar e tiver email
      if (!result.success && isEmail) {
        console.log("SMS failed, trying email fallback");
        channel = 'email';
        result = await sendEmail(contact, code);
      }
    }

    // Gravar log
    const logData = {
      user_id: userId || null,
      contact,
      channel,
      purpose,
      status: result.success ? 'sent' : 'failed',
      code_hash: result.success ? codeHash : null,
      expires_at: expiresAt,
      error_message: result.error || null,
    };

    const { data: log, error: logError } = await supabase
      .from('otp_logs')
      .insert(logData)
      .select()
      .single();

    if (logError) {
      console.error("Error saving log:", logError);
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "SEND_FAILED",
          message: `Erro ao enviar código via ${channel}. Por favor, tente novamente.`
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        logId: log?.id,
        channel,
        message: `Código enviado via ${channel === 'email' ? 'e-mail' : 'SMS'}`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message || "Erro interno ao processar solicitação"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  contact: string;
  code: string;
  purpose: 'login' | 'queue' | 'reservation' | 'profile';
}

// Hash do código para comparação
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact, code, purpose }: VerifyOtpRequest = await req.json();
    
    console.log(`Verifying OTP for ${contact}, purpose: ${purpose}`);

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "INVALID_CODE",
          message: "Código deve ter 6 dígitos numéricos."
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const codeHash = await hashCode(code);
    const now = new Date().toISOString();

    // Buscar log do código
    const { data: logs, error: fetchError } = await supabase
      .from('otp_logs')
      .select('*')
      .eq('contact', contact)
      .eq('purpose', purpose)
      .eq('code_hash', codeHash)
      .eq('status', 'sent')
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching logs:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "DATABASE_ERROR",
          message: "Erro ao verificar código."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!logs || logs.length === 0) {
      // Verificar se existe um log para incrementar tentativas
      const { data: anyLog } = await supabase
        .from('otp_logs')
        .select('*')
        .eq('contact', contact)
        .eq('purpose', purpose)
        .order('created_at', { ascending: false })
        .limit(1);

      if (anyLog && anyLog.length > 0) {
        const log = anyLog[0];
        
        // Verificar se expirou
        if (new Date(log.expires_at) < new Date()) {
          await supabase
            .from('otp_logs')
            .update({ status: 'expired' })
            .eq('id', log.id);

          return new Response(
            JSON.stringify({ 
              success: false,
              error: "EXPIRED",
              message: "Código expirado. Solicite um novo código."
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        // Incrementar tentativas (máximo 5)
        const newAttempts = (log.attempts || 0) + 1;
        
        if (newAttempts >= 5) {
          await supabase
            .from('otp_logs')
            .update({ 
              status: 'failed',
              attempts: newAttempts,
              error_message: 'Too many attempts'
            })
            .eq('id', log.id);

          return new Response(
            JSON.stringify({ 
              success: false,
              error: "TOO_MANY_ATTEMPTS",
              message: "Muitas tentativas incorretas. Solicite um novo código."
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        await supabase
          .from('otp_logs')
          .update({ attempts: newAttempts })
          .eq('id', log.id);
      }

      return new Response(
        JSON.stringify({ 
          success: false,
          error: "INCORRECT",
          message: "Código incorreto. Tente novamente."
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const log = logs[0];

    // Atualizar log como verificado
    const { error: updateError } = await supabase
      .from('otp_logs')
      .update({ 
        status: 'verified',
        verified_at: now
      })
      .eq('id', log.id);

    if (updateError) {
      console.error("Error updating log:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: log.user_id,
        message: "Código verificado com sucesso!"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "INTERNAL_ERROR",
        message: error.message || "Erro interno ao processar verificação"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

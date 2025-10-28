import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  restaurantId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, restaurantId }: NotificationRequest = await req.json();

    // Buscar informações do restaurante e programa
    const { data: restaurant, error: restaurantError } = await supabase
      .schema("mesaclik")
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .single();

    if (restaurantError) throw restaurantError;

    const { data: program, error: programError } = await supabase
      .schema("mesaclik")
      .from("cliks_program")
      .select("reward_description, rules, validity")
      .eq("restaurant_id", restaurantId)
      .single();

    if (programError) throw programError;

    // Buscar email do usuário (assumindo que existe uma tabela de profiles ou similar)
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user?.email) {
      console.log("User not found or no email:", userId);
      return new Response(
        JSON.stringify({ message: "User email not found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Enviar email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Parabéns!</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1f2937; margin-top: 0;">Você completou 10 Cliks!</h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
            Você acumulou 10 Cliks no <strong>${restaurant.name}</strong> e agora tem direito à sua recompensa:
          </p>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #92400e; font-size: 18px; font-weight: bold;">
              🎁 ${program.reward_description}
            </p>
          </div>
          
          ${program.rules ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #1f2937; font-size: 16px;">Regras:</h3>
              <p style="color: #6b7280; font-size: 14px;">${program.rules}</p>
            </div>
          ` : ''}
          
          ${program.validity ? `
            <p style="color: #ef4444; font-size: 14px;">
              ⏰ Válido até: ${new Date(program.validity).toLocaleDateString('pt-BR')}
            </p>
          ` : ''}
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
              <strong>Como resgatar:</strong><br>
              Mostre este email ao garçom ou gerente do restaurante para receber sua recompensa.
            </p>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
            Este é um email automático do Programa 10 Cliks do ${restaurant.name}.
          </p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "MesaClik <noreply@mesaclik.com>",
      to: [user.email],
      subject: `🎉 Parabéns! Você completou 10 Cliks no ${restaurant.name}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-10cliks function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

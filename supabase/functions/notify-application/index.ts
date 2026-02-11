import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { application_id } = await req.json();

    if (!application_id) {
      return new Response(
        JSON.stringify({ error: "application_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the application
    const { data: app, error } = await supabaseAdmin
      .from("restaurant_applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (error || !app) {
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@mesaclik.com";

    // Build approval/rejection URLs that call the approve-restaurant function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const approveUrl = `${supabaseUrl}/functions/v1/approve-restaurant`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a2e; border-bottom: 3px solid #e94560; padding-bottom: 10px;">
          🍽️ Nova Solicitação de Restaurante
        </h1>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #333;">${app.restaurant_name}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666;">Culinária:</td><td style="padding: 8px 0;"><strong>${app.cuisine}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Endereço:</td><td style="padding: 8px 0;"><strong>${app.address_line || 'Não informado'}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Cidade:</td><td style="padding: 8px 0;"><strong>${app.city || ''} ${app.state ? '- ' + app.state : ''}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email:</td><td style="padding: 8px 0;"><strong>${app.owner_email}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Telefone:</td><td style="padding: 8px 0;"><strong>${app.owner_phone || 'Não informado'}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Data:</td><td style="padding: 8px 0;"><strong>${new Date(app.created_at).toLocaleString('pt-BR')}</strong></td></tr>
          </table>
        </div>

        <p style="color: #555;">Para aprovar ou recusar, use os comandos abaixo no terminal ou ferramenta HTTP:</p>
        
        <div style="background: #e8f5e9; border: 1px solid #4caf50; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <strong style="color: #2e7d32;">✅ APROVAR:</strong>
          <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">curl -X POST "${approveUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"application_id": "${app.id}", "action": "approve"}'</pre>
        </div>
        
        <div style="background: #ffebee; border: 1px solid #f44336; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <strong style="color: #c62828;">❌ RECUSAR:</strong>
          <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">curl -X POST "${approveUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"application_id": "${app.id}", "action": "reject"}'</pre>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          MesaClik — Sistema de Gestão de Restaurantes
        </p>
      </div>
    `;

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `MesaClik <${fromEmail}>`,
      to: ["gvaldergarcia@gmail.com"],
      subject: `🍽️ Nova solicitação: ${app.restaurant_name}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send notification email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Notification email sent:", emailResult);

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

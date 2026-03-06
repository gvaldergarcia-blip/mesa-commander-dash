import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_TRANSACTIONAL =
  Deno.env.get("RESEND_FROM_TRANSACTIONAL") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "notify@mesaclik.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  from: string,
  text: string,
): Promise<{ id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY secret");
    return { error: "Missing RESEND_API_KEY" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      reply_to: "suporte@mesaclik.com.br",
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "DR, RN, NRN, OOF, AutoReply",
      },
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error("Resend API error:", data);
    return { error: data.message || "Failed to send email" };
  }
  
  return { id: data.id };
}

interface QueueEmailRequest {
  email: string;
  customer_name?: string;
  restaurant_name: string;
  position: number;
  party_size?: number;
  size_group?: string;
  estimated_wait_minutes?: number;
  type: 'entry' | 'called' | 'position_update';
  queue_url?: string;
}

function getSafeSenderName(restaurantName: string): string {
  const clean = (restaurantName || "MesaClik")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 40 ? clean.slice(0, 40) : clean || "MesaClik";
}

// ── Escape helpers ─────────────────────────────────────────────────
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Plain-text builders ─────────────────────────────────────────────
function buildPlainText(data: QueueEmailRequest): string {
  const name = data.customer_name || "Cliente";
  const positionLine = Number.isFinite(data.position) ? `Posicao atual: #${data.position}` : "";

  switch (data.type) {
    case "entry":
      return [
        `Voce entrou na fila do ${data.restaurant_name}.`,
        "",
        `Ola ${name}!`,
        positionLine,
        data.party_size ? `Pessoas: ${data.party_size}` : "",
        data.estimated_wait_minutes ? `Tempo estimado: ~${data.estimated_wait_minutes} min` : "",
        data.queue_url ? `Acompanhar fila: ${data.queue_url}` : "",
        "",
        `Enviado por ${data.restaurant_name}`,
      ].filter(Boolean).join("\n");

    case "called":
      return [
        `Sua vez chegou no ${data.restaurant_name}!`,
        "",
        `${name}, dirija-se ao balcao agora.`,
        "Sua mesa esta pronta. Apresente-se ao atendente.",
        "",
        `Enviado por ${data.restaurant_name}`,
      ].filter(Boolean).join("\n");

    case "position_update":
    default:
      return [
        `Atualizacao da fila - ${data.restaurant_name}`,
        "",
        `Ola ${name}!`,
        positionLine,
        data.estimated_wait_minutes ? `Tempo estimado: ~${data.estimated_wait_minutes} min` : "",
        data.queue_url ? `Acompanhar fila: ${data.queue_url}` : "",
        "",
        `Enviado por ${data.restaurant_name}`,
      ].filter(Boolean).join("\n");
  }
}

// ── Subject builders ────────────────────────────────────────────────
function buildSubject(data: QueueEmailRequest): string {
  switch (data.type) {
    case "entry":
      return `Voce esta na fila - ${data.restaurant_name}`;
    case "called":
      return `Sua vez chegou - ${data.restaurant_name}`;
    case "position_update":
      return `Atualizacao da fila - ${data.restaurant_name}`;
    default:
      return `Fila - ${data.restaurant_name}`;
  }
}

// ── Minimal HTML builder (super compatível anti-corpo-vazio) ───────
function buildHtml(data: QueueEmailRequest): string {
  const customerName = escapeHtml(data.customer_name || "Cliente");
  const restaurantName = escapeHtml(data.restaurant_name || "MesaClik");
  const queueUrl = data.queue_url ? escapeHtml(data.queue_url) : "";
  const hasPosition = Number.isFinite(data.position);

  let heroTitle = "Atualização da fila";
  let bodyIntro = `Olá <strong>${customerName}</strong>!`;
  let infoBlock = "";
  let ctaLabel = "Ver minha posição em tempo real";
  let footerText = "Fique de olho! Avisaremos quando for a sua vez.";

  if (data.type === "entry") {
    heroTitle = "Você está na fila!";
    infoBlock = `
      ${hasPosition ? `<p style="margin:0 0 8px;font-size:24px;line-height:1.2;font-weight:700;color:#1f2937;">Posição atual: #${data.position}</p>` : ""}
      ${data.party_size ? `<p style="margin:0 0 8px;font-size:18px;line-height:1.4;color:#9a3412;"><strong>👥 ${data.party_size} pessoas</strong></p>` : ""}
      ${data.size_group ? `<p style="margin:0;font-size:16px;line-height:1.5;color:#6b7280;">Fila de ${escapeHtml(data.size_group)}</p>` : ""}
      ${data.estimated_wait_minutes ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#6b7280;">Tempo estimado: ~${data.estimated_wait_minutes} min</p>` : ""}
    `;
  } else if (data.type === "called") {
    heroTitle = "Sua vez chegou!";
    ctaLabel = "Ir para o acompanhamento";
    footerText = "Dirija-se ao balcão o quanto antes para não perder sua vez.";
    infoBlock = `
      <p style="margin:0 0 8px;font-size:20px;line-height:1.3;font-weight:700;color:#9a3412;">🔔 Estamos te chamando agora</p>
      <p style="margin:0;font-size:16px;line-height:1.5;color:#4b5563;">Sua mesa está pronta.</p>
    `;
  } else {
    heroTitle = "Atualização da fila";
    infoBlock = `
      ${hasPosition ? `<p style="margin:0 0 8px;font-size:24px;line-height:1.2;font-weight:700;color:#1f2937;">Posição atual: #${data.position}</p>` : ""}
      ${data.estimated_wait_minutes ? `<p style="margin:0;font-size:15px;line-height:1.5;color:#6b7280;">Tempo estimado: ~${data.estimated_wait_minutes} min</p>` : ""}
    `;
  }

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:0;margin:0;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;">
            <tr>
              <td style="background:#f97316;padding:36px 24px;text-align:center;">
                <p style="margin:0 0 10px;font-size:28px;line-height:1;">🎉</p>
                <h1 style="margin:0 0 8px;font-size:40px;line-height:1.1;color:#ffffff;font-weight:800;">${heroTitle}</h1>
                <p style="margin:0;font-size:20px;line-height:1.4;color:#fff7ed;">${restaurantName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 22px;">
                <p style="margin:0 0 22px;font-size:30px;line-height:1.25;color:#111827;">${bodyIntro}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px 16px;">
                      ${infoBlock}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${queueUrl ? `
            <tr>
              <td align="center" style="padding:4px 24px 22px;">
                <a href="${queueUrl}" style="display:inline-block;background:#f97316;color:#ffffff;font-size:20px;line-height:1.3;font-weight:700;text-decoration:none;padding:16px 22px;border-radius:14px;">📱 ${ctaLabel}</a>
              </td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding:0 24px 30px;text-align:center;">
                <p style="margin:0;font-size:16px;line-height:1.5;color:#6b7280;">${footerText}</p>
                <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">Enviado por ${restaurantName} • MesaClik</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: QueueEmailRequest = await req.json();

    console.log('Queue email request:', JSON.stringify({
      email: requestData.email,
      type: requestData.type,
      restaurant_name: requestData.restaurant_name,
      position: requestData.position,
    }));

    if (!requestData.email || !requestData.restaurant_name || !requestData.type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, restaurant_name, type' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = buildSubject(requestData);
    const html = buildHtml(requestData);
    const text = buildPlainText(requestData);
    // Use RESEND_FROM_EMAIL directly — it's already a valid email on the verified domain
    const rawEmail = RESEND_FROM_TRANSACTIONAL.replace(/^.*</, '').replace(/>$/, '');
    const senderName = getSafeSenderName(requestData.restaurant_name);
    const fromAddress = `${senderName} <${rawEmail}>`;

    console.log('Sending from:', fromAddress, '| Subject:', subject);
    console.log('Payload sizes:', JSON.stringify({ htmlLength: html.length, textLength: text.length, hasQueueUrl: !!requestData.queue_url }));

    const emailResponse = await sendEmailViaResend(
      requestData.email,
      subject,
      html,
      fromAddress,
      text,
    );

    if (emailResponse.error) {
      console.error('Failed to send email:', emailResponse.error);
      return new Response(
        JSON.stringify({ error: emailResponse.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Email sent successfully:', JSON.stringify(emailResponse));

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error sending queue email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

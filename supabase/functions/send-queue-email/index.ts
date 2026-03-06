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

// ── Minimal HTML builder (super compatível anti-corpo-vazio) ───────
function buildHtml(data: QueueEmailRequest): string {
  const customerName = escapeHtml(data.customer_name || "Cliente");
  const restaurantName = escapeHtml(data.restaurant_name || "MesaClik");
  const queueUrl = data.queue_url ? escapeHtml(data.queue_url) : "";
  const positionLine = Number.isFinite(data.position)
    ? `<p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;"><strong>Posicao atual:</strong> #${data.position}</p>`
    : "";

  let title = "Atualizacao da fila";
  let intro = `<p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;">Ola <strong>${customerName}</strong>!</p>`;
  let extra = "";

  if (data.type === "entry") {
    title = "Voce entrou na fila";
    extra = `
      ${positionLine}
      ${data.party_size ? `<p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;"><strong>Pessoas:</strong> ${data.party_size}</p>` : ""}
      ${data.estimated_wait_minutes ? `<p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;"><strong>Tempo estimado:</strong> ~${data.estimated_wait_minutes} min</p>` : ""}
      <p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;">Avisaremos quando chegar sua vez.</p>
    `;
  } else if (data.type === "called") {
    title = "Sua vez chegou";
    extra = `
      <p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;"><strong>Dirija-se ao balcao agora.</strong></p>
      <p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;">Sua mesa esta pronta.</p>
    `;
  } else {
    title = "Atualizacao da fila";
    extra = `
      ${positionLine}
      ${data.estimated_wait_minutes ? `<p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;"><strong>Tempo estimado:</strong> ~${data.estimated_wait_minutes} min</p>` : ""}
    `;
  }

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
    <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;padding:24px;">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111111;">${title}</h1>
      <p style="margin:0 0 12px;color:#111111;font-size:16px;line-height:1.5;"><strong>Restaurante:</strong> ${restaurantName}</p>
      ${intro}
      ${extra}
      ${queueUrl ? `<p style="margin:16px 0 0;color:#111111;font-size:16px;line-height:1.5;"><a href="${queueUrl}" style="color:#0a58ca;text-decoration:underline;">Clique aqui para acompanhar sua posicao</a></p>` : ""}
      <p style="margin:24px 0 0;color:#666666;font-size:12px;line-height:1.5;">Enviado por ${restaurantName}</p>
    </div>
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

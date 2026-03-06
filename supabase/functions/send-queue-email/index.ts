import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_TRANSACTIONAL =
  Deno.env.get("RESEND_FROM_TRANSACTIONAL") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "notify@mesaclik.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function getRawEmailAddress(fromValue: string): string {
  return (fromValue || "notify@mesaclik.com.br").replace(/^.*</, "").replace(/>$/, "").trim();
}

// ── Subject (NO emoji — same pattern as reservation) ────────────────
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

// ── Plain text ──────────────────────────────────────────────────────
function buildPlainText(data: QueueEmailRequest): string {
  const name = data.customer_name || "Cliente";

  switch (data.type) {
    case "entry":
      return [
        `Voce entrou na fila do ${data.restaurant_name}.`,
        "",
        `Ola ${name}!`,
        data.party_size ? `Pessoas: ${data.party_size}` : "",
        data.estimated_wait_minutes ? `Tempo estimado: ~${data.estimated_wait_minutes} min` : "",
        data.queue_url ? `Acompanhar fila: ${data.queue_url}` : "",
        "",
        `Este e-mail foi enviado pelo ${data.restaurant_name}`,
      ].filter(Boolean).join("\n");

    case "called":
      return [
        `Sua vez chegou no ${data.restaurant_name}!`,
        "",
        `${name}, dirija-se ao balcao agora.`,
        "Sua mesa esta pronta. Apresente-se ao atendente.",
        "",
        `Este e-mail foi enviado pelo ${data.restaurant_name}`,
      ].filter(Boolean).join("\n");

    case "position_update":
    default:
      return [
        `Atualizacao da fila - ${data.restaurant_name}`,
        "",
        `Ola ${name}!`,
        data.estimated_wait_minutes ? `Tempo estimado: ~${data.estimated_wait_minutes} min` : "",
        data.queue_url ? `Acompanhar fila: ${data.queue_url}` : "",
        "",
        `Este e-mail foi enviado pelo ${data.restaurant_name}`,
      ].filter(Boolean).join("\n");
  }
}

// ── Minimal HTML (SAME structure as send-reservation-email) ─────────
function buildHtml(data: QueueEmailRequest): string {
  const name = data.customer_name || "Cliente";
  const restaurantName = data.restaurant_name || "MesaClik";
  const queueUrl = data.queue_url || "";

  const headerBg = data.type === "called" ? "#dc2626" : "#ea580c";
  const headerTitle =
    data.type === "entry"           ? "Voce esta na fila!" :
    data.type === "called"          ? "Sua vez chegou!" :
                                      "Atualizacao da fila";

  let bodyContent: string;

  if (data.type === "called") {
    bodyContent = `
      ${data.customer_name ? `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">Ola <strong>${name}</strong>!</p>` : ""}
      <p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">
        Estamos chamando voce agora! Dirija-se ao balcao do <strong>${restaurantName}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td style="padding:16px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;text-align:center;">
          <p style="margin:0;color:#991b1b;font-size:16px;font-weight:700;">Sua mesa esta pronta</p>
          <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Apresente-se ao atendente o quanto antes</p>
        </td></tr>
      </table>`;
  } else if (data.type === "entry") {
    bodyContent = `
      ${data.customer_name ? `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">Ola <strong>${name}</strong>!</p>` : ""}
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        Voce entrou na fila do <strong>${restaurantName}</strong> com sucesso.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td style="padding:16px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;text-align:center;">
          ${data.party_size ? `<p style="margin:0;color:#9a3412;font-size:14px;font-weight:600;">${data.party_size} ${data.party_size === 1 ? "pessoa" : "pessoas"}</p>` : ""}
          ${data.size_group ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Fila de ${data.size_group}</p>` : ""}
          ${data.estimated_wait_minutes ? `<p style="margin:4px 0 0;color:#1f2937;font-size:16px;font-weight:700;">Tempo estimado: ~${data.estimated_wait_minutes} min</p>` : ""}
        </td></tr>
      </table>
      ${queueUrl ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td align="center">
          <a href="${queueUrl}" style="display:inline-block;padding:14px 32px;background-color:#ea580c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
            Ver minha posicao em tempo real
          </a>
        </td></tr>
      </table>` : ""}`;
  } else {
    bodyContent = `
      ${data.customer_name ? `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">Ola <strong>${name}</strong>!</p>` : ""}
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        Sua posicao na fila do <strong>${restaurantName}</strong> foi atualizada.
      </p>
      ${data.estimated_wait_minutes ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td style="padding:16px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;text-align:center;">
          <p style="margin:0;color:#1f2937;font-size:16px;font-weight:700;">Tempo estimado: ~${data.estimated_wait_minutes} min</p>
        </td></tr>
      </table>` : ""}
      ${queueUrl ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td align="center">
          <a href="${queueUrl}" style="display:inline-block;padding:14px 32px;background-color:#ea580c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
            Ver minha posicao em tempo real
          </a>
        </td></tr>
      </table>` : ""}`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no">
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f9fafb;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <tr>
            <td style="padding:28px 24px;text-align:center;background-color:${headerBg};border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${headerTitle}</h1>
              <p style="margin:8px 0 0;color:#ffffff;font-size:15px;opacity:0.9;">${restaurantName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-radius:0 0 8px 8px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">Este e-mail foi enviado pelo ${restaurantName}</p>
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
    const fromAddress = `MesaClik <${getRawEmailAddress(RESEND_FROM_TRANSACTIONAL)}>`;

    console.log('Sending from:', fromAddress, '| Subject:', subject);

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

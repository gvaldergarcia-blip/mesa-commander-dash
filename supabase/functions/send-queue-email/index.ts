import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@mesaclik.com.br";

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
  headers: Record<string, string>
): Promise<{ id?: string; error?: string }> {
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
      headers,
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

// ── Plain-text builders ─────────────────────────────────────────────
function buildPlainText(data: QueueEmailRequest): string {
  const name = data.customer_name || 'Cliente';
  switch (data.type) {
    case 'entry':
      return [
        `Voce esta na fila do ${data.restaurant_name}`,
        '',
        `Ola ${name}!`,
        data.party_size ? `Pessoas: ${data.party_size}` : '',
        data.queue_url ? `Acompanhe em tempo real: ${data.queue_url}` : '',
        '',
        `Este e-mail foi enviado pelo ${data.restaurant_name}`,
      ].filter(Boolean).join('\n');

    case 'called':
      return [
        `E a sua vez no ${data.restaurant_name}!`,
        '',
        `${name}, dirija-se ao balcao agora!`,
        'Sua mesa esta pronta. Por favor, apresente-se ao atendente.',
        '',
        `Este e-mail foi enviado pelo ${data.restaurant_name}`,
      ].filter(Boolean).join('\n');

    case 'position_update':
    default:
      return [
        `Atualizacao da fila - ${data.restaurant_name}`,
        '',
        `Ola ${name}! A fila esta andando!`,
        data.party_size ? `Pessoas: ${data.party_size}` : '',
        data.queue_url ? `Acompanhe em tempo real: ${data.queue_url}` : '',
        '',
        'Aguarde, logo sera a sua vez!',
        '',
        `Este e-mail foi enviado pelo ${data.restaurant_name}`,
      ].filter(Boolean).join('\n');
  }
}

// ── Subject builders (NO emoji – Hotmail penalises emoji subjects) ──
function buildSubject(data: QueueEmailRequest): string {
  switch (data.type) {
    case 'entry':
      return `Voce esta na fila - ${data.restaurant_name}`;
    case 'called':
      return `Sua vez chegou - ${data.restaurant_name}`;
    case 'position_update':
      return `Atualizacao da fila - ${data.restaurant_name}`;
    default:
      return `Fila - ${data.restaurant_name}`;
  }
}

// ── Minimal HTML builder (Outlook-safe: no gradients, no box-shadow) ──
function buildHtml(data: QueueEmailRequest): string {
  const { customer_name, restaurant_name, party_size, size_group, queue_url, type } = data;
  const name = customer_name || 'Cliente';

  const headerBg = type === 'called' ? '#d97706' : '#ea580c';
  const headerTitle =
    type === 'entry' ? 'Voce esta na fila!' :
    type === 'called' ? 'Sua vez chegou!' :
    'Atualizacao da fila';

  const bodyContent = type === 'called'
    ? `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">${customer_name ? `<strong>${customer_name}</strong>, d` : 'D'}irija-se ao balcao agora!</p>
       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
         <tr><td style="padding:20px;background-color:#fef3c7;border:1px solid #fbbf24;border-radius:8px;text-align:center;">
           <p style="margin:0;color:#92400e;font-size:16px;font-weight:600;">Sua mesa esta pronta!</p>
         </td></tr>
       </table>
       <p style="margin:0;color:#6b7280;font-size:14px;">Por favor, apresente-se ao atendente.</p>`
    : `${customer_name ? `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">Ola <strong>${customer_name}</strong>!</p>` : ''}
       ${party_size ? `
       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
         <tr><td style="padding:16px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;text-align:center;">
           <p style="margin:0;color:#9a3412;font-size:14px;font-weight:600;">${party_size} ${party_size === 1 ? 'pessoa' : 'pessoas'}</p>
           <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">Fila de ${size_group || `${party_size} pessoas`}</p>
         </td></tr>
       </table>` : ''}
       ${queue_url ? `
       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
         <tr><td align="center">
           <a href="${queue_url}" style="display:inline-block;padding:14px 32px;background-color:#ea580c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
             Ver minha posicao em tempo real
           </a>
         </td></tr>
       </table>` : ''}
       <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">
         ${type === 'entry' ? 'Fique de olho! Avisaremos quando for a sua vez.' : 'Aguarde, logo sera a sua vez!'}
       </p>`;

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
          <!-- Header -->
          <tr>
            <td style="padding:28px 24px;text-align:center;background-color:${headerBg};border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${headerTitle}</h1>
              <p style="margin:8px 0 0;color:#ffffff;font-size:15px;opacity:0.9;">${restaurant_name}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-radius:0 0 8px 8px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Este e-mail foi enviado pelo ${restaurant_name}
              </p>
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
    const fromAddress = `${requestData.restaurant_name} <${RESEND_FROM_EMAIL}>`;

    // Headers optimised for Hotmail/Outlook + Gmail deliverability
    const emailHeaders: Record<string, string> = {
      "Reply-To": "suporte@mesaclik.com.br",
      "X-Entity-Ref-ID": crypto.randomUUID(),
      "X-Priority": "1",                        // marks as high-priority / transactional
      "X-Mailer": "MesaClik Transactional",
      "List-Unsubscribe": "<mailto:suporte@mesaclik.com.br?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };

    console.log('Sending from:', fromAddress, '| Subject:', subject);

    const emailResponse = await sendEmailViaResend(
      requestData.email,
      subject,
      html,
      fromAddress,
      text,
      emailHeaders,
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

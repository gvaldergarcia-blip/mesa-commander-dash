import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SizeGroup = "1-2" | "3-4" | "5-6" | "7-8" | "9-10" | "10+";

function getSizeGroup(partySize: number): SizeGroup {
  if (partySize >= 1 && partySize <= 2) return "1-2";
  if (partySize >= 3 && partySize <= 4) return "3-4";
  if (partySize >= 5 && partySize <= 6) return "5-6";
  if (partySize >= 7 && partySize <= 8) return "7-8";
  if (partySize >= 9 && partySize <= 10) return "9-10";
  return "10+";
}

function matchesSizeGroup(partySize: number, group: SizeGroup): boolean {
  switch (group) {
    case "1-2":
      return partySize >= 1 && partySize <= 2;
    case "3-4":
      return partySize >= 3 && partySize <= 4;
    case "5-6":
      return partySize >= 5 && partySize <= 6;
    case "7-8":
      return partySize >= 7 && partySize <= 8;
    case "9-10":
      return partySize >= 9 && partySize <= 10;
    case "10+":
      return partySize > 10;
    default:
      return false;
  }
}

function getSizeGroupLabel(group: SizeGroup): string {
  switch (group) {
    case "1-2":
      return "1–2 pessoas";
    case "3-4":
      return "3–4 pessoas";
    case "5-6":
      return "5–6 pessoas";
    case "7-8":
      return "7–8 pessoas";
    case "9-10":
      return "9–10 pessoas";
    case "10+":
      return "10+ pessoas";
    default:
      return group;
  }
}

async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
}): Promise<{ id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { error: "Missing RESEND_API_KEY" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Resend API error:", data);
    return { error: data.message || "Failed to send email" };
  }

  return { id: data.id };
}

async function sendBatchEmailsViaResend(
  emails: Array<{ to: string; subject: string; html: string; from: string }>,
): Promise<{ ids?: string[]; error?: string }> {
  if (!RESEND_API_KEY) {
    return { error: "Missing RESEND_API_KEY" };
  }

  if (emails.length === 0) return { ids: [] };

  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(
      emails.map((e) => ({
        from: e.from,
        to: [e.to],
        subject: e.subject,
        html: e.html,
      })),
    ),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Resend Batch API error:", data);
    return { error: data?.message || "Failed to send batch email" };
  }

  const ids = Array.isArray(data?.data)
    ? data.data.map((d: any) => d?.id).filter(Boolean)
    : [];

  return { ids };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NotifyQueuePositionUpdatesRequest {
  restaurant_id: string;
  queue_id: string;
  party_size: number;
  base_url: string; // ex: https://app.mesaclik.app
  exclude_entry_id?: string;
}

function buildPositionUpdateEmail(args: {
  restaurantName: string;
  customerName?: string;
  position: number;
  queueUrl: string;
  sizeGroupLabel: string;
  partySize: number;
}): { subject: string; html: string } {
  const { restaurantName, customerName, queueUrl, sizeGroupLabel, partySize } = args;
  const subject = `📍 Atualização da fila - ${restaurantName}`;

  return {
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Atualização da Fila</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
                <tr>
                  <td style="padding: 28px 32px 22px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800;">📍 Atualização da fila</h1>
                    <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">${restaurantName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 32px;">
                    <p style="margin: 0 0 16px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
                      ${customerName ? `Olá <strong>${customerName}</strong>!` : 'Olá!'} A fila está andando!
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin-bottom: 16px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 600;">👥 ${partySize} ${partySize === 1 ? 'pessoa' : 'pessoas'}</p>
                          <p style="margin: 8px 0 0; color: #71717a; font-size: 12px;">Fila de ${sizeGroupLabel}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding: 8px 0 24px;">
                          <a href="${queueUrl}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                            📱 Ver minha posição em tempo real
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.6; text-align: center;">
                      Aguarde, logo será a sua vez!
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurantName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: NotifyQueuePositionUpdatesRequest = await req.json();

    if (!body.restaurant_id || !body.queue_id || !body.base_url || !body.party_size) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: restaurant_id, queue_id, party_size, base_url",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", body.restaurant_id)
      .maybeSingle();

    const restaurantName = restaurant?.name || "Restaurante";

    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const group = getSizeGroup(body.party_size);
    const groupLabel = getSizeGroupLabel(group);

    const { data: waitingEntries, error: waitingError } = await supabase
      .schema("mesaclik")
      .from("queue_entries")
      .select("id, name, email, party_size, created_at")
      .eq("queue_id", body.queue_id)
      .eq("status", "waiting")
      .gte("created_at", last24Hours.toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (waitingError) {
      console.error("[notify-queue-position-updates] waiting query error:", waitingError);
      return new Response(
        JSON.stringify({ error: waitingError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filtrar entries do mesmo grupo E remover o entry excluído ANTES de calcular posição
    const sameGroup = (waitingEntries || [])
      .filter((e: any) => matchesSizeGroup(Number(e.party_size || 1), group))
      .filter((e: any) => !(body.exclude_entry_id && e.id === body.exclude_entry_id));

    console.log(`[notify-queue-position-updates] Group ${groupLabel}: ${sameGroup.length} entries waiting (excluded: ${body.exclude_entry_id || 'none'})`);
    sameGroup.forEach((e: any, i: number) => {
      console.log(`  Position ${i + 1}: ${e.name} (${e.id})`);
    });

    // Enviar email para todos do grupo com a posição recalculada
    let attempted = 0;
    let sent = 0;
    const failures: Array<{ id: string; email?: string; error: string }> = [];

    const fromAddress = `${restaurantName} <${RESEND_FROM_EMAIL}>`;

    const messages: Array<{
      entryId: string;
      to: string;
      subject: string;
      html: string;
      from: string;
    }> = [];

    // Agora idx corresponde exatamente à posição correta (1-indexed = idx + 1)
    for (let idx = 0; idx < sameGroup.length; idx++) {
      const entry = sameGroup[idx];
      if (!entry.email) continue;

      const position = idx + 1; // Posição correta após remoção do exclude_entry_id
      const queueUrl = `${body.base_url.replace(/\/$/, "")}/fila/final?ticket=${entry.id}`;
      const { subject, html } = buildPositionUpdateEmail({
        restaurantName,
        customerName: entry.name || undefined,
        position,
        queueUrl,
        sizeGroupLabel: groupLabel,
        partySize: Number(entry.party_size || body.party_size || 1),
      });

      messages.push({
        entryId: entry.id,
        to: entry.email,
        subject,
        html,
        from: fromAddress,
      });
    }

    attempted = messages.length;

    // Envio em lote (evita rate limit 2 req/s do Resend)
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);

      const batchRes = await sendBatchEmailsViaResend(
        chunk.map((m) => ({ to: m.to, subject: m.subject, html: m.html, from: m.from })),
      );

      if (batchRes.error) {
        console.warn(
          "[notify-queue-position-updates] batch failed, falling back to throttled individual sends:",
          batchRes.error,
        );

        // Fallback: envio individual com throttle para respeitar rate limit
        for (const m of chunk) {
          const res = await sendEmailViaResend({
            to: m.to,
            subject: m.subject,
            html: m.html,
            from: m.from,
          });

          if (res.error) {
            failures.push({ id: m.entryId, email: m.to, error: res.error });
          } else {
            sent++;
          }

          // 2 req/s => ~500ms. Usamos 650ms para margem.
          await sleep(650);
        }
      } else {
        // Considerar sucesso do lote (Resend retorna ids na mesma ordem do array)
        sent += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        group: groupLabel,
        attempted,
        sent,
        failures,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-queue-position-updates] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

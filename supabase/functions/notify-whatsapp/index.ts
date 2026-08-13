import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { zapiSendText, zapiStatus } from "../_shared/zapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const DEFAULT_EVENTS: Record<string, boolean> = {
  validity_today: false,
  validity_tomorrow: false,
  validity_soon: false,
  stock_below_min: false,
  stock_out: false,
  stock_replenish: false,
  receipt_pending: false,
  receipt_awaiting_info: false,
  receipt_divergence: false,
  checklist_pending: false,
  loss_registered: false,
  transfer_done: false,
  operational_event: false,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(phone: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? `+${d}` : `+55${d}`;
}

/** Caller must be the service role (internal event) or an authenticated member of the restaurant. */
async function authorize(req: Request, restaurantId: string) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, reason: "missing token" };
  if (token === SERVICE_KEY) return { ok: true, internal: true };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user;
  if (!user) return { ok: false, reason: "invalid token" };
  const { data: allowed } = await sb.rpc("is_member_or_admin", { p_restaurant_id: restaurantId });
  if (allowed === false) {
    const { data: isAdmin } = await sb.rpc("is_admin", { user_id: user.id });
    if (!isAdmin) return { ok: false, reason: "forbidden" };
  }
  return { ok: true, internal: false, userId: user.id };
}

function inQuietHours(settings: any) {
  const start = Number(settings?.quiet_hours_start ?? 22);
  const end = Number(settings?.quiet_hours_end ?? 7);
  // Restaurant timezone: America/Sao_Paulo (UTC-3)
  const hour = new Date(Date.now() - 3 * 3600 * 1000).getUTCHours();
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const action: string = body?.action || "send";
    const restaurantId: string = body?.restaurant_id;

    if (action === "status") {
      const st = await zapiStatus();
      if (restaurantId) {
        const auth = await authorize(req, restaurantId);
        if (!auth.ok) return json({ error: auth.reason }, 403);
        const sb = createClient(SUPABASE_URL, SERVICE_KEY);
        await sb.from("whatsapp_notification_settings").upsert({
          restaurant_id: restaurantId,
          connection_status: st.connected ? "connected" : "disconnected",
          last_checked_at: new Date().toISOString(),
          last_error: st.error ?? null,
        }, { onConflict: "restaurant_id" });
      }
      return json({ connected: st.connected, error: st.error ?? null });
    }

    if (!restaurantId) return json({ error: "restaurant_id obrigatório" }, 400);
    const auth = await authorize(req, restaurantId);
    if (!auth.ok) return json({ error: auth.reason }, 403);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const eventType: string = body?.event_type || "operational_event";
    const message: string = String(body?.message || "").trim();
    const dedupeKey: string | null = body?.dedupe_key || null;
    const isTest = action === "test";
    if (!message) return json({ error: "message obrigatório" }, 400);

    const { data: settings } = await sb
      .from("whatsapp_notification_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!isTest) {
      if (!settings?.enabled) return json({ skipped: "whatsapp_disabled", sent: 0 });
      const events = { ...DEFAULT_EVENTS, ...(settings?.events || {}) };
      if (!events[eventType]) return json({ skipped: `event_disabled:${eventType}`, sent: 0 });
      if (inQuietHours(settings)) return json({ skipped: "quiet_hours", sent: 0 });
    }

    // Recipients
    let recipients: { id: string | null; phone: string }[] = [];
    if (body?.to) {
      recipients = [{ id: body?.employee_id ?? null, phone: normalize(body.to) }];
    } else {
      const { data: emps } = await sb
        .from("label_employees")
        .select("id, name, whatsapp_phone, status, notifications_enabled, notification_types")
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .eq("notifications_enabled", true)
        .not("whatsapp_phone", "is", null);
      const seen = new Set<string>();
      for (const e of emps || []) {
        const types: string[] = e.notification_types || [];
        if (types.length > 0 && !types.includes(eventType)) continue;
        const phone = normalize(e.whatsapp_phone);
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        recipients.push({ id: e.id, phone });
      }
    }

    if (!recipients.length) return json({ skipped: "no_recipients", sent: 0 });

    const results: any[] = [];
    for (const r of recipients) {
      // Anti-duplication: unique index on (restaurant_id, employee_id, dedupe_key)
      if (dedupeKey) {
        const windowHours = Number(settings?.dedupe_window_hours ?? 12);
        const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
        const { data: dup } = await sb
          .from("label_sms_logs")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .eq("dedupe_key", dedupeKey)
          .eq("channel", "whatsapp")
          .gte("sent_at", since)
          .limit(1);
        if ((dup || []).length) {
          results.push({ phone: r.phone, skipped: "duplicate" });
          continue;
        }
      }

      const sendResult = await zapiSendText(r.phone, message);
      await sb.from("label_sms_logs").insert({
        restaurant_id: restaurantId,
        employee_id: r.id,
        phone: r.phone,
        message,
        kind: isTest ? "test" : "whatsapp_event",
        channel: "whatsapp",
        event_type: eventType,
        dedupe_key: dedupeKey,
        provider_message_id: sendResult.messageId ?? null,
        status: sendResult.success ? "sent" : "failed",
        error: sendResult.error ?? null,
        payload: body?.payload ?? {},
      });
      results.push({ phone: r.phone, success: sendResult.success, error: sendResult.error });
    }

    return json({ sent: results.filter((r) => r.success).length, results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
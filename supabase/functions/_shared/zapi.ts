// Z-API client. Credentials live ONLY in edge function env (never in the frontend).
const BASE = "https://api.z-api.io";

export function zapiEnv() {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID")?.trim();
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN")?.trim();
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN")?.trim();
  if (!instanceId || !instanceToken) {
    throw new Error("Z-API não configurada (ZAPI_INSTANCE_ID / ZAPI_INSTANCE_TOKEN).");
  }
  return { instanceId, instanceToken, clientToken: clientToken || "" };
}

function url(path: string) {
  const { instanceId, instanceToken } = zapiEnv();
  return `${BASE}/instances/${instanceId}/token/${instanceToken}/${path}`;
}

function headers() {
  const { clientToken } = zapiEnv();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) h["Client-Token"] = clientToken;
  return h;
}

/** Z-API expects digits only, with country code. */
export function toZapiPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function zapiStatus(): Promise<{ connected: boolean; raw: unknown; error?: string }> {
  try {
    const res = await fetch(url("status"), { headers: headers() });
    const raw = await res.json().catch(() => ({}));
    const connected = !!(raw as any)?.connected && !(raw as any)?.error;
    return { connected, raw, error: connected ? undefined : ((raw as any)?.error || (raw as any)?.message || undefined) };
  } catch (e) {
    return { connected: false, raw: null, error: (e as Error).message };
  }
}

export async function zapiSendText(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const to = toZapiPhone(phone);
  if (!to) return { success: false, error: "Telefone inválido" };
  try {
    const res = await fetch(url("send-text"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ phone: to, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data as any)?.error) {
      return { success: false, error: (data as any)?.error || (data as any)?.message || `Z-API HTTP ${res.status}` };
    }
    return { success: true, messageId: (data as any)?.messageId || (data as any)?.id || (data as any)?.zaapId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
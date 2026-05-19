import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, CheckCircle2, Copy, Loader2, Trash2, AlertCircle, ExternalLink, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

type Config = {
  restaurant_id: string;
  twilio_account_sid: string;
  whatsapp_number: string;
  status: "pending" | "connected" | "disconnected" | "error";
  last_error: string | null;
  connected_at: string | null;
  webhook_secret: string;
};

export function WhatsAppBotSettings() {
  const { restaurantId } = useRestaurant();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [number, setNumber] = useState("");

  const SUPA_URL = "https://akqldesakmcroydbgkbe.supabase.co";
  const webhookUrl = config
    ? `${SUPA_URL}/functions/v1/whatsapp-inbound?r=${config.restaurant_id}&s=${config.webhook_secret}`
    : "";

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_whatsapp_config", { p_restaurant_id: restaurantId });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar configuração", { description: error.message });
    }
    if (data) {
      const c = data as unknown as Config;
      setConfig(c);
      setSid(c.twilio_account_sid ?? "");
      setNumber(c.whatsapp_number ?? "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const save = async () => {
    if (!restaurantId) return;
    if (!sid.startsWith("AC") || sid.length < 32) {
      toast.error("Account SID inválido", { description: "Deve começar com AC e ter 34 caracteres." });
      return;
    }
    if (!token) {
      toast.error("Auth Token obrigatório", { description: "Cole novamente o Auth Token do Twilio para salvar." });
      return;
    }
    if (!number.startsWith("+")) {
      toast.error("Número inválido", { description: "Use o formato internacional, ex: +5511999998888" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_whatsapp_config", {
        p_restaurant_id: restaurantId,
        p_account_sid: sid.trim(),
        p_auth_token: token.trim(),
        p_whatsapp_number: number.trim(),
      });
      if (error) throw error;
      toast.success("Credenciais salvas. Agora teste a conexão.");
      setToken("");
      await load();
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!restaurantId) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-whatsapp-config", {
        body: { restaurantId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Twilio conectado!", { description: `Conta: ${(data as any).friendly_name}` });
      await load();
    } catch (e: any) {
      toast.error("Falha no teste", { description: e?.message });
      await load();
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    if (!restaurantId) return;
    if (!confirm("Desconectar o bot? O WhatsApp deixará de responder até reconectar.")) return;
    const { error } = await supabase.rpc("delete_whatsapp_config", { p_restaurant_id: restaurantId });
    if (error) { toast.error(error.message); return; }
    toast.success("Bot desconectado");
    setConfig(null);
    setSid(""); setToken(""); setNumber("");
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusBadge = config && (
    config.status === "connected" ? (
      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 border">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
      </Badge>
    ) : config.status === "error" ? (
      <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>
    ) : (
      <Badge variant="outline">Pendente</Badge>
    )
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chatbot WhatsApp
            {statusBadge}
          </CardTitle>
          <CardDescription>
            Conecte o WhatsApp Business do seu restaurante. A IA vai conversar com cada cliente, entender o histórico dele
            e enviar fotos personalizadas dos pratos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {config?.status === "error" && config.last_error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {config.last_error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Twilio Account SID *</Label>
              <Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              <p className="text-xs text-muted-foreground">
                Encontre em <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">console.twilio.com</a>.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Twilio Auth Token *</Label>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={config ? "Cole novamente para atualizar" : "Cole seu Auth Token"} />
              <p className="text-xs text-muted-foreground">Armazenado criptografado.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Número WhatsApp Business *</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+5511999998888" />
              <p className="text-xs text-muted-foreground">Número já aprovado pela Meta e configurado no Twilio (formato internacional com +).</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar credenciais
            </Button>
            {config && (
              <>
                <Button variant="outline" onClick={test} disabled={testing}>
                  {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Testar conexão
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={disconnect}>
                  <Trash2 className="h-4 w-4 mr-2" /> Desconectar
                </Button>
              </>
            )}
          </div>

          {config && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">Configurar Webhook no Twilio</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cole esta URL em <strong>Twilio Console → Messaging → Settings → WhatsApp sandbox / Sender → "A message comes in"</strong>:
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="link" size="sm" asChild className="p-0 h-auto">
                  <a href="https://console.twilio.com/us1/develop/sms/senders" target="_blank" rel="noopener noreferrer">
                    Abrir Twilio Console <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" /> Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Cliente manda mensagem no seu WhatsApp Business.</p>
          <p>2. A IA identifica o cliente pelo telefone, consulta o CRM (visitas, pratos favoritos, status VIP).</p>
          <p>3. Responde de forma personalizada e, quando faz sentido, envia uma foto do prato com o nome do cliente no overlay.</p>
          <p>4. Toda a conversa fica salva no painel em <strong>Cardápio Inteligente → Conversas WhatsApp</strong>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
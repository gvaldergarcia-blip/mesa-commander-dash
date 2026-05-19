import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, CheckCircle2, Copy, Loader2, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Config = {
  restaurant_id: string;
  whatsapp_number: string | null;
  greeting_message: string | null;
  status: string;
};

const DEFAULT_GREETING =
  "Olá! Quero conhecer o cardápio e tirar dúvidas. 🍽️";

export function WhatsAppBotSettings() {
  const { restaurantId } = useRestaurant();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [number, setNumber] = useState("");
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_whatsapp_link", { p_restaurant_id: restaurantId });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar configuração", { description: error.message });
    }
    if (data) {
      const c = data as unknown as Config;
      setConfig(c);
      setNumber(c.whatsapp_number ?? "");
      setGreeting(c.greeting_message ?? DEFAULT_GREETING);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const cleanNumber = useMemo(() => number.replace(/\D/g, ""), [number]);
  const waLink = useMemo(() => {
    if (!cleanNumber) return "";
    const msg = encodeURIComponent(greeting || "");
    return `https://wa.me/${cleanNumber}${msg ? `?text=${msg}` : ""}`;
  }, [cleanNumber, greeting]);

  const save = async () => {
    if (!restaurantId) return;
    if (!number.startsWith("+") || cleanNumber.length < 10) {
      toast.error("Número inválido", { description: "Use formato internacional, ex: +5511999998888" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_whatsapp_link", {
        p_restaurant_id: restaurantId,
        p_whatsapp_number: number.trim(),
        p_greeting_message: greeting.trim() || null,
      });
      if (error) throw error;
      toast.success("Configuração salva!");
      await load();
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            WhatsApp + Assistente IA
            {config?.whatsapp_number && (
              <Badge className="bg-green-500/15 text-green-600 border-green-500/30 border">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Configurado
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Informe o WhatsApp do seu restaurante. Geramos um link e um QR Code para você divulgar (no rodapé do site, cardápio, redes sociais).
            Para responder os clientes, use o <strong>Assistente IA</strong> em Cardápio Inteligente — ele sugere a resposta com base no histórico do cliente e gera fotos personalizadas dos pratos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Número WhatsApp *</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+5511999998888" />
              <p className="text-xs text-muted-foreground">Formato internacional com + (DDI + DDD + número).</p>
            </div>

            <div className="space-y-2">
              <Label>Mensagem inicial do cliente (opcional)</Label>
              <Textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder={DEFAULT_GREETING}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Texto que aparece pré-preenchido quando o cliente abre a conversa pelo link.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>

          {waLink && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-semibold">Link wa.me para divulgar</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quem clicar abre o WhatsApp já com a mensagem pronta.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input value={waLink} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(waLink)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={waLink} target="_blank" rel="noopener noreferrer">
                        Testar link <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/cardapio">
                        Abrir Assistente IA <Bot className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-md border self-start">
                  <QRCodeCanvas value={waLink} size={160} includeMargin />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <QrCode className="h-3 w-3" /> QR para clientes
                  </span>
                </div>
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
          <p>1. Divulgue o link/QR no Instagram, site, cardápio impresso, recibo etc.</p>
          <p>2. O cliente clica → abre o WhatsApp do restaurante com a mensagem inicial pronta.</p>
          <p>3. Você responde usando o <strong>Assistente IA</strong> no painel: ele lê o histórico, sugere a resposta perfeita e gera a foto do prato com o nome do cliente. Você copia e cola no WhatsApp.</p>
          <p className="pt-2 text-xs">Sem configurar Twilio, sem aprovação Meta, sem mensalidade adicional.</p>
        </CardContent>
      </Card>
    </div>
  );
}

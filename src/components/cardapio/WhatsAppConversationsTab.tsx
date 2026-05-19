import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, ExternalLink, Copy, QrCode, Bot, Settings } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Cfg = {
  whatsapp_number: string | null;
  greeting_message: string | null;
};

export function WhatsAppConversationsTab() {
  const { restaurantId } = useRestaurant();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!restaurantId) return;
      const { data } = await supabase.rpc("get_whatsapp_link", { p_restaurant_id: restaurantId });
      if (data) setCfg(data as unknown as Cfg);
      setLoading(false);
    })();
  }, [restaurantId]);

  const waLink = useMemo(() => {
    if (!cfg?.whatsapp_number) return "";
    const num = cfg.whatsapp_number.replace(/\D/g, "");
    const msg = cfg.greeting_message ? `?text=${encodeURIComponent(cfg.greeting_message)}` : "";
    return `https://wa.me/${num}${msg}`;
  }, [cfg]);

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado!"); };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!cfg?.whatsapp_number) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Link WhatsApp não configurado</CardTitle>
          <CardDescription>Cadastre o número do seu restaurante para gerar o link e o QR que os clientes vão usar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/settings"><Settings className="h-4 w-4 mr-2" /> Configurar agora</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Link WhatsApp do restaurante
            <Badge className="bg-green-500/15 text-green-600 border-green-500/30 border">Ativo</Badge>
          </CardTitle>
          <CardDescription>
            Divulgue este link/QR no site, Instagram e cardápio. Quando o cliente chamar, use o <strong>Assistente IA</strong> abaixo para preparar a resposta e copie pro WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={waLink} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(waLink)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                Abrir conversa de teste <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
            <Separator />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Número:</strong> {cfg.whatsapp_number}</p>
              {cfg.greeting_message && <p><strong>Mensagem inicial:</strong> {cfg.greeting_message}</p>}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-md border self-start">
            <QRCodeCanvas value={waLink} size={180} includeMargin />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <QrCode className="h-3 w-3" /> QR para clientes
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" /> Use o Assistente IA para responder
          </CardTitle>
          <CardDescription>
            Cole a mensagem que o cliente mandou no chat ao lado (aba <strong>Chat IA</strong>) — ele identifica o cliente pelo histórico, sugere a melhor resposta e gera a foto do prato com o nome do cliente.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { X, Send, Users, Star, Calendar, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RestaurantCustomer } from "@/hooks/useRestaurantCustomers";
import { AudienceFilter } from "@/hooks/useRestaurantCampaigns";

type CreateCampaignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleCustomers: RestaurantCustomer[];
  onSubmit: (data: {
    title: string;
    subject: string;
    message: string;
    ctaText?: string;
    ctaUrl?: string;
    couponCode?: string;
    expiresAt?: string;
    audienceFilter: AudienceFilter;
    recipients: { email: string; name?: string; customerId?: string }[];
  }) => Promise<void>;
  isSubmitting: boolean;
};

export function CreateCampaignDialog({
  open,
  onOpenChange,
  eligibleCustomers,
  onSubmit,
  isSubmitting,
}: CreateCampaignDialogProps) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceFilter['type']>("all");

  // Filtrar destinatários com base no público
  const getFilteredRecipients = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return eligibleCustomers.filter(customer => {
      if (audienceType === "all") return true;
      if (audienceType === "vip") return customer.vip;
      if (audienceType === "active") {
        const lastSeen = new Date(customer.last_seen_at);
        return lastSeen >= thirtyDaysAgo;
      }
      if (audienceType === "inactive") {
        const lastSeen = new Date(customer.last_seen_at);
        return lastSeen < thirtyDaysAgo;
      }
      return true;
    });
  };

  const filteredRecipients = getFilteredRecipients();

  const handleSubmit = async () => {
    await onSubmit({
      title,
      subject,
      message,
      ctaText: ctaText || undefined,
      ctaUrl: ctaUrl || undefined,
      couponCode: couponCode || undefined,
      expiresAt: expiresAt || undefined,
      audienceFilter: { type: audienceType },
      recipients: filteredRecipients.map(c => ({
        email: c.customer_email,
        name: c.customer_name || undefined,
        customerId: c.id,
      })),
    });
    
    // Reset form
    setTitle("");
    setSubject("");
    setMessage("");
    setCtaText("");
    setCtaUrl("");
    setCouponCode("");
    setExpiresAt("");
    setAudienceType("all");
    onOpenChange(false);
  };

  const canSubmit = title && subject && message && filteredRecipients.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Nova Campanha de E-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Público-alvo */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Público-alvo</Label>
            <RadioGroup value={audienceType} onValueChange={(v) => setAudienceType(v as AudienceFilter['type'])}>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer">
                    <Users className="w-4 h-4 text-primary" />
                    <div>
                      <div className="font-medium">Todos</div>
                      <div className="text-xs text-muted-foreground">
                        {eligibleCustomers.length} clientes
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="vip" id="vip" />
                  <Label htmlFor="vip" className="flex items-center gap-2 cursor-pointer">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="font-medium">VIP</div>
                      <div className="text-xs text-muted-foreground">
                        {eligibleCustomers.filter(c => c.vip).length} clientes
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="active" id="active" />
                  <Label htmlFor="active" className="flex items-center gap-2 cursor-pointer">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="font-medium">Ativos</div>
                      <div className="text-xs text-muted-foreground">
                        Últimos 30 dias
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="inactive" id="inactive" />
                  <Label htmlFor="inactive" className="flex items-center gap-2 cursor-pointer">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="font-medium">Inativos</div>
                      <div className="text-xs text-muted-foreground">
                        Sem visita há 30+ dias
                      </div>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <strong>{filteredRecipients.length}</strong> destinatários receberão esta campanha
            </div>
          </div>

          {/* Título interno */}
          <div className="space-y-2">
            <Label htmlFor="title">Título da campanha (interno)</Label>
            <Input
              id="title"
              placeholder="Ex: Promoção de Natal 2024"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Assunto do e-mail */}
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto do e-mail</Label>
            <Input
              id="subject"
              placeholder="Ex: 🎄 Oferta especial para você!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Escreva a mensagem da sua promoção..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>

          {/* Cupom (opcional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coupon">Código do cupom (opcional)</Label>
              <Input
                id="coupon"
                placeholder="Ex: NATAL20"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires">Validade (opcional)</Label>
              <Input
                id="expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* CTA (opcional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ctaText">Texto do botão (opcional)</Label>
              <Input
                id="ctaText"
                placeholder="Ex: Ver oferta"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaUrl">Link do botão (opcional)</Label>
              <Input
                id="ctaUrl"
                type="url"
                placeholder="https://..."
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isSubmitting}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "Enviando..." : `Enviar para ${filteredRecipients.length} clientes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

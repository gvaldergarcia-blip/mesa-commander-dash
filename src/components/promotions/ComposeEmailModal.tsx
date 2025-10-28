import { useState } from "react";
import { Send, Eye, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEmailLogs } from "@/hooks/useEmailLogs";

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  restaurantId: string;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  customer,
  restaurantId,
}: ComposeEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { createEmailLog, updateEmailLogStatus } = useEmailLogs(restaurantId);

  const handleSend = async () => {
    if (!subject || subject.length > 80) {
      toast({
        title: "Erro de validação",
        description: "O título deve ter entre 1 e 80 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!body || body.length < 10) {
      toast({
        title: "Erro de validação",
        description: "O corpo do email deve ter pelo menos 10 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!customer.marketing_opt_in) {
      toast({
        title: "Cliente sem opt-in",
        description: "Este cliente não possui consentimento para receber emails",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      // Criar log de email
      const log = await createEmailLog({
        restaurant_id: restaurantId,
        customer_id: customer.id,
        email: customer.email,
        subject,
        body_html: `<html><body><p>${body.replace(/\n/g, '<br>')}</p>${couponCode ? `<p><strong>Código do cupom:</strong> ${couponCode}</p>` : ''}</body></html>`,
        body_text: body,
        coupon_code: couponCode || undefined,
        valid_until: validUntil || undefined,
      });

      // Chamar edge function para enviar email
      const { data, error } = await supabase.functions.invoke('send-promotion-email', {
        body: {
          email_log_id: log.id,
          to_email: customer.email,
          to_name: customer.name,
          subject,
          body_html: `<html><body><p>${body.replace(/\n/g, '<br>')}</p>${couponCode ? `<p><strong>Código do cupom:</strong> ${couponCode}</p>` : ''}</body></html>`,
          restaurant_id: restaurantId,
        },
      });

      if (error) {
        await updateEmailLogStatus(log.id, 'failed', undefined, error.message);
        throw error;
      }

      await updateEmailLogStatus(log.id, 'sent', data?.messageId);

      toast({
        title: "Email enviado",
        description: `Promoção enviada para ${customer.name}`,
      });

      // Reset form
      setSubject("");
      setBody("");
      setCouponCode("");
      setValidUntil("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lançar promoção para {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Título da promoção *</Label>
            <Input
              id="subject"
              placeholder="Ex: Desconto especial para você!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {subject.length}/80 caracteres
            </p>
          </div>

          <div>
            <Label htmlFor="body">Descrição/Corpo do e-mail *</Label>
            <Textarea
              id="body"
              placeholder="Descreva sua promoção..."
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mínimo 10 caracteres
            </p>
          </div>

          <div>
            <Label htmlFor="coupon">Cupom/código (opcional)</Label>
            <Input
              id="coupon"
              placeholder="Ex: DESC10"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="valid-until">Validade (opcional)</Label>
            <Input
              id="valid-until"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                // TODO: Implementar preview
                toast({
                  title: "Preview",
                  description: "Funcionalidade em desenvolvimento",
                });
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Pré-visualizar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSend}
              disabled={sending || !subject || !body}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Enviando..." : "Enviar agora"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

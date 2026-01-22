import { useState, useEffect } from 'react';
import { Send, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AIPalpite } from '@/hooks/useAIPalpites';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

interface SendPalpitePromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palpite: AIPalpite | null;
  onSent: (palpiteId: string) => Promise<boolean>;
}

export function SendPalpitePromotionDialog({
  open,
  onOpenChange,
  palpite,
  onSent,
}: SendPalpitePromotionDialogProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [validDays, setValidDays] = useState(7);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Pre-fill from cta_payload when palpite changes
  useEffect(() => {
    if (palpite?.cta_payload) {
      setSubject(palpite.cta_payload.subject || '');
      setMessage(palpite.cta_payload.message || '');
      setCouponCode(palpite.cta_payload.coupon_code || '');
      setValidDays(palpite.cta_payload.valid_days || 7);
    }
  }, [palpite]);

  const handleSend = async () => {
    if (!palpite || !subject.trim() || !message.trim()) return;

    setIsSending(true);
    try {
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validDays);

      // Send the promotion email
      const { error: sendError } = await supabase.functions.invoke('send-promotion-direct', {
        body: {
          to_email: palpite.customer_email,
          to_name: palpite.customer_name,
          subject,
          message,
          coupon_code: couponCode || undefined,
          expires_at: expiresAt.toISOString(),
          restaurant_name: 'MesaClik',
        },
      });

      if (sendError) throw sendError;

      // Log the email with origin = palpite_ia
      await supabase.from('email_logs').insert({
        restaurant_id: RESTAURANT_ID,
        customer_id: palpite.customer_id,
        email: palpite.customer_email || '',
        subject,
        body_html: message,
        coupon_code: couponCode || null,
        valid_until: expiresAt.toISOString(),
        status: 'sent',
        sent_at: new Date().toISOString(),
        source: 'palpite_ia',
      });

      // Update palpite status
      await onSent(palpite.id);

      toast({
        title: 'Promoção enviada!',
        description: `Email enviado para ${palpite.customer_email}`,
      });

      onOpenChange(false);
    } catch (err) {
      console.error('Error sending promotion:', err);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a promoção.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!palpite) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Enviar Promoção
          </DialogTitle>
          <DialogDescription>
            Enviar promoção sugerida para{' '}
            <strong>{palpite.customer_name || palpite.customer_email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto do email *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Oferta especial para você!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva sua mensagem..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="couponCode">Código do cupom</Label>
              <Input
                id="couponCode"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Ex: DESCONTO20"
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="validDays">Válido por (dias)</Label>
              <Input
                id="validDays"
                type="number"
                min={1}
                max={90}
                value={validDays}
                onChange={(e) => setValidDays(parseInt(e.target.value) || 7)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !message.trim()}
            className="gap-2"
          >
            {isSending ? (
              'Enviando...'
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar promoção
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

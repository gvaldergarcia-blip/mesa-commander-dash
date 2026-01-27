import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PromotionData {
  to_email: string;
  to_name?: string;
  subject: string;
  message: string;
  coupon_code?: string;
  expires_at?: string;
  cta_text?: string;
  cta_url?: string;
  restaurant_name?: string;
}

interface SendPromotionResult {
  success: boolean;
  messageId?: string;
  lastEvent?: string | null;
  error?: string;
}

export function useSendPromotion() {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const formatInvokeError = (err: unknown): string => {
    if (!err || typeof err !== 'object') return 'Erro ao enviar promoção';

    const anyErr = err as any;
    const base = typeof anyErr.message === 'string' && anyErr.message.trim()
      ? anyErr.message
      : 'Erro ao enviar promoção';

    // supabase-js costuma anexar detalhes em `context.body` quando a edge function retorna != 2xx
    const body = anyErr.context?.body;
    if (!body) return base;

    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      const detail = parsed?.error || parsed?.message || parsed?.details;
      return detail ? `${base}: ${detail}` : base;
    } catch {
      return typeof body === 'string' ? `${base}: ${body}` : base;
    }
  };

  const sendPromotion = useCallback(async (data: PromotionData): Promise<SendPromotionResult> => {
    setSending(true);
    
    try {
      const { data: response, error } = await supabase.functions.invoke('send-promotion-direct', {
        body: data,
      });

      if (error) {
        console.error('send-promotion-direct invoke error:', error);
        throw new Error(formatInvokeError(error));
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao enviar promoção');
      }

      const messageId = response.messageId as string | undefined;
      const lastEvent = (response.last_event ?? null) as string | null;

      toast({
        title: '✉️ Promoção enviada!',
        description:
          `E-mail enviado para ${data.to_name || data.to_email}` +
          (messageId ? ` • ID: ${messageId}` : '') +
          `\nDica: no Gmail, pode aparecer na aba “Promoções” ou “Spam”.`,
      });

      return { success: true, messageId, lastEvent };
    } catch (err) {
      const message = err instanceof Error ? err.message : formatInvokeError(err);
      
      toast({
        title: 'Erro ao enviar promoção',
        description: message,
        variant: 'destructive',
      });

      return { success: false, error: message };
    } finally {
      setSending(false);
    }
  }, [toast]);

  const sendPromotionToMultiple = useCallback(async (
    recipients: { email: string; name?: string }[],
    promotionData: Omit<PromotionData, 'to_email' | 'to_name'>
  ): Promise<{ sent: number; failed: number }> => {
    setSending(true);
    let sent = 0;
    let failed = 0;

    try {
      for (const recipient of recipients) {
        const result = await supabase.functions.invoke('send-promotion-direct', {
          body: {
            ...promotionData,
            to_email: recipient.email,
            to_name: recipient.name,
          },
        });

        if (result.error || !result.data?.success) {
          failed++;
          console.error(`Failed to send to ${recipient.email}:`, result.error);
        } else {
          sent++;
        }
      }

      if (sent > 0) {
        toast({
          title: '✉️ Promoções enviadas!',
          description: `${sent} e-mail(s) enviado(s)${failed > 0 ? `, ${failed} falhou(aram)` : ''}`,
        });
      } else {
        toast({
          title: 'Erro ao enviar promoções',
          description: 'Nenhum e-mail foi enviado',
          variant: 'destructive',
        });
      }

      return { sent, failed };
    } finally {
      setSending(false);
    }
  }, [toast]);

  return {
    sendPromotion,
    sendPromotionToMultiple,
    sending,
  };
}

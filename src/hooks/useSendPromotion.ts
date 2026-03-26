import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/contexts/RestaurantContext';

interface PromotionData {
  to_email?: string;
  to_phone?: string;
  to_name?: string;
  subject: string;
  message: string;
  coupon_code?: string;
  expires_at?: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
  restaurant_name?: string;
  unsubscribe_token?: string;
  site_url?: string;
}

interface SendPromotionResult {
  success: boolean;
  messageId?: string;
  smsSid?: string;
  whatsappSid?: string;
  lastEvent?: string | null;
  error?: string;
}

export function useSendPromotion() {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { restaurant } = useRestaurant();

  const sendPromotion = useCallback(async (data: PromotionData): Promise<SendPromotionResult> => {
    setSending(true);
    
    try {
      const normalizedPhone = data.to_phone?.trim();
      if (!normalizedPhone) {
        throw new Error('Telefone é obrigatório para enviar promoção por SMS');
      }

      const normalizedData: PromotionData = {
        ...data,
        to_phone: normalizedPhone,
        restaurant_name: data.restaurant_name?.trim() || restaurant?.name || 'MesaClik',
      };

      const { data: response, error } = await supabase.functions.invoke('send-promotion-direct', {
        body: normalizedData,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao enviar promoção');
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao enviar promoção');
      }

      const messageId = response.messageId as string | undefined;
      const smsSid = response.smsSid as string | undefined;
      const whatsappSid = response.whatsappSid as string | undefined;
      const lastEvent = (response.last_event ?? null) as string | null;

      if (!smsSid) {
        throw new Error(response?.error || response?.sms?.error || 'SMS não foi enviado');
      }

      toast({
        title: '✅ Promoção enviada com sucesso',
        description: data.to_email ? 'SMS enviado e e-mail disparado quando disponível.' : 'SMS enviado com sucesso.',
      });

      return { success: true, messageId, smsSid, whatsappSid, lastEvent };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar promoção';
      
      toast({
        title: 'Erro ao enviar promoção',
        description: message,
        variant: 'destructive',
      });

      return { success: false, error: message };
    } finally {
      setSending(false);
    }
  }, [toast, restaurant?.name]);

  const sendPromotionToMultiple = useCallback(async (
    recipients: { email?: string; phone?: string; name?: string }[],
    promotionData: Omit<PromotionData, 'to_email' | 'to_phone' | 'to_name'>
  ): Promise<{ sent: number; failed: number }> => {
    setSending(true);
    let sent = 0;
    let failed = 0;

    try {
      const normalizedPromotionData = {
        ...promotionData,
        restaurant_name: promotionData.restaurant_name?.trim() || restaurant?.name || 'MesaClik',
      };

      for (const recipient of recipients) {
        if (!recipient.phone?.trim()) {
          failed++;
          console.error('Failed to send promotion: recipient missing phone', recipient);
          continue;
        }

        const result = await supabase.functions.invoke('send-promotion-direct', {
          body: {
            ...normalizedPromotionData,
            to_email: recipient.email,
            to_phone: recipient.phone.trim(),
            to_name: recipient.name,
          },
        });

        if (result.error || !result.data?.success || !result.data?.smsSid) {
          failed++;
          console.error(`Failed to send to ${recipient.email || recipient.phone}:`, result.error || result.data);
        } else {
          sent++;
        }
      }

      if (sent > 0) {
        toast({
          title: '✅ Promoção enviada com sucesso',
          description: `${sent} SMS enviado(s)${failed > 0 ? `, ${failed} falhou(aram)` : ''}`,
        });
      } else {
        toast({
          title: 'Erro ao enviar promoções',
          description: 'Nenhum SMS foi enviado',
          variant: 'destructive',
        });
      }

      return { sent, failed };
    } finally {
      setSending(false);
    }
  }, [toast, restaurant?.name]);

  return {
    sendPromotion,
    sendPromotionToMultiple,
    sending,
  };
}

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
      const normalizedData: PromotionData = {
        ...data,
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
      const lastEvent = (response.last_event ?? null) as string | null;

      toast({
        title: '✅ Promoção enviada com sucesso',
      });

      return { success: true, messageId, lastEvent };
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
        const result = await supabase.functions.invoke('send-promotion-direct', {
          body: {
            ...normalizedPromotionData,
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
          title: '✅ Promoção enviada com sucesso',
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
  }, [toast, restaurant?.name]);

  return {
    sendPromotion,
    sendPromotionToMultiple,
    sending,
  };
}

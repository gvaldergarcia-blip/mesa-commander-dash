/**
 * Utilitário para envio de SMS via Twilio
 */

import { supabase } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';

export const sendSms = async (phone: string, message: string): Promise<boolean> => {
  try {
    console.log('Enviando SMS via Twilio Edge Function:', { phone, message });

    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        to: phone,
        message: message,
      },
    });

    if (error) {
      console.error('Erro ao enviar SMS:', error);
      toast({
        title: 'Erro ao enviar SMS',
        description: 'Não foi possível enviar o SMS. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }

    // Verificar se a função retornou erro no corpo da resposta
    if (data && !data.success) {
      console.error('Erro retornado pela edge function:', data);
      
      // Tratar erro específico de conta trial do Twilio
      if (data.error === 'TWILIO_TRIAL_ERROR') {
        toast({
          title: 'SMS não enviado',
          description: 'Número não verificado. Conta Twilio trial só envia para números verificados. Verifique o número ou atualize para conta paga.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao enviar SMS',
          description: data.message || 'Não foi possível enviar o SMS.',
          variant: 'destructive',
        });
      }
      
      return false;
    }

    console.log('SMS enviado com sucesso:', data);
    return true;
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    toast({
      title: 'Erro ao enviar SMS',
      description: 'Ocorreu um erro inesperado ao tentar enviar o SMS.',
      variant: 'destructive',
    });
    return false;
  }
};

export const SMS_TEMPLATES = {
  QUEUE_CALLED: () => 
    `Olá! Sua mesa está pronta. Você tem 5 minutos para chegar ao restaurante antes que sua vez seja passada ao próximo da fila.`,
  RESERVATION_CONFIRMED: (name: string, datetime: string) =>
    `Olá ${name}! Sua reserva para ${datetime} foi confirmada. Aguardamos você!`,
  RESERVATION_REMINDER: (name: string, datetime: string) =>
    `Olá ${name}! Lembramos que sua reserva é para ${datetime}. Até logo!`,
};

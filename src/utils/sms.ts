/**
 * Utilitário para envio de SMS via Twilio
 */

import { supabase } from '@/integrations/supabase/client';

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
      return false;
    }

    console.log('SMS enviado com sucesso:', data);
    return true;
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    return false;
  }
};

export const SMS_TEMPLATES = {
  QUEUE_CALLED: () => 
    `Olá! Sua mesa está pronta. Você tem 5 minutos para chegar ao restaurante antes que sua vez seja passada ao próximo da fila.`,
  RESERVATION_CONFIRMED: (name: string, datetime: string) =>
    `Olá ${name}! Sua reserva para ${datetime} foi confirmada. Aguardamos você! - Mocotó`,
  RESERVATION_REMINDER: (name: string, datetime: string) =>
    `Olá ${name}! Lembramos que sua reserva é para ${datetime}. Até logo! - Mocotó`,
};

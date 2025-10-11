/**
 * Utilitário para envio de SMS via Twilio
 * Em produção, configurar TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER
 */

export const TWILIO_AVAILABLE = false; // Definir como true quando credenciais forem configuradas

export const sendSms = async (phone: string, message: string): Promise<boolean> => {
  if (!TWILIO_AVAILABLE) {
    // Modo simulado para desenvolvimento
    console.warn('[SMS SIMULADO]', { phone, message });
    return true;
  }

  try {
    // TODO: Implementar integração real com Twilio via Edge Function
    // const response = await fetch('/api/send-sms', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phone, message }),
    // });
    // return response.ok;
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    return false;
  }
};

export const SMS_TEMPLATES = {
  QUEUE_CALLED: (name: string) => 
    `Olá ${name}! Sua vez na fila chegou! Você tem 5 minutos para comparecer ao local. - Mocotó`,
  RESERVATION_CONFIRMED: (name: string, datetime: string) =>
    `Olá ${name}! Sua reserva para ${datetime} foi confirmada. Aguardamos você! - Mocotó`,
  RESERVATION_REMINDER: (name: string, datetime: string) =>
    `Olá ${name}! Lembramos que sua reserva é para ${datetime}. Até logo! - Mocotó`,
};

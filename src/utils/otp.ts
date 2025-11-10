/**
 * Utilitário para envio e verificação de códigos OTP via Twilio
 */

import { supabase } from '@/integrations/supabase/client';

export interface SendOtpResult {
  success: boolean;
  logId?: string;
  channel?: 'email' | 'sms';
  message?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  userId?: string;
  message?: string;
  error?: string;
}

/**
 * Envia um código OTP via e-mail ou SMS
 * @param contact E-mail ou telefone do destinatário
 * @param purpose Finalidade do código (login, queue, reservation, profile)
 * @param preferredChannel Canal preferencial (email ou sms). Se não especificado, escolhe automaticamente
 * @param userId ID do usuário (opcional)
 */
export const sendOtp = async (
  contact: string,
  purpose: 'login' | 'queue' | 'reservation' | 'profile',
  preferredChannel?: 'email' | 'sms',
  userId?: string
): Promise<SendOtpResult> => {
  try {
    console.log('Enviando OTP via Twilio Edge Function:', { 
      contact, 
      purpose, 
      preferredChannel 
    });

    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: {
        contact,
        purpose,
        preferredChannel,
        userId,
      },
    });

    if (error) {
      console.error('Erro ao enviar OTP:', error);
      return {
        success: false,
        error: error.message || 'Erro ao enviar código',
      };
    }

    if (!data.success) {
      console.error('Falha ao enviar OTP:', data);
      return {
        success: false,
        error: data.error,
        message: data.message,
      };
    }

    console.log('OTP enviado com sucesso:', data);
    return {
      success: true,
      logId: data.logId,
      channel: data.channel,
      message: data.message,
    };
  } catch (error) {
    console.error('Erro ao enviar OTP:', error);
    return {
      success: false,
      error: 'Erro inesperado ao enviar código',
    };
  }
};

/**
 * Verifica um código OTP
 * @param contact E-mail ou telefone usado para receber o código
 * @param code Código de 6 dígitos
 * @param purpose Finalidade do código (deve corresponder ao envio)
 */
export const verifyOtp = async (
  contact: string,
  code: string,
  purpose: 'login' | 'queue' | 'reservation' | 'profile'
): Promise<VerifyOtpResult> => {
  try {
    console.log('Verificando OTP via Twilio Edge Function:', { 
      contact, 
      purpose 
    });

    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: {
        contact,
        code,
        purpose,
      },
    });

    if (error) {
      console.error('Erro ao verificar OTP:', error);
      return {
        success: false,
        error: error.message || 'Erro ao verificar código',
      };
    }

    if (!data.success) {
      console.error('Falha ao verificar OTP:', data);
      return {
        success: false,
        error: data.error,
        message: data.message,
      };
    }

    console.log('OTP verificado com sucesso:', data);
    return {
      success: true,
      userId: data.userId,
      message: data.message,
    };
  } catch (error) {
    console.error('Erro ao verificar OTP:', error);
    return {
      success: false,
      error: 'Erro inesperado ao verificar código',
    };
  }
};

export const OTP_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMIT: 'Por favor, aguarde 1 minuto antes de solicitar um novo código.',
  SEND_FAILED: 'Erro ao enviar código. Por favor, tente novamente.',
  INVALID_CODE: 'Código deve ter 6 dígitos numéricos.',
  INCORRECT: 'Código incorreto. Tente novamente.',
  EXPIRED: 'Código expirado. Solicite um novo código.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas incorretas. Solicite um novo código.',
  INTERNAL_ERROR: 'Erro interno. Por favor, tente novamente mais tarde.',
};

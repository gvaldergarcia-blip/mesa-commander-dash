/**
 * Hook para gerenciar a fila web com autenticação OTP
 * Integra com Supabase Auth (signInWithOtp/verifyOtp)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface QueueStatus {
  success: boolean;
  in_queue: boolean;
  entry_id?: string;
  status?: 'aguardando' | 'chamado' | 'finalizado' | 'cancelado';
  position?: number;
  party_size?: number;
  created_at?: string;
  called_at?: string;
  consent?: {
    aceitou_ofertas_email: boolean;
    aceitou_termos_uso: boolean;
    aceitou_politica_privacidade: boolean;
  };
  error?: string;
}

export interface CreateEntryResult {
  success: boolean;
  entry_id?: string;
  already_exists?: boolean;
  message?: string;
  error?: string;
}

export function useFilaWeb() {
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  /**
   * Valida se o restaurante existe e tem fila ativa
   */
  const validateRestaurant = useCallback(async (restauranteId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, has_queue')
        .eq('id', restauranteId)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: 'Restaurante não encontrado',
          description: 'Verifique o link e tente novamente.',
          variant: 'destructive',
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao validar restaurante:', error);
      return false;
    }
  }, [toast]);

  /**
   * Envia OTP por e-mail usando Supabase Auth
   */
  const sendOtp = useCallback(async (email: string, restauranteId: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Validar restaurante primeiro
      const isValid = await validateRestaurant(restauranteId);
      if (!isValid) {
        setLoading(false);
        return false;
      }

      // Usar signInWithOtp do Supabase Auth
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Não criar usuário automaticamente se não existir
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/fila/verificar?restauranteId=${restauranteId}&email=${encodeURIComponent(email)}`,
        },
      });

      if (error) {
        console.error('Erro ao enviar OTP:', error);
        toast({
          title: 'Erro ao enviar código',
          description: error.message || 'Tente novamente em alguns segundos.',
          variant: 'destructive',
        });
        setLoading(false);
        return false;
      }

      setOtpSent(true);
      toast({
        title: 'Código enviado!',
        description: `Verifique seu e-mail ${email}`,
      });

      setLoading(false);
      return true;
    } catch (error) {
      console.error('Erro ao enviar OTP:', error);
      toast({
        title: 'Erro inesperado',
        description: 'Por favor, tente novamente.',
        variant: 'destructive',
      });
      setLoading(false);
      return false;
    }
  }, [validateRestaurant, toast]);

  /**
   * Verifica o código OTP
   */
  const verifyOtp = useCallback(async (email: string, token: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        console.error('Erro ao verificar OTP:', error);
        toast({
          title: 'Código inválido',
          description: error.message || 'Verifique o código e tente novamente.',
          variant: 'destructive',
        });
        setLoading(false);
        return false;
      }

      if (data.session) {
        setIsAuthenticated(true);
        toast({
          title: 'Verificado!',
          description: 'Você foi autenticado com sucesso.',
        });
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      console.error('Erro ao verificar OTP:', error);
      toast({
        title: 'Erro inesperado',
        description: 'Por favor, tente novamente.',
        variant: 'destructive',
      });
      setLoading(false);
      return false;
    }
  }, [toast]);

  /**
   * Cria entrada na fila (requer autenticação)
   */
  const createQueueEntry = useCallback(async (
    restauranteId: string,
    partySize: number = 1
  ): Promise<CreateEntryResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_queue_entry_web', {
        p_restaurante_id: restauranteId,
        p_party_size: partySize,
      });

      if (error) {
        console.error('Erro ao criar entrada:', error);
        toast({
          title: 'Erro ao entrar na fila',
          description: error.message || 'Tente novamente.',
          variant: 'destructive',
        });
        setLoading(false);
        return { success: false, error: error.message };
      }

      const result = data as CreateEntryResult;
      
      if (result.already_exists) {
        toast({
          title: 'Você já está na fila!',
          description: 'Redirecionando para sua posição...',
        });
      } else {
        toast({
          title: 'Entrada na fila confirmada!',
          description: 'Acompanhe sua posição na tela.',
        });
      }

      setLoading(false);
      return result;
    } catch (error) {
      console.error('Erro ao criar entrada:', error);
      setLoading(false);
      return { success: false, error: 'Erro inesperado' };
    }
  }, [toast]);

  /**
   * Busca status atual na fila
   */
  const getQueueStatus = useCallback(async (restauranteId: string): Promise<QueueStatus> => {
    try {
      const { data, error } = await supabase.rpc('get_my_queue_status', {
        p_restaurante_id: restauranteId,
      });

      if (error) {
        console.error('Erro ao buscar status:', error);
        return { success: false, in_queue: false, error: error.message };
      }

      return data as QueueStatus;
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      return { success: false, in_queue: false, error: 'Erro inesperado' };
    }
  }, []);

  /**
   * Atualiza consentimentos
   */
  const updateConsent = useCallback(async (
    restauranteId: string,
    consent: {
      aceitou_ofertas_email?: boolean;
      aceitou_termos_uso?: boolean;
      aceitou_politica_privacidade?: boolean;
    }
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('update_consent', {
        p_restaurante_id: restauranteId,
        p_aceitou_ofertas_email: consent.aceitou_ofertas_email ?? null,
        p_aceitou_termos_uso: consent.aceitou_termos_uso ?? null,
        p_aceitou_politica_privacidade: consent.aceitou_politica_privacidade ?? null,
      });

      if (error) {
        console.error('Erro ao atualizar consentimento:', error);
        return false;
      }

      const result = data as { success: boolean };
      return result.success;
    } catch (error) {
      console.error('Erro ao atualizar consentimento:', error);
      return false;
    }
  }, []);

  /**
   * Cancela entrada na fila
   */
  const cancelQueueEntry = useCallback(async (restauranteId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cancel_my_queue_entry', {
        p_restaurante_id: restauranteId,
      });

      if (error) {
        console.error('Erro ao cancelar entrada:', error);
        toast({
          title: 'Erro ao cancelar',
          description: error.message || 'Tente novamente.',
          variant: 'destructive',
        });
        setLoading(false);
        return false;
      }

      const result = data as { success: boolean };
      if (result.success) {
        toast({
          title: 'Entrada cancelada',
          description: 'Você saiu da fila.',
        });
      }

      setLoading(false);
      return result.success;
    } catch (error) {
      console.error('Erro ao cancelar entrada:', error);
      setLoading(false);
      return false;
    }
  }, [toast]);

  /**
   * Verifica se usuário está autenticado
   */
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    const authenticated = !!session?.user;
    setIsAuthenticated(authenticated);
    return authenticated;
  }, []);

  /**
   * Busca nome do restaurante
   */
  const getRestaurantName = useCallback(async (restauranteId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restauranteId)
        .maybeSingle();

      if (error || !data) return null;
      return data.name;
    } catch {
      return null;
    }
  }, []);

  return {
    loading,
    otpSent,
    isAuthenticated,
    sendOtp,
    verifyOtp,
    createQueueEntry,
    getQueueStatus,
    updateConsent,
    cancelQueueEntry,
    checkAuth,
    validateRestaurant,
    getRestaurantName,
  };
}

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

type CliksProgram = {
  id: string;
  restaurant_id: string;
  is_active: boolean;
  reward_description: string;
  validity: string | null;
  rules: string | null;
  created_at: string;
  updated_at: string;
};

type CliksUser = {
  id: string;
  user_id: string;
  restaurant_id: string;
  total_cliks: number;
  has_reward: boolean;
  last_updated: string;
  created_at: string;
};

export function use10Cliks() {
  const [program, setProgram] = useState<CliksProgram | null>(null);
  const [users, setUsers] = useState<CliksUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProgram();
    fetchUsers();
  }, []);

  const fetchProgram = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('cliks_program')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProgram(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar programa';
      setError(message);
      console.error('Error fetching program:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('cliks_users')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('total_cliks', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const saveProgram = async (data: {
    is_active: boolean;
    reward_description: string;
    validity?: string | null;
    rules?: string | null;
  }) => {
    try {
      const programData = {
        restaurant_id: RESTAURANT_ID,
        ...data,
      };

      const { error } = await supabase
        .schema('mesaclik')
        .from('cliks_program')
        .upsert(programData, {
          onConflict: 'restaurant_id',
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Programa 10 Cliks atualizado com sucesso',
      });

      await fetchProgram();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar programa';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const resetUserReward = async (userId: string) => {
    try {
      const { error } = await supabase
        .schema('mesaclik')
        .from('cliks_users')
        .update({
          total_cliks: 0,
          has_reward: false,
          last_updated: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('restaurant_id', RESTAURANT_ID);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Pontos resetados com sucesso',
      });

      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao resetar pontos';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  return {
    program,
    users,
    loading,
    error,
    saveProgram,
    resetUserReward,
    refetch: () => {
      fetchProgram();
      fetchUsers();
    },
  };
}

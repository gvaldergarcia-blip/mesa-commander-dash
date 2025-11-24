import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type QueueSettings = {
  id?: string;
  restaurant_id: string;
  max_party_size: number;
  queue_capacity: number;
  avg_time_1_2: number;
  avg_time_3_4: number;
  avg_time_5_6: number;
  avg_time_7_8: number;
  created_at?: string;
  updated_at?: string;
};

export function useQueueSettings(restaurantId: string) {
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, [restaurantId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('queue_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching queue settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (values: Omit<QueueSettings, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('queue_settings')
        .upsert({
          ...values,
          restaurant_id: restaurantId,
        }, {
          onConflict: 'restaurant_id'
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações da fila foram atualizadas com sucesso.",
      });

      await fetchSettings();
      return true;
    } catch (error) {
      console.error('Error saving queue settings:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    settings,
    loading,
    saveSettings,
    refetch: fetchSettings,
  };
}

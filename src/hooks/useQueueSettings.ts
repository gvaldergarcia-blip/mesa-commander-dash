import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type QueueSettings = {
  id?: string;
  restaurant_id: string;
  max_party_size: number;
  max_queue_capacity: number;
  tolerance_minutes: number;
  avg_wait_time_1_2: number;
  avg_wait_time_3_4: number;
  avg_wait_time_5_6: number;
  avg_wait_time_7_8: number;
  created_at?: string;
  updated_at?: string;
};

export function useQueueSettings(restaurantId: string) {
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [restaurantId]);

  const fetchSettings = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('queue_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      // Map public schema fields to internal type
      if (data) {
        setSettings({
          id: data.id,
          restaurant_id: data.restaurant_id,
          max_party_size: data.max_party_size,
          max_queue_capacity: data.queue_capacity,
          tolerance_minutes: data.tolerance_minutes ?? 10,
          avg_wait_time_1_2: data.avg_time_1_2,
          avg_wait_time_3_4: data.avg_time_3_4,
          avg_wait_time_5_6: data.avg_time_5_6,
          avg_wait_time_7_8: data.avg_time_7_8,
        } as QueueSettings);
      } else {
        setSettings(null);
      }
    } catch (error) {
      console.error('Error fetching queue settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (values: Omit<QueueSettings, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const payload = {
        restaurant_id: restaurantId,
        max_party_size: values.max_party_size,
        queue_capacity: values.max_queue_capacity,
        tolerance_minutes: values.tolerance_minutes,
        avg_time_1_2: values.avg_wait_time_1_2,
        avg_time_3_4: values.avg_wait_time_3_4,
        avg_time_5_6: values.avg_wait_time_5_6,
        avg_time_7_8: values.avg_wait_time_7_8,
      };

      // Avoid upsert(onConflict) because restaurant_id may not be unique in DB
      let existingId = settings?.id;
      if (!existingId) {
        const { data, error } = await supabase
          .from('queue_settings')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (error) throw error;
        existingId = data?.id;
      }

      const { error } = existingId
        ? await supabase.from('queue_settings').update(payload).eq('id', existingId)
        : await supabase.from('queue_settings').insert(payload);

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
        description: (error as any)?.message ?? "Não foi possível salvar as configurações.",
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

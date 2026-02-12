import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ReservationSettings = {
  id?: string;
  restaurant_id: string;
  max_party_size: number;
  tolerance_minutes: number;
  created_at?: string;
  updated_at?: string;
};

export function useReservationSettings(restaurantId: string) {
  const [settings, setSettings] = useState<ReservationSettings | null>(null);
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
        .from('reservation_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      setSettings(data as ReservationSettings | null);
    } catch (error) {
      console.error('Error fetching reservation settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (values: Omit<ReservationSettings, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const payload = {
        restaurant_id: restaurantId,
        max_party_size: values.max_party_size,
        tolerance_minutes: values.tolerance_minutes,
      };

      // Avoid upsert(onConflict) because restaurant_id may not be unique in DB
      let existingId = settings?.id;
      if (!existingId) {
        const { data, error } = await supabase
          .from('reservation_settings')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (error) throw error;
        existingId = data?.id;
      }

      const { error } = existingId
        ? await supabase.from('reservation_settings').update(payload).eq('id', existingId)
        : await supabase.from('reservation_settings').insert(payload);

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações de reservas foram atualizadas com sucesso.",
      });

      await fetchSettings();
      return true;
    } catch (error) {
      console.error('Error saving reservation settings:', error);
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

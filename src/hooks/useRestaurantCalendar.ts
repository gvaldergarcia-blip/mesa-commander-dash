import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

type CalendarDay = {
  restaurant_id: string;
  day: string;
  is_open: boolean;
  created_at: string;
  updated_at: string;
};

export function useRestaurantCalendar() {
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[useRestaurantCalendar] Fetching calendar for restaurant:', RESTAURANT_ID);
      
      // Usar RPC para buscar dados do schema mesaclik sem problemas de RLS
      const { data, error } = await supabase
        .rpc('get_restaurant_calendar', {
          p_restaurant_id: RESTAURANT_ID
        });

      if (error) {
        console.error('[useRestaurantCalendar] RPC error, falling back to direct query:', error);
        // Fallback: tentar query direta
        const { data: directData, error: directError } = await supabase
          .schema('mesaclik')
          .from('restaurant_calendar')
          .select('*')
          .eq('restaurant_id', RESTAURANT_ID)
          .order('day', { ascending: true });
        
        if (directError) throw directError;
        setCalendarDays(directData || []);
        return;
      }
      
      console.log('[useRestaurantCalendar] Calendar data loaded:', data?.length || 0, 'days');
      // Normalizar dias para formato YYYY-MM-DD
      const normalizedData = (data || []).map((item: any) => ({
        ...item,
        day: typeof item.day === 'string' ? item.day.split('T')[0] : item.day
      }));
      setCalendarDays(normalizedData);
    } catch (err) {
      console.error('[useRestaurantCalendar] Erro ao carregar calendário:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar disponibilidade',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const toggleDayAvailability = async (day: string, isOpen: boolean) => {
    try {
      console.log('[useRestaurantCalendar] Toggling day:', { day, isOpen, restaurant_id: RESTAURANT_ID });
      
      // Usar RPC para update no schema mesaclik
      const { data, error } = await supabase.rpc('toggle_restaurant_calendar_day', {
        p_restaurant_id: RESTAURANT_ID,
        p_day: day,
        p_is_open: isOpen
      });

      if (error) {
        console.error('[useRestaurantCalendar] RPC toggle error:', error);
        throw error;
      }
      
      console.log('[useRestaurantCalendar] Toggle success:', data);

      toast({
        title: 'Sucesso',
        description: `Dia ${isOpen ? 'disponível' : 'bloqueado'} com sucesso`,
      });

      await fetchCalendar();
    } catch (err) {
      console.error('[useRestaurantCalendar] Erro ao atualizar calendário:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar disponibilidade',
        variant: 'destructive',
      });
    }
  };

  const isDayAvailable = (day: string): boolean => {
    // Normalizar o dia de entrada para YYYY-MM-DD
    const normalizedDay = day.split('T')[0];
    const found = calendarDays.find(cd => {
      const cdDay = typeof cd.day === 'string' ? cd.day.split('T')[0] : cd.day;
      return cdDay === normalizedDay;
    });
    // Por padrão, dias não marcados estão abertos
    return found ? found.is_open : true;
  };

  return {
    calendarDays,
    loading,
    refetch: fetchCalendar,
    toggleDayAvailability,
    isDayAvailable,
  };
}

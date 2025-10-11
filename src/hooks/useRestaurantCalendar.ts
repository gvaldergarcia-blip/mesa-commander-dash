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
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('restaurant_calendar')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('day', { ascending: true });

      if (error) throw error;
      setCalendarDays(data || []);
    } catch (err) {
      console.error('Erro ao carregar calendário:', err);
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
      const { error } = await supabase
        .schema('mesaclik')
        .from('restaurant_calendar')
        .upsert({
          restaurant_id: RESTAURANT_ID,
          day,
          is_open: isOpen,
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Dia ${isOpen ? 'aberto' : 'fechado'} com sucesso`,
      });

      await fetchCalendar();
    } catch (err) {
      console.error('Erro ao atualizar calendário:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar disponibilidade',
        variant: 'destructive',
      });
    }
  };

  const isDayAvailable = (day: string): boolean => {
    const found = calendarDays.find(cd => cd.day === day);
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

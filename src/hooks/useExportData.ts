import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useToast } from '@/hooks/use-toast';

type ExportType = 'queue' | 'reservations' | 'kpis';

export function useExportData() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: 'Sem dados',
        description: 'Não há dados para exportar no período selecionado.',
        variant: 'destructive',
      });
      return false;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle null/undefined
          if (value === null || value === undefined) return '';
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  const exportQueueData = async (startDate: Date, endDate: Date) => {
    try {
      // Usar RPC para contornar RLS
      const { data, error } = await supabase.rpc('get_reports_queue_data', {
        p_restaurant_id: restaurantId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) {
        console.error('[Export] Erro ao buscar dados da fila:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Não há dados de fila no período selecionado.',
          variant: 'destructive',
        });
        return;
      }

      const formattedData = data.map((entry: any) => ({
        'ID': entry.id,
        'Status': entry.status === 'seated' ? 'Atendido' : 
                  entry.status === 'waiting' ? 'Aguardando' : 
                  entry.status === 'called' ? 'Chamado' : 
                  entry.status === 'canceled' ? 'Cancelado' : 
                  entry.status === 'no_show' ? 'Não compareceu' : entry.status,
        'Pessoas': entry.party_size,
        'Criado em': new Date(entry.created_at).toLocaleString('pt-BR'),
        'Sentado em': entry.seated_at ? new Date(entry.seated_at).toLocaleString('pt-BR') : '',
        'Cancelado em': entry.canceled_at ? new Date(entry.canceled_at).toLocaleString('pt-BR') : '',
        'Tempo de espera (min)': entry.seated_at 
          ? Math.round((new Date(entry.seated_at).getTime() - new Date(entry.created_at).getTime()) / 60000)
          : ''
      }));

      exportToCSV(formattedData, `fila_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('[Export] Erro:', error);
      throw error;
    }
  };

  const exportReservationsData = async (startDate: Date, endDate: Date) => {
    try {
      // Usar RPC para contornar RLS
      const { data, error } = await supabase.rpc('get_reports_reservation_data', {
        p_restaurant_id: restaurantId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) {
        console.error('[Export] Erro ao buscar dados de reservas:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Não há dados de reservas no período selecionado.',
          variant: 'destructive',
        });
        return;
      }

      const formattedData = data.map((reservation: any) => ({
        'ID': reservation.id,
        'Status': reservation.status === 'completed' ? 'Concluída' : 
                  reservation.status === 'confirmed' ? 'Confirmada' : 
                  reservation.status === 'pending' ? 'Pendente' : 
                  reservation.status === 'canceled' ? 'Cancelada' : 
                  reservation.status === 'no_show' ? 'Não compareceu' : reservation.status,
        'Pessoas': reservation.party_size,
        'Data/Hora Reserva': reservation.reserved_for ? new Date(reservation.reserved_for).toLocaleString('pt-BR') : '',
        'Criado em': new Date(reservation.created_at).toLocaleString('pt-BR'),
        'Confirmado em': reservation.confirmed_at ? new Date(reservation.confirmed_at).toLocaleString('pt-BR') : '',
        'Concluído em': reservation.completed_at ? new Date(reservation.completed_at).toLocaleString('pt-BR') : '',
        'Cancelado em': reservation.canceled_at ? new Date(reservation.canceled_at).toLocaleString('pt-BR') : '',
      }));

      exportToCSV(formattedData, `reservas_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('[Export] Erro:', error);
      throw error;
    }
  };

  const exportKPIsData = async (startDate: Date, endDate: Date) => {
    try {
      // Buscar dados via RPC
      const [
        { data: queueData, error: queueError },
        { data: reservationsData, error: resError }
      ] = await Promise.all([
        supabase.rpc('get_reports_queue_data', {
          p_restaurant_id: restaurantId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        }),
        supabase.rpc('get_reports_reservation_data', {
          p_restaurant_id: restaurantId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        })
      ]);

      if (queueError) console.warn('[Export] Erro ao buscar fila:', queueError);
      if (resError) console.warn('[Export] Erro ao buscar reservas:', resError);

      // Calcular KPIs de Fila
      const seatedEntries = queueData?.filter((e: any) => ['seated', 'served'].includes(e.status) && e.seated_at) || [];
      const avgWaitTime = seatedEntries.length > 0
        ? Math.round(seatedEntries.reduce((sum: number, entry: any) => {
            const created = new Date(entry.created_at).getTime();
            const seated = new Date(entry.seated_at).getTime();
            return sum + (seated - created) / 60000;
          }, 0) / seatedEntries.length)
        : 0;

      const totalQueueEntries = queueData?.length || 0;
      const queueSeated = seatedEntries.length;
      const queueCanceled = queueData?.filter((e: any) => e.status === 'canceled').length || 0;
      const queueConversionRate = totalQueueEntries > 0 
        ? Math.round((queueSeated / totalQueueEntries) * 100) 
        : 0;

      // Calcular KPIs de Reservas
      const totalReservations = reservationsData?.length || 0;
      const resCompleted = reservationsData?.filter((r: any) => r.status === 'completed').length || 0;
      const resConfirmed = reservationsData?.filter((r: any) => r.status === 'confirmed').length || 0;
      const resCanceled = reservationsData?.filter((r: any) => r.status === 'canceled').length || 0;
      const resNoShow = reservationsData?.filter((r: any) => r.status === 'no_show' || r.no_show_at).length || 0;
      
      const resFinalized = resCompleted + resNoShow + resCanceled;
      const noShowRate = resFinalized > 0 ? Math.round((resNoShow / resFinalized) * 100) : 0;
      const successRate = totalReservations > 0 
        ? Math.round(((resCompleted + resConfirmed) / totalReservations) * 100) 
        : 0;

      const periodLabel = `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`;

      const kpisData = [
        {
          'Categoria': 'Fila',
          'Métrica': 'Total de Entradas',
          'Valor': totalQueueEntries,
          'Período': periodLabel
        },
        {
          'Categoria': 'Fila',
          'Métrica': 'Total Atendidos',
          'Valor': queueSeated,
          'Período': periodLabel
        },
        {
          'Categoria': 'Fila',
          'Métrica': 'Cancelados',
          'Valor': queueCanceled,
          'Período': periodLabel
        },
        {
          'Categoria': 'Fila',
          'Métrica': 'Tempo Médio de Espera',
          'Valor': `${avgWaitTime} min`,
          'Período': periodLabel
        },
        {
          'Categoria': 'Fila',
          'Métrica': 'Taxa de Conversão',
          'Valor': `${queueConversionRate}%`,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Total de Reservas',
          'Valor': totalReservations,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Concluídas',
          'Valor': resCompleted,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Confirmadas',
          'Valor': resConfirmed,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Canceladas',
          'Valor': resCanceled,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Não Compareceram',
          'Valor': resNoShow,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Taxa de No-Show',
          'Valor': `${noShowRate}%`,
          'Período': periodLabel
        },
        {
          'Categoria': 'Reservas',
          'Métrica': 'Taxa de Sucesso',
          'Valor': `${successRate}%`,
          'Período': periodLabel
        },
      ];

      exportToCSV(kpisData, `kpis_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('[Export] Erro:', error);
      throw error;
    }
  };

  return {
    exportQueueData,
    exportReservationsData,
    exportKPIsData
  };
}

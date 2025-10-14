import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';

type ExportType = 'queue' | 'reservations' | 'kpis';

interface ExportParams {
  type: ExportType;
  startDate: Date;
  endDate: Date;
}

export function useExportData() {
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportQueueData = async (startDate: Date, endDate: Date) => {
    const { data, error } = await supabase
      .schema('mesaclik')
      .from('queue_entries')
      .select('*')
      .eq('restaurant_id', RESTAURANT_ID)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const formattedData = data.map(entry => ({
      'ID': entry.id,
      'Nome': entry.customer_name,
      'Telefone': entry.phone,
      'Pessoas': entry.party_size,
      'Status': entry.status,
      'Criado em': new Date(entry.created_at).toLocaleString('pt-BR'),
      'Sentado em': entry.seated_at ? new Date(entry.seated_at).toLocaleString('pt-BR') : '',
      'Tempo de espera (min)': entry.seated_at 
        ? Math.round((new Date(entry.seated_at).getTime() - new Date(entry.created_at).getTime()) / 60000)
        : ''
    }));

    exportToCSV(formattedData, `fila_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
  };

  const exportReservationsData = async (startDate: Date, endDate: Date) => {
    const { data, error } = await supabase
      .schema('mesaclik')
      .from('reservations')
      .select('*')
      .eq('restaurant_id', RESTAURANT_ID)
      .gte('reservation_datetime', startDate.toISOString())
      .lte('reservation_datetime', endDate.toISOString())
      .order('reservation_datetime', { ascending: false });

    if (error) throw error;
    
    const formattedData = data.map(reservation => ({
      'ID': reservation.id,
      'Nome': reservation.customer_name,
      'Telefone': reservation.phone,
      'Pessoas': reservation.party_size,
      'Status': reservation.status,
      'Data/Hora': new Date(reservation.reservation_datetime).toLocaleString('pt-BR'),
      'Criado em': new Date(reservation.created_at).toLocaleString('pt-BR'),
      'Notas': reservation.notes || ''
    }));

    exportToCSV(formattedData, `reservas_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
  };

  const exportKPIsData = async (startDate: Date, endDate: Date) => {
    // Buscar dados de fila
    const { data: queueData } = await supabase
      .schema('mesaclik')
      .from('queue_entries')
      .select('created_at, seated_at, status')
      .eq('restaurant_id', RESTAURANT_ID)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'seated')
      .not('seated_at', 'is', null);

    // Buscar dados de reservas
    const { data: reservationsData } = await supabase
      .schema('mesaclik')
      .from('reservations')
      .select('status, created_at')
      .eq('restaurant_id', RESTAURANT_ID)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Calcular KPIs
    const avgWaitTime = queueData && queueData.length > 0
      ? Math.round(queueData.reduce((sum, entry) => {
          const created = new Date(entry.created_at).getTime();
          const seated = new Date(entry.seated_at!).getTime();
          return sum + (seated - created) / 60000;
        }, 0) / queueData.length)
      : 0;

    const totalReservations = reservationsData?.length || 0;
    const confirmedReservations = reservationsData?.filter(r => 
      r.status === 'confirmed' || r.status === 'completed' || r.status === 'seated'
    ).length || 0;
    const noShowReservations = reservationsData?.filter(r => 
      r.status === 'canceled'
    ).length || 0;

    const conversionRate = totalReservations > 0 
      ? Math.round((confirmedReservations / totalReservations) * 100)
      : 0;
    const noShowRate = confirmedReservations > 0
      ? Math.round((noShowReservations / totalReservations) * 100)
      : 0;

    const kpisData = [{
      'Métrica': 'Tempo Médio de Espera',
      'Valor': `${avgWaitTime} min`,
      'Período': `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
    }, {
      'Métrica': 'Taxa de Conversão',
      'Valor': `${conversionRate}%`,
      'Período': `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
    }, {
      'Métrica': 'Taxa de No-Show',
      'Valor': `${noShowRate}%`,
      'Período': `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
    }, {
      'Métrica': 'Total de Atendimentos (Fila)',
      'Valor': queueData?.length || 0,
      'Período': `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
    }, {
      'Métrica': 'Total de Reservas',
      'Valor': totalReservations,
      'Período': `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
    }];

    exportToCSV(kpisData, `kpis_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
  };

  return {
    exportQueueData,
    exportReservationsData,
    exportKPIsData
  };
}

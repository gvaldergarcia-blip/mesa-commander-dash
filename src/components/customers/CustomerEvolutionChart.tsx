import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type MonthlyData = {
  month: string;
  queue_visits: number;
  reservation_visits: number;
  queue_completed: number;
  queue_canceled: number;
  promotions_sent: number;
};

type VisitHistory = {
  id: string;
  type: 'queue' | 'reservation';
  date: string;
  status: string;
};

type PromotionHistory = {
  id: string;
  date: string;
};

interface CustomerEvolutionChartProps {
  visits: VisitHistory[];
  promotions?: PromotionHistory[];
}

export function CustomerEvolutionChart({ visits, promotions = [] }: CustomerEvolutionChartProps) {
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, MonthlyData>();
    
    // Processar visitas
    visits.forEach((visit) => {
      const date = new Date(visit.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, {
          month: monthLabel,
          queue_visits: 0,
          reservation_visits: 0,
          queue_completed: 0,
          queue_canceled: 0,
          promotions_sent: 0,
        });
      }
      
      const data = dataMap.get(monthKey)!;
      
      if (visit.type === 'queue') {
        data.queue_visits++;
        if (visit.status === 'seated') {
          data.queue_completed++;
        } else if (visit.status === 'canceled' || visit.status === 'no_show') {
          data.queue_canceled++;
        }
      } else {
        data.reservation_visits++;
      }
    });
    
    // Processar promoções
    promotions.forEach((promo) => {
      const date = new Date(promo.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, {
          month: monthLabel,
          queue_visits: 0,
          reservation_visits: 0,
          queue_completed: 0,
          queue_canceled: 0,
          promotions_sent: 0,
        });
      }
      
      dataMap.get(monthKey)!.promotions_sent++;
    });
    
    // Ordenar por data
    return Array.from(dataMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, data]) => data)
      .slice(-12); // Últimos 12 meses
  }, [visits, promotions]);

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução Mensal</CardTitle>
          <CardDescription>Histórico de interações mês a mês</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados históricos suficientes para exibir o gráfico
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Mensal</CardTitle>
        <CardDescription>Histórico de interações mês a mês</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorReservation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="queue_visits" 
                name="Filas"
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorQueue)" 
              />
              <Area 
                type="monotone" 
                dataKey="reservation_visits" 
                name="Reservas"
                stroke="hsl(var(--success))" 
                fillOpacity={1} 
                fill="url(#colorReservation)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {monthlyData.reduce((sum, d) => sum + d.queue_visits, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total de Filas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">
              {monthlyData.reduce((sum, d) => sum + d.reservation_visits, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total de Reservas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {monthlyData.reduce((sum, d) => sum + d.queue_completed, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Filas Concluídas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent">
              {monthlyData.reduce((sum, d) => sum + d.promotions_sent, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Promoções Enviadas</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

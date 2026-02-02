import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, Clock } from "lucide-react";

interface QueueHourlyChartProps {
  data: Array<{
    hour: string;
    count: number;
  }>;
}

/**
 * Gráfico de distribuição horária EXCLUSIVO para fila
 * Mostra volume real de entradas por hora (0-23h)
 * Eixo Y ajustado automaticamente à quantidade real
 */
export function QueueHourlyChart({ data }: QueueHourlyChartProps) {
  // Garantir todas as 24 horas representadas, mesmo sem dados
  const fullDayData = Array.from({ length: 24 }, (_, i) => {
    const hourStr = `${i.toString().padStart(2, '0')}:00`;
    const existing = data?.find(d => d.hour === hourStr);
    return {
      hour: hourStr,
      count: existing?.count || 0,
    };
  });

  // Filtrar apenas horas com algum movimento (ou mostrar horário comercial 10h-23h)
  const activeHours = fullDayData.filter((d, i) => i >= 10 && i <= 23);
  
  const totalEntries = activeHours.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...activeHours.map(d => d.count), 1);
  const peakHour = activeHours.find(d => d.count === maxCount)?.hour || '-';

  if (totalEntries === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            Distribuição por Horário (Fila)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Volume de entradas na fila por hora do dia
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Sem entradas na fila</p>
            <p className="text-sm">Adicione clientes para visualizar a distribuição</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-lg">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Distribuição por Horário (Fila)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {totalEntries} entradas no período
            </p>
          </div>
          {peakHour !== '-' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
              <Clock className="w-4 h-4 text-primary" />
              <div className="text-sm">
                <span className="text-muted-foreground">Pico: </span>
                <span className="font-semibold text-primary">{peakHour}</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={activeHours} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="hour" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, 'auto']}
            />
            <RechartsTooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
              formatter={(value: number) => [`${value} entrada${value !== 1 ? 's' : ''}`, 'Fila']}
              labelFormatter={(label) => `Horário: ${label}`}
            />
            <Bar
              dataKey="count" 
              name="Entradas"
              radius={[6, 6, 0, 0]}
            >
              {activeHours.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.count === maxCount ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

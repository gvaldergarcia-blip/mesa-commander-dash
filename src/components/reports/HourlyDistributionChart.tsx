import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { BarChart3, Clock } from "lucide-react";

interface HourlyDistributionChartProps {
  data?: Array<{
    hour: string;
    count: number;
  }>;
}

export function HourlyDistributionChart({ data }: HourlyDistributionChartProps) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            Distribuição por Horário
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Volume de atendimentos por hora do dia
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados no período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  // Encontrar o horário de pico
  const maxCount = Math.max(...data.map(d => d.count));
  const peakHour = data.find(d => d.count === maxCount)?.hour || '';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-lg">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Distribuição por Horário
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Volume de atendimentos por hora do dia
            </p>
          </div>
          {peakHour && (
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
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="hour" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
              formatter={(value: number) => [`${value} atendimentos`, 'Volume']}
              labelFormatter={(label) => `Horário: ${label}`}
            />
            <Bar
              dataKey="count" 
              name="Atendimentos"
              radius={[6, 6, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.count === maxCount ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

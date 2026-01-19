import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from "lucide-react";

interface DailyEvolutionChartProps {
  data?: Array<{
    date: string;
    reservations: number;
    queue: number;
  }>;
}

export function DailyEvolutionChart({ data }: DailyEvolutionChartProps) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            Evolução Diária
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparativo entre fila e reservas ao longo do tempo
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

  // Calcular totais para o resumo
  const totalReservations = data.reduce((sum, d) => sum + d.reservations, 0);
  const totalQueue = data.reduce((sum, d) => sum + d.queue, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center text-lg">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              Evolução Diária
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Comparativo entre fila e reservas ao longo do tempo
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Fila:</span>
              <span className="font-semibold">{totalQueue}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-muted-foreground">Reservas:</span>
              <span className="font-semibold">{totalReservations}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="date" 
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
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500, marginBottom: 4 }}
            />
            <Legend 
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground">{value}</span>
              )}
            />
            <Area 
              type="monotone" 
              dataKey="queue" 
              name="Fila"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              fill="url(#colorQueue)"
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Area 
              type="monotone" 
              dataKey="reservations" 
              name="Reservas"
              stroke="hsl(var(--accent))" 
              strokeWidth={2}
              fill="url(#colorReservations)"
              dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

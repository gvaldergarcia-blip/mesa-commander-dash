import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyEvolutionChartProps {
  data?: Array<{
    date: string;
    reservations: number;
    queue: number;
  }>;
}

export function DailyEvolutionChart({ data }: DailyEvolutionChartProps) {
  const [hidden, setHidden] = useState<{ queue: boolean; reservations: boolean }>({
    queue: false,
    reservations: false,
  });

  // Enriquecer dados com variação vs semana anterior (mesmo índice -7)
  const enriched = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((d, i) => {
      const prev = i >= 7 ? data[i - 7] : null;
      return {
        ...d,
        prevQueue: prev?.queue ?? null,
        prevReservations: prev?.reservations ?? null,
      };
    });
  }, [data]);

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

  const RichTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload || {};
    const renderDelta = (curr: number, prev: number | null | undefined) => {
      if (prev === null || prev === undefined) return <span className="text-muted-foreground/60">—</span>;
      const diff = curr - prev;
      if (diff === 0) return <span className="text-muted-foreground">0%</span>;
      const pct = prev === 0 ? 100 : Math.round((diff / prev) * 100);
      const up = diff > 0;
      return (
        <span className={cn("font-medium", up ? "text-success" : "text-destructive")}>
          {up ? "↑" : "↓"} {Math.abs(pct)}%
        </span>
      );
    };
    return (
      <div className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3.5 py-3 shadow-lg min-w-[200px]">
        <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1.5 text-xs">
          {!hidden.queue && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f97316' }} />
                <span className="text-muted-foreground">Fila</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{row.queue}</span>
              <span className="tabular-nums">{renderDelta(row.queue, row.prevQueue)}</span>
            </div>
          )}
          {!hidden.reservations && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-muted-foreground">Reservas</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{row.reservations}</span>
              <span className="tabular-nums">{renderDelta(row.reservations, row.prevReservations)}</span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/70 pt-1.5 border-t border-border/60 mt-2">
            Variação vs mesmo dia da semana anterior
          </p>
        </div>
      </div>
    );
  };

  const toggle = (key: 'queue' | 'reservations') =>
    setHidden((s) => ({ ...s, [key]: !s[key] }));

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
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => toggle('queue')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                hidden.queue
                  ? "border-border bg-muted/40 opacity-50"
                  : "border-orange-500/30 bg-orange-500/10 hover:border-orange-500/60"
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f97316' }} />
              <span className="text-muted-foreground text-xs">Fila</span>
              <span className="font-semibold text-xs tabular-nums">{totalQueue}</span>
            </button>
            <button
              type="button"
              onClick={() => toggle('reservations')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                hidden.reservations
                  ? "border-border bg-muted/40 opacity-50"
                  : "border-blue-500/30 bg-blue-500/10 hover:border-blue-500/60"
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-muted-foreground text-xs">Reservas</span>
              <span className="font-semibold text-xs tabular-nums">{totalReservations}</span>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={enriched} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.45}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
              allowDecimals={false}
              domain={[0, 'auto']}
            />
            <RechartsTooltip content={<RichTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="queue"
              name="Fila"
              hide={hidden.queue}
              stroke="#f97316"
              strokeWidth={2.5}
              fill="url(#colorQueue)"
              dot={{ fill: '#f97316', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="reservations"
              name="Reservas"
              hide={hidden.reservations}
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#colorReservations)"
              dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

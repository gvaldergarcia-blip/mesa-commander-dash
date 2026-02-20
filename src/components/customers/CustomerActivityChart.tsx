import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { cn } from "@/lib/utils";

interface MonthData {
  month: string;
  queue: number;
  reservation: number;
}

interface CustomerActivityChartProps {
  monthlyEvolution: MonthData[];
}

type PeriodFilter = '12m' | '6m' | '3m';

export function CustomerActivityChart({ monthlyEvolution }: CustomerActivityChartProps) {
  const [period, setPeriod] = useState<PeriodFilter>('12m');
  const [showQueue, setShowQueue] = useState(true);
  const [showReservation, setShowReservation] = useState(true);

  const filteredData = useMemo(() => {
    const sliceCount = period === '12m' ? 12 : period === '6m' ? 6 : 3;
    return monthlyEvolution.slice(-sliceCount);
  }, [monthlyEvolution, period]);

  const hasData = filteredData.some(d => d.queue > 0 || d.reservation > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atividade do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Dados insuficientes para gráfico
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Atividade do Cliente</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['12m', '6m', '3m'] as PeriodFilter[]).map(p => (
                <Button
                  key={p}
                  size="sm"
                  variant={period === p ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2"
                  onClick={() => setPeriod(p)}
                >
                  {p === '12m' ? '12 meses' : p === '6m' ? '6 meses' : '90 dias'}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 ml-2">
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer text-[10px]",
                  showQueue ? "bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30" : "opacity-50"
                )}
                onClick={() => setShowQueue(!showQueue)}
              >
                🎫 Fila
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer text-[10px]",
                  showReservation ? "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30" : "opacity-50"
                )}
                onClick={() => setShowReservation(!showReservation)}
              >
                📅 Reserva
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={filteredData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {showQueue && <Bar dataKey="queue" name="Fila" fill="#f97316" radius={[3, 3, 0, 0]} />}
            {showReservation && <Bar dataKey="reservation" name="Reserva" fill="#3b82f6" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

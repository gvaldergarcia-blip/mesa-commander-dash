import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { CalendarCheck } from "lucide-react";

interface ReservationStatusChartProps {
  completed: number;
  confirmed: number;
  pending: number;
  canceled: number;
  noShow: number;
}

// Cores fixas para status de reserva - paleta única MesaClik
const COLORS = {
  completed: '#22c55e',  // green-500 - Concluídas
  confirmed: '#3b82f6',  // blue-500 - Confirmadas
  pending: '#6b7280',    // gray-500 - Pendentes
  canceled: '#ef4444',   // red-500 - Canceladas
  noShow: '#ec4899',     // pink-500 - Não compareceram
};

export function ReservationStatusChart({ completed, confirmed, pending, canceled, noShow }: ReservationStatusChartProps) {
  const data = [
    { name: 'Concluídas', value: completed, color: COLORS.completed },
    { name: 'Confirmadas', value: confirmed, color: COLORS.confirmed },
    { name: 'Pendentes', value: pending, color: COLORS.pending },
    { name: 'Canceladas', value: canceled, color: COLORS.canceled },
    { name: 'Não Compareceram', value: noShow, color: COLORS.noShow },
  ].filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <div className="p-2 bg-accent/10 rounded-lg mr-3">
              <CalendarCheck className="w-5 h-5 text-accent-foreground" />
            </div>
            Status de Reservas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Distribuição de reservas por status final
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Sem dados de reservas</p>
            <p className="text-sm">Adicione reservas para visualizar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <div className="p-2 bg-accent/10 rounded-lg mr-3">
            <CalendarCheck className="w-5 h-5 text-accent-foreground" />
          </div>
          Status de Reservas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {total} reservas no período
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={50}
              fill="#8884d8"
              dataKey="value"
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number, name: string) => [
                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                name
              ]}
            />
            <Legend 
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp } from "lucide-react";

interface PeakInfoCardProps {
  peakHour: string;
  peakDay: string;
  totalServed: number;
  totalCanceled: number;
}

export function PeakInfoCard({ peakHour, peakDay, totalServed, totalCanceled }: PeakInfoCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Atendidos */}
      <Card className="border-success/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Atendidos</p>
              <p className="text-2xl font-bold text-success">{totalServed}</p>
              <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
            </div>
            <div className="p-3 bg-success/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Cancelados */}
      <Card className="border-destructive/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Cancelados</p>
              <p className="text-2xl font-bold text-destructive">{totalCanceled}</p>
              <p className="text-xs text-muted-foreground mt-1">Fila de espera</p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horário de Pico */}
      <Card className="border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Horário de Pico</p>
              <p className="text-2xl font-bold text-primary">{peakHour}</p>
              <p className="text-xs text-muted-foreground mt-1">Maior volume de clientes</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Clock className="w-5 h-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dia de Pico */}
      <Card className="border-accent/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Dia de Pico</p>
              <p className="text-2xl font-bold text-accent capitalize">{peakDay}</p>
              <p className="text-xs text-muted-foreground mt-1">Melhor dia da semana</p>
            </div>
            <div className="p-3 bg-accent/10 rounded-xl">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

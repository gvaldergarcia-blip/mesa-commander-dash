import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp, XCircle, CheckCircle2 } from "lucide-react";

interface PeakInfoCardProps {
  peakHour: string;
  peakDay: string;
  totalServed: number;
  totalCanceled: number;
}

export function PeakInfoCard({ peakHour, peakDay, totalServed, totalCanceled }: PeakInfoCardProps) {
  // Formatar dia de pico
  const formattedPeakDay = peakDay && peakDay !== '-' 
    ? peakDay.charAt(0).toUpperCase() + peakDay.slice(1)
    : '-';

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Atendidos */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="p-2 rounded-lg bg-success/20">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{totalServed}</p>
              <p className="text-xs text-muted-foreground">Total Atendidos</p>
              <p className="text-[10px] text-muted-foreground/70">Fila + Reservas</p>
            </div>
          </div>

          {/* Total Cancelados */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="p-2 rounded-lg bg-destructive/20">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{totalCanceled}</p>
              <p className="text-xs text-muted-foreground">Total Cancelados</p>
              <p className="text-[10px] text-muted-foreground/70">Fila + Reservas</p>
            </div>
          </div>

          {/* Horário de Pico */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="p-2 rounded-lg bg-primary/20">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{peakHour}</p>
              <p className="text-xs text-muted-foreground">Horário de Pico</p>
              <p className="text-[10px] text-muted-foreground/70">Maior volume</p>
            </div>
          </div>

          {/* Dia de Pico */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
            <div className="p-2 rounded-lg bg-accent/20">
              <Calendar className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold text-accent-foreground truncate">{formattedPeakDay}</p>
              <p className="text-xs text-muted-foreground">Dia de Pico</p>
              <p className="text-[10px] text-muted-foreground/70">Maior movimento</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

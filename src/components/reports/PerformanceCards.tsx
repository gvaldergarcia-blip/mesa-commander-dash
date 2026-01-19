import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Target, CheckCircle2, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface PerformanceCardsProps {
  queueEfficiency: number;
  avgQueueSize: number;
  reservationMetrics: Array<{
    period: string;
    confirmed: number;
    pending: number;
    noShow: number;
    canceled: number;
  }>;
}

export function PerformanceCards({ queueEfficiency, avgQueueSize, reservationMetrics }: PerformanceCardsProps) {
  const metrics = reservationMetrics[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Performance da Fila */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            Desempenho da Fila
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground ml-2 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">
                    Eficiência = percentual de clientes da fila que foram efetivamente atendidos.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-success/5 to-success/10 border border-success/20">
              <div className="text-3xl font-bold text-success">{queueEfficiency}%</div>
              <div className="text-sm text-muted-foreground mt-1">Taxa de Eficiência</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-warning/5 to-warning/10 border border-warning/20">
              <div className="text-3xl font-bold text-warning">{avgQueueSize}</div>
              <div className="text-sm text-muted-foreground mt-1">Média Diária na Fila</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance de Reservas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <div className="p-2 bg-accent/10 rounded-lg mr-3">
              <Target className="w-5 h-5 text-accent" />
            </div>
            Desempenho de Reservas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics && (
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success mx-auto mb-1" />
                <div className="text-xl font-bold text-success">{metrics.confirmed}</div>
                <div className="text-xs text-muted-foreground">Confirmadas</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-warning/5 border border-warning/20">
                <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
                <div className="text-xl font-bold text-warning">{metrics.pending}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <XCircle className="w-4 h-4 text-destructive mx-auto mb-1" />
                <div className="text-xl font-bold text-destructive">{metrics.noShow}</div>
                <div className="text-xs text-muted-foreground">Não Compareceram</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border border-border">
                <XCircle className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <div className="text-xl font-bold text-muted-foreground">{metrics.canceled}</div>
                <div className="text-xs text-muted-foreground">Canceladas</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

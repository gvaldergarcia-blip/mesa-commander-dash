import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface QueuePerformanceCardProps {
  avgWaitTime: number;
  efficiency: number;
  totalServed: number;
  avgQueueSize: number;
  hasData: boolean;
}

/**
 * Card de desempenho EXCLUSIVO para fila
 * Tempo médio de espera calculado entre entrada e seated_at
 */
export function QueuePerformanceCard({
  avgWaitTime,
  efficiency,
  totalServed,
  avgQueueSize,
  hasData,
}: QueuePerformanceCardProps) {
  return (
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
                  Métricas calculadas a partir de entradas na fila com timestamp de atendimento (seated_at).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
            <Clock className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Sem dados de fila no período</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tempo Médio de Espera */}
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">
                {avgWaitTime > 0 ? `${avgWaitTime}min` : '-'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Tempo Médio</div>
            </div>

            {/* Eficiência */}
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-success/5 to-success/10 border border-success/20">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
              <div className="text-2xl font-bold text-success">{efficiency}%</div>
              <div className="text-xs text-muted-foreground mt-1">Taxa de Conversão</div>
            </div>

            {/* Total Atendidos */}
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20">
              <CheckCircle2 className="w-5 h-5 text-accent-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-accent-foreground">{totalServed}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Atendidos</div>
            </div>

            {/* Média Diária */}
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-warning/5 to-warning/10 border border-warning/20">
              <Users className="w-5 h-5 text-warning mx-auto mb-2" />
              <div className="text-2xl font-bold text-warning">{avgQueueSize}</div>
              <div className="text-xs text-muted-foreground mt-1">Média/Dia</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

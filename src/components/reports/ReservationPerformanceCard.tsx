import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, CheckCircle2, Clock, XCircle, UserX } from "lucide-react";

interface ReservationPerformanceCardProps {
  confirmed: number;
  completed: number;
  pending: number;
  noShow: number;
  canceled: number;
  noShowRate: number;    // Pré-calculado pelo hook central
  successRate: number;   // Pré-calculado pelo hook central
  hasData: boolean;
}

/**
 * Card de desempenho EXCLUSIVO para reservas
 * 
 * REGRA DE CONSISTÊNCIA:
 * - noShowRate e successRate são recebidos do hook central (useReportsReal)
 * - NÃO recalcular localmente para evitar divergência
 */
export function ReservationPerformanceCard({
  confirmed,
  completed,
  pending,
  noShow,
  canceled,
  noShowRate,
  successRate,
  hasData,
}: ReservationPerformanceCardProps) {

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <div className="p-2 bg-accent/10 rounded-lg mr-3">
            <CalendarCheck className="w-5 h-5 text-accent-foreground" />
          </div>
          Desempenho de Reservas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
            <CalendarCheck className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Sem reservas no período</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo principal */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success mx-auto mb-1" />
                <div className="text-xl font-bold text-success">{completed}</div>
                <div className="text-xs text-muted-foreground">Concluídas</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <CalendarCheck className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-blue-500">{confirmed}</div>
                <div className="text-xs text-muted-foreground">Confirmadas</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <UserX className="w-4 h-4 text-destructive mx-auto mb-1" />
                <div className="text-xl font-bold text-destructive">{noShow}</div>
                <div className="text-xs text-muted-foreground">No-show</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border border-border">
                <XCircle className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <div className="text-xl font-bold text-muted-foreground">{canceled}</div>
                <div className="text-xs text-muted-foreground">Canceladas</div>
              </div>
            </div>

            {/* Taxas */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
                <span className={`text-lg font-bold ${successRate >= 70 ? 'text-success' : 'text-warning'}`}>
                  {successRate}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Taxa No-Show</span>
                <span className={`text-lg font-bold ${noShowRate <= 10 ? 'text-success' : 'text-destructive'}`}>
                  {noShowRate}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

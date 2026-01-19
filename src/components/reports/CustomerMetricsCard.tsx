import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Crown, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface CustomerMetricsCardProps {
  newCustomers: number;
  vipCustomers: number;
}

export function CustomerMetricsCard({ newCustomers, vipCustomers }: CustomerMetricsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <div className="p-2 bg-accent/10 rounded-lg mr-3">
            <Users className="w-5 h-5 text-accent" />
          </div>
          Clientes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Métricas de aquisição e fidelização no período
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Novos Clientes */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-accent/5 to-primary/5 border border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-accent/10 rounded-lg">
                <UserPlus className="w-4 h-4 text-accent" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Novos Clientes</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{newCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Primeira visita no período
            </p>
          </div>

          {/* Clientes VIP */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-warning/5 to-success/5 border border-warning/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-warning/10 rounded-lg">
                <Crown className="w-4 h-4 text-warning" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Clientes VIP</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      Clientes com vip_status=true OU com 10 ou mais visitas realizadas (total_visits ≥ 10).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-3xl font-bold text-foreground">{vipCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              10+ visitas realizadas
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

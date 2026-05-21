import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNowStrict, format, isBefore, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLabelIssuances } from "@/hooks/useLabelIssuances";
import { cn } from "@/lib/utils";

export function ExpiryAlerts() {
  const { issuances, isLoading, resolve } = useLabelIssuances();

  const { expired, soon, ok } = useMemo(() => {
    const now = new Date();
    const expired: typeof issuances = [];
    const soon: typeof issuances = [];
    const ok: typeof issuances = [];
    for (const i of issuances) {
      const exp = new Date(i.expiry_date);
      if (isBefore(exp, now)) expired.push(i);
      else if (differenceInHours(exp, now) <= 24) soon.push(i);
      else ok.push(i);
    }
    return { expired, soon, ok };
  }, [issuances]);

  const visible = [...expired, ...soon];

  return (
    <Card className="bg-card/40 border-border/50 rounded-3xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Alertas de Validade</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Itens preparados ativos no estoque
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              {expired.length} vencidos
            </Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500">
              {soon.length} em 24h
            </Badge>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
              {ok.length} ok
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
            <p className="text-sm font-medium">Nenhum alerta no momento</p>
            <p className="text-xs mt-1">
              Os produtos preparados aparecerão aqui conforme se aproximarem do vencimento.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((i) => {
              const exp = new Date(i.expiry_date);
              const isExpired = isBefore(exp, new Date());
              return (
                <li
                  key={i.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl border",
                    isExpired
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-amber-500/5 border-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isExpired ? "text-destructive" : "text-amber-500"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-sm">
                        {i.product_name}
                        {i.quantity > 1 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ×{i.quantity}
                          </span>
                        )}
                        {i.batch && (
                          <span className="text-muted-foreground font-normal ml-2 text-xs">
                            Lote {i.batch}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isExpired ? "Venceu" : "Vence em"}{" "}
                        <span
                          className={cn(
                            "font-medium",
                            isExpired ? "text-destructive" : "text-amber-500"
                          )}
                        >
                          {formatDistanceToNowStrict(exp, { locale: ptBR, addSuffix: isExpired })}
                        </span>
                        {" · "}
                        {format(exp, "dd/MM HH:mm", { locale: ptBR })}
                        {i.responsible && ` · ${i.responsible}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => resolve({ id: i.id, status: "consumed" })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Consumido
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => resolve({ id: i.id, status: "discarded" })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Descartar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
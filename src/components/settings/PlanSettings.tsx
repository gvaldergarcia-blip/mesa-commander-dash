import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useModules } from "@/contexts/ModulesContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PlanStatus = "trialing" | "active" | "expired" | "canceled";

interface SubscriptionData {
  plan_type: string;
  status: string;
  started_at: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  external_subscription_id: string | null;
}

const STATUS_CONFIG: Record<
  PlanStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  trialing: { label: "Teste grátis", variant: "secondary", className: "bg-primary/10 text-primary border-primary/20" },
  active: { label: "Ativo", variant: "default", className: "bg-success/10 text-success border-success/20" },
  expired: { label: "Expirado", variant: "destructive", className: "bg-destructive/10 text-destructive border-destructive/20" },
  canceled: { label: "Cancelado", variant: "outline", className: "bg-muted text-muted-foreground border-muted" },
};

function getPlanName(planModules: string): string {
  switch (planModules) {
    case "FILA": return "Plano Fila";
    case "RESERVA": return "Plano Reservas";
    case "FILA_RESERVA": return "Plano Completo";
    default: return "Plano MesaClik";
  }
}

function getTrialProgress(startedAt: string, trialEndsAt: string | null) {
  const start = new Date(startedAt);
  const end = trialEndsAt ? new Date(trialEndsAt) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = now.getTime() - start.getTime();
  const totalDays = Math.round(totalMs / (24 * 60 * 60 * 1000));

  const daysUsed = Math.max(0, Math.min(totalDays, Math.floor(elapsedMs / (24 * 60 * 60 * 1000))));
  const daysLeft = Math.max(0, totalDays - daysUsed);
  const progressPercent = totalDays > 0 ? Math.min(100, (daysUsed / totalDays) * 100) : 0;

  return { daysUsed, daysLeft, totalDays, progressPercent, endDate: end };
}

function resolveStatus(sub: SubscriptionData | null): PlanStatus {
  if (!sub) return "expired";
  const s = sub.status.toLowerCase();
  if (s === "trialing" || sub.plan_type === "trial") {
    const end = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
    if (end && new Date() > end) return "expired";
    return "trialing";
  }
  if (s === "canceled") return "canceled";
  if (s === "active") return "active";
  return "expired";
}

export function PlanSettings() {
  const { restaurantId } = useRestaurant();
  const { planModules } = useModules();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }

    const fetch = async () => {
      const { data } = await (supabase as any)
        .schema("public")
        .from("subscriptions")
        .select("plan_type, status, started_at, trial_ends_at, current_period_end, external_subscription_id")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubscription(data ?? null);
      setLoading(false);
    };
    fetch();
  }, [restaurantId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const status = resolveStatus(subscription);
  const statusCfg = STATUS_CONFIG[status];
  const modules = planModules || "FILA_RESERVA";
  const planName = getPlanName(modules);

  const trial =
    subscription && (status === "trialing" || status === "expired")
      ? getTrialProgress(subscription.started_at, subscription.trial_ends_at)
      : null;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Plano & Pagamento</CardTitle>
                <CardDescription>Gerencie sua assinatura e método de pagamento</CardDescription>
              </div>
            </div>
            <Badge variant={statusCfg.variant} className={statusCfg.className}>
              {statusCfg.label}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* TRIAL Card */}
      {status === "trialing" && trial && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Você está no teste grátis</h3>
            </div>

            <Progress value={trial.progressPercent} className="h-3" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{trial.daysUsed}</span>/{trial.totalDays} dias usados
              </span>
              <span className="text-muted-foreground">
                Faltam <span className="font-semibold text-primary">{trial.daysLeft} dias</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Termina em{" "}
                <span className="font-medium text-foreground">
                  {format(trial.endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </span>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={() => window.open("https://mesaclik.com.br/#planos", "_blank")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Escolher plano
              </Button>
              <Button variant="outline" className="flex-1">
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar com suporte
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EXPIRED Card */}
      {status === "expired" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold text-foreground">Seu teste grátis terminou</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Para continuar usando o MesaClik, escolha um dos planos disponíveis.
            </p>
            {trial && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Expirou em{" "}
                  <span className="font-medium text-foreground">
                    {format(trial.endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </span>
              </div>
            )}
            <Button className="w-full" onClick={() => window.open("https://mesaclik.com.br/#planos", "_blank")}>
              <Sparkles className="h-4 w-4 mr-2" />
              Escolher plano
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CANCELED Card */}
      {status === "canceled" && (
        <Card className="border-muted">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Assinatura cancelada</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua assinatura foi cancelada. Reative para voltar a usar todas as funcionalidades.
            </p>
            {subscription?.current_period_end && (
              <p className="text-sm text-muted-foreground">
                Acesso até{" "}
                <span className="font-medium text-foreground">
                  {format(new Date(subscription.current_period_end), "dd/MM/yyyy")}
                </span>
              </p>
            )}
            <Button className="w-full" variant="outline">
              Reativar assinatura
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ACTIVE plan details */}
      {status === "active" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{planName}</h3>
                <p className="text-sm text-muted-foreground">
                  Ativo desde{" "}
                  {subscription?.started_at
                    ? format(new Date(subscription.started_at), "dd/MM/yyyy")
                    : "—"}
                </p>
              </div>
              <Badge className="bg-success/10 text-success border-success/20" variant="outline">
                Ativo
              </Badge>
            </div>

            {subscription?.current_period_end && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Próxima renovação</span>
                  <span className="font-medium">
                    {format(new Date(subscription.current_period_end), "dd/MM/yyyy")}
                  </span>
                </div>
              </>
            )}

            <Button variant="outline" className="w-full">
              Alterar plano
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modules Card — always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos do seu plano</CardTitle>
          <CardDescription>Funcionalidades incluídas na sua assinatura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ModuleRow
            label="Fila Virtual"
            description="Gerencie a espera dos clientes com fila digital"
            active={modules === "FILA" || modules === "FILA_RESERVA"}
          />
          <ModuleRow
            label="Reservas"
            description="Aceite e gerencie reservas online"
            active={modules === "RESERVA" || modules === "FILA_RESERVA"}
          />
        </CardContent>
      </Card>

      {/* Stripe placeholder */}
      {!subscription?.external_subscription_id && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <CreditCard className="h-5 w-5" />
              <div>
                <p className="font-medium text-foreground">Pagamento online</p>
                <p className="text-sm">
                  Integração com pagamento estará disponível em breve. Seu teste funciona normalmente sem ela.
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0">Em breve</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ModuleRow({
  label,
  description,
  active,
}: {
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
      {active ? (
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge
        variant="outline"
        className={
          active
            ? "bg-success/10 text-success border-success/20"
            : "bg-muted text-muted-foreground border-muted"
        }
      >
        {active ? "Ativo" : "Inativo"}
      </Badge>
    </div>
  );
}

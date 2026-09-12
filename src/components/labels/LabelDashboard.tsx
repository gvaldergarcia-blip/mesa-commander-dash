import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OperationalView } from "@/lib/labels/operationalDashboard";

interface Props {
  restaurantName: string;
  userName: string;
  counts: Record<OperationalView, number>;
  onOpen: (view: OperationalView) => void;
}

const CARDS = [
  {
    key: "expired",
    label: "Itens vencidos",
    action: "Ver agora",
    icon: AlertTriangle,
    tone: "border-destructive/35 bg-destructive/[0.07] hover:border-destructive/65",
    iconTone: "bg-destructive/15 text-destructive",
    valueTone: "text-destructive",
  },
  {
    key: "tomorrow",
    label: "Vencem amanhã",
    action: "Ver produtos",
    icon: CalendarClock,
    tone: "border-warning/35 bg-warning/[0.07] hover:border-warning/65",
    iconTone: "bg-warning/15 text-warning",
    valueTone: "text-warning",
  },
  {
    key: "renewal",
    label: "Precisam de renovação",
    action: "Ver para renovar",
    icon: RefreshCw,
    tone: "border-primary/35 bg-primary/[0.07] hover:border-primary/65",
    iconTone: "bg-primary/15 text-primary",
    valueTone: "text-primary",
  },
  {
    key: "ok",
    label: "Tudo certo",
    action: "Produtos OK",
    icon: CheckCircle2,
    tone: "border-success/35 bg-success/[0.07] hover:border-success/65",
    iconTone: "bg-success/15 text-success",
    valueTone: "text-success",
  },
] as const;

export function LabelDashboard({ restaurantName, userName, counts, onOpen }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-2 md:py-6">
      <header className="border-b border-border/60 pb-6 md:pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">{restaurantName}</p>
            <h1 className="text-3xl font-bold text-foreground md:text-5xl">
              {greeting}, {userName}!
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Veja o que precisa da sua atenção hoje.
            </p>
          </div>
          <time className="shrink-0 text-sm font-medium text-muted-foreground" dateTime={format(new Date(), "yyyy-MM-dd")}>
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </time>
        </div>
      </header>

      <section aria-label="Situação operacional" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Button
              key={card.key}
              type="button"
              variant="outline"
              onClick={() => onOpen(card.key)}
              className={cn(
                "group h-auto min-h-52 w-full items-stretch justify-start rounded-lg p-0 text-left shadow-sm transition-colors",
                card.tone,
              )}
            >
              <span className="flex w-full flex-col p-6 md:p-8">
                <span className="flex items-start justify-between gap-4">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", card.iconTone)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                </span>
                <span className={cn("mt-7 text-5xl font-bold leading-none tabular-nums md:text-6xl", card.valueTone)}>
                  {counts[card.key]}
                </span>
                <span className="mt-3 text-lg font-semibold text-foreground">{card.label}</span>
                <span className="mt-2 text-sm font-medium text-muted-foreground group-hover:text-foreground">
                  {card.action} <span aria-hidden="true">→</span>
                </span>
              </span>
            </Button>
          );
        })}
      </section>
    </div>
  );
}
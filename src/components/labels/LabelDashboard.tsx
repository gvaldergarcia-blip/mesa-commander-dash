import { memo } from "react";
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

export const LabelDashboard = memo(function LabelDashboard({ restaurantName, userName, counts, onOpen }: Props) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 py-0 md:space-y-6 md:py-4">
      <header className="border-b border-border/60 pb-2.5 md:pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 truncate text-xs font-semibold uppercase text-primary md:mb-1.5 md:text-sm">{restaurantName}</p>
            <h1 className="text-xl font-bold leading-tight text-foreground md:text-4xl">
              {greeting}, {userName}!
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground md:mt-2 md:text-base">
              Veja o que precisa da sua atenção hoje.
            </p>
          </div>
          <time className="shrink-0 text-xs font-semibold text-muted-foreground md:text-sm" dateTime={format(now, "yyyy-MM-dd")}>
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </time>
        </div>
      </header>

      <section aria-label="Situação operacional" className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Button
              key={card.key}
              type="button"
              variant="outline"
              onClick={() => onOpen(card.key)}
              className={cn(
                "group h-auto min-h-32 w-full min-w-0 items-stretch justify-start overflow-hidden rounded-lg p-0 text-left shadow-sm transition-colors motion-reduce:transition-none md:min-h-52",
                card.tone,
              )}
            >
              <span className="flex w-full min-w-0 flex-1 flex-col p-2.5 md:p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md md:h-10 md:w-10 md:rounded-lg", card.iconTone)}>
                    <Icon className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none" aria-hidden="true" />
                </span>
                <span className={cn("mt-2 text-3xl font-black leading-none tabular-nums md:mt-4 md:text-5xl", card.valueTone)}>
                  {counts[card.key]}
                </span>
                <span className="mt-1.5 min-h-8 whitespace-normal text-xs font-bold leading-tight text-foreground md:mt-2 md:min-h-10 md:text-base">{card.label}</span>
                <span className="mt-auto hidden whitespace-normal pt-2 text-xs font-semibold leading-tight text-muted-foreground group-hover:text-foreground md:block md:pt-3 md:text-sm">
                  {card.action} <span aria-hidden="true">→</span>
                </span>
              </span>
            </Button>
          );
        })}
      </section>
    </div>
  );
});

LabelDashboard.displayName = "LabelDashboard";
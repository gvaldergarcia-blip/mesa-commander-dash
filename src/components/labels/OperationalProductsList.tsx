import { useState } from "react";
import { ArrowLeft, CalendarDays, Loader2, MapPin, PackageCheck, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { Label, DischargeReason } from "@/hooks/useLabels";
import type { OperationalView } from "@/lib/labels/operationalDashboard";
import { ScanLabelQrDialog } from "./ScanLabelQrDialog";

interface Props {
  view: Exclude<OperationalView, "renewal">;
  labels: Label[];
  resolveOriginal: (label: Label) => Date | null;
  onBack: () => void;
  onDischarge: (input: { ids: string[]; reason: DischargeReason }) => Promise<void>;
}

const TITLES = {
  expired: { title: "Itens vencidos", description: "Produtos cuja validade original do fabricante foi atingida." },
  tomorrow: { title: "Vencem amanhã", description: "Produtos ordenados pela validade original mais próxima." },
  ok: { title: "Tudo certo", description: "Produtos ativos sem vencimento próximo ou renovação pendente." },
} as const;

export function OperationalProductsList({ view, labels, resolveOriginal, onBack, onDischarge }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanLabel, setScanLabel] = useState<Label | null>(null);
  const copy = TITLES[view];

  const discharge = async (label: Label) => {
    setBusyId(label.id);
    try {
      await onDischarge({ ids: [label.id], reason: "vencimento" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-2 md:py-6">
      <header className="flex items-start gap-3 border-b border-border/60 pb-5">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Voltar ao dashboard" className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
      </header>

      {labels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum produto nesta situação.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {labels.map((label) => {
            const original = resolveOriginal(label);
            const responsible = label.employee_name || label.responsible || "Não informado";
            return (
              <article key={label.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-card-foreground">{label.product_name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Lote {label.batch || "não informado"}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {label.units_remaining} un.
                  </span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Validade original</dt>
                    <dd className="mt-1 font-semibold text-foreground">{original ? format(original, "dd/MM/yyyy", { locale: ptBR }) : "Não informada"}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Local</dt>
                    <dd className="mt-1 font-semibold text-foreground">{label.storage_location || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3.5 w-3.5" />Responsável</dt>
                    <dd className="mt-1 truncate font-semibold text-foreground">{responsible}</dd>
                  </div>
                </dl>
                {view === "expired" && (
                  <Button
                    className="mt-5 w-full gap-2 sm:w-auto"
                    variant="destructive"
                    disabled={busyId === label.id}
                    onClick={() => discharge(label)}
                  >
                    {busyId === label.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                    Dar baixa
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
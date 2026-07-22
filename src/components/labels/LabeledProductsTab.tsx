import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Loader2, Tag, Printer, ChevronDown, Truck, Calendar, Package as PackageIcon,
  PackageMinus, Trash2, Clock, Utensils, HelpCircle, AlertTriangle, ClipboardCheck, MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useLabeledProducts, type LabeledProduct } from "@/hooks/useLabeledProducts";
import { useLabels, type DischargeReason } from "@/hooks/useLabels";
import { useStockStatus } from "@/hooks/useStockStatus";
import { getSectorHex, mergeSectors, NO_SECTOR_HEX } from "@/lib/labels/sectors";
import { withAlpha } from "@/lib/labels/categories";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS_STYLES: Record<LabeledProduct["status"], { label: string; bg: string; fg: string }> = {
  ok:       { label: "OK",       bg: "#1C4532", fg: "#68D391" },
  warning:  { label: "ATENÇÃO",  bg: "#744210", fg: "#F6AD55" },
  critical: { label: "CRÍTICO",  bg: "#742A2A", fg: "#FC8181" },
  expired:  { label: "VENCIDO",  bg: "#3B0D0D", fg: "#FEB2B2" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function fromNow(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

interface Props {
  onPrintProduct?: (productId: string) => void;
}

export function LabeledProductsTab({ onPrintProduct }: Props) {
  const { items, isLoading } = useLabeledProducts();
  const { dischargeBulk } = useLabels();
  const { statusMap } = useStockStatus();
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dischargeTarget, setDischargeTarget] = useState<LabeledProduct | null>(null);
  const [isDischarging, setIsDischarging] = useState(false);

  const REASONS: { value: DischargeReason; label: string; icon: any; hint: string }[] = [
    { value: "vencimento", label: "Vencimento", icon: Clock, hint: "Produto passou da validade" },
    { value: "descarte", label: "Descarte", icon: Trash2, hint: "Produto perdido ou danificado" },
    { value: "consumo", label: "Consumo", icon: Utensils, hint: "Produto foi todo consumido" },
    { value: "outro", label: "Outro", icon: HelpCircle, hint: "Outro motivo" },
  ];

  const runDischarge = async (reason: DischargeReason) => {
    if (!dischargeTarget) return;
    const ids = dischargeTarget.active_label_ids;
    if (!ids.length) {
      toast.info("Nenhuma etiqueta ativa para baixar.");
      setDischargeTarget(null);
      return;
    }
    try {
      setIsDischarging(true);
      await dischargeBulk({ ids, reason });
      setDischargeTarget(null);
    } finally {
      setIsDischarging(false);
    }
  };

  // Regra: a tela Produtos representa apenas produtos ATIVOS na operação.
  // Exclui automaticamente quem:
  //   - não possui nenhuma etiqueta ativa (todas baixadas/vencidas), ou
  //   - foi marcado como "Precisa repor" (falta) na Conferência Operacional.
  const activeItems = useMemo(
    () =>
      items.filter((it) => {
        if (it.active_labels_count <= 0) return false;
        if (it.product_id) {
          const st = statusMap.get(it.product_id);
          if (st?.status === "falta") return false;
        }
        return true;
      }),
    [items, statusMap],
  );

  const sectors = useMemo(
    () => mergeSectors(activeItems.map((i) => i.sector)),
    [activeItems]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeItems.filter((it) => {
      if (sectorFilter === "__none__" && it.sector) return false;
      if (sectorFilter !== "all" && sectorFilter !== "__none__" && it.sector !== sectorFilter) return false;
      if (term && !it.product_name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [activeItems, sectorFilter, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Produtos Etiquetados</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Cada produto aparece aqui automaticamente quando sua primeira etiqueta é impressa através do recebimento.
            Sem cadastro manual.
          </p>
          <p className="text-[11px] text-primary uppercase tracking-widest font-bold mt-1">
            {filtered.length} de {activeItems.length} {activeItems.length === 1 ? "produto ativo" : "produtos ativos"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background border-input placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {[
            { value: "all", label: "Todos" },
            ...sectors.map((s) => ({ value: s, label: s })),
            { value: "__none__", label: "Sem setor" },
          ].map((opt) => {
            const active = sectorFilter === opt.value;
            let activeStyle: React.CSSProperties | undefined;
            if (active) {
              if (opt.value === "all") {
                activeStyle = {
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  borderColor: "transparent",
                };
              } else {
                const hex = opt.value === "__none__" ? NO_SECTOR_HEX : getSectorHex(opt.value);
                activeStyle = {
                  backgroundColor: withAlpha(hex, 0.2),
                  borderColor: hex,
                  color: hex,
                };
              }
            }
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSectorFilter(opt.value)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
                  !active && "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                )}
                style={activeStyle}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground/80">Nenhum produto etiquetado ainda</p>
          <p className="text-xs mt-1">
            Os produtos aparecem aqui automaticamente após a primeira etiqueta impressa no Recebimento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it) => {
            const hex = getSectorHex(it.sector);
            const st = STATUS_STYLES[it.status];
            const key = it.product_id ?? `name:${it.product_name}`;
            const isOpen = expanded === key;
            return (
              <div
                key={key}
                className="group relative p-5 rounded-2xl border border-border bg-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)] overflow-hidden"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${withAlpha(hex, 0.12)} 0%, transparent 60%)`,
                  boxShadow: `0 8px 32px -16px ${withAlpha(hex, 0.4)}`,
                }}
              >
                <span
                  className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${hex} 0%, ${withAlpha(hex, 0.25)} 100%)`,
                    boxShadow: `0 0 14px ${withAlpha(hex, 0.7)}`,
                  }}
                />
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold truncate flex-1 text-foreground tracking-tight">
                      {it.product_name}
                    </h3>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border border-border shrink-0"
                      style={{ backgroundColor: st.bg, color: st.fg }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border w-fit max-w-full"
                    style={{
                      backgroundColor: withAlpha(hex, 0.14),
                      borderColor: withAlpha(hex, 0.4),
                      color: hex,
                    }}
                    title="Local atual do produto"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wide truncate">
                      {it.sector || "Sem local"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    <span className="truncate">{it.last_supplier || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Val.: <span className="font-semibold text-foreground">{formatDate(it.last_expiry)}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    <span title={it.last_label_at ? new Date(it.last_label_at).toLocaleString("pt-BR") : ""}>
                      Impr.: <span className="font-semibold text-foreground">{fromNow(it.last_label_at)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    <span>
                      <span className="font-semibold text-foreground">{it.active_labels_count}</span> ativa{it.active_labels_count === 1 ? "" : "s"}
                      {it.discharged_labels_count > 0 && (
                        <span className="text-muted-foreground/70"> · {it.discharged_labels_count} baixadas</span>
                      )}
                    </span>
                  </div>
                  {(() => {
                    const st = it.product_id ? statusMap.get(it.product_id) : undefined;
                    if (!st) return null;
                    const tone =
                      st.status === "falta" ? "text-rose-500" :
                      st.status === "atencao" ? "text-amber-500" : "text-emerald-500";
                    const label =
                      st.status === "falta" ? "Precisa repor" :
                      st.status === "atencao" ? "Atenção" : "Suficiente";
                    return (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <ClipboardCheck className={cn("h-3.5 w-3.5", tone)} />
                        <span>
                          Conf.: <span className={cn("font-semibold", tone)}>{label}</span>
                          <span className="text-muted-foreground/70"> · {fromNow(st.marked_at)}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-2 pt-3 mt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : key)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-medium text-foreground/80 transition-all hover:bg-muted"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                    Histórico
                  </button>
                  {it.active_labels_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setDischargeTarget(it)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-destructive border border-border bg-muted/40 hover:bg-destructive/10 hover:border-destructive/40 transition-all text-xs font-medium"
                    >
                      <PackageMinus className="h-3.5 w-3.5" /> Baixa
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 max-h-56 overflow-y-auto">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pb-1">
                      <span>{it.active_labels_count} ativa{it.active_labels_count === 1 ? "" : "s"}</span>
                      <span>{it.discharged_labels_count} baixada{it.discharged_labels_count === 1 ? "" : "s"}</span>
                      {it.last_discharge_at && (
                        <span className="italic">Última baixa: {formatDate(it.last_discharge_at)} · {it.last_discharge_reason || "—"}</span>
                      )}
                    </div>
                    {it.receipts.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        Nenhum recebimento registrado — este produto foi etiquetado manualmente.
                      </p>
                    ) : (
                      it.receipts.map((r) => (
                        <div key={r.receipt_id + r.received_at} className="rounded-lg border border-border bg-background/40 p-2.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{formatDate(r.received_at)}</span>
                            <span className="text-muted-foreground">{r.supplier_name || "Sem fornecedor"}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-muted-foreground">
                            <span>{r.quantity} {r.unit || ""}</span>
                            <span>{r.labels_prepared} etiq.</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!dischargeTarget} onOpenChange={(o) => !o && setDischargeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageMinus className="h-5 w-5 text-destructive" />
              Dar baixa em produto
            </DialogTitle>
            <DialogDescription>
              {dischargeTarget && (
                <>
                  Todas as <b>{dischargeTarget.active_labels_count}</b> etiqueta
                  {dischargeTarget.active_labels_count === 1 ? "" : "s"} ativa
                  {dischargeTarget.active_labels_count === 1 ? "" : "s"} de <b>{dischargeTarget.product_name}</b> serão
                  baixadas. O histórico é preservado.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-2">
            {REASONS.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.value}
                  type="button"
                  disabled={isDischarging}
                  onClick={() => runDischarge(r.value)}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-card hover:border-destructive/50 hover:bg-destructive/5 transition-all text-left disabled:opacity-50"
                >
                  <Icon className="h-4 w-4 text-destructive" />
                  <span className="font-semibold text-sm">{r.label}</span>
                  <span className="text-[11px] text-muted-foreground">{r.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground p-2 rounded-lg bg-muted/40 border border-border">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Esta ação não remove o produto do histórico — ele passa a integrar a lista de baixas.</span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDischargeTarget(null)} disabled={isDischarging}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
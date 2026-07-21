import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackagePlus, Sparkles, CheckCircle2, AlertCircle, ChevronRight, Loader2, X, BookOpen } from "lucide-react";
import { useReceipts } from "@/hooks/useReceipts";
import { NewReceiptDialog } from "./NewReceiptDialog";
import { PendingItemDialog } from "./PendingItemDialog";
import { PendingItemsPanel } from "./PendingItemsPanel";
import { OperationalDiary } from "./OperationalDiary";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function ReceivingTab() {
  const { receipts, isLoading, confirmReceipt, isConfirming, cancelReceipt } = useReceipts();
  const [newOpen, setNewOpen] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<any>(null);

  const activeReceipt = useMemo(
    () => receipts.find((r) => r.id === activeReceiptId) ?? null,
    [receipts, activeReceiptId]
  );

  const openReceipts = receipts.filter((r) => r.status !== "confirmed" && r.status !== "canceled");
  const recentConfirmed = receipts.filter((r) => r.status === "confirmed").slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero action */}
      <Card className="p-4 md:p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold">Recebimento inteligente</h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Registre o que chegou. O sistema reconhece produtos, aprende sozinho e gera as etiquetas.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => setNewOpen(true)} className="gap-2 shadow-lg shadow-primary/20 w-full md:w-auto">
            <PackagePlus className="h-5 w-5" /> Novo recebimento
          </Button>
        </div>
      </Card>

      {/* Active receipts */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : openReceipts.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3">
            {openReceipts.map((r) => {
              const items = r.items || [];
              const pending = items.filter((i) => i.needs_info).length;
              const ready = items.length - pending;
              return (
                <Card
                  key={r.id}
                  className={cn(
                    "p-4 cursor-pointer hover:border-primary/40 transition-colors",
                    activeReceiptId === r.id && "border-primary/60"
                  )}
                  onClick={() => setActiveReceiptId(r.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.supplier?.name || "Sem fornecedor"}</span>
                        {r.reference && <span className="text-xs text-muted-foreground">· {r.reference}</span>}
                        {r.status === "pending_info" ? (
                          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
                            <AlertCircle className="h-3 w-3" /> A completar
                          </Badge>
                        ) : r.status === "ready_to_print" ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="h-3 w-3" /> Pronto</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {items.length} item(ns) · {ready} pronto(s) · {pending} a completar · {formatDistanceToNow(new Date(r.received_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active receipt detail */}
      {activeReceipt && (
        <Card className="p-4 md:p-5 border-primary/30">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="font-bold">Detalhe do recebimento</h3>
              <p className="text-xs text-muted-foreground">{activeReceipt.supplier?.name || "Sem fornecedor"} · {activeReceipt.items?.length ?? 0} itens</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setActiveReceiptId(null)}><X className="h-4 w-4" /></Button>
          </div>

          {(() => {
            const items = activeReceipt.items || [];
            const ready = items.filter((i) => !i.needs_info);
            const pending = items.filter((i) => i.needs_info);
            return (
              <div className="space-y-4">
                {ready.length > 0 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                      <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                      {ready.length} item(ns) reconhecido(s) automaticamente
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ready.map((it) => (
                        <span key={it.id} className="text-[11px] px-2 py-0.5 rounded bg-background border">
                          {it.raw_name} · {Number(it.quantity)} {it.unit || ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {pending.length > 0 ? (
                  <PendingItemsPanel
                    receiptId={activeReceipt.id}
                    supplierId={activeReceipt.supplier_id}
                    pendingItems={pending.map((p) => ({ id: p.id, raw_name: p.raw_name }))}
                    onDone={() => setActiveReceiptId(null)}
                  />
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => confirmReceipt(activeReceipt.id).then(() => setActiveReceiptId(null))}
                      disabled={isConfirming}
                      className="gap-2"
                    >
                      {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirmar recebimento e gerar etiquetas
                    </Button>
                    <Button variant="outline" onClick={() => cancelReceipt(activeReceipt.id).then(() => setActiveReceiptId(null))}>
                      Descartar
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Recent confirmed */}
      {recentConfirmed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Últimos confirmados</h3>
          <div className="grid gap-2">
            {recentConfirmed.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-border/50 bg-muted/20 text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.supplier?.name || "Sem fornecedor"}</span>
                  <span className="text-muted-foreground ml-2">· {r.items?.length ?? 0} itens</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.received_at), { addSuffix: true, locale: ptBR })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diário operacional */}
      <div className="space-y-3 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Diário operacional</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Extrato automático dos acontecimentos da cozinha. Não precisa preencher — o sistema alimenta sozinho.</p>
        <OperationalDiary />
      </div>

      <NewReceiptDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => setActiveReceiptId(id)}
      />
      <PendingItemDialog
        open={!!pendingItem}
        onOpenChange={(v) => !v && setPendingItem(null)}
        item={pendingItem}
        supplierId={activeReceipt?.supplier_id}
        onDone={() => setPendingItem(null)}
      />
    </div>
  );
}
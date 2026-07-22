import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackagePlus, Sparkles, CheckCircle2, AlertCircle, ChevronDown, Loader2, BookOpen, History, Clock, Printer, Truck, Flag } from "lucide-react";
import { useReceipts } from "@/hooks/useReceipts";
import { NewReceiptDialog } from "./NewReceiptDialog";
import { PendingItemsPanel } from "./PendingItemsPanel";
import { OperationalDiary } from "./OperationalDiary";
import { useDiaryHistory } from "@/hooks/useDiaryReceipts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function ReceivingTab() {
  const { receipts, isLoading, cancelReceipt, finalizeReceipt, isFinalizing } = useReceipts();
  const [newOpen, setNewOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  const openReceipts = receipts.filter((r) => r.status !== "confirmed" && r.status !== "canceled");
  const { data: history = [] } = useDiaryHistory(30);
  const [showHistory, setShowHistory] = useState(false);

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
                Registre a lista do fornecedor. Depois envie fotos das etiquetas para o sistema casar item por item.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => setNewOpen(true)} className="gap-2 shadow-lg shadow-primary/20 w-full md:w-auto">
            <PackagePlus className="h-5 w-5" /> Novo recebimento
          </Button>
        </div>
      </Card>

      {/* Active receipts — cada fornecedor é um accordion (todo o conteúdo dele fica dentro do próprio card) */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : openReceipts.length > 0 && (
        <div className="grid gap-3">
          {openReceipts.map((r) => {
            const items = r.items || [];
            const prepared = items.filter((i) => Number(i.labels_prepared || 0) > 0).length;
            const pending = Math.max(0, items.length - prepared);
            const pendingItems = items.filter((i) => Number(i.labels_prepared || 0) === 0);
            const isOpen = expandedId === r.id;
            return (
              <Card
                key={r.id}
                className={cn(
                  "overflow-hidden transition-all",
                  isOpen ? "border-primary/50 shadow-lg" : "hover:border-primary/30"
                )}
              >
                {/* Header — clique alterna o accordion */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : r.id)}
                  className="w-full text-left p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{r.supplier?.name || "Sem fornecedor"}</span>
                      {r.reference && <Badge variant="outline" className="text-[10px] font-mono">NF {r.reference}</Badge>}
                      {r.status === "pending_info" ? (
                        <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 text-[10px]">
                          <AlertCircle className="h-3 w-3" /> A completar
                        </Badge>
                      ) : r.status === "ready_to_print" ? (
                        <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]"><CheckCircle2 className="h-3 w-3" /> Pronto</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {items.length} produto(s) · {prepared} com etiquetas · {pending} aguardando foto · {formatDistanceToNow(new Date(r.received_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
                </button>

                {/* Conteúdo do fornecedor — SEMPRE inline dentro do próprio card */}
                {isOpen && (
                  <div className="p-4 md:p-5 border-t border-border/60 bg-muted/10 space-y-4 animate-fade-in">
                    {pendingItems.length > 0 ? (
                      <PendingItemsPanel
                        receiptId={r.id}
                        supplierId={r.supplier_id}
                        pendingItems={pendingItems.map((p) => ({ id: p.id, raw_name: p.raw_name }))}
                      />
                    ) : (
                      <div className="flex items-start gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>Todos os itens já têm etiquetas geradas. Vá até <strong>Diário</strong> para imprimir, ou finalize o recebimento.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                      <Button
                        variant="default"
                        className="gap-2"
                        disabled={isFinalizing && finalizingId === r.id}
                        onClick={async () => {
                          if (!confirm("Finalizar este recebimento? Todos os produtos, pendências e etiquetas pendentes deste fornecedor sairão da área operacional e irão para o Histórico.")) return;
                          setFinalizingId(r.id);
                          try {
                            await finalizeReceipt(r.id);
                            setExpandedId(null);
                          } finally {
                            setFinalizingId(null);
                          }
                        }}
                      >
                        {isFinalizing && finalizingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                        Finalizar recebimento
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (!confirm("Descartar este recebimento?")) return;
                          await cancelReceipt(r.id);
                          setExpandedId(null);
                        }}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Diário operacional — recebimentos em andamento */}
      <div className="space-y-3 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Em andamento</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => setShowHistory((s) => !s)}
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Ocultar histórico" : `Histórico (${history.length})`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Cada recebimento fica aqui até todas as etiquetas serem impressas. Ao concluir, ele vai automaticamente para o histórico.
        </p>
        <OperationalDiary />
      </div>

      {/* Histórico */}
      {showHistory && (
        <div className="space-y-3 pt-4 border-t border-border/50 animate-fade-in">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Histórico</h3>
          </div>
          {history.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-xl">
              Nenhum recebimento concluído ainda.
            </div>
          ) : (
            <div className="grid gap-2">
              {history.map((r: any) => {
                const done = r.stats.total > 0 && r.stats.printed >= r.stats.total;
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border border-border/60 bg-muted/10 text-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.supplier?.name || "Sem fornecedor"}</span>
                        {r.reference && <span className="text-[11px] text-muted-foreground font-mono">NF {r.reference}</span>}
                        {done ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Concluído
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Printer className="h-3 w-3" /> {r.stats.printed}/{r.stats.total}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.stats.products} produto(s) · {r.stats.total} etiqueta(s)
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(r.received_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <NewReceiptDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => setExpandedId(id)}
      />
    </div>
  );
}
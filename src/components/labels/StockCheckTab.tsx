import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, PackageCheck, PackageX, ArrowLeft, Trash2, RotateCcw, History, Boxes, Clock,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useHiddenSectors } from '@/hooks/useHiddenSectors';
import { useStockBalance } from '@/hooks/useStockBalance';
import { useStockMovements } from '@/hooks/useStockMovements';
import { useLabeledProducts, type LabeledProduct } from '@/hooks/useLabeledProducts';
import { useLabelProducts } from '@/hooks/useLabelProducts';
import { getSectorHex, mergeSectors, NO_SECTOR_HEX } from '@/lib/labels/sectors';
import { withAlpha } from '@/lib/labels/categories';
import { formatBase, formatQty } from '@/lib/labels/stockUnits';
import { ENTRY_EVENTS } from '@/hooks/useStockBalance';
import { cn } from '@/lib/utils';

function sectorOf(p: LabeledProduct): string {
  return (p.sector || '').trim() || 'Sem setor';
}

const EVENT_LABEL: Record<string, string> = {
  receipt: 'Recebimento',
  transfer: 'Transferência',
  adjustment: 'Ajuste',
  production: 'Produção interna',
  discharge: 'Baixa por uso',
  waste: 'Perda / vencimento',
  consumption: 'Baixa por uso',
  loss: 'Perda / vencimento',
};

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  const sameDay = d.toDateString() === new Date().toDateString();
  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoje, ${hhmm}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hhmm}`;
}

/** Histórico de movimentações — rastreabilidade do saldo. */
function MovementHistory({ product, onClose }: { product: LabeledProduct | null; onClose: () => void }) {
  const { movements, isLoading } = useStockMovements(product?.product_id ?? null);
  const { balances } = useStockBalance();
  const bal = product?.product_id ? balances.get(product.product_id) : undefined;

  return (
    <Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="truncate">{product?.product_name}</SheetTitle>
          <SheetDescription>Histórico de movimentações do estoque digital.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 p-4 rounded-xl border border-border bg-card">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Saldo atual</div>
          <div className="text-3xl font-black tracking-tight">{bal ? bal.label : 'sem entrada'}</div>
          {bal && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Entrou {formatBase(bal.entered, bal.base)} · usado {formatBase(bal.exited, bal.base)}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
          ) : movements.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            movements.map((m) => {
              const entry = ENTRY_EVENTS.includes(m.event_type);
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/70 bg-card/60">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{EVENT_LABEL[m.event_type] ?? m.event_type}</div>
                    <div className="text-[11px] text-muted-foreground">{relTime(m.occurred_at)}</div>
                    {m.notes && <div className="text-[11px] text-muted-foreground truncate">{m.notes}</div>}
                  </div>
                  <div className={cn('text-sm font-bold shrink-0', entry ? 'text-emerald-500' : 'text-foreground')}>
                    {entry ? '+' : '−'}{formatQty(Number(m.quantity) || 0, m.unit)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface StockCheckTabProps {
  initialSector?: string | null;
}

export function StockCheckTab({ initialSector = null }: StockCheckTabProps = {}) {
  const { items, isLoading } = useLabeledProducts();
  const { products: registry } = useLabelProducts();
  const { balances } = useStockBalance();
  const { hidden, hideSector, restoreAll } = useHiddenSectors();
  const [sectorToDelete, setSectorToDelete] = useState<string | null>(null);
  const [historyProduct, setHistoryProduct] = useState<LabeledProduct | null>(null);

  const [selectedSector, setSelectedSector] = useState<string | null>(initialSector);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialSector) setSelectedSector(initialSector);
  }, [initialSector]);

  // Estoque = TODO produto cadastrado (ativo) + produtos com etiquetas ativas.
  const products = useMemo(() => {
    const labeled = items.filter((p) => p.product_id && p.active_non_expired_labels_count > 0);
    const seen = new Set(labeled.map((p) => p.product_id));
    const extras: LabeledProduct[] = registry
      .filter((r) => (r.status ?? 'active') === 'active' && !seen.has(r.id))
      .map((r) => ({
        product_id: r.id,
        product_name: r.name,
        sector: r.storage_location ?? null,
        category: r.category ?? null,
        status: 'ok',
        origin: r.origin === 'produced' ? 'internal' : 'received',
        labels_count: 0,
        active_labels_count: 0,
        active_non_expired_labels_count: 0,
        active_units: 0,
        active_units_non_expired: 0,
        discharged_labels_count: 0,
        active_label_ids: [],
        last_discharge_at: null,
        last_discharge_reason: null,
        receipts_count: 0,
        last_receipt_at: null,
        last_label_at: null,
        last_supplier: null,
        last_expiry: null,
        raw: r,
        receipts: [],
      }));
    return [...labeled, ...extras].sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [items, registry]);

  const sectors = useMemo(() => {
    const fromActive = products.map((p) => p.sector);
    const fromAll = [...items.map((p) => p.sector), ...registry.map((r) => r.storage_location ?? null)];
    const all = mergeSectors([...fromActive, ...fromAll]);
    const hasNone = products.some((p) => !p.sector);
    const full = hasNone ? [...all, 'Sem setor'] : all;
    const withProducts = new Set(products.map((p) => sectorOf(p)));
    return full.filter((s) => withProducts.has(s) || !hidden.includes(s));
  }, [products, items, registry, hidden]);

  const bySector = useMemo(() => {
    const map = new Map<string, LabeledProduct[]>();
    for (const p of products) {
      const key = sectorOf(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [products]);

  const emptyCount = products.filter((p) => p.product_id && (balances.get(p.product_id)?.value ?? 0) <= 0).length;
  const lastUpdate = useMemo(() => {
    let last: string | null = null;
    for (const b of balances.values()) {
      if (b.lastMovementAt && (!last || b.lastMovementAt > last)) last = b.lastMovementAt;
    }
    return last;
  }, [balances]);

  // ============= RESUMO DO TOPO =============
  const Summary = (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="p-4 rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <Boxes className="h-3.5 w-3.5 text-primary" /> Produtos
        </div>
        <div className="text-2xl font-black tracking-tight mt-1">{products.length}</div>
      </div>
      <div className="p-4 rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <PackageX className="h-3.5 w-3.5" /> Sem estoque
        </div>
        <div className={cn('text-2xl font-black tracking-tight mt-1', emptyCount > 0 && 'text-destructive')}>
          {emptyCount}
        </div>
      </div>
      <div className="p-4 rounded-2xl border border-border bg-card col-span-2 sm:col-span-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <Clock className="h-3.5 w-3.5" /> Última atualização
        </div>
        <div className="text-lg font-bold tracking-tight mt-1">{relTime(lastUpdate)}</div>
      </div>
    </div>
  );

  // ============= VISÃO 1: seleção de setor =============
  if (!selectedSector) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Estoque digital</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              O Recebimento diz quanto entrou. O QR Code diz quanto saiu. Aqui você vê quanto resta.
            </p>
          </div>
          {hidden.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={restoreAll}>
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar setores ({hidden.length})
            </Button>
          )}
        </div>

        {Summary}

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando…</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground">
            <p className="font-medium text-foreground/80">Nenhum produto cadastrado ainda</p>
            <p className="text-xs mt-1">
              Cadastre um produto em “Produtos” e ele aparece aqui automaticamente, no card do seu setor.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectors.map((s) => {
              const list = bySector.get(s) || [];
              const hex = s === 'Sem setor' ? NO_SECTOR_HEX : getSectorHex(s);
              return (
                <div
                  key={s}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSector(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSector(s);
                    }
                  }}
                  className="group relative cursor-pointer text-left p-5 rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${withAlpha(hex, 0.14)} 0%, transparent 70%)`,
                    boxShadow: `0 8px 24px -18px ${withAlpha(hex, 0.5)}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg text-foreground truncate">{s}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border"
                        style={{ backgroundColor: withAlpha(hex, 0.18), borderColor: withAlpha(hex, 0.5), color: hex }}
                      >
                        {list.length === 0
                          ? 'sem produtos'
                          : `${list.length} ${list.length === 1 ? 'produto' : 'produtos'}`}
                      </span>
                      <button
                        type="button"
                        aria-label={`Apagar card do setor ${s}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSectorToDelete(s);
                        }}
                        className="md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Setor sem itens no momento. Continua ativo para novos recebimentos.
                    </p>
                  ) : (
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                        <PackageCheck className="h-3.5 w-3.5 text-primary" />
                        {list.filter((p) => p.product_id && (balances.get(p.product_id)?.value ?? 0) > 0).length} com saldo
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <PackageX className="h-3.5 w-3.5" />
                        {list.filter((p) => p.product_id && (balances.get(p.product_id)?.value ?? 0) <= 0).length} sem estoque
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AlertDialog open={!!sectorToDelete} onOpenChange={(o) => !o && setSectorToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar card do setor?</AlertDialogTitle>
              <AlertDialogDescription>
                O card “{sectorToDelete}” deixa de aparecer no Estoque Digital. Nenhum produto, etiqueta ou
                histórico é apagado — os itens continuam em “Produtos”. Você pode trazer o card de volta a qualquer
                momento em “Restaurar setores”.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (sectorToDelete) hideSector(sectorToDelete);
                  setSectorToDelete(null);
                }}
              >
                Apagar card
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ============= VISÃO 2: saldo do setor =============
  const list = bySector.get(selectedSector) || [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? list.filter((p) => {
        const raw: any = p.raw || {};
        return [p.product_name, raw.brand, raw.supplier_name, p.last_supplier]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(term));
      })
    : list;
  const hex = selectedSector === 'Sem setor' ? NO_SECTOR_HEX : getSectorHex(selectedSector);
  const withStock = list.filter((p) => p.product_id && (balances.get(p.product_id)?.value ?? 0) > 0).length;
  const without = list.length - withStock;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedSector(null)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Setores
        </Button>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Setor</div>
          <h2 className="text-lg font-semibold" style={{ color: hex }}>{selectedSector}</h2>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto, marca ou fornecedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/30">
          <PackageCheck className="h-3.5 w-3.5" /> {withStock} com saldo
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border">
          <PackageX className="h-3.5 w-3.5" /> {without} sem estoque
        </span>
        <span className="text-muted-foreground">de {list.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground">
          Nenhum produto neste setor.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const bal = p.product_id ? balances.get(p.product_id) : undefined;
            const value = bal?.value ?? 0;
            const empty = value <= 0;
            return (
              <div
                key={p.product_id!}
                role="button"
                tabIndex={0}
                onClick={() => setHistoryProduct(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setHistoryProduct(p);
                  }
                }}
                className={cn(
                  'group cursor-pointer p-5 rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40',
                  empty ? 'border-border' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground truncate">
                    {p.product_name}
                  </h4>
                  <History className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Nível 2 — protagonismo absoluto do saldo */}
                <div
                  className={cn(
                    'mt-2 text-4xl font-black tracking-tight leading-none',
                    empty ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {bal ? bal.label : '—'}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Saldo atual
                </div>

                {/* Nível 3 — contexto */}
                <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                  {bal ? (
                    <>
                      Entrou <span className="text-foreground font-semibold">{formatBase(bal.entered, bal.base)}</span>
                      {' · '}
                      Usado <span className="text-foreground font-semibold">{formatBase(bal.exited, bal.base)}</span>
                    </>
                  ) : (
                    'Sem entrada registrada no Recebimento'
                  )}
                </div>

                {/* Nível 4 — última movimentação / estado */}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Última movimentação: {relTime(bal?.lastMovementAt ?? null)}
                  </span>
                  {empty && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
                      Sem estoque
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MovementHistory product={historyProduct} onClose={() => setHistoryProduct(null)} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Search, PackageCheck, PackageX, ArrowLeft, Scale, AlertTriangle } from 'lucide-react';
import { useStockStatus } from '@/hooks/useStockStatus';
import { useLabelEmployees } from '@/hooks/useLabelEmployees';
import { useLabeledProducts, type LabeledProduct } from '@/hooks/useLabeledProducts';
import { getSectorHex, mergeSectors, NO_SECTOR_HEX } from '@/lib/labels/sectors';
import { withAlpha } from '@/lib/labels/categories';
import { cn } from '@/lib/utils';

function isWeightProduct(p: LabeledProduct): boolean {
  const unit = (p.raw?.unit || '').toLowerCase().trim();
  return unit === 'g' || unit === 'kg' || unit === 'gr' || unit === 'grama' || unit === 'gramas';
}

function sectorOf(p: LabeledProduct): string {
  return (p.sector || '').trim() || 'Sem setor';
}

interface StockCheckTabProps {
  initialSector?: string | null;
}

export function StockCheckTab({ initialSector = null }: StockCheckTabProps = {}) {
  const { items, isLoading } = useLabeledProducts();
  const { statusMap, setStatus, isMutating } = useStockStatus();
  const { activeEmployees } = useLabelEmployees();

  const [selectedSector, setSelectedSector] = useState<string | null>(initialSector);
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialSector) setSelectedSector(initialSector);
  }, [initialSector]);

  // Só produtos com id e com etiquetas ativas (baixa por vencimento remove do estoque).
  const products = useMemo(
    () => items.filter((p) => p.product_id && p.active_labels_count > 0),
    [items],
  );

  const sectors = useMemo(() => {
    const all = mergeSectors(products.map((p) => p.sector));
    // garantimos "Sem setor" no fim se houver
    const hasNone = products.some((p) => !p.sector);
    return hasNone ? [...all, 'Sem setor'] : all;
  }, [products]);

  const bySector = useMemo(() => {
    const map = new Map<string, LabeledProduct[]>();
    for (const p of products) {
      const key = sectorOf(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [products]);

  const employee = activeEmployees.find((e) => e.id === employeeId);

  const mark = async (p: LabeledProduct, status: 'ok' | 'atencao' | 'falta') => {
    if (!p.product_id) return;
    const raw = weightDraft[p.product_id];
    const parsed = raw ? Number(raw.replace(',', '.')) : NaN;
    await setStatus({
      product_id: p.product_id,
      product_name: p.product_name,
      status,
      employee_id: employee?.id ?? null,
      employee_name: employee?.name ?? 'Equipe',
      weight_grams: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      sector: p.sector || null,
    });
  };

  // ============= VISÃO 1: seleção de setor =============
  if (!selectedSector) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Conferência operacional</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Escolha um setor para conferir. Você verá apenas os produtos daquele setor e responderá se cada um está
            suficiente ou precisa ser reposto.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando…</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground">
            <p className="font-medium text-foreground/80">Nenhum produto etiquetado ainda</p>
            <p className="text-xs mt-1">
              Um produto passa a aparecer aqui quando sua primeira etiqueta é impressa pelo Recebimento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectors.map((s) => {
              const list = bySector.get(s) || [];
              if (list.length === 0) return null;
              const missing = list.filter((p) => p.product_id && statusMap.get(p.product_id)!?.status === 'falta').length;
              const okCount = list.filter((p) => p.product_id && statusMap.get(p.product_id)!?.status === 'ok').length;
              const pending = list.length - missing - okCount;
              const hex = s === 'Sem setor' ? NO_SECTOR_HEX : getSectorHex(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSector(s)}
                  className="group text-left p-5 rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${withAlpha(hex, 0.14)} 0%, transparent 70%)`,
                    boxShadow: `0 8px 24px -18px ${withAlpha(hex, 0.5)}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg text-foreground truncate">{s}</h3>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border"
                      style={{ backgroundColor: withAlpha(hex, 0.18), borderColor: withAlpha(hex, 0.5), color: hex }}
                    >
                      {list.length} {list.length === 1 ? 'produto' : 'produtos'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-500">
                      <PackageCheck className="h-3.5 w-3.5" /> {okCount} ok
                    </span>
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <PackageX className="h-3.5 w-3.5" /> {missing} falta
                    </span>
                    {pending > 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        • {pending} pendente{pending === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============= VISÃO 2: conferência do setor =============
  const list = bySector.get(selectedSector) || [];
  const term = search.trim().toLowerCase();
  const filtered = term ? list.filter((p) => p.product_name.toLowerCase().includes(term)) : list;
  const okCount = list.filter((p) => p.product_id && statusMap.get(p.product_id)!?.status === 'ok').length;
  const missingCount = list.filter((p) => p.product_id && statusMap.get(p.product_id)!?.status === 'falta').length;
  const hex = selectedSector === 'Sem setor' ? NO_SECTOR_HEX : getSectorHex(selectedSector);

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

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
        >
          <option value="">Quem confere: Equipe</option>
          {activeEmployees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
          <PackageCheck className="h-3.5 w-3.5" /> {okCount} suficiente{okCount === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
          <PackageX className="h-3.5 w-3.5" /> {missingCount} precisa{missingCount === 1 ? '' : 'm'} repor
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
            const st = p.product_id ? statusMap.get(p.product_id) : undefined;
            const isMissing = st?.status === 'falta';
            const isOk = st?.status === 'ok';
            const isWarn = st?.status === 'atencao';
            const weight = isWeightProduct(p);
            const draftKey = p.product_id!;
            return (
              <div
                key={draftKey}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  isMissing
                    ? 'bg-destructive/5 border-destructive/40'
                    : isOk
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : isWarn
                        ? 'bg-amber-500/5 border-amber-500/40'
                        : 'bg-card border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">{p.product_name}</h4>
                    {st && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {st.marked_by_name || 'Equipe'} · {new Date(st.marked_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                        {st.weight_grams ? ` · ${st.weight_grams} g` : ''}
                      </p>
                    )}
                  </div>
                  {weight && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      <Scale className="h-3 w-3" /> Peso
                    </span>
                  )}
                </div>

                {weight && (
                  <div className="mb-3">
                    <Input
                      inputMode="decimal"
                      placeholder="Peso atual (g) — opcional"
                      value={weightDraft[draftKey] ?? (st?.weight_grams ? String(st.weight_grams) : '')}
                      onChange={(e) => setWeightDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={isOk ? 'default' : 'outline'}
                    className={cn('flex-1 gap-1.5 h-12', isOk && 'bg-emerald-600 hover:bg-emerald-700')}
                    disabled={isMutating}
                    onClick={() => mark(p, 'ok')}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Suficiente
                  </Button>
                  <Button
                    type="button"
                    variant={isWarn ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-1.5 h-12',
                      isWarn && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
                    )}
                    disabled={isMutating}
                    onClick={() => mark(p, 'atencao')}
                  >
                    <AlertTriangle className="h-4 w-4" /> Atenção
                  </Button>
                  <Button
                    type="button"
                    variant={isMissing ? 'destructive' : 'outline'}
                    className="flex-1 gap-1.5 h-12"
                    disabled={isMutating}
                    onClick={() => mark(p, 'falta')}
                  >
                    <XCircle className="h-4 w-4" /> Precisa repor
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
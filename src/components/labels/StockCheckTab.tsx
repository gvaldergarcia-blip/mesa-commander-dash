import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Search, PackageX, PackageCheck } from 'lucide-react';
import { useLabelProducts } from '@/hooks/useLabelProducts';
import { useStockStatus } from '@/hooks/useStockStatus';
import { useLabelEmployees } from '@/hooks/useLabelEmployees';
import { cn } from '@/lib/utils';

export function StockCheckTab() {
  const { products } = useLabelProducts();
  const { statusMap, setStatus, isMutating } = useStockStatus();
  const { activeEmployees } = useLabelEmployees();

  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState<string>('');

  const activeProducts = useMemo(
    () => products.filter((p) => p.status !== 'inactive'),
    [products],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeProducts;
    return activeProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [activeProducts, search]);

  const missingCount = useMemo(
    () => activeProducts.filter((p) => statusMap.get(p.id)?.status === 'falta').length,
    [activeProducts, statusMap],
  );

  const employee = activeEmployees.find((e) => e.id === employeeId);

  const mark = async (productId: string, productName: string, status: 'ok' | 'falta') => {
    await setStatus({
      product_id: productId,
      product_name: productName,
      status,
      employee_id: employee?.id ?? null,
      employee_name: employee?.name ?? 'Equipe',
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
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
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
            >
              <option value="">Sem funcionário</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1.5">
              <PackageCheck className="h-3.5 w-3.5" />
              {activeProducts.length - missingCount} Ok
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-destructive/40 text-destructive">
              <PackageX className="h-3.5 w-3.5" />
              {missingCount} em falta
            </Badge>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground">
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const st = statusMap.get(p.id);
            const isMissing = st?.status === 'falta';
            return (
              <div
                key={p.id}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  isMissing
                    ? 'bg-destructive/5 border-destructive/40'
                    : st?.status === 'ok'
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-card border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">{p.name}</h4>
                    {st && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {st.marked_by_name || 'Equipe'} · {new Date(st.marked_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  {p.category && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      {p.category}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={st?.status === 'ok' ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-1.5 h-12',
                      st?.status === 'ok' && 'bg-emerald-600 hover:bg-emerald-700',
                    )}
                    disabled={isMutating}
                    onClick={() => mark(p.id, p.name, 'ok')}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Ok
                  </Button>
                  <Button
                    type="button"
                    variant={isMissing ? 'destructive' : 'outline'}
                    className="flex-1 gap-1.5 h-12"
                    disabled={isMutating}
                    onClick={() => mark(p.id, p.name, 'falta')}
                  >
                    <XCircle className="h-4 w-4" /> Falta
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
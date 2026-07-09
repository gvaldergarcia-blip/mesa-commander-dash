import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, CheckCircle2, Printer, PackageX } from 'lucide-react';
import { useLabelProducts } from '@/hooks/useLabelProducts';
import { useStockStatus } from '@/hooks/useStockStatus';
import { toast } from 'sonner';

interface ShoppingListTabProps {
  onPrintProduct?: (productId: string) => void;
}

export function ShoppingListTab({ onPrintProduct }: ShoppingListTabProps) {
  const { products } = useLabelProducts();
  const { missingProducts, setStatus, isMutating } = useStockStatus();

  const items = useMemo(() => {
    return missingProducts
      .map((s) => {
        const p = products.find((x) => x.id === s.product_id);
        if (!p) return null;
        return { status: s, product: p };
      })
      .filter((x): x is { status: typeof missingProducts[0]; product: typeof products[0] } => !!x)
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [missingProducts, products]);

  const markReceived = async (productId: string, productName: string) => {
    await setStatus({
      product_id: productId,
      product_name: productName,
      status: 'ok',
      employee_name: 'Recebimento',
    });
    toast.success(`${productName} marcado como recebido`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
              <ShoppingCart className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Lista de compras</h3>
              <p className="text-sm text-muted-foreground">
                Produtos marcados como falta pela equipe. Quando chegarem, marque como recebido e imprima a etiqueta.
              </p>
            </div>
            <Badge variant="outline" className="border-destructive/40 text-destructive gap-1.5 text-base py-1 px-3">
              <PackageX className="h-4 w-4" />
              {items.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-2xl">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
          <p className="font-medium">Nenhum produto em falta</p>
          <p className="text-sm text-muted-foreground">Sua equipe marcará no checklist quando algo acabar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(({ status, product }) => (
            <div
              key={product.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold truncate">{product.name}</h4>
                  {product.category && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {product.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Marcado por {status.marked_by_name || 'Equipe'} · {new Date(status.marked_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex gap-2">
                {onPrintProduct && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onPrintProduct(product.id)}
                  >
                    <Printer className="h-3.5 w-3.5" /> Etiqueta
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  disabled={isMutating}
                  onClick={() => markReceived(product.id, product.name)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Recebido
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
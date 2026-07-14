import { Sparkles, Printer, X, Loader2 } from "lucide-react";
import { useLabelReprintQueue } from "@/hooks/useLabelReprintQueue";
import { cn } from "@/lib/utils";

interface Props {
  onPrintProduct: (productId: string) => void;
  className?: string;
}

export function SmartReprintCard({ onPrintProduct, className }: Props) {
  const { items, isLoading, resolve } = useLabelReprintQueue();

  if (isLoading || items.length === 0) return null;

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 md:p-5 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm md:text-base leading-tight">
            Reimpressão sugerida
          </h3>
          <p className="text-xs text-muted-foreground">
            {items.length} produto(s) baixados recentemente — o sistema sugere reemitir.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.slice(0, 4).map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-2 rounded-lg bg-background/60 border border-border/60 p-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {it.product?.name || "Produto"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Validade padrão: {it.product?.validity_days ?? "?"} dias
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onPrintProduct(it.label_product_id);
                resolve({ id: it.id, status: "printed" });
              }}
              className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1.5 hover:opacity-90"
            >
              <Printer className="h-3.5 w-3.5" /> Reimprimir
            </button>
            <button
              type="button"
              onClick={() => resolve({ id: it.id, status: "dismissed" })}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
              title="Dispensar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {items.length > 4 && (
          <p className="text-[11px] text-muted-foreground pl-1">
            + {items.length - 4} outras sugestões
          </p>
        )}
      </div>
    </div>
  );
}
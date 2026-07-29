import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Pencil, Trash2, Loader2, Printer } from "lucide-react";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import { ProductFormDialog } from "./ProductFormDialog";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";

/** Cadastro permanente de produtos — feito uma única vez pelo gestor. */
export function ProductRegistryTab({ onPrintProduct }: { onPrintProduct?: (id: string) => void }) {
  const { products, isLoading, createProduct, updateProduct, deleteProduct, isMutating } = useLabelProducts();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabelProduct | null>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return products;
    return products.filter((p) =>
      [p.name, p.brand, p.supplier_name, p.category, p.storage_location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [products, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Cadastro de produtos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre uma vez. A operação diária informa apenas lote, validade original e quantidade.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, marca, fornecedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl text-muted-foreground text-sm">
          Nenhum produto cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4 bg-card/40 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.brand, p.supplier_name].filter(Boolean).join(" · ") || "Sem marca/fornecedor"}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {(p.status ?? "active") === "active" ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                {CONSERVATION_LABEL[(p.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL]}
                {p.storage_location ? ` · ${p.storage_location}` : ""}
                {p.sif ? ` · ${p.inspection_type === "SISP" ? "SISP" : p.inspection_type === "IMPORTADO" ? "REG." : "SIF"} ${p.sif}` : ""}
                <br />
                {p.manipulation_enabled && p.manipulation_validity_value
                  ? `Após abertura: ${p.manipulation_validity_value} ${
                      p.manipulation_validity_unit === "hours" ? "hora(s)" : p.manipulation_validity_unit === "months" ? "mês(es)" : "dia(s)"
                    }`
                  : `Validade: ${p.validity_days} dia(s)`}
              </div>
              <div className="flex gap-2 pt-1">
                {onPrintProduct && (
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => onPrintProduct(p.id)}>
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Remover "${p.name}" do cadastro?`)) deleteProduct(p.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProductFormDialog
        open={open}
        onOpenChange={setOpen}
        product={editing}
        isSubmitting={isMutating}
        onSubmit={async (input) =>
          editing ? updateProduct({ id: editing.id, input }) : createProduct(input)
        }
      />
    </div>
  );
}
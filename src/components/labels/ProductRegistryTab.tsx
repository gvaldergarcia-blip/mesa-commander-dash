import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Pencil, Trash2, Loader2, Printer, Package, Snowflake } from "lucide-react";
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const conservation = CONSERVATION_LABEL[(p.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL];
            return (
              <Card key={p.id} className="p-4 bg-card/40">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold truncate">{p.name}</div>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        (p.status ?? "active") === "active"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {(p.status ?? "active") === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{p.brand || "Sem marca"}</div>
                    {p.category && (
                      <div className="text-xs text-muted-foreground truncate">
                        Categoria: <span className="text-sky-400">{p.category}</span>
                      </div>
                    )}
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/80">
                        <Snowflake className="h-3 w-3" /> {conservation}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="text-xs text-muted-foreground leading-snug">
                    {p.manipulation_enabled && p.manipulation_validity_value
                      ? <>Após abertura: {p.manipulation_validity_value} {p.manipulation_validity_unit === "hours" ? "hora(s)" : p.manipulation_validity_unit === "months" ? "mês(es)" : "dia(s)"}<br /></>
                      : <>Validade padrão: {p.validity_days} dia(s)<br /></>}
                    Unidade: {p.unit || "un"}
                    {p.storage_location ? <><br />Local: {p.storage_location}</> : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {onPrintProduct && (
                      <Button size="icon" variant="outline" className="hidden h-9 w-9 md:inline-flex" title="Imprimir etiqueta" onClick={() => onPrintProduct(p.id)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="outline" className="h-11 w-11 md:h-9 md:w-9" title="Editar" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 md:h-9 md:w-9"
                      title="Remover"
                      onClick={() => {
                        if (confirm(`Remover "${p.name}" do cadastro?`)) deleteProduct(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
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
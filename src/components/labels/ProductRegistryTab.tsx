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
  const [conservationFilter, setConservationFilter] = useState("all");

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const byConservation = conservationFilter === "all"
      ? products
      : conservationFilter === "produce"
        ? products.filter((p) => [p.category, p.name].filter(Boolean).join(" ").toLowerCase().includes("hortif"))
        : products.filter((p) => (p.conservation_method || "refrigerated") === conservationFilter);
    if (!s) return byConservation;
    return byConservation.filter((p) =>
      [p.name, p.brand, p.supplier_name, p.category, p.storage_location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [conservationFilter, products, search]);

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div>
          <h2 className="text-lg font-bold md:text-xl">Cadastro de produtos</h2>
          <p className="hidden text-sm text-muted-foreground md:block">
            Cadastre uma vez. A operação diária informa apenas lote, validade original e quantidade.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="h-10 w-full sm:h-11 sm:w-auto">
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
        {[["all", "Todos"], ["ambient", "Ambiente"], ["refrigerated", "Refrigerado"], ["frozen", "Congelado"], ["produce", "Hortifruti"]].map(([value, label]) => (
          <Button key={value} type="button" size="sm" variant={conservationFilter === value ? "default" : "outline"} onClick={() => setConservationFilter(value)} className="h-9 shrink-0 px-3">
            {label}
          </Button>
        ))}
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
        <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-md border border-border sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:border-0 xl:grid-cols-3">
          {filtered.map((p) => {
            const conservation = CONSERVATION_LABEL[(p.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL];
            return (
          <Card key={p.id} className="rounded-none border-x-0 border-t-0 bg-card/40 p-3 last:border-b-0 sm:rounded-lg sm:border sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/60 sm:h-14 sm:w-14 sm:rounded-xl">
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
                <div className="mt-2.5 flex items-end justify-between gap-2 sm:mt-3">
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
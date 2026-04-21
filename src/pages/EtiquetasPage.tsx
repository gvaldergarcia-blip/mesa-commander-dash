import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tag, Plus, Pencil, Trash2, Printer, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LabelProduct, useLabelProducts } from "@/hooks/useLabelProducts";
import { ProductFormDialog } from "@/components/labels/ProductFormDialog";
import { printLabels } from "@/components/labels/LabelPrintSheet";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function EtiquetasPage() {
  const { products, isLoading, createProduct, updateProduct, deleteProduct, isMutating } =
    useLabelProducts();
  const { restaurant } = useRestaurant();

  // ----- Tabs / state -----
  const [tab, setTab] = useState<"produtos" | "gerar">("produtos");

  // ----- Products tab -----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LabelProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabelProduct | null>(null);

  // ----- Generate tab -----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [responsible, setResponsible] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [now, setNow] = useState(new Date());

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) || null,
    [products, selectedId]
  );

  // Refresh "now" when entering the Gerar tab so dates stay current.
  useEffect(() => {
    if (tab === "gerar") setNow(new Date());
  }, [tab, selectedId]);

  // Pre-fill responsible with the current user's name (fallback: email).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const fallback =
        (meta?.full_name as string) ||
        (meta?.name as string) ||
        data.user?.email?.split("@")[0] ||
        "";
      setResponsible((prev) => prev || fallback);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fill notes from product when selecting one.
  useEffect(() => {
    if (selected) setExtraNotes(selected.notes ?? "");
  }, [selected]);

  const expiryDate = useMemo(() => {
    if (!selected) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + selected.validity_days);
    return d;
  }, [selected, now]);

  const handlePrint = () => {
    if (!selected || !expiryDate) return;
    // Imprime em iframe isolado — não trava o dashboard.
    printLabels({
      productName: selected.name,
      manufactureDate: now,
      expiryDate,
      responsible: responsible.trim() || "—",
      notes: extraNotes.trim() || null,
      quantity: Math.max(1, Math.min(10, quantity)),
    });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            Etiquetas de Alimentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre produtos e gere etiquetas de validade automaticamente.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full md:w-auto md:inline-flex">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="gerar">Gerar Etiqueta</TabsTrigger>
        </TabsList>

        {/* ============ PRODUTOS ============ */}
        <TabsContent value="produtos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Produtos cadastrados</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {products.length}{" "}
                  {products.length === 1 ? "produto" : "produtos"} no catálogo.
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Novo Produto
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum produto cadastrado ainda</p>
                  <p className="text-sm mt-1">
                    Clique em "Novo Produto" para começar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors flex flex-col gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Validade:{" "}
                          <span className="font-medium text-foreground">
                            {p.validity_days} {p.validity_days === 1 ? "dia" : "dias"}
                          </span>
                        </p>
                        {p.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                            {p.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ GERAR ETIQUETA ============ */}
        <TabsContent value="gerar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerar nova etiqueta</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecione o produto e ajuste os dados antes de imprimir.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Produto */}
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selected ? selected.name : "Buscar produto cadastrado..."}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome do produto..." />
                      <CommandList>
                        <CommandEmpty>
                          {products.length === 0
                            ? "Cadastre um produto primeiro."
                            : "Nenhum produto encontrado."}
                        </CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setSelectedId(p.id);
                                setComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  selectedId === p.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="flex-1">{p.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {p.validity_days}d
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Auto-filled fields */}
              {selected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Fabricação
                    </p>
                    <p className="font-semibold mt-0.5">
                      {format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Validade ({selected.validity_days}{" "}
                      {selected.validity_days === 1 ? "dia" : "dias"})
                    </p>
                    <p className="font-semibold mt-0.5 text-primary">
                      {expiryDate &&
                        format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsible">Responsável</Label>
                  <Input
                    id="responsible"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    placeholder="Nome do responsável"
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qty">Quantidade de etiquetas (1 a 10)</Label>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    max={10}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="extra-notes">Observação</Label>
                <Textarea
                  id="extra-notes"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  placeholder="Ex: manter refrigerado"
                  maxLength={200}
                  rows={2}
                />
              </div>

              <Button
                onClick={handlePrint}
                disabled={!selected}
                size="lg"
                className="w-full md:w-auto"
              >
                <Printer className="h-4 w-4" /> Imprimir Etiqueta
              </Button>
            </CardContent>
          </Card>

          {/* Preview na tela (só rascunho — a impressão usa o LabelPrintSheet) */}
          {selected && expiryDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-foreground rounded-md p-5 bg-background max-w-sm">
                  <p className="text-lg font-bold uppercase tracking-wide border-b border-foreground pb-2 mb-3">
                    {selected.name}
                  </p>
                  <p className="text-sm">
                    <span className="font-bold">Fabricação:</span>{" "}
                    {format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-sm">
                    <span className="font-bold">Validade:</span>{" "}
                    {format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm">
                    <span className="font-bold">Responsável:</span>{" "}
                    {responsible || "—"}
                  </p>
                  {extraNotes && (
                    <p className="text-xs italic mt-2 pt-2 border-t border-dashed border-foreground">
                      <span className="font-bold not-italic">Obs:</span> {extraNotes}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        isSubmitting={isMutating}
        onSubmit={async (input) => {
          if (editing) {
            await updateProduct({ id: editing.id, input });
          } else {
            await createProduct(input);
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) await deleteProduct(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
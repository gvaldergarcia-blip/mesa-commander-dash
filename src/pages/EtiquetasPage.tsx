import { useEffect, useMemo, useState } from "react";
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
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useChecklistItems } from "@/hooks/useChecklists";
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
  const { data: checklistItems = [] } = useChecklistItems();
  const qrChecklistItems = useMemo(
    () => checklistItems.filter((i) => i.has_qr),
    [checklistItems]
  );

  // ----- Products section -----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LabelProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabelProduct | null>(null);

  // ----- Generate tab -----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [responsible, setResponsible] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [batch, setBatch] = useState("");
  const [quantityWeight, setQuantityWeight] = useState("");
  const [checklistItemId, setChecklistItemId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [now, setNow] = useState(new Date());

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) || null,
    [products, selectedId]
  );

  const selectedChecklist = useMemo(
    () => qrChecklistItems.find((i) => i.id === checklistItemId) || null,
    [qrChecklistItems, checklistItemId]
  );
  const checklistQrUrl = selectedChecklist
    ? `${window.location.origin}/checklists/scan/${selectedChecklist.id}`
    : null;

  // Keep manufacture date fresh when product changes.
  useEffect(() => {
    setNow(new Date());
  }, [selectedId]);

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
    const qrSvg = checklistQrUrl
      ? renderToStaticMarkup(
          <QRCodeSVG value={checklistQrUrl} size={120} level="M" marginSize={0} />
        )
      : null;
    // Imprime em iframe isolado — não trava o dashboard.
    printLabels({
      productName: selected.name,
      manufactureDate: now,
      expiryDate,
      responsible: responsible.trim() || "—",
      notes: extraNotes.trim() || null,
      batch: batch.trim() || null,
      quantityWeight: quantityWeight.trim() || null,
      restaurantName: restaurant?.name || null,
      restaurantLogoUrl: restaurant?.logo_url || null,
      checklistQrSvg: qrSvg,
      checklistQrLabel: selectedChecklist?.name ?? null,
      quantity: Math.max(1, Math.min(10, quantity)),
    });
  };

  return (
    <div className="p-3 md:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Etiquetas de Alimentos
            </h1>
          </div>
          <p className="text-muted-foreground max-w-md">
            Gestão inteligente de validade e rastreabilidade para sua cozinha profissional.
          </p>
        </div>
      </header>

      {/* Main grid: products on left, generator on right */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ============ PRODUTOS ============ */}
        <section className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Produtos Cadastrados</h2>
              <p className="text-[11px] text-primary uppercase tracking-widest font-bold mt-1">
                {products.length} {products.length === 1 ? "Item Ativo" : "Itens Ativos"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4 text-primary" /> Novo Produto
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl bg-muted/20 text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum produto cadastrado ainda</p>
              <p className="text-sm mt-1">Clique em "Novo Produto" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((p) => {
                const dotColor =
                  p.validity_days <= 3
                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                    : p.validity_days <= 7
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
                return (
                  <div
                    key={p.id}
                    className="group bg-card/40 border border-border/50 p-5 rounded-2xl hover:border-primary/40 hover:bg-card/60 transition-all"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn("w-2 h-2 rounded-full", dotColor)} />
                        <span className="text-xs text-muted-foreground uppercase tracking-tight">
                          Validade:{" "}
                          <span className="text-foreground font-medium">
                            {String(p.validity_days).padStart(2, "0")}{" "}
                            {p.validity_days === 1 ? "dia" : "dias"}
                          </span>
                        </span>
                      </div>
                      {p.notes && (
                        <p className="text-xs text-muted-foreground/80 mt-2 italic line-clamp-2">
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 bg-muted/50 hover:bg-muted"
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground text-destructive"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ============ GERAR ETIQUETA ============ */}
        <section className="lg:col-span-5">
          <Card className="bg-card/40 border-border/50 rounded-3xl shadow-2xl lg:sticky lg:top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">Gerar nova etiqueta</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure os detalhes para impressão.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Produto */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Produto Selecionado *
                </Label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-full justify-between font-normal h-11 rounded-xl bg-background/60"
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
                <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Fabricação
                    </p>
                    <p className="font-semibold mt-1 text-sm">
                      {format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Validade ({selected.validity_days}{" "}
                      {selected.validity_days === 1 ? "dia" : "dias"})
                    </p>
                    <p className="font-semibold mt-1 text-sm text-primary">
                      {expiryDate &&
                        format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsible" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Responsável
                  </Label>
                  <Input
                    id="responsible"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    placeholder="Nome do responsável"
                    maxLength={60}
                    className="h-11 rounded-xl bg-background/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Lote
                  </Label>
                  <Input
                    id="batch"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="Ex: L2026-001"
                    maxLength={30}
                    className="h-11 rounded-xl bg-background/60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qty-weight" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Quantidade / Peso
                </Label>
                <Input
                  id="qty-weight"
                  value={quantityWeight}
                  onChange={(e) => setQuantityWeight(e.target.value)}
                  placeholder="Ex: 500g, 1L, 12 un"
                  maxLength={20}
                  className="h-11 rounded-xl bg-background/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extra-notes" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Observação
                </Label>
                <Textarea
                  id="extra-notes"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  placeholder="Ex: manter refrigerado"
                  maxLength={200}
                  rows={2}
                  className="rounded-xl bg-background/60 resize-none"
                />
              </div>

              {/* Checklist QR */}
              <div className="space-y-2">
                <Label htmlFor="checklist-qr" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Vincular QR de Checklist
                </Label>
                <select
                  id="checklist-qr"
                  value={checklistItemId}
                  onChange={(e) => setChecklistItemId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background/60 px-3 text-sm"
                >
                  <option value="">Sem QR de checklist</option>
                  {qrChecklistItems.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground/80">
                  {qrChecklistItems.length === 0
                    ? "Crie itens com 'Validação por QR Code' em Checklists para usar aqui."
                    : "A equipe pode escanear esse QR direto da etiqueta para registrar a verificação no checklist."}
                </p>
              </div>

              {/* Quantity stepper */}
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border border-border/50">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground block mb-1 uppercase tracking-widest">
                    Quantidade (1 a 10)
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-background/80 rounded-full hover:bg-background transition-colors text-base font-semibold"
                    >
                      −
                    </button>
                    <span className="text-lg font-bold text-foreground w-6 text-center">
                      {String(quantity).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      className="w-8 h-8 flex items-center justify-center bg-background/80 rounded-full hover:bg-background transition-colors text-base font-semibold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handlePrint}
                disabled={!selected}
                size="lg"
                className="w-full h-12 rounded-xl font-bold tracking-wide shadow-xl shadow-primary/20"
              >
                <Printer className="h-4 w-4" /> IMPRIMIR ETIQUETA
              </Button>
            </CardContent>
          </Card>

          {/* Preview na tela (só rascunho — a impressão usa o LabelPrintSheet) */}
          {selected && expiryDate && (
            <Card className="mt-6 bg-card/40 border-border/50 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Pré-visualização · 80×40 mm
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border border-black bg-white text-black font-sans overflow-hidden flex flex-col mx-auto"
                  style={{
                    width: "302px", // ≈ 80mm a 96dpi
                    height: "151px", // ≈ 40mm
                    padding: "8px 11px",
                    fontSize: "11px",
                    lineHeight: 1.2,
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between gap-2 border-b border-black"
                    style={{ paddingBottom: "3px", marginBottom: "5px" }}
                  >
                    <span
                      className="font-bold uppercase truncate flex-1"
                      style={{ fontSize: "14px", letterSpacing: "0.3px" }}
                    >
                      {selected.name}
                    </span>
                    {checklistQrUrl ? (
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <QRCodeSVG value={checklistQrUrl} size={48} level="M" marginSize={0} />
                        <span className="truncate text-center" style={{ fontSize: "6px", maxWidth: "60px", lineHeight: 1 }}>
                          {selectedChecklist?.name}
                        </span>
                      </div>
                    ) : restaurant?.logo_url ? (
                      <img
                        src={restaurant.logo_url}
                        alt="logo"
                        style={{ width: "20px", height: "20px", objectFit: "contain" }}
                      />
                    ) : (
                      <span className="font-bold uppercase truncate" style={{ fontSize: "9px", maxWidth: "70px" }}>
                        {restaurant?.name || ""}
                      </span>
                    )}
                  </div>
                  {/* Body 2 colunas */}
                  <div className="grid grid-cols-2 gap-x-3 flex-1" style={{ rowGap: "1px" }}>
                    <span className="truncate"><span className="font-bold">Fab:</span> {format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    <span className="truncate"><span className="font-bold">Val:</span> {format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                    <span className="truncate"><span className="font-bold">Resp:</span> {responsible || "—"}</span>
                    {batch && <span className="truncate"><span className="font-bold">Lote:</span> {batch}</span>}
                    {quantityWeight && <span className="truncate"><span className="font-bold">Qtd:</span> {quantityWeight}</span>}
                  </div>
                  {extraNotes && (
                    <p
                      className="italic border-t border-dashed border-black truncate"
                      style={{ fontSize: "9px", marginTop: "3px", paddingTop: "2px", lineHeight: 1.15 }}
                    >
                      <span className="font-bold not-italic">Obs:</span> {extraNotes}
                    </p>
                  )}
                  {restaurant?.name && (
                    <p
                      className="text-center font-semibold uppercase border-t border-black truncate"
                      style={{ fontSize: "8px", marginTop: "3px", paddingTop: "2px", letterSpacing: "0.3px" }}
                    >
                      {restaurant.name}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  A etiqueta será impressa em fundo branco com texto preto, em página de 80×40 mm.
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>

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
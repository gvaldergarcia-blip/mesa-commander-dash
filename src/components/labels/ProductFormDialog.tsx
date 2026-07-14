import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelProduct, LabelProductInput } from "@/hooks/useLabelProducts";
import { PRODUCT_CATEGORIES, ALLERGEN_OPTIONS } from "@/lib/labels/categories";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LabelProduct | null;
  onSubmit: (input: LabelProductInput) => Promise<unknown>;
  isSubmitting?: boolean;
}

export function ProductFormDialog({ open, onOpenChange, product, onSubmit, isSubmitting }: Props) {
  const [name, setName] = useState("");
  const [validityDays, setValidityDays] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [conservation, setConservation] = useState<string>("refrigerated");
  const [unit, setUnit] = useState<string>("un");
  const [status, setStatus] = useState<string>("active");
  const [category, setCategory] = useState<string>("none");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string>("");
  const [storageLocation, setStorageLocation] = useState<string>("");
  const [autoReprint, setAutoReprint] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setValidityDays(product?.validity_days?.toString() ?? "");
      setNotes(product?.notes ?? "");
      setConservation(product?.conservation_method ?? "refrigerated");
      setUnit(product?.unit ?? "un");
      setStatus(product?.status ?? "active");
      setCategory(product?.category ?? "none");
      setAllergens(
        product?.allergens
          ? product.allergens.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      );
      setIngredients(product?.ingredients ?? "");
      setStorageLocation((product as any)?.storage_location ?? "");
      setAutoReprint((product as any)?.auto_reprint_enabled ?? true);
    }
  }, [open, product]);

  const toggleAllergen = (a: string) => {
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(validityDays, 10);
    if (!name.trim() || isNaN(days) || days <= 0) return;
    const trimmed = name.trim();
    const normalizedName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    await onSubmit({
      name: normalizedName,
      validity_days: days,
      notes,
      conservation_method: conservation as any,
      unit,
      status: status as any,
      category: category === "none" ? null : category,
      cif: null,
      allergens: allergens.length ? allergens.join(", ") : null,
      ingredients: ingredients.trim() || null,
      storage_location: storageLocation.trim() || null,
      auto_reprint_enabled: autoReprint,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            Cadastre produtos para gerar etiquetas com validade automática.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prod-name">Nome do produto *</Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Molho de tomate"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-days">Validade (em dias) *</Label>
            <Input
              id="prod-days"
              type="number"
              min={1}
              max={3650}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              placeholder="Ex: 5"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Conservação</Label>
              <Select value={conservation} onValueChange={setConservation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="refrigerated">Resfriado</SelectItem>
                  <SelectItem value="frozen">Congelado</SelectItem>
                  <SelectItem value="ambient">Temp. ambiente</SelectItem>
                  <SelectItem value="hot">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="un">un</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-ingredients">Ingredientes principais (opcional)</Label>
            <Textarea
              id="prod-ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Em ordem decrescente de quantidade"
              maxLength={400}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-storage">Local de armazenamento (opcional)</Label>
            <Input
              id="prod-storage"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="Ex: Geladeira 1, Freezer 2"
              maxLength={50}
            />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <input
              id="prod-auto-reprint"
              type="checkbox"
              checked={autoReprint}
              onChange={(e) => setAutoReprint(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <label htmlFor="prod-auto-reprint" className="text-sm cursor-pointer">
              <span className="font-semibold">Reimpressão automática</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando uma etiqueta deste produto for baixada, o sistema sugere reemitir automaticamente com nova validade.
              </p>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Alergênicos (RDC 26/2015) — opcional</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_OPTIONS.map((a) => {
                const active = allergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      active
                        ? "bg-amber-500/20 border-amber-500/60 text-amber-200"
                        : "bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se selecionados, aparecem em destaque na etiqueta impressa com ícone de alerta.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-notes">Observação (opcional)</Label>
            <Textarea
              id="prod-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: manter refrigerado"
              maxLength={200}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
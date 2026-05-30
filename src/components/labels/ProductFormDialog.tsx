import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelProduct, LabelProductInput } from "@/hooks/useLabelProducts";
import { PRODUCT_CATEGORIES } from "@/lib/labels/categories";

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
  const [cif, setCif] = useState<string>("");
  const [allergens, setAllergens] = useState<string>("");
  const [ingredients, setIngredients] = useState<string>("");

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setValidityDays(product?.validity_days?.toString() ?? "");
      setNotes(product?.notes ?? "");
      setConservation(product?.conservation_method ?? "refrigerated");
      setUnit(product?.unit ?? "un");
      setStatus(product?.status ?? "active");
      setCategory(product?.category ?? "none");
      setCif(product?.cif ?? "");
      setAllergens(product?.allergens ?? "");
      setIngredients(product?.ingredients ?? "");
    }
  }, [open, product]);

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
      cif: cif.trim() || null,
      allergens: allergens.trim() || null,
      ingredients: ingredients.trim() || null,
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
            <Label htmlFor="prod-days">Validade pós-manipulação (em dias) *</Label>
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
            <p className="text-[11px] text-muted-foreground">
              Prazo após abrir/manipular o produto — não é a validade original do fornecedor.
            </p>
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
            <Label htmlFor="prod-cif">CIF — Comunicado de Início de Fabricação (opcional)</Label>
            <Input
              id="prod-cif"
              value={cif}
              onChange={(e) => setCif(e.target.value)}
              placeholder="Nº do CIF junto à Anvisa/Vigilância Sanitária"
              maxLength={80}
            />
            <p className="text-[11px] text-muted-foreground">
              Se preenchido, aparece na etiqueta impressa abaixo do campo Obs.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-allergens">Alergênicos (RDC 26/2015) — opcional</Label>
            <Input
              id="prod-allergens"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              placeholder="Ex: contém glúten, leite, ovo, soja"
              maxLength={200}
            />
            <p className="text-[11px] text-muted-foreground">
              Será impresso em destaque na etiqueta (obrigatório se contiver alergênicos).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-ingredients">Ingredientes — opcional</Label>
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
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelProduct, LabelProductInput } from "@/hooks/useLabelProducts";
import { PRODUCT_CATEGORIES, ALLERGEN_OPTIONS } from "@/lib/labels/categories";
import { SectorCombobox } from "@/components/labels/SectorCombobox";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { cn } from "@/lib/utils";
import { ChefHat, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LabelProduct | null;
  onSubmit: (input: LabelProductInput) => Promise<unknown>;
  isSubmitting?: boolean;
}

export function ProductFormDialog({ open, onOpenChange, product, onSubmit, isSubmitting }: Props) {
  const [name, setName] = useState("");
  const { activeEmployees } = useLabelEmployees();
  const [brand, setBrand] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [sif, setSif] = useState("");
  const [inspectionType, setInspectionType] = useState<string>("none");
  const [defaultWeight, setDefaultWeight] = useState("");
  const [defaultEmployeeId, setDefaultEmployeeId] = useState<string>("none");
  const [originalExpiry, setOriginalExpiry] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [conservation, setConservation] = useState<string>("refrigerated");
  const [unit, setUnit] = useState<string>("un");
  const [status, setStatus] = useState<string>("active");
  const [category, setCategory] = useState<string>("none");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string>("");
  const [storageLocation, setStorageLocation] = useState<string>("");
  const [autoReprint, setAutoReprint] = useState<boolean>(true);
  const [manipEnabled, setManipEnabled] = useState<boolean>(false);
  const [manipValue, setManipValue] = useState<string>("3");
  const [manipUnit, setManipUnit] = useState<"days" | "hours">("days");
  const [manipNotes, setManipNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setBrand(product?.brand ?? "");
      setSupplierName(product?.supplier_name ?? "");
      setSif(product?.sif ?? "");
      setInspectionType(((product as any)?.inspection_type as string) ?? "none");
      setDefaultWeight(product?.default_weight ?? "");
      setDefaultEmployeeId(product?.default_employee_id ?? "none");
      if (product?.validity_days) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + product.validity_days);
        setOriginalExpiry(d.toISOString().slice(0, 10));
      } else {
        setOriginalExpiry("");
      }
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
      setManipEnabled(!!(product as any)?.manipulation_enabled);
      setManipValue(String((product as any)?.manipulation_validity_value ?? "3"));
      setManipUnit(((product as any)?.manipulation_validity_unit as any) ?? "days");
      setManipNotes((product as any)?.manipulation_notes ?? "");
    }
  }, [open, product]);

  const toggleAllergen = (a: string) => {
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !originalExpiry) return;
    const target = new Date(`${originalExpiry}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((target.getTime() - today.getTime()) / 86400000));
    if (isNaN(days)) return;
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
      brand: brand.trim() || null,
      supplier_name: supplierName.trim() || null,
      sif: sif.trim() || null,
      inspection_type: inspectionType === "none" ? null : (inspectionType as any),
      default_weight: defaultWeight.trim() || null,
      default_employee_id: defaultEmployeeId === "none" ? null : defaultEmployeeId,
      allergens: allergens.length ? allergens.join(", ") : null,
      ingredients: ingredients.trim() || null,
      storage_location: storageLocation.trim() || null,
      auto_reprint_enabled: autoReprint,
      manipulation_enabled: manipEnabled,
      manipulation_validity_value: manipEnabled ? Math.max(1, parseInt(manipValue, 10) || 0) : null,
      manipulation_validity_unit: manipEnabled ? manipUnit : null,
      manipulation_notes: manipEnabled ? (manipNotes.trim() || null) : null,
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
            <Label htmlFor="prod-original-expiry">Validade original *</Label>
            <Input
              id="prod-original-expiry"
              type="date"
              value={originalExpiry}
              onChange={(e) => setOriginalExpiry(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Informe a data completa impressa na embalagem (ex.: 25/09/2028).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prod-brand">Marca / Fabricante</Label>
              <Input id="prod-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Friboi" maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-supplier">Fornecedor</Label>
              <Input id="prod-supplier" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Ex: Distribuidora X" maxLength={60} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prod-sif">SIF (quando aplicável)</Label>
              <Input id="prod-sif" value={sif} onChange={(e) => setSif(e.target.value)} placeholder="Ex: 1234" maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-weight">Peso padrão (opcional)</Label>
              <Input id="prod-weight" value={defaultWeight} onChange={(e) => setDefaultWeight(e.target.value)} placeholder="Ex: 500g, 1kg" maxLength={20} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Responsável padrão (opcional)</Label>
            <Select value={defaultEmployeeId} onValueChange={setDefaultEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Sem responsável padrão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável padrão</SelectItem>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <SectorCombobox
              value={storageLocation}
              onChange={setStorageLocation}
              placeholder="Ex.: Câmara Fria, Geladeira 1, Freezer 2…"
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

          {/* Configuração de Manipulação — definida pelo estabelecimento (POPs). */}
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <input
                id="prod-manip-enabled"
                type="checkbox"
                checked={manipEnabled}
                onChange={(e) => setManipEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <label htmlFor="prod-manip-enabled" className="text-sm cursor-pointer">
                <span className="font-semibold flex items-center gap-1.5">
                  <ChefHat className="h-3.5 w-3.5 text-primary" /> Produto pode ser manipulado?
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se sim, informe abaixo a validade que será aplicada automaticamente após a manipulação.
                </p>
              </label>
            </div>

            {manipEnabled && (
              <div className="space-y-3 pl-7">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Validade após manipulação</Label>
                    <Input
                      type="number"
                      min={1}
                      value={manipValue}
                      onChange={(e) => setManipValue(e.target.value)}
                      placeholder="Ex.: 3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unidade</Label>
                    <Select value={manipUnit} onValueChange={(v) => setManipUnit(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="days">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-manip-notes">Observação (opcional)</Label>
                  <Textarea
                    id="prod-manip-notes"
                    value={manipNotes}
                    onChange={(e) => setManipNotes(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Ex.: manter refrigerado a 4°C após aberto"
                  />
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300 flex gap-1.5 leading-snug">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    A validade após manipulação deve ser definida pelo estabelecimento conforme seus POPs, Manual de Boas Práticas e orientações do Responsável Técnico, quando aplicável. O MesaClik apenas aplica automaticamente essa configuração durante a geração das etiquetas.
                  </span>
                </div>
              </div>
            )}
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
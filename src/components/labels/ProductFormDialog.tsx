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
import { ChefHat, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LabelProduct | null;
  onSubmit: (input: LabelProductInput) => Promise<unknown>;
  isSubmitting?: boolean;
  /** Pré-preenche o nome (usado no cadastro rápido a partir da busca da impressão). */
  initialName?: string;
  /** Texto do botão de confirmação (ex.: "Cadastrar e usar"). */
  submitLabel?: string;
}

/** Conservação → cor do chip. */
const CONSERVATIONS = [
  { value: "refrigerated", label: "Resfriado" },
  { value: "frozen", label: "Congelado" },
  { value: "ambient", label: "Temp. ambiente" },
  { value: "hot", label: "Quente" },
];

export function ProductFormDialog({ open, onOpenChange, product, onSubmit, isSubmitting, initialName, submitLabel }: Props) {
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
  const [manipValue, setManipValue] = useState<string>("3");
  const [manipUnit, setManipUnit] = useState<"days" | "hours">("days");
  const [manipNotes, setManipNotes] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setName(product?.name ?? initialName ?? "");
      setBrand(product?.brand ?? "");
      setSupplierName(product?.supplier_name ?? "");
      setSif(product?.sif ?? "");
      setInspectionType(((product as any)?.inspection_type as string) ?? "none");
      setDefaultWeight(product?.default_weight ?? "");
      setDefaultEmployeeId(product?.default_employee_id ?? "none");
      setOriginalExpiry("");
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
      setManipValue(String((product as any)?.manipulation_validity_value ?? "3"));
      setManipUnit(((product as any)?.manipulation_validity_unit as any) ?? "days");
      setManipNotes((product as any)?.manipulation_notes ?? "");
      setShowAdvanced(false);
    }
  }, [open, product, initialName]);

  const toggleAllergen = (a: string) => {
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const manip = Math.max(1, parseInt(manipValue, 10) || 0);
    if (!name.trim() || !manip) return;

    // validity_days: usa a validade original se informada, senão deriva da regra pós-abertura.
    let days = manipUnit === "hours" ? 1 : manip;
    if (originalExpiry) {
      const target = new Date(`${originalExpiry}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
      if (!isNaN(diff)) days = Math.max(1, diff);
    }

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
      manipulation_enabled: true,
      manipulation_validity_value: manip,
      manipulation_validity_unit: manipUnit,
      manipulation_notes: manipNotes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            Só o essencial: nome, local, conservação e validade após abertura.
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
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Local de armazenamento *</Label>
            <SectorCombobox
              value={storageLocation}
              onChange={setStorageLocation}
              placeholder="Ex.: Câmara Fria, Geladeira 1, Freezer 2…"
            />
          </div>

          <div className="space-y-2">
            <Label>Conservação *</Label>
            <div className="grid grid-cols-2 gap-2">
              {CONSERVATIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setConservation(c.value)}
                  className={cn(
                    "h-10 rounded-lg border text-sm font-semibold transition-colors",
                    conservation === c.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pós-abertura — o campo mais importante do cadastro. */}
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <ChefHat className="h-4 w-4 text-primary" /> Validade após abertura / manipulação *
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min={1}
                value={manipValue}
                onChange={(e) => setManipValue(e.target.value)}
                placeholder="Ex.: 3"
                required
              />
              <Select value={manipUnit} onValueChange={(v) => setManipUnit(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300 flex gap-1.5 leading-snug">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Defina conforme seus POPs e Manual de Boas Práticas. O MesaClik apenas aplica essa regra ao gerar as etiquetas.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Mais detalhes (opcional)
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-l-2 border-border/50 pl-3">
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

              <div className="space-y-2">
                <Label htmlFor="prod-original-expiry">Validade original (opcional)</Label>
                <Input
                  id="prod-original-expiry"
                  type="date"
                  value={originalExpiry}
                  onChange={(e) => setOriginalExpiry(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Normalmente informada na impressão da etiqueta, lote a lote.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de inspeção</Label>
                  <Select value={inspectionType} onValueChange={setInspectionType}>
                    <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      <SelectItem value="SIF">SIF</SelectItem>
                      <SelectItem value="SISP">SISP</SelectItem>
                      <SelectItem value="IMPORTADO">Produto importado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prod-sif">Número da inspeção</Label>
                  <Input
                    id="prod-sif"
                    value={sif}
                    onChange={(e) => setSif(e.target.value)}
                    placeholder={inspectionType === "SISP" ? "Ex: 0169" : "Ex: 157"}
                    maxLength={30}
                    disabled={inspectionType === "none"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="prod-weight">Peso padrão</Label>
                  <Input id="prod-weight" value={defaultWeight} onChange={(e) => setDefaultWeight(e.target.value)} placeholder="Ex: 500g, 1kg" maxLength={20} />
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

              <div className="grid grid-cols-2 gap-3">
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
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {PRODUCT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Responsável padrão</Label>
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

              <div className="space-y-2">
                <Label htmlFor="prod-ingredients">Ingredientes principais</Label>
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
                <Label htmlFor="prod-manip-notes">Observação da manipulação</Label>
                <Textarea
                  id="prod-manip-notes"
                  value={manipNotes}
                  onChange={(e) => setManipNotes(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Ex.: manter refrigerado a 4°C após aberto"
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
                    Ao baixar uma etiqueta deste produto, o sistema sugere reemitir com nova validade.
                  </p>
                </label>
              </div>

              <div className="space-y-2">
                <Label>Alergênicos (RDC 26/2015)</Label>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-notes">Observação geral</Label>
                <Textarea
                  id="prod-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: manter refrigerado"
                  maxLength={200}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : product ? "Salvar alterações" : submitLabel || "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

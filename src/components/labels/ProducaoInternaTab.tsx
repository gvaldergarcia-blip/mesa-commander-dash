import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Plus, Search, Printer, Loader2, ArrowLeft, RefreshCw, User, Package, GitBranch, AlertTriangle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useQuery } from "@tanstack/react-query";
import { useLabels, Label as LabelRow } from "@/hooks/useLabels";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { printLabels } from "./LabelPrintSheet";
import { SectorCombobox } from "./SectorCombobox";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { getSiteBaseUrl } from "@/config/site-url";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BATCH_PREFIX = "PRD-";
const LEGACY_BATCH_PREFIXES = ["PI-", "PRD-"];
const UNITS = ["un", "kg", "g", "l", "ml", "porção"];
const CONSERVATION_OPTS = [
  { v: "refrigerated", l: "Resfriado" },
  { v: "frozen", l: "Congelado" },
  { v: "ambient", l: "Ambiente" },
  { v: "hot", l: "Quente" },
];

function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ProducaoInternaTab() {
  const { producedProducts, createProduct } = useLabelProducts();
  const { labels, createLabel, refetch } = useLabels();
  const { activeEmployees } = useLabelEmployees();
  const { restaurant } = useRestaurant();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabelRow | null>(null);

  const productions = useMemo(
    () => labels.filter((l) => LEGACY_BATCH_PREFIXES.some((p) => (l.batch || "").startsWith(p))),
    [labels]
  );

  const { data: legal } = useQuery({
    queryKey: ["restaurant-legal-prod", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .schema("mesaclik")
        .from("restaurants")
        .select("cnpj, zip_code")
        .eq("id", restaurant!.id)
        .maybeSingle();
      return { cnpj: data?.cnpj || null, cep: data?.zip_code || null };
    },
  });

  const reprint = (l: LabelRow) => {
    const qrSvg = renderToStaticMarkup(
      <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/${l.unique_code}?op=1`} size={144} level="L" marginSize={1} />
    );
    printLabels({
      productName: l.product_name,
      manufactureDate: new Date(l.manufacture_date),
      expiryDate: new Date(l.expiry_date),
      responsible: l.employee_name || l.responsible || "—",
      notes: l.notes,
      cif: l.cif,
      sif: null,
      allergens: l.allergens,
      ingredients: l.ingredients,
      conservationLabel: CONSERVATION_LABEL[l.conservation_method || ""] || null,
      storageLocation: l.storage_location,
      batch: l.batch,
      quantityWeight: l.weight ? `${l.weight}${l.weight_unit || ""}` : null,
      restaurantName: restaurant?.name || null,
      restaurantLogoUrl: (restaurant as any)?.logo_url || null,
      restaurantCnpj: legal?.cnpj || null,
      restaurantCep: legal?.cep || null,
      checklistQrSvg: qrSvg,
      checklistQrLabel: `#${l.unique_code}`,
      quantity: l.quantity,
      template: "production",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" /> Produção Interna
          </h2>
          <p className="text-sm text-muted-foreground">
            Etiquete alimentos preparados na própria cozinha. Cada produção tem sua validade.
          </p>
        </div>
        <Button size="lg" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova produção
        </Button>
      </div>

      <ProductionDialog
        open={open}
        onOpenChange={setOpen}
        products={producedProducts}
        employees={activeEmployees}
        onCreateProduct={createProduct}
        onCreateLabel={createLabel}
        onPrint={(inserted, ctx) => {
          const qrSvg = renderToStaticMarkup(
            <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/${inserted.unique_code}?op=1`} size={144} level="L" marginSize={1} />
          );
          printLabels({
            productName: ctx.productName,
            manufactureDate: ctx.manufactureDate,
            expiryDate: ctx.expiryDate,
            responsible: ctx.responsible,
            notes: ctx.notes,
            conservationLabel: CONSERVATION_LABEL[ctx.conservation] || null,
            storageLocation: ctx.storageLocation,
            batch: ctx.batch,
            quantityWeight: ctx.quantityWeight,
            restaurantName: restaurant?.name || null,
            restaurantLogoUrl: (restaurant as any)?.logo_url || null,
            restaurantCnpj: legal?.cnpj || null,
            restaurantCep: legal?.cep || null,
            checklistQrSvg: qrSvg,
            checklistQrLabel: `#${inserted.unique_code}`,
            quantity: ctx.qty,
            template: "production",
          });
        }}
      />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">Histórico de produções</h3>
          <Badge variant="secondary">{productions.length}</Badge>
        </div>
        {productions.length === 0 ? (
          <Card className="p-10 text-center border-dashed bg-card/40">
            <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma produção registrada ainda. Clique em <strong>Nova produção</strong> para começar.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {productions.map((l) => {
              const expired = l.status === "expired";
              const discharged = l.status === "discharged";
              return (
                <Card key={l.id} className="p-4 space-y-3 bg-card/50 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{l.product_name}</div>
                      <div className="text-xs text-muted-foreground">#{l.unique_code}</div>
                    </div>
                    <Badge
                      variant={discharged ? "outline" : expired ? "destructive" : "default"}
                      className="shrink-0"
                    >
                      {discharged ? "Baixada" : expired ? "Vencida" : "Ativa"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Produção</div>
                      <div className="font-medium">{format(new Date(l.manufacture_date), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Validade</div>
                      <div className="font-medium">{format(new Date(l.expiry_date), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Quantidade</div>
                      <div className="font-medium">
                        {l.quantity} {l.weight ? `· ${l.weight}${l.weight_unit || ""}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Responsável</div>
                      <div className="font-medium truncate">{l.employee_name || l.responsible || "—"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" className="gap-2" onClick={() => setEditing(l)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => reprint(l)}>
                      <RefreshCw className="h-3.5 w-3.5" /> Reimprimir
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <EditProductionDialog
        label={editing}
        employees={activeEmployees}
        onClose={() => setEditing(null)}
        onSaved={async (updated, print) => {
          await refetch();
          setEditing(null);
          if (print) reprint(updated);
        }}
      />
    </div>
  );
}

/* ============================================================
   Dialog — Editar produção existente + reimprimir com novos dados
   ============================================================ */

function toTimeInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function EditProductionDialog({
  label,
  employees,
  onClose,
  onSaved,
}: {
  label: LabelRow | null;
  employees: ReturnType<typeof useLabelEmployees>["activeEmployees"];
  onClose: () => void;
  onSaved: (updated: LabelRow, print: boolean) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    product_name: "",
    manufacture: "",
    manufactureTime: "00:00",
    expiry: "",
    expiryTime: "23:59",
    quantity: 1,
    weight: "",
    weight_unit: "kg",
    employeeId: "",
    responsible: "",
    conservation: "refrigerated",
    storage_location: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!label) return;
    const man = new Date(label.manufacture_date);
    const exp = new Date(label.expiry_date);
    setForm({
      product_name: label.product_name || "",
      manufacture: toDateInput(man),
      manufactureTime: toTimeInput(man),
      expiry: toDateInput(exp),
      expiryTime: toTimeInput(exp),
      quantity: label.quantity || 1,
      weight: label.weight != null ? String(label.weight) : "",
      weight_unit: label.weight_unit || "kg",
      employeeId: label.employee_id || "",
      responsible: label.responsible || "",
      conservation: label.conservation_method || "refrigerated",
      storage_location: label.storage_location || "",
      notes: label.notes || "",
    });
  }, [label]);

  const save = async (print: boolean) => {
    if (!label) return;
    if (!form.product_name.trim()) return toast.error("Informe o nome do produto");
    const [mh, mm] = form.manufactureTime.split(":").map(Number);
    const manufacture = new Date(`${form.manufacture}T00:00:00`);
    manufacture.setHours(mh || 0, mm || 0, 0, 0);
    const [eh, em] = form.expiryTime.split(":").map(Number);
    const expiry = new Date(`${form.expiry}T00:00:00`);
    expiry.setHours(eh || 23, em || 59, 0, 0);
    if (expiry <= manufacture) return toast.error("Validade deve ser posterior à produção");

    const employee = employees.find((e) => e.id === form.employeeId);
    const weightNum = form.weight ? Number(String(form.weight).replace(",", ".")) : null;

    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from("label_issuances")
        .update({
          product_name: form.product_name.trim(),
          manufacture_date: manufacture.toISOString(),
          expiry_date: expiry.toISOString(),
          quantity: Math.max(1, Number(form.quantity) || 1),
          weight: weightNum,
          weight_unit: weightNum ? form.weight_unit : null,
          employee_id: employee?.id || null,
          responsible: employee?.name || form.responsible || null,
          conservation_method: form.conservation,
          storage_location: form.storage_location || null,
          notes: form.notes || null,
        })
        .eq("id", label.id)
        .select("*")
        .single();
      if (error) throw error;
      toast.success("Produção atualizada");
      await onSaved({ ...(label as any), ...(data as any), employee_name: employee?.name ?? null } as LabelRow, print);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar produção");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!label} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" /> Editar produção
          </DialogTitle>
          <DialogDescription>
            Corrija as informações e reimprima as etiquetas já com os novos dados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Produto *</Label>
            <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          </div>
          <div>
            <Label>Produção (data)</Label>
            <Input type="date" value={form.manufacture} onChange={(e) => setForm({ ...form, manufacture: e.target.value })} />
          </div>
          <div>
            <Label>Produção (hora)</Label>
            <Input type="time" value={form.manufactureTime} onChange={(e) => setForm({ ...form, manufactureTime: e.target.value })} />
          </div>
          <div>
            <Label>Validade (data) *</Label>
            <Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
          </div>
          <div>
            <Label>Validade (hora)</Label>
            <Input type="time" value={form.expiryTime} onChange={(e) => setForm({ ...form, expiryTime: e.target.value })} />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Peso</Label>
              <Input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="2,5" />
            </div>
            <div>
              <Label>Un.</Label>
              <Select value={form.weight_unit} onValueChange={(v) => setForm({ ...form, weight_unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["kg", "g", "l", "ml"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Conservação</Label>
            <Select value={form.conservation} onValueChange={(v) => setForm({ ...form, conservation: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONSERVATION_OPTS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
              <SelectTrigger><SelectValue placeholder={form.responsible || "Selecionar"} /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {e.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Local / Setor</Label>
            <SectorCombobox value={form.storage_location} onChange={(v) => setForm({ ...form, storage_location: v })} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Salvar e reimprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Dialog — Fluxo de nova produção (Cadastro Mestre de Produzidos)
   ============================================================ */

const VALIDITY_UNITS = [
  { v: "hours", l: "horas" },
  { v: "days", l: "dias" },
  { v: "months", l: "meses" },
];

function addValidity(from: Date, value: number, unit: string) {
  const d = new Date(from);
  if (unit === "hours") d.setHours(d.getHours() + value);
  else if (unit === "months") d.setMonth(d.getMonth() + value);
  else d.setDate(d.getDate() + value);
  return d;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: LabelProduct[];
  employees: ReturnType<typeof useLabelEmployees>["activeEmployees"];
  onCreateProduct: (input: any) => Promise<LabelProduct>;
  onCreateLabel: (input: any) => Promise<LabelRow>;
  onPrint: (
    inserted: LabelRow,
    ctx: {
      productName: string;
      manufactureDate: Date;
      expiryDate: Date;
      responsible: string;
      qty: number;
      conservation: string;
      storageLocation: string | null;
      batch: string;
      notes: string | null;
      quantityWeight: string | null;
    }
  ) => void;
}

function ProductionDialog({ open, onOpenChange, products, employees, onCreateProduct, onCreateLabel, onPrint }: DialogProps) {
  const { updateProduct } = useLabelProducts();
  const [step, setStep] = useState<"select" | "new-product" | "form">("select");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<LabelProduct | null>(null);

  // Cadastro mestre de produto produzido
  const [np, setNp] = useState({
    name: "",
    category: "",
    unit: "un",
    conservation: "refrigerated",
    storage_location: "",
    validity_value: 3,
    validity_unit: "days",
    pop_notes: "",
  });

  // Produção
  const [prod, setProd] = useState({ qty: 1, employeeId: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("select");
    setSearch("");
    setProduct(null);
    setNp({ name: "", category: "", unit: "un", conservation: "refrigerated", storage_location: "", validity_value: 3, validity_unit: "days", pop_notes: "" });
    setProd({ qty: 1, employeeId: "", notes: "" });
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const list = products.filter((p) => (p.status ?? "active") === "active");
    if (!s) return list.slice(0, 50);
    return list.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 50);
  }, [products, search]);

  // A regra de validade da produção NUNCA é inventada: só existe se cadastrada.
  const productValidity = (p: LabelProduct): { value: number; unit: string } | null => {
    const value = p.production_validity_value;
    const unit = p.production_validity_unit;
    if (!value || value <= 0 || !unit) return null;
    return { value, unit: unit as string };
  };

  const currentRule = product ? productValidity(product) : null;

  const previewExpiry = useMemo(() => {
    if (!product || !currentRule) return null;
    return addValidity(new Date(), currentRule.value, currentRule.unit);
  }, [product, currentRule?.value, currentRule?.unit]);

  // Configuração da regra ausente (Cenário 2)
  const [ruleValue, setRuleValue] = useState<number>(3);
  const [ruleUnit, setRuleUnit] = useState<string>("days");
  const [savingRule, setSavingRule] = useState(false);

  const saveMissingRule = async () => {
    if (!product) return;
    const value = Math.max(1, Number(ruleValue) || 0);
    if (!value) return toast.error("Informe a validade da produção");
    setSavingRule(true);
    try {
      const updated = await updateProduct({
        id: product.id,
        input: {
          name: product.name,
          validity_days: ruleUnit === "days" ? value : ruleUnit === "months" ? value * 30 : 1,
          origin: "produced",
          production_validity_value: value,
          production_validity_unit: ruleUnit as any,
        } as any,
      });
      setProduct({ ...product, ...(updated as any), production_validity_value: value, production_validity_unit: ruleUnit as any });
      toast.success("Regra de validade da produção salva");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar a regra");
    } finally {
      setSavingRule(false);
    }
  };

  const pickProduct = (p: LabelProduct) => {
    setProduct(p);
    setStep("form");
  };

  const saveNewProduct = async () => {
    if (!np.name.trim()) return toast.error("Informe o nome do produto");
    const value = Math.max(1, Number(np.validity_value) || 1);
    setSaving(true);
    try {
      const created = await onCreateProduct({
        name: np.name,
        validity_days: np.validity_unit === "days" ? value : np.validity_unit === "months" ? value * 30 : 1,
        conservation_method: np.conservation as any,
        unit: np.unit,
        category: np.category || null,
        storage_location: np.storage_location || null,
        status: "active",
        origin: "produced",
        production_validity_value: value,
        production_validity_unit: np.validity_unit as any,
        pop_notes: np.pop_notes || null,
      });
      pickProduct(created);
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar produto");
    } finally {
      setSaving(false);
    }
  };

  const confirmProduction = async () => {
    if (!product) return;
    if (!prod.employeeId) return toast.error("Selecione o responsável");
    const rule = productValidity(product);
    if (!rule) return toast.error("Cadastre a regra de validade da produção deste produto antes de imprimir");
    const qty = Math.max(1, Math.min(30, Number(prod.qty) || 1));
    const manufactureDate = new Date();
    const expiryDate = addValidity(manufactureDate, rule.value, rule.unit);

    const employee = employees.find((e) => e.id === prod.employeeId);
    // Lote interno automático (PRD-YYYYMMDD-NNN)
    let batch = `${BATCH_PREFIX}${Date.now().toString(36).toUpperCase()}`;
    try {
      const { data: gen } = await (supabase as any).rpc("label_generate_production_lot");
      if (typeof gen === "string" && gen) batch = gen;
    } catch { /* fallback local */ }

    setSaving(true);
    try {
      const inserted = await onCreateLabel({
        label_product_id: product.id,
        product_name: product.name,
        manufacture_date: manufactureDate,
        expiry_date: expiryDate,
        quantity: qty,
        batch,
        responsible: employee?.name || null,
        employee_id: employee?.id || null,
        conservation_method: (product.conservation_method as any) || "refrigerated",
        notes: prod.notes.trim() ? `[Produção Interna] ${prod.notes.trim()}` : "[Produção Interna]",
        allergens: (product as any).allergens || null,
        ingredients: (product as any).ingredients || null,
      });

      onPrint(inserted, {
        productName: product.name,
        manufactureDate,
        expiryDate,
        responsible: employee?.name || "—",
        qty,
        conservation: (product.conservation_method as any) || "refrigerated",
        storageLocation: (product as any).storage_location || null,
        batch,
        notes: prod.notes.trim() || null,
        quantityWeight: null,
      });

      toast.success(`Produção registrada · ${qty} etiqueta(s)`);
      close(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar produção");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {step === "select" && "Escolha o produto"}
            {step === "new-product" && "Novo produto produzido"}
            {step === "form" && "Registrar produção"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Apenas produtos produzidos na cozinha. Insumos recebidos não aparecem aqui."}
            {step === "new-product" && "Este produto passa a fazer parte permanentemente da sua lista de produção."}
            {step === "form" && "Data, validade e lote são calculados automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar produto (ex.: maionese, arroz, molho pesto...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
            <Button
              variant="outline"
              className="w-full h-12 gap-2 border-dashed"
              onClick={() => {
                setNp((s) => ({ ...s, name: search }));
                setStep("new-product");
              }}
            >
              <Plus className="h-4 w-4" /> Cadastrar novo produto {search ? `"${search}"` : ""}
            </Button>
            <div className="max-h-[45vh] overflow-y-auto space-y-1">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg">
                  Nenhum produto produzido cadastrado ainda.
                </div>
              ) : (
                filtered.map((p) => {
                  const v = productValidity(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickProduct(p)}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 hover:border-primary hover:bg-primary/5 transition text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChefHat className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.category || "Sem categoria"} ·{" "}
                            {v
                              ? `validade ${v.value} ${VALIDITY_UNITS.find((u) => u.v === v.unit)?.l}`
                              : "sem regra de validade"}
                          </div>
                        </div>
                      </div>
                      {p.storage_location && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {p.storage_location}
                        </Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {step === "new-product" && (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setStep("select")} className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Nome *</Label>
                <Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="Ex.: Maionese da casa" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} placeholder="Molhos, Bases..." />
              </div>
              <div>
                <Label>Conservação</Label>
                <Select value={np.conservation} onValueChange={(v) => setNp({ ...np, conservation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONSERVATION_OPTS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade padrão</Label>
                <Select value={np.unit} onValueChange={(v) => setNp({ ...np, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Validade da produção *</Label>
                  <Input type="number" min={1} value={np.validity_value} onChange={(e) => setNp({ ...np, validity_value: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={np.validity_unit} onValueChange={(v) => setNp({ ...np, validity_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALIDITY_UNITS.map((u) => <SelectItem key={u.v} value={u.v}>{u.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Local / Setor</Label>
                <SectorCombobox value={np.storage_location} onChange={(v) => setNp({ ...np, storage_location: v })} />
              </div>
              <div className="md:col-span-2">
                <Label>Observações do POP (opcional)</Label>
                <Textarea rows={2} value={np.pop_notes} onChange={(e) => setNp({ ...np, pop_notes: e.target.value })} placeholder="Ex.: resfriar até 5°C em até 2h" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("select")}>Cancelar</Button>
              <Button onClick={saveNewProduct} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Salvar e continuar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "form" && product && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("select")} className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Trocar produto
            </Button>

            <Card className="p-3 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-primary" />
                <div className="font-semibold">{product.name}</div>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {CONSERVATION_LABEL[product.conservation_method || ""] || "—"}
                </Badge>
              </div>
              {product.pop_notes && (
                <div className="mt-2 pt-2 border-t border-primary/10 text-[11px] text-muted-foreground">
                  POP: {product.pop_notes}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade produzida *</Label>
                <Input
                  type="number"
                  min={1}
                  value={prod.qty}
                  onChange={(e) => setProd({ ...prod, qty: Number(e.target.value) })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Serão geradas {Math.max(1, Number(prod.qty) || 1)} etiqueta(s) · unidade {product.unit || "un"}.
                </p>
              </div>
              <div>
                <Label>Responsável *</Label>
                <Select value={prod.employeeId} onValueChange={(v) => setProd({ ...prod, employeeId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione quem produziu" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {e.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Observações (opcional)</Label>
                <Textarea rows={2} value={prod.notes} onChange={(e) => setProd({ ...prod, notes: e.target.value })} placeholder="Ex.: receita nova, dobrou o alho..." />
              </div>
            </div>

            {currentRule ? (
              <div className={cn("text-xs p-3 rounded-md bg-muted/40 border border-border/40 space-y-1")}>
                <div>📅 Produção registrada na data/hora atual</div>
                <div>
                  ⏳ Validade prevista:{" "}
                  <strong>
                    {previewExpiry ? format(previewExpiry, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                  </strong>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Baseada na regra de validade da produção deste produto ({currentRule.value}{" "}
                  {VALIDITY_UNITS.find((u) => u.v === currentRule.unit)?.l}).
                </div>
                <div>🏷️ Lote interno gerado automaticamente</div>
              </div>
            ) : (
              <div className="text-xs p-3 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="space-y-1">
                  <div className="font-semibold text-amber-800 dark:text-amber-300">
                    Este produto ainda não possui uma regra de validade da produção.
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Informe a validade padrão utilizada pelo estabelecimento para este produto. O MesaClik nunca
                    calcula validade sem uma regra definida por você.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Validade da produção *</Label>
                    <Input type="number" min={1} value={ruleValue} onChange={(e) => setRuleValue(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Select value={ruleUnit} onValueChange={setRuleUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VALIDITY_UNITS.map((u) => <SelectItem key={u.v} value={u.v}>{u.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" onClick={saveMissingRule} disabled={savingRule} className="gap-2">
                  {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar regra de validade
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
              <Button onClick={confirmProduction} disabled={saving || !currentRule} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Registrar e imprimir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

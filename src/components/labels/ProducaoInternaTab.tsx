import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Plus, Search, Printer, Loader2, ArrowLeft, RefreshCw, User, Package } from "lucide-react";
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

const BATCH_PREFIX = "PI-";
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
  const { products, createProduct } = useLabelProducts();
  const { labels, createLabel } = useLabels();
  const { activeEmployees } = useLabelEmployees();
  const { restaurant } = useRestaurant();

  const [open, setOpen] = useState(false);

  const productions = useMemo(
    () => labels.filter((l) => (l.batch || "").startsWith(BATCH_PREFIX)),
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
      sif: l.sif,
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
        products={products}
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
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => reprint(l)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Reimprimir etiquetas
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Dialog — Fluxo de nova produção
   ============================================================ */

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
  const [step, setStep] = useState<"select" | "new-product" | "form">("select");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<LabelProduct | null>(null);

  // Novo produto
  const [np, setNp] = useState({
    name: "",
    category: "",
    unit: "un",
    conservation: "refrigerated",
    storage_location: "",
    validity_days: 3,
  });

  // Produção
  const [prod, setProd] = useState({
    qty: 1,
    unit: "un",
    weight: "",
    weight_unit: "kg",
    expiry: toDateInput(new Date(Date.now() + 3 * 86400000)),
    expiryTime: "23:59",
    employeeId: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("select");
    setSearch("");
    setProduct(null);
    setNp({ name: "", category: "", unit: "un", conservation: "refrigerated", storage_location: "", validity_days: 3 });
    setProd({ qty: 1, unit: "un", weight: "", weight_unit: "kg", expiry: toDateInput(new Date(Date.now() + 3 * 86400000)), expiryTime: "23:59", employeeId: "", notes: "" });
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const list = products.filter((p) => (p.status ?? "active") === "active");
    if (!s) return list.slice(0, 30);
    return list.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 30);
  }, [products, search]);

  const pickProduct = (p: LabelProduct) => {
    setProduct(p);
    const validity = p.validity_days || 3;
    const exp = new Date(Date.now() + validity * 86400000);
    setProd((s) => ({
      ...s,
      unit: p.unit || "un",
      expiry: toDateInput(exp),
    }));
    setStep("form");
  };

  const saveNewProduct = async () => {
    if (!np.name.trim()) return toast.error("Informe o nome do produto");
    setSaving(true);
    try {
      const created = await onCreateProduct({
        name: np.name,
        validity_days: Math.max(1, Number(np.validity_days) || 3),
        conservation_method: np.conservation as any,
        unit: np.unit,
        category: np.category || null,
        storage_location: np.storage_location || null,
        status: "active",
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
    const qty = Math.max(1, Math.min(30, Number(prod.qty) || 1));
    const manufactureDate = new Date();
    const [h, m] = prod.expiryTime.split(":").map(Number);
    const expiryDate = new Date(`${prod.expiry}T00:00:00`);
    expiryDate.setHours(h || 23, m || 59, 0, 0);
    if (expiryDate <= manufactureDate) return toast.error("Validade deve ser posterior à produção");

    const employee = employees.find((e) => e.id === prod.employeeId);
    const batch = `${BATCH_PREFIX}${Date.now().toString(36).toUpperCase()}`;
    const weightNum = prod.weight ? Number(prod.weight.replace(",", ".")) : null;

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

      // Persist peso da produção (se informado)
      if (weightNum && weightNum > 0) {
        try {
          await (supabase as any)
            .from("label_issuances")
            .update({ weight: weightNum, weight_unit: prod.weight_unit })
            .eq("id", inserted.id);
          (inserted as any).weight = weightNum;
          (inserted as any).weight_unit = prod.weight_unit;
        } catch {
          /* peso é opcional; ignora falha */
        }
      }

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
        quantityWeight: weightNum ? `${weightNum}${prod.weight_unit}` : null,
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
            {step === "new-product" && "Novo produto"}
            {step === "form" && "Registrar produção"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Selecione um produto já cadastrado ou cadastre um novo."}
            {step === "new-product" && "Estes dados ficam salvos para reutilização."}
            {step === "form" && "Cada produção tem sua própria validade."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar produto (ex.: maionese, molho...)"
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
                  Nenhum produto cadastrado ainda.
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pickProduct(p)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 hover:border-primary hover:bg-primary/5 transition text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.category || "Sem categoria"} · {p.validity_days}d validade padrão
                        </div>
                      </div>
                    </div>
                    {p.storage_location && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {p.storage_location}
                      </Badge>
                    )}
                  </button>
                ))
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
                <Label>Unidade</Label>
                <Select value={np.unit} onValueChange={(v) => setNp({ ...np, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Label>Validade padrão (dias)</Label>
                <Input type="number" min={1} value={np.validity_days} onChange={(e) => setNp({ ...np, validity_days: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label>Local / Setor</Label>
                <SectorCombobox value={np.storage_location} onChange={(v) => setNp({ ...np, storage_location: v })} />
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
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("select")} className="gap-2 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Trocar produto
              </Button>
            </div>
            <Card className="p-3 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <div className="font-semibold">{product.name}</div>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {CONSERVATION_LABEL[product.conservation_method || ""] || "—"}
                </Badge>
              </div>
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
                  Serão geradas {Math.max(1, Number(prod.qty) || 1)} etiqueta(s).
                </p>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={prod.unit} onValueChange={(v) => setProd({ ...prod, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Peso/volume total (opcional)</Label>
                <Input
                  placeholder="Ex.: 2,5"
                  value={prod.weight}
                  onChange={(e) => setProd({ ...prod, weight: e.target.value })}
                />
              </div>
              <div>
                <Label>Unidade do peso</Label>
                <Select value={prod.weight_unit} onValueChange={(v) => setProd({ ...prod, weight_unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["kg", "g", "l", "ml"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Validade (data) *</Label>
                <Input type="date" value={prod.expiry} onChange={(e) => setProd({ ...prod, expiry: e.target.value })} />
              </div>
              <div>
                <Label>Validade (hora)</Label>
                <Input type="time" value={prod.expiryTime} onChange={(e) => setProd({ ...prod, expiryTime: e.target.value })} />
              </div>

              <div className="col-span-2">
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
                <Label>Observações</Label>
                <Textarea rows={2} value={prod.notes} onChange={(e) => setProd({ ...prod, notes: e.target.value })} placeholder="Ex.: receita nova, dobrou o alho..." />
              </div>
            </div>

            <div className={cn("text-xs p-2 rounded-md bg-muted/40 border border-border/40")}>
              📅 Produção agora · Validade em <strong>{format(new Date(`${prod.expiry}T${prod.expiryTime || "23:59"}:00`), "dd/MM/yyyy HH:mm", { locale: ptBR })}</strong>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
              <Button onClick={confirmProduction} disabled={saving} className="gap-2">
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
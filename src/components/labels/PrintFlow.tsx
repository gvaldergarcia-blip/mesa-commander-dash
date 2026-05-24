import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Printer, Search, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLabelEmployees, LabelEmployee } from "@/hooks/useLabelEmployees";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { printLabels } from "./LabelPrintSheet";
import { cn } from "@/lib/utils";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { getSiteBaseUrl } from "@/config/site-url";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const initials = (name: string) =>
  name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

export function PrintFlow({ onFinished }: { onFinished?: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const { activeEmployees, isLoading: empLoading } = useLabelEmployees();
  const { products, isLoading: prodLoading } = useLabelProducts();
  const { createLabel } = useLabels();
  const { restaurant } = useRestaurant();

  const [employee, setEmployee] = useState<LabelEmployee | null>(null);
  const [product, setProduct] = useState<LabelProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const [now, setNow] = useState(new Date());
  const [batch, setBatch] = useState("");
  const [quantityWeight, setQuantityWeight] = useState("");
  const [conservation, setConservation] = useState<string>("refrigerated");
  const [notes, setNotes] = useState("");
  const [cif, setCif] = useState("");
  const [printQty, setPrintQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setNow(new Date());
      setConservation(product.conservation_method || "refrigerated");
      setNotes(product.default_observation || product.notes || "");
      setCif(product.cif || "");
    }
  }, [product]);

  const expiryDate = useMemo(() => {
    if (!product) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + product.validity_days);
    return d;
  }, [product, now]);

  const activeProducts = useMemo(
    () => products.filter((p) => (p.status ?? "active") === "active"),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const s = productSearch.toLowerCase().trim();
    if (!s) return activeProducts;
    return activeProducts.filter((p) => p.name.toLowerCase().includes(s));
  }, [activeProducts, productSearch]);

  const reset = () => {
    setStep(1); setEmployee(null); setProduct(null);
    setBatch(""); setQuantityWeight(""); setNotes(""); setCif(""); setPrintQty(1);
    setProductSearch("");
  };

  const handlePrint = async () => {
    if (!product || !expiryDate || !employee) return;
    setSubmitting(true);
    try {
      const qty = Math.max(1, Math.min(10, printQty));
      const inserted = await createLabel({
        label_product_id: product.id,
        product_name: product.name,
        manufacture_date: now,
        expiry_date: expiryDate,
        quantity: qty,
        batch: batch.trim() || null,
        responsible: employee.name,
        employee_id: employee.id,
        conservation_method: conservation as any,
        notes: notes.trim() || null,
      });
      const scanUrl = `${getSiteBaseUrl()}/etiquetas/scan/${inserted.unique_code}`;
      const qrSvg = renderToStaticMarkup(
        <QRCodeSVG value={scanUrl} size={120} level="M" marginSize={0} />
      );
      printLabels({
        productName: product.name,
        manufactureDate: now,
        expiryDate,
        responsible: employee.name,
        notes: notes.trim() || null,
        cif: cif.trim() || null,
        batch: batch.trim() || null,
        quantityWeight: quantityWeight.trim() || null,
        restaurantName: restaurant?.name || null,
        restaurantLogoUrl: restaurant?.logo_url || null,
        checklistQrSvg: qrSvg,
        checklistQrLabel: `#${inserted.unique_code}`,
        quantity: qty,
      });
      toast.success(`Etiqueta #${inserted.unique_code} registrada`);
      reset();
      onFinished?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao imprimir");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Steps progress */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className={cn(
            "h-2 rounded-full transition-all",
            step >= n ? "bg-primary w-12" : "bg-muted w-6"
          )} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Quem está imprimindo?</h2>
            <p className="text-sm text-muted-foreground mt-1">Selecione o responsável.</p>
          </div>
          {empLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : activeEmployees.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Cadastre funcionários na aba "Funcionários" primeiro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activeEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setEmployee(e); setStep(2); }}
                  className="p-5 rounded-2xl border border-border/50 bg-card/40 hover:border-primary hover:bg-primary/5 transition-all text-center group"
                >
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-2xl mb-3 group-hover:scale-110 transition-transform">
                    {initials(e.name)}
                  </div>
                  <div className="font-semibold truncate">{e.name}</div>
                  {e.role && <div className="text-xs text-muted-foreground truncate">{e.role}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /></Button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Escolha o produto</h2>
              <p className="text-sm text-muted-foreground">Imprimindo como <strong>{employee?.name}</strong></p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9 h-12 text-base"
            />
          </div>
          {prodLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum produto encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProduct(p); setStep(3); }}
                  className="p-4 rounded-xl border border-border/50 bg-card/40 hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {CONSERVATION_LABEL[p.conservation_method || "refrigerated"]} · {p.validity_days} dia(s)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && product && employee && expiryDate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4 bg-card/40">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /></Button>
              <h2 className="text-xl font-bold flex-1">Confirmar e imprimir</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 text-sm">
              <div><div className="text-[10px] uppercase text-muted-foreground">Produto</div><div className="font-semibold">{product.name}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Responsável</div><div className="font-semibold">{employee.name}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Fabricação</div><div className="font-semibold">{format(now, "dd/MM HH:mm", { locale: ptBR })}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Validade</div><div className="font-semibold text-primary">{format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Lote</Label><Input value={batch} onChange={(e) => setBatch(e.target.value)} maxLength={30} /></div>
              <div className="space-y-1"><Label>Qtd / Peso</Label><Input value={quantityWeight} onChange={(e) => setQuantityWeight(e.target.value)} placeholder="500g, 1L..." /></div>
            </div>

            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={200} />
            </div>

            <div className="space-y-1">
              <Label>CIF (opcional)</Label>
              <Input value={cif} onChange={(e) => setCif(e.target.value)} maxLength={80} placeholder="CNPJ ou código do fornecedor" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <span className="text-sm font-semibold">Etiquetas a imprimir</span>
              <div className="flex items-center gap-3">
                <Button type="button" size="icon" variant="outline" onClick={() => setPrintQty((q) => Math.max(1, q - 1))}>−</Button>
                <span className="text-lg font-bold w-8 text-center">{printQty}</span>
                <Button type="button" size="icon" variant="outline" onClick={() => setPrintQty((q) => Math.min(10, q + 1))}>+</Button>
              </div>
            </div>

            <Button onClick={handlePrint} disabled={submitting} size="lg" className="w-full h-12 font-bold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              IMPRIMIR ETIQUETA
            </Button>
          </Card>

          {/* Preview */}
          <Card className="p-5 bg-card/40">
            <div className="text-xs uppercase text-muted-foreground mb-3 font-semibold">Pré-visualização · 80×40mm</div>
            <div
              className="border border-black bg-white text-black font-sans overflow-hidden flex flex-col mx-auto"
              style={{ width: "302px", height: "151px", padding: "8px 11px", fontSize: "11px", lineHeight: 1.2 }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-black" style={{ paddingBottom: "3px", marginBottom: "5px" }}>
                <span className="font-bold uppercase truncate flex-1" style={{ fontSize: "14px" }}>{product.name}</span>
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/PREVIEW`} size={48} level="M" marginSize={0} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 flex-1" style={{ rowGap: "1px" }}>
                <span className="truncate"><span className="font-bold">Fab:</span> {format(now, "dd/MM HH:mm", { locale: ptBR })}</span>
                <span className="truncate"><span className="font-bold">Val:</span> {format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                <span className="truncate"><span className="font-bold">Resp:</span> {employee.name}</span>
                {batch && <span className="truncate"><span className="font-bold">Lote:</span> {batch}</span>}
                {quantityWeight && <span className="truncate"><span className="font-bold">Qtd:</span> {quantityWeight}</span>}
              </div>
              {notes && <p className="italic border-t border-dashed border-black truncate" style={{ fontSize: "9px", marginTop: "3px", paddingTop: "2px" }}><span className="font-bold not-italic">Obs:</span> {notes}</p>}
              {restaurant?.name && <p className="text-center font-semibold uppercase border-t border-black truncate" style={{ fontSize: "8px", marginTop: "3px", paddingTop: "2px" }}>{restaurant.name}</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
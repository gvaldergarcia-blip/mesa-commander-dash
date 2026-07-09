import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Printer, Search, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLabelEmployees, LabelEmployee } from "@/hooks/useLabelEmployees";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { printLabels } from "./LabelPrintSheet";
import { cn } from "@/lib/utils";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { toast } from "sonner";
import { getSiteBaseUrl } from "@/config/site-url";

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
  const [printQty, setPrintQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setNow(new Date());
      setConservation(product.conservation_method || "refrigerated");
    }
  }, [product]);

  // Dados legais do restaurante (CNPJ + CEP) — puxados de Configurações, NUNCA editáveis aqui.
  const { data: restaurantLegal } = useQuery({
    queryKey: ["restaurant-legal", restaurant?.id],
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
    setBatch(""); setQuantityWeight(""); setPrintQty(1);
    setProductSearch("");
  };

  const handlePrint = async () => {
    if (!product || !expiryDate || !employee) return;
    setSubmitting(true);
    try {
      const qty = Math.max(1, Math.min(10, printQty));
      // Dados do produto (alergênicos, ingredientes, notas) puxados do cadastro.
      const productNotes = product.default_observation || product.notes || null;
      const productAllergens = (product as any).allergens || null;
      const productIngredients = (product as any).ingredients || null;
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
        notes: productNotes,
        cif: product.cif || null,
        allergens: productAllergens,
        ingredients: productIngredients,
      });
      const qrSvg = renderToStaticMarkup(
        <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/${inserted.unique_code}?op=1`} size={144} level="L" marginSize={1} />
      );
      printLabels({
        productName: product.name,
        manufactureDate: now,
        expiryDate,
        responsible: employee.name,
        notes: productNotes,
        cif: product.cif || null,
        allergens: productAllergens,
        ingredients: productIngredients,
        conservationLabel: CONSERVATION_LABEL[conservation as keyof typeof CONSERVATION_LABEL] || null,
        storageLocation: (product as any).storage_location || null,
        batch: batch.trim() || null,
        quantityWeight: quantityWeight.trim() || null,
        restaurantName: restaurant?.name || null,
        restaurantLogoUrl: restaurant?.logo_url || null,
        restaurantCnpj: restaurantLegal?.cnpj || null,
        restaurantCep: restaurantLegal?.cep || null,
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
            <h2 className="text-xl md:text-2xl font-bold">Quem está imprimindo?</h2>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Selecione o responsável.</p>
          </div>
          {empLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : activeEmployees.length === 0 ? (
            <div className="text-center py-8 md:py-12 px-4 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
              <User className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-2 md:mb-3 opacity-40" />
              <p className="text-sm">Cadastre funcionários na aba "Funcionários" primeiro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
              {activeEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setEmployee(e); setStep(2); }}
                  className="p-3 md:p-5 rounded-2xl border border-border/50 bg-card/40 hover:border-primary hover:bg-primary/5 active:bg-primary/10 transition-all text-center group min-h-[112px]"
                >
                  <div className="h-12 w-12 md:h-16 md:w-16 mx-auto rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-lg md:text-2xl mb-2 md:mb-3 group-hover:scale-110 transition-transform">
                    {initials(e.name)}
                  </div>
                  <div className="font-semibold truncate text-sm md:text-base">{e.name}</div>
                  {e.role && <div className="text-[10px] md:text-xs text-muted-foreground truncate">{e.role}</div>}
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
              <h2 className="text-xl md:text-2xl font-bold">Escolha o produto</h2>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Como <strong>{employee?.name}</strong></p>
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

            {((product as any).allergens || (product as any).ingredients) && (
              <div className="p-3 rounded-xl border border-border/50 text-xs space-y-1 bg-muted/30">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Dados do produto (impressos automaticamente)</div>
                {(product as any).allergens && (
                  <div><span className="font-semibold text-amber-500">⚠ Alergênicos:</span> {(product as any).allergens}</div>
                )}
                {(product as any).ingredients && (
                  <div className="line-clamp-2"><span className="font-semibold">Ingredientes:</span> {(product as any).ingredients}</div>
                )}
              </div>
            )}
            {!restaurantLegal?.cnpj && (
              <div className="text-[11px] text-amber-500/90 border border-amber-500/30 bg-amber-500/5 rounded-lg p-2">
                CNPJ do estabelecimento não cadastrado. Configure em <strong>Configurações → Restaurante</strong> para que apareça na etiqueta.
              </div>
            )}

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
              className="bg-white text-black font-sans overflow-hidden flex flex-col mx-auto shadow"
              style={{ width: "340px", minHeight: "170px", padding: "10px 12px", fontSize: "10px", lineHeight: 1.2 }}
            >
              {/* Topo: nome + peso */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold uppercase truncate" style={{ fontSize: "15px", lineHeight: 1.05 }}>
                    {product.name}
                  </div>
                  <div className="font-semibold uppercase" style={{ fontSize: "10px", marginTop: "1px", letterSpacing: "0.3px" }}>
                    {CONSERVATION_LABEL[conservation as keyof typeof CONSERVATION_LABEL]}
                  </div>
                </div>
                {quantityWeight && (
                  <div className="font-extrabold whitespace-nowrap" style={{ fontSize: "14px" }}>{quantityWeight}</div>
                )}
              </div>

              {/* Datas */}
              <div className="border-t border-b border-black" style={{ margin: "5px 0", padding: "3px 0" }}>
                <div className="flex" style={{ fontSize: "10px", lineHeight: 1.3 }}>
                  <span className="font-bold" style={{ minWidth: "75px" }}>PREPARADO:</span>
                  <span className="font-semibold">{format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="flex" style={{ fontSize: "10px", lineHeight: 1.3 }}>
                  <span className="font-bold" style={{ minWidth: "75px" }}>VALIDADE:</span>
                  <span className="font-semibold">{format(expiryDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                {batch && (
                  <div className="flex" style={{ fontSize: "10px", lineHeight: 1.3 }}>
                    <span className="font-bold" style={{ minWidth: "75px" }}>LOTE:</span>
                    <span className="font-semibold">{batch}</span>
                  </div>
                )}
              </div>

              {(product as any).storage_location && (
                <div style={{ fontSize: "10px", marginTop: "3px" }}>
                  <span className="font-extrabold uppercase">LOCAL:</span>{" "}
                  <span className="font-bold uppercase">{(product as any).storage_location}</span>
                </div>
              )}

              {/* Rodapé + QR */}
              <div className="flex justify-between items-end gap-2 flex-1">
                <div className="flex-1 min-w-0" style={{ fontSize: "9px", lineHeight: 1.25 }}>
                  <div className="truncate"><span className="font-bold">RESP:</span> {employee.name}</div>
                  {restaurant?.name && <div className="font-bold uppercase truncate">{restaurant.name}</div>}
                  {restaurantLegal?.cnpj && <div className="truncate"><span className="font-bold">CNPJ:</span> {restaurantLegal.cnpj}</div>}
                  {restaurantLegal?.cep && <div className="truncate"><span className="font-bold">CEP:</span> {restaurantLegal.cep}</div>}
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <QRCodeSVG
                    value={`${getSiteBaseUrl()}/etiquetas/scan/PREVIEW?op=1`}
                    size={54}
                    level="L"
                    marginSize={1}
                  />
                  <div className="font-bold" style={{ fontSize: "8px" }}>#PREVIEW</div>
                </div>
              </div>

              {(product as any).allergens && (
                <div className="font-extrabold uppercase text-center border border-black" style={{ fontSize: "9px", padding: "1px 3px", marginTop: "3px", letterSpacing: "0.3px" }}>
                  ⚠ CONTÉM: {(product as any).allergens}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              Conforme RDC 216/2004 · Portaria CVS 5/2013 · RDC 26/2015
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
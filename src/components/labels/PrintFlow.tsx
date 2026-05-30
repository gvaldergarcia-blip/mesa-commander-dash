import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Printer, Search, Loader2, User, CalendarIcon } from "lucide-react";
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
import { getSiteBaseUrl } from "@/config/site-url";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Step = 1 | 2 | 3 | 4;

const initials = (name: string) =>
  name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

export function PrintFlow({ onFinished }: { onFinished?: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const { activeEmployees, isLoading: empLoading } = useLabelEmployees();
  const { products, isLoading: prodLoading } = useLabelProducts();
  const { createLabel } = useLabels();
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();

  const [employee, setEmployee] = useState<LabelEmployee | null>(null);
  const [product, setProduct] = useState<LabelProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const [now, setNow] = useState(new Date());
  const [supplierExpiry, setSupplierExpiry] = useState<Date | null>(null);
  const [noSupplierExpiry, setNoSupplierExpiry] = useState(false);
  const [batch, setBatch] = useState("");
  const [quantityWeight, setQuantityWeight] = useState("");
  const [conservation, setConservation] = useState<string>("refrigerated");
  const [notes, setNotes] = useState("");
  const [cif, setCif] = useState("");
  const [allergens, setAllergens] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [cnpjInput, setCnpjInput] = useState("");
  const [cepInput, setCepInput] = useState("");
  const [savingLegal, setSavingLegal] = useState(false);
  const [printQty, setPrintQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setNow(new Date());
      setConservation(product.conservation_method || "refrigerated");
      setNotes(product.default_observation || product.notes || "");
      setCif(product.cif || "");
      setAllergens((product as any).allergens || "");
      setIngredients((product as any).ingredients || "");
      setSupplierExpiry(null);
      setNoSupplierExpiry(false);
    }
  }, [product]);

  // CNPJ/CEP do restaurante para a etiqueta
  const { data: restaurantLegal } = useQuery({
    queryKey: ["restaurant-legal", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("restaurants")
        .select("cnpj, address")
        .eq("id", restaurant!.id)
        .maybeSingle();
      const address: string = data?.address || "";
      const cepMatch = address.match(/\d{5}-?\d{3}/);
      return { cnpj: data?.cnpj || null, cep: cepMatch ? cepMatch[0] : null };
    },
  });

  useEffect(() => {
    setCnpjInput(restaurantLegal?.cnpj || "");
    setCepInput(restaurantLegal?.cep || "");
  }, [restaurantLegal?.cnpj, restaurantLegal?.cep]);

  const saveLegal = async () => {
    if (!restaurant?.id) return;
    setSavingLegal(true);
    try {
      await (supabase as any)
        .from("restaurants")
        .update({
          cnpj: cnpjInput.trim() || null,
          address: cepInput.trim() ? `CEP ${cepInput.trim()}` : null,
        })
        .eq("id", restaurant.id);
      await qc.invalidateQueries({ queryKey: ["restaurant-legal", restaurant.id] });
      toast.success("Dados do estabelecimento salvos");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingLegal(false);
    }
  };

  const manipulationExpiry = useMemo(() => {
    if (!product) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + product.validity_days);
    return d;
  }, [product, now]);

  const expiryDate = useMemo(() => {
    if (!manipulationExpiry) return null;
    if (supplierExpiry && supplierExpiry < manipulationExpiry) return supplierExpiry;
    return manipulationExpiry;
  }, [manipulationExpiry, supplierExpiry]);

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
    setSupplierExpiry(null); setNoSupplierExpiry(false);
    setBatch(""); setQuantityWeight(""); setNotes(""); setCif("");
    setAllergens(""); setIngredients(""); setStorageLocation(""); setPrintQty(1);
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
        cif: cif.trim() || null,
        allergens: allergens.trim() || null,
        ingredients: ingredients.trim() || null,
      });
      const scanUrl = `${getSiteBaseUrl()}/etiquetas/scan/${inserted.unique_code}`;
      const qrSvg = renderToStaticMarkup(
        <QRCodeSVG value={scanUrl} size={120} level="M" marginSize={0} />
      );
      printLabels({
        productName: product.name,
        manufactureDate: now,
        expiryDate,
        supplierExpiryDate: supplierExpiry,
        responsible: employee.name,
        notes: notes.trim() || null,
        cif: cif.trim() || null,
        allergens: allergens.trim() || null,
        ingredients: ingredients.trim() || null,
        conservationLabel: CONSERVATION_LABEL[conservation as keyof typeof CONSERVATION_LABEL] || null,
        storageLocation: storageLocation.trim() || null,
        batch: batch.trim() || null,
        quantityWeight: quantityWeight.trim() || null,
        restaurantName: restaurant?.name || null,
        restaurantLogoUrl: restaurant?.logo_url || null,
        restaurantCnpj: cnpjInput.trim() || restaurantLegal?.cnpj || null,
        restaurantCep: cepInput.trim() || restaurantLegal?.cep || null,
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
        {[1, 2, 3, 4].map((n) => (
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
                    {CONSERVATION_LABEL[p.conservation_method || "refrigerated"]} · {p.validity_days} dia(s) pós-manipulação
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && product && employee && manipulationExpiry && (
        <div className="space-y-5 max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /></Button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Qual a validade na embalagem?</h2>
              <p className="text-sm text-muted-foreground">Produto: <strong>{product.name}</strong></p>
            </div>
          </div>

          <Card className="p-5 space-y-4 bg-card/40">
            <div className="space-y-2">
              <Label>Validade impressa na embalagem do fornecedor</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={noSupplierExpiry}
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal text-base",
                      !supplierExpiry && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {supplierExpiry ? format(supplierExpiry, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={supplierExpiry ?? undefined}
                    onSelect={(d) => { setSupplierExpiry(d ?? null); if (d) setNoSupplierExpiry(false); }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Encontre essa data no rótulo ou embalagem do produto.</p>
            </div>

            <Button
              type="button"
              variant={noSupplierExpiry ? "default" : "outline"}
              className="w-full"
              onClick={() => {
                setNoSupplierExpiry((v) => !v);
                setSupplierExpiry(null);
              }}
            >
              {noSupplierExpiry ? "✓ Sem validade impressa" : "Não tem validade impressa"}
            </Button>

            <Button
              size="lg"
              className="w-full h-12 font-bold"
              disabled={!supplierExpiry && !noSupplierExpiry}
              onClick={() => setStep(4)}
            >
              Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Card>
        </div>
      )}

      {step === 4 && product && employee && expiryDate && manipulationExpiry && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4 bg-card/40">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4" /></Button>
              <h2 className="text-xl font-bold flex-1">Confirmar e imprimir</h2>
            </div>

            <div className="p-3 rounded-xl border border-border/50 space-y-1 text-xs">
              {supplierExpiry && (
                <div className="flex justify-between"><span className="text-muted-foreground">Validade do fornecedor:</span><span className="font-semibold">{format(supplierExpiry, "dd/MM/yyyy", { locale: ptBR })}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Validade pós-manipulação:</span><span className="font-semibold">{format(manipulationExpiry, "dd/MM/yyyy", { locale: ptBR })} ({product.validity_days} dia(s))</span></div>
              <div className="flex justify-between pt-1 border-t border-border/40 mt-1"><span className="font-semibold">Validade final na etiqueta:</span><span className="font-bold text-primary">{format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}</span></div>
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
              <Label>CIF — Comunicado de Início de Fabricação (opcional)</Label>
              <Input
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                maxLength={80}
                placeholder="Nº do CIF junto à Anvisa/Vigilância Sanitária"
              />
            </div>

            <div className="space-y-1">
              <Label>Alergênicos (RDC 26/2015)</Label>
              <Input
                value={allergens}
                onChange={(e) => setAllergens(e.target.value)}
                maxLength={200}
                placeholder="Ex: glúten, leite, ovo, soja"
              />
            </div>

            <div className="space-y-1">
              <Label>Ingredientes</Label>
              <Textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="Em ordem decrescente de quantidade"
              />
            </div>

            <div className="space-y-1">
              <Label>Local de armazenamento</Label>
              <Input
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                maxLength={40}
                placeholder="Ex: Geladeira 1, Freezer 2, Bancada"
              />
            </div>

            <div className="p-3 rounded-xl border border-border/50 space-y-2">
              <div className="text-xs uppercase font-bold text-muted-foreground">Dados do estabelecimento (impressos na etiqueta)</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={cnpjInput} onChange={(e) => setCnpjInput(e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <Input value={cepInput} onChange={(e) => setCepInput(e.target.value)} placeholder="00000-000" />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={saveLegal} disabled={savingLegal} className="w-full">
                {savingLegal ? "Salvando..." : "Salvar dados do estabelecimento"}
              </Button>
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
              className="bg-white text-black font-sans overflow-hidden flex flex-col mx-auto shadow"
              style={{ width: "340px", height: "170px", padding: "10px 12px", fontSize: "10px", lineHeight: 1.2 }}
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

              {/* LOCAL — linha própria */}
              <div className="flex" style={{ fontSize: "10px", lineHeight: 1.3, marginBottom: "4px" }}>
                <span className="font-bold" style={{ minWidth: "55px" }}>LOCAL:</span>
                <span className="font-semibold uppercase">{storageLocation || "—"}</span>
              </div>

              {/* Rodapé + QR */}
              <div className="flex justify-between items-end gap-2 flex-1">
                <div className="flex-1 min-w-0" style={{ fontSize: "9px", lineHeight: 1.25 }}>
                  <div className="truncate"><span className="font-bold">RESP:</span> {employee.name}</div>
                  {restaurant?.name && <div className="font-bold uppercase truncate">{restaurant.name}</div>}
                  {(cnpjInput || restaurantLegal?.cnpj) && <div className="truncate"><span className="font-bold">CNPJ:</span> {cnpjInput || restaurantLegal?.cnpj}</div>}
                  {cif && <div className="truncate"><span className="font-bold">CIF:</span> {cif}</div>}
                  {(cepInput || restaurantLegal?.cep) && <div className="truncate"><span className="font-bold">CEP:</span> {cepInput || restaurantLegal?.cep}</div>}
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/PREVIEW`} size={46} level="M" marginSize={0} />
                  <div className="font-bold" style={{ fontSize: "8px" }}>#PREVIEW</div>
                </div>
              </div>

              {allergens && (
                <div className="font-extrabold uppercase text-center border border-black" style={{ fontSize: "9px", padding: "1px 3px", marginTop: "3px", letterSpacing: "0.3px" }}>
                  CONTÉM: {allergens}
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
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Loader2, LogOut, Maximize2, Printer, Search, User, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import { useLabelEmployees, LabelEmployee } from "@/hooks/useLabelEmployees";
import { useLabels } from "@/hooks/useLabels";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { getCategoryHex, getCategoryIcon, getValidityRisk, withAlpha } from "@/lib/labels/categories";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { getSiteBaseUrl } from "@/config/site-url";
import { printLabels } from "@/components/labels/LabelPrintSheet";
import { cn } from "@/lib/utils";

type Phase = "products" | "employee" | "confirm";

const initials = (name: string) =>
  name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

export default function EtiquetasQuiosque() {
  const navigate = useNavigate();
  const { products, isLoading: prodLoading } = useLabelProducts();
  const { activeEmployees, isLoading: empLoading } = useLabelEmployees();
  const { createLabel } = useLabels();
  const { restaurant } = useRestaurant();

  const [phase, setPhase] = useState<Phase>("products");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<LabelProduct | null>(null);
  const [employee, setEmployee] = useState<LabelEmployee | null>(null);

  const [now, setNow] = useState(new Date());
  const [batch, setBatch] = useState("");
  const [quantityWeight, setQuantityWeight] = useState("");
  const [conservation, setConservation] = useState<string>("refrigerated");
  const [notes, setNotes] = useState("");
  const [printQty, setPrintQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  // try to enter fullscreen on mount (no error if blocked)
  useEffect(() => {
    const el = rootRef.current;
    if (el && document.fullscreenEnabled && !document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (product) {
      setNow(new Date());
      setConservation(product.conservation_method || "refrigerated");
      setNotes(product.default_observation || product.notes || "");
    }
  }, [product]);

  const activeProducts = useMemo(
    () => products.filter((p) => (p.status ?? "active") === "active"),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return activeProducts;
    return activeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.category || "").toLowerCase().includes(s)
    );
  }, [activeProducts, search]);

  const expiryDate = useMemo(() => {
    if (!product) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + product.validity_days);
    return d;
  }, [product, now]);

  const enterFullscreen = () => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const handleExit = async () => {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    navigate("/etiquetas");
  };

  const reset = () => {
    setPhase("products");
    setProduct(null);
    setEmployee(null);
    setBatch("");
    setQuantityWeight("");
    setNotes("");
    setPrintQty(1);
    setSearch("");
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
        cif: product.cif?.trim() || null,
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
    } catch (e: any) {
      toast.error(e.message || "Erro ao imprimir");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] overflow-y-auto text-white"
      style={{
        backgroundColor: "#0F0F1A",
        backgroundImage:
          "radial-gradient(circle at 15% 10%, rgba(255,107,0,0.10) 0%, transparent 45%), radial-gradient(circle at 90% 90%, rgba(159,122,234,0.08) 0%, transparent 50%)",
      }}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0F0F1A]/70 border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight leading-none">
              <span className="text-white">MESA</span>
              <span className="text-[#FF6B00]">CLIK</span>
            </h1>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-2 hidden sm:inline">
              Modo Quiosque
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enterFullscreen}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white transition-all"
              title="Tela cheia"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Tela cheia
            </button>
            <button
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white transition-all"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair do Quiosque
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* PHASE 1: PRODUCTS */}
        {phase === "products" && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                O que vai etiquetar agora?
              </h2>
              <p className="text-white/50 text-sm">Toque em um produto para começar.</p>
            </div>

            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <Input
                autoFocus
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-14 h-16 text-lg rounded-2xl bg-white/[0.04] backdrop-blur-xl border-white/10 placeholder:text-white/30 focus-visible:border-[#FF6B00] focus-visible:ring-2 focus-visible:ring-[#FF6B00]/30"
              />
            </div>

            {prodLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" /></div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-white/40">Nenhum produto encontrado.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((p) => {
                  const risk = getValidityRisk(p.validity_days);
                  const hex = getCategoryHex(p.category);
                  const icon = getCategoryIcon(p.category);
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setProduct(p); setPhase("employee"); }}
                      className="group relative text-left p-5 min-h-[160px] rounded-2xl border border-white/[0.06] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_25px_70px_-20px_rgba(255,107,0,0.4)] overflow-hidden flex flex-col justify-between"
                      style={{
                        background: `linear-gradient(135deg, ${withAlpha(hex, 0.12)} 0%, rgba(255,255,255,0.02) 50%, rgba(15,15,26,0.6) 100%)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px -16px ${withAlpha(hex, 0.4)}`,
                      }}
                    >
                      <span
                        className="absolute left-0 top-5 bottom-5 w-[4px] rounded-full"
                        style={{
                          background: `linear-gradient(180deg, ${hex} 0%, ${withAlpha(hex, 0.3)} 100%)`,
                          boxShadow: `0 0 18px ${withAlpha(hex, 0.8)}`,
                        }}
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-60"
                        style={{ background: `radial-gradient(circle, ${hex} 0%, transparent 70%)` }}
                      />
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="text-[20px] font-bold leading-tight text-white tracking-tight line-clamp-2">
                            {p.name}
                          </h3>
                          {icon && <span className="text-3xl leading-none select-none shrink-0">{icon}</span>}
                        </div>
                        {p.category && (
                          <span
                            className="inline-block text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border rounded-full px-2.5 py-0.5"
                            style={{
                              backgroundColor: withAlpha(hex, 0.14),
                              borderColor: withAlpha(hex, 0.35),
                              color: hex,
                            }}
                          >
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="font-semibold text-white">{p.validity_days} {p.validity_days === 1 ? "dia" : "dias"}</span>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-md"
                          style={risk.style}
                        >
                          {risk.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PHASE 2: EMPLOYEE */}
        {phase === "employee" && product && (
          <div className="space-y-8">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <button
                onClick={() => { setPhase("products"); setProduct(null); }}
                className="inline-flex items-center justify-center h-12 w-12 rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-white/40">Imprimindo</p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.name}</h2>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-bold">Quem está imprimindo?</h3>
              <p className="text-white/50 text-sm mt-1">Toque no seu nome.</p>
            </div>

            {empLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" /></div>
            ) : activeEmployees.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl text-white/50 max-w-xl mx-auto">
                <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Cadastre funcionários antes de usar o Quiosque.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
                {activeEmployees.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { setEmployee(e); setPhase("confirm"); }}
                    className="group relative p-6 min-h-[170px] rounded-2xl border border-white/[0.06] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#FF6B00]/40 hover:shadow-[0_25px_70px_-20px_rgba(255,107,0,0.45)] text-center overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,107,0,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(15,15,26,0.6) 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px -16px rgba(255,107,0,0.35)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-60"
                      style={{ background: "radial-gradient(circle, #FF6B00 0%, transparent 70%)" }}
                    />
                    <div className="h-20 w-20 mx-auto rounded-full flex items-center justify-center font-bold text-3xl mb-4 transition-transform group-hover:scale-110"
                      style={{
                        background: "linear-gradient(135deg, rgba(255,107,0,0.25) 0%, rgba(255,107,0,0.08) 100%)",
                        color: "#FF6B00",
                        border: "1px solid rgba(255,107,0,0.3)",
                      }}
                    >
                      {initials(e.name)}
                    </div>
                    <div className="font-bold text-white text-lg truncate">{e.name}</div>
                    {e.role && <div className="text-xs text-white/50 truncate mt-1">{e.role}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PHASE 3: CONFIRM */}
        {phase === "confirm" && product && employee && expiryDate && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase("employee")}
                className="inline-flex items-center justify-center h-12 w-12 rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-white/40">Confirmar impressão</p>
                <h2 className="text-2xl font-bold">{product.name}</h2>
              </div>
            </div>

            <div
              className="p-6 rounded-2xl border border-white/[0.06] backdrop-blur-xl"
              style={{
                background: "linear-gradient(135deg, rgba(255,107,0,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(15,15,26,0.55) 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Responsável</div>
                  <div className="font-semibold mt-1">{employee.name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Conservação</div>
                  <div className="font-semibold mt-1">{CONSERVATION_LABEL[conservation as any] || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Fabricação</div>
                  <div className="font-semibold mt-1">{format(now, "dd/MM HH:mm", { locale: ptBR })}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Validade</div>
                  <div className="font-semibold mt-1 text-[#FF6B00]">{format(expiryDate, "dd/MM/yyyy", { locale: ptBR })}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Lote</Label>
                  <Input value={batch} onChange={(e) => setBatch(e.target.value)} maxLength={30} className="h-11 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Qtd / Peso</Label>
                  <Input value={quantityWeight} onChange={(e) => setQuantityWeight(e.target.value)} placeholder="500g, 1L..." className="h-11 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30" />
                </div>
              </div>

              <div className="space-y-1.5 mt-4">
                <Label className="text-xs text-white/60">Observação</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={200} className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/30" />
              </div>

              <div className="flex items-center justify-between p-4 mt-6 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-sm font-semibold">Etiquetas a imprimir</span>
                <div className="flex items-center gap-3">
                  <Button type="button" size="icon" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={() => setPrintQty((q) => Math.max(1, q - 1))}>−</Button>
                  <span className="text-2xl font-bold w-10 text-center">{printQty}</span>
                  <Button type="button" size="icon" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={() => setPrintQty((q) => Math.min(10, q + 1))}>+</Button>
                </div>
              </div>

              <Button
                onClick={handlePrint}
                disabled={submitting}
                size="lg"
                className="w-full h-14 mt-6 font-bold text-base bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white shadow-[0_10px_40px_-10px_rgba(255,107,0,0.7)]"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Printer className="h-5 w-5 mr-2" />}
                IMPRIMIR ETIQUETA
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
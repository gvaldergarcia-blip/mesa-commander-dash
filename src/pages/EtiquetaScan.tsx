import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CalendarDays, CalendarX, User, CheckCircle2, XCircle,
  Utensils, Package, X, Building2, Hash, ShieldCheck,
  Snowflake, Flame, Thermometer, Refrigerator,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONSERVATION_LABEL, REASON_LABEL, classifyExpiry } from "@/lib/labels/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateLabelData } from "@/hooks/useLabelsLiveSync";
import { formatBase, toBase, type StockBase } from "@/lib/labels/stockUnits";


const conservationIcon = (c: string | null) => {
  switch (c) {
    case "frozen": return Snowflake;
    case "hot": return Flame;
    case "ambient": return Thermometer;
    default: return Refrigerator;
  }
};

export default function EtiquetaScan() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submitLock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<any>(null);
  const reason = "use";
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState<{ base: StockBase; value: number; unit: string } | null>(null);
  const [usedQty, setUsedQty] = useState<string>("");
  const [usedUnit, setUsedUnit] = useState<string | null>(null);

  /** A operação escolhe como o consumo foi medido no momento da baixa. */
  const unitOptions = balance?.base === "g" ? ["g", "kg"] : balance?.base === "ml" ? ["ml", "l"] : ["un"];

  /** Unidade sugerida: peso do produto (g/kg) quando existir, senão unidade. */
  const suggestedUnit = useMemo(() => {
    const candidates = [
      balance?.unit,
      balance?.base,
      label?.weight_unit,
      label?.unit,
    ];
    for (const c of candidates) {
      const v = String(c || "").toLowerCase().trim();
      if (["g", "kg", "un", "ml", "l"].includes(v)) return v;
      if (v === "gr" || v === "grama" || v === "gramas") return "g";
      if (v === "quilo" || v === "quilos") return "kg";
    }
    return "un";
  }, [balance?.unit, balance?.base, label?.weight_unit, label?.unit]);

  useEffect(() => {
    setUsedUnit((u) => (u && unitOptions.includes(u) ? u : suggestedUnit));
  }, [suggestedUnit]);

  const effUnit = usedUnit ?? suggestedUnit;
  const qtyNum = Number(String(usedQty).replace(",", "."));
  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;
  const usedBase = balance && qtyValid ? toBase(qtyNum, effUnit).value : 0;
  const afterBase = balance ? balance.value - usedBase : 0;
  const overBalance = !!balance && qtyValid && usedBase > balance.value + 1e-9;
  /** Toda baixa por uso exige a quantidade exata consumida. */
  const missingUseQty = reason === "use" && !qtyValid;

  const load = async () => {
    if (!code) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_label_by_code", { _code: code });
    if (error) toast.error(error.message);
    setLabel(data);
    setLoading(false);
    try {
      const { data: b } = await (supabase as any).rpc("label_balance_by_code", { _code: code });
      if (b?.found) {
        setBalance({ base: b.base as StockBase, value: Number(b.balance_base) || 0, unit: b.entry_unit || "un" });
      } else {
        setBalance(null);
      }
    } catch (_) { setBalance(null); }
  };

  useEffect(() => { load(); }, [code]);

  /** BAIXA POR USO — movimentação quantitativa, NÃO exclusão da etiqueta. */
  const handleRegisterUse = async () => {
    if (!code) return;
    if (!qtyValid) {
      toast.error("Informe a quantidade utilizada");
      return;
    }
    if (balance && overBalance) {
      toast.error(`Quantidade superior ao saldo disponível (${formatBase(balance.value, balance.base)})`);
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const { data: usage, error } = await (supabase as any).rpc("label_register_usage", {
        _code: code,
        _quantity: qtyNum,
        _unit: effUnit,
        _reason: "use",
        _employee_id: null,
        _notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      if (!usage?.success) {
        if (usage?.error === "insufficient_stock") {
          toast.error(
            `Quantidade superior ao saldo disponível (${formatBase(Number(usage.balance_base) || 0, usage.base)})`,
          );
        } else {
          throw new Error(usage?.error || "Erro ao registrar o uso");
        }
        return;
      }

      const after = Number(usage.balance_after_base) || 0;
      toast.success(`Uso registrado. Saldo: ${formatBase(after, usage.base)}`);

      try {
        await (supabase as any).functions.invoke("send-label-discharge-alert", {
          body: {
            restaurant_id: label?.restaurant_id,
            product_id: usage?.product_id,
            product_name: usage?.product_name || label?.product_name,
            reason: "use",
            quantity: qtyNum,
            unit: effUnit,
            fully_discharged: after <= 0.0000001,
          },
        });
      } catch (_) { /* ignore */ }

      setUsedQty("");
      setNotes("");
      invalidateLabelData(qc, label?.restaurant_id);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar o uso");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const closeNav = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-scan-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-scan-primary" />
      </div>
    );
  }

  if (!label?.found) {
    if (code === "PREVIEW") {
      return (
        <div className="min-h-screen bg-scan-background flex items-center justify-center p-4">
          <div className="bg-scan-surface border border-scan-border rounded-3xl shadow-xl p-8 max-w-md text-center">
            <Package className="h-12 w-12 mx-auto text-scan-primary mb-3" />
            <h1 className="text-xl font-bold text-scan-foreground">QR de pré-visualização</h1>
            <p className="text-scan-secondary mt-2">
              Este é apenas um QR de exemplo exibido na tela de impressão.
              Imprima uma etiqueta real para escanear e dar baixa.
            </p>
            <Button onClick={closeNav} className="mt-5 px-4 py-2 rounded-lg bg-scan-primary text-scan-foreground font-semibold">Voltar</Button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-scan-background flex items-center justify-center p-4">
        <div className="bg-scan-surface border border-scan-border rounded-3xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="h-12 w-12 mx-auto text-scan-danger mb-3" />
          <h1 className="text-xl font-bold text-scan-foreground">Etiqueta não encontrada</h1>
          <p className="text-scan-secondary mt-2">O código <strong className="text-scan-foreground">#{code}</strong> não corresponde a nenhuma etiqueta.</p>
          <Button onClick={closeNav} className="mt-5 px-4 py-2 rounded-lg bg-scan-primary text-scan-foreground font-semibold">Voltar</Button>
        </div>
      </div>
    );
  }

  const cls = classifyExpiry(label.expiry_date);
  const isExpired = label.is_expired || cls === "expired";
  const isDischarged = label.status === "discharged";

  // Urgency
  const urgency = isDischarged
    ? { label: "BAIXADA", badge: "bg-scan-border text-scan-secondary", border: "border-l-scan-border" }
    : isExpired
    ? { label: "VENCIDA", badge: "bg-scan-danger/20 text-scan-danger-foreground", border: "border-l-scan-danger" }
    : cls === "today"
    ? { label: "VENCE HOJE", badge: "bg-scan-danger/20 text-scan-danger-foreground", border: "border-l-scan-danger" }
    : cls === "tomorrow"
    ? { label: "ATENÇÃO", badge: "bg-scan-warning/20 text-scan-warning", border: "border-l-scan-warning" }
    : { label: "OK", badge: "bg-scan-success-muted text-scan-success-foreground", border: "border-l-scan-success" };

  const ConsIcon = conservationIcon(label.conservation_method);

  return (
    <div className="min-h-[100dvh] w-full min-w-0 max-w-full overflow-x-clip bg-scan-background text-scan-foreground p-3 pb-40">
      <div className="w-full min-w-0 max-w-md mx-auto pt-2">
        {/* Header */}
        <div className="flex items-center justify-between px-1 py-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-scan-primary/15 border border-scan-primary/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-scan-primary" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Etiqueta</div>
              <div className="text-[10px] uppercase tracking-widest text-scan-secondary">
                Baixa por uso
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={closeNav} className="text-scan-secondary hover:text-scan-foreground p-2" aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Code field (Yeschef-style outlined input) */}
        <div className="mb-3 rounded-2xl border border-scan-border bg-scan-surface px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-scan-secondary">
            <Hash className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">Código</span>
          </div>
          <div className="font-mono font-bold text-base tracking-[0.2em] text-scan-primary">
            {label.unique_code}
          </div>
        </div>

        {/* Card */}
        <div
          className={`bg-scan-surface rounded-3xl border border-scan-border border-l-4 overflow-hidden ${urgency.border}`}
        >
          {/* Product name + status badge */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              {!isDischarged ? (
                <CheckCircle2 className="h-6 w-6 text-scan-success shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-scan-secondary shrink-0 mt-0.5" />
              )}
              <h2 className="text-2xl font-bold text-scan-foreground leading-tight">{label.product_name}</h2>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wider shrink-0 ${urgency.badge}`}
            >
              {urgency.label}
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-3 px-5 pb-4 text-sm">
            <div className="bg-scan-muted rounded-xl p-3 border border-scan-border">
              <div className="text-[10px] uppercase tracking-wider text-scan-secondary font-semibold mb-0.5">Lote</div>
              <div className="text-scan-foreground font-medium truncate">{label.batch || "—"}</div>
            </div>
            <div className="bg-scan-muted rounded-xl p-3 border border-scan-border">
              <div className="text-[10px] uppercase tracking-wider text-scan-secondary font-semibold mb-0.5">Qtd.</div>
              <div className="text-scan-foreground font-medium">
                {label.units_remaining ?? label.quantity} / {label.quantity}
              </div>
            </div>
            <div className="bg-scan-muted rounded-xl p-3 border border-scan-border">
              <div className="text-[10px] uppercase tracking-wider text-scan-secondary font-semibold mb-0.5 flex items-center gap-1">
                <ConsIcon className="h-3 w-3" /> Conserv.
              </div>
              <div className="text-scan-foreground font-medium text-xs">{CONSERVATION_LABEL[label.conservation_method || ""] || "—"}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="px-5 pb-4 space-y-2.5">
            <div className="flex items-center justify-between bg-scan-muted rounded-xl px-3 py-2.5 border border-scan-border">
              <div className="flex items-center gap-2 text-scan-success text-xs font-semibold">
                <CalendarDays className="h-4 w-4" /> Preparo
              </div>
              <div className="text-scan-foreground text-sm font-medium">
                {format(new Date(label.manufacture_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            <div
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${isExpired ? "bg-scan-danger/10 border-scan-danger/30" : "bg-scan-muted border-scan-border"}`}
            >
              <div className={`flex items-center gap-2 text-xs font-semibold ${isExpired ? "text-scan-danger-foreground" : "text-scan-warning"}`}>
                <CalendarX className="h-4 w-4" /> Vencimento
              </div>
              <div className={`text-sm font-bold ${isExpired ? "text-scan-danger-foreground" : "text-scan-foreground"}`}>
                {format(new Date(label.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Responsible / Restaurant */}
          <div className="px-5 pb-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3.5 w-3.5 text-scan-secondary" />
              <span className="text-scan-secondary">Responsável:</span>
              <span className="text-scan-foreground font-medium truncate">{label.responsible || "—"}</span>
            </div>
            {label.restaurant_name && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="h-3.5 w-3.5 text-scan-secondary" />
                <span className="text-scan-secondary">Empresa:</span>
                <span className="text-scan-foreground font-medium truncate">{label.restaurant_name}</span>
              </div>
            )}
          </div>

          {label.notes && (
            <div className="mx-5 mb-4 p-3 rounded-xl bg-scan-muted border border-scan-border">
              <div className="text-[10px] uppercase tracking-wider text-scan-secondary font-semibold mb-1">Observação</div>
              <p className="text-sm text-scan-foreground italic">{label.notes}</p>
            </div>
          )}

          {/* Last verification info */}
          {label.last_verification && !isDischarged && (
            <div className="mx-5 mb-4 p-3 rounded-xl bg-scan-success-muted/30 border border-scan-success/40">
              <div className="flex items-center gap-2 text-scan-success-foreground text-xs font-semibold mb-1">
                <ShieldCheck className="h-4 w-4" /> Última verificação
              </div>
              <div className="text-xs text-scan-foreground">
                {format(new Date(label.last_verification.verified_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                {label.last_verification.employee_name && <> · por <strong>{label.last_verification.employee_name}</strong></>}
              </div>
            </div>
          )}

          {/* Discharged block */}
          {isDischarged && label.discharge && (
            <div className="mx-5 mb-5 p-4 rounded-xl bg-scan-border border border-scan-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-scan-secondary" />
                <span className="font-bold text-scan-foreground">Etiqueta já baixada</span>
              </div>
              <div className="text-sm text-scan-secondary space-y-1">
                <div>Motivo: <strong className="text-scan-foreground">{REASON_LABEL[label.discharge.reason]}</strong></div>
                <div>Em: {format(new Date(label.discharge.discharged_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                {label.discharge.employee_name && <div>Por: <strong className="text-scan-foreground">{label.discharge.employee_name}</strong></div>}
                {label.discharge.notes && <div className="italic">"{label.discharge.notes}"</div>}
              </div>
            </div>
          )}
        </div>

        {/* Reason picker + sticky action bar (only if not discharged) */}
        {!isDischarged && (
          <>
            <div className="mt-5">
              {/* ===== ESTOQUE DIGITAL — BAIXA POR USO QUANTITATIVA ===== */}
              {reason === "use" && (
                <div className="mt-3 rounded-2xl border border-scan-success/40 bg-scan-surface p-4 ">
                  <div className="text-[10px] uppercase tracking-widest text-scan-success font-bold mb-3">
                    Baixa por uso
                  </div>

                  {balance && (
                    <>
                      <div className="text-[10px] uppercase tracking-widest text-scan-secondary font-semibold">
                        Saldo atual
                      </div>
                      <div className="text-3xl font-black tracking-tight text-scan-foreground leading-none mt-0.5">
                        {formatBase(balance.value, balance.base)}
                      </div>
                    </>
                  )}

                   <div className="mt-4 text-[10px] uppercase tracking-widest text-scan-secondary font-semibold mb-1.5">
                     Quanto foi consumido? *
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={effUnit === "un" ? "0" : "0,000"}
                      value={usedQty}
                      onChange={(e) => setUsedQty(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="min-w-0 w-0 flex-1 h-14 bg-scan-background border border-scan-border focus:border-scan-success outline-none rounded-xl px-4 text-scan-foreground font-black text-2xl tracking-tight"
                    />
                    <div className="grid h-14 shrink-0 grid-flow-col auto-cols-fr rounded-xl bg-scan-background border border-scan-border p-1 gap-1" aria-label="Unidade da quantidade consumida">
                      {unitOptions.map((u) => (
                        <Button
                          variant="ghost"
                          key={u}
                          type="button"
                          onClick={() => setUsedUnit(u)}
                          aria-pressed={effUnit === u}
                          title={u === "g" ? "Gramas" : u === "kg" ? "Quilos" : u === "ml" ? "Mililitros" : u === "l" ? "Litros" : "Unidades"}
                          className={`min-w-10 px-2 rounded-lg text-sm font-bold transition-colors ${
                            effUnit === u ? "bg-scan-success text-scan-background" : "text-scan-secondary hover:text-scan-foreground"
                          }`}
                        >
                          {u}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {balance && overBalance ? (
                    <div className="mt-3 rounded-xl border border-scan-danger/40 bg-scan-danger/10 px-3 py-2.5">
                      <div className="text-sm font-bold text-scan-danger">Quantidade superior ao saldo disponível.</div>
                      <div className="text-[11px] text-scan-danger-foreground mt-0.5">
                        Saldo disponível: <strong>{formatBase(balance.value, balance.base)}</strong>
                      </div>
                    </div>
                  ) : balance && qtyValid ? (
                    <div className="mt-3 rounded-xl bg-scan-background border border-scan-border px-3 py-3">
                      <div className="flex items-center justify-between text-[11px] text-scan-secondary">
                        <span>Uso</span>
                        <span className="text-scan-danger font-bold">
                          −{formatBase(usedBase, balance.base)}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-scan-border">
                        <div className="text-[10px] uppercase tracking-widest text-scan-secondary font-semibold">
                          Saldo após o uso
                        </div>
                        <div className="text-3xl font-black tracking-tight text-scan-success leading-none mt-0.5">
                          {formatBase(afterBase, balance.base)}
                        </div>
                        {afterBase <= 0.0000001 && (
                          <div className="text-[11px] text-scan-warning mt-1 font-semibold">
                            Embalagem esgotada — histórico e rastreabilidade preservados.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-scan-secondary">
                      Informe quanto foi utilizado para atualizar o Estoque Digital.
                    </p>
                  )}
                </div>
              )}

              {reason && (
                <Textarea
                  placeholder="Observação (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={200}
                  className="mt-3 bg-scan-surface border-scan-border text-scan-foreground placeholder:text-scan-secondary"
                />
              )}

            </div>

            {/* Sticky bottom action */}
            <div className="fixed bottom-0 inset-x-0 px-3 pb-4 pt-3 bg-gradient-to-t from-scan-background via-scan-background/95 to-transparent">
              <div className="max-w-md mx-auto">
                <Button
                  onClick={handleRegisterUse}
                  disabled={
                    !balance ||
                    submitting ||
                    missingUseQty ||
                    overBalance
                  }
                  className={`w-full h-14 rounded-2xl disabled:bg-scan-border disabled:text-scan-secondary text-scan-foreground font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-colors ${
                    reason === "use"
                      ? "bg-scan-success hover:bg-scan-success text-scan-background"
                      : "bg-scan-danger hover:bg-scan-danger"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Registrando...
                    </>
                  ) : reason === "use" ? (
                    <>
                      <Utensils className="h-5 w-5" />
                      Confirmar uso
                      {qtyValid && !overBalance
                        ? ` (${balance ? formatBase(usedBase, balance.base) : `${usedQty.replace(".", ",")} ${effUnit}`})`
                        : ""}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5" />
                      Baixar Etiqueta
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-[11px] text-scan-secondary pt-6">
          MesaClik © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

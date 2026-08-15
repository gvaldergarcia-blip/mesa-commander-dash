import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CalendarDays, CalendarX, User, CheckCircle2, XCircle,
  Utensils, AlertTriangle, Package, X, Building2, Hash, Printer, ShieldCheck,
  Snowflake, Flame, Thermometer, Refrigerator, Trash2, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONSERVATION_LABEL, REASON_LABEL, classifyExpiry } from "@/lib/labels/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatBase, toBase, type StockBase } from "@/lib/labels/stockUnits";

type Action = "verify" | "use" | "loss" | "error";
type Reason = "use" | "loss" | "error";

const LOSS_REASONS = [
  { value: "vencimento", label: "Vencimento" },
  { value: "contaminacao", label: "Contaminação" },
  { value: "queda_temperatura", label: "Queda de temperatura" },
  { value: "outros", label: "Outros" },
] as const;

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<any>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [notes, setNotes] = useState("");
  const [lossReason, setLossReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [unitsToDischarge, setUnitsToDischarge] = useState<number>(1);
  const [balance, setBalance] = useState<{ base: StockBase; value: number; unit: string } | null>(null);
  const [usedQty, setUsedQty] = useState<string>("");
  const [usedUnit, setUsedUnit] = useState<string | null>(null);

  /** Unidades permitidas conforme a base de controle do produto. */
  const unitOptions: string[] = !balance
    ? ["g", "kg"]
    : balance.base === "g"
      ? ["kg", "g"]
      : balance.base === "ml"
        ? ["L", "ml"]
        : ["un"];

  useEffect(() => {
    if (!balance) return;
    setUsedUnit((u) => {
      if (u && unitOptions.includes(u)) return u;
      const entry = unitOptions.find((o) => o.toLowerCase() === (balance.unit || "").toLowerCase());
      return entry ?? unitOptions[0];
    });
  }, [balance?.base, balance?.unit]);

  const effUnit = usedUnit ?? balance?.unit ?? "g";
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

  useEffect(() => {
    const requestedAction = searchParams.get("op");
    if (loading || !label?.found || label?.status === "discharged" || action) return;

    if (requestedAction === "1" || requestedAction === "use") {
      setReason("use");
    }
  }, [searchParams, loading, label, action]);

  const handleVerify = async () => {
    if (!code) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("verify_label_by_code", {
        _code: code,
        _employee_id: null,
        _notes: notes.trim() || null,
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Erro ao verificar");
      toast.success("Etiqueta verificada");
      setNotes("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSubmitting(false);
    }
  };

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
    if (submitting) return;
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

      // Saldo zerado: a embalagem está esgotada — fecha a etiqueta mantendo todo o histórico.
      if (after <= 0.0000001) {
        try {
          await (supabase as any).rpc("discharge_label_by_code", {
            _code: code,
            _reason: "use",
            _employee_id: null,
            _notes: notes.trim() || "Saldo esgotado",
            _units: Math.max(1, Number(label?.units_remaining ?? label?.quantity ?? 1)),
          });
        } catch (_) { /* histórico preservado mesmo se falhar */ }
      }

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
      setReason(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar o uso");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDischarge = async () => {
    if (!reason || !code) return;
    if (reason === "use") return handleRegisterUse();
    if (reason === "loss" && !lossReason) {
      toast.error("Selecione o motivo da perda");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const composedNotes =
        reason === "loss"
          ? [LOSS_REASONS.find((r) => r.value === lossReason)?.label, notes.trim()]
              .filter(Boolean)
              .join(" — ")
          : notes.trim() || null;

      const remaining = Math.max(1, Number(label?.units_remaining ?? label?.quantity ?? 1));
      const units = Math.max(1, Math.min(unitsToDischarge || 1, remaining));
      const { data, error } = await (supabase as any).rpc("discharge_label_by_code", {
        _code: code,
        _reason: reason,
        _employee_id: null,
        _notes: composedNotes || null,
        _units: units,
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Erro ao baixar");
      toast.success(
        `${REASON_LABEL[reason]} registrada (${data.units_used} unidade${data.units_used === 1 ? "" : "s"})`,
      );
      // Estoque digital quantitativo: registra a quantidade realmente consumida.
      const qty = Number(String(usedQty).replace(",", "."));
      if (balance && qty > 0) {
        const { data: usage } = await (supabase as any).rpc("label_register_usage", {
          _code: code,
          _quantity: qty,
          _unit: balance.unit,
          _reason: "loss",
          _employee_id: null,
          _notes: composedNotes || null,
        });
        if (usage?.success) {
          toast.success(
            `Estoque atualizado: ${formatBase(Number(usage.balance_after_base) || 0, usage.base)} restantes`,
          );
        } else if (usage?.error === "insufficient_stock") {
          toast.error("Quantidade maior que o saldo disponível — nada foi descontado do estoque.");
        }
      }

      // Notificação SMS/WhatsApp (fire-and-forget)
      try {
        await (supabase as any).functions.invoke("send-label-discharge-alert", {
          body: {
            restaurant_id: label?.restaurant_id,
            label_id: data?.label_id,
            product_id: data?.label_product_id,
            product_name: data?.product_name || label?.product_name,
            reason,
            units: data?.units_used,
            units_remaining: data?.units_remaining,
            fully_discharged: data?.fully_discharged,
          },
        });
      } catch (_) { /* ignore */ }
      setReason(null);
      setNotes("");
      setLossReason("");
      setUnitsToDischarge(1);
      setUsedQty("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  const closeNav = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  if (!label?.found) {
    if (code === "PREVIEW") {
      return (
        <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-4">
          <div className="bg-[#161626] border border-[#2D2D44] rounded-3xl shadow-xl p-8 max-w-md text-center">
            <Package className="h-12 w-12 mx-auto text-[#FF6B00] mb-3" />
            <h1 className="text-xl font-bold text-white">QR de pré-visualização</h1>
            <p className="text-[#A0AEC0] mt-2">
              Este é apenas um QR de exemplo exibido na tela de impressão.
              Imprima uma etiqueta real para escanear e dar baixa.
            </p>
            <button onClick={closeNav} className="mt-5 px-4 py-2 rounded-lg bg-[#FF6B00] text-white font-semibold">Voltar</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-4">
        <div className="bg-[#161626] border border-[#2D2D44] rounded-3xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="h-12 w-12 mx-auto text-[#E53E3E] mb-3" />
          <h1 className="text-xl font-bold text-white">Etiqueta não encontrada</h1>
          <p className="text-[#A0AEC0] mt-2">O código <strong className="text-white">#{code}</strong> não corresponde a nenhuma etiqueta.</p>
          <button onClick={closeNav} className="mt-5 px-4 py-2 rounded-lg bg-[#FF6B00] text-white font-semibold">Voltar</button>
        </div>
      </div>
    );
  }

  const cls = classifyExpiry(label.expiry_date);
  const isExpired = label.is_expired || cls === "expired";
  const isDischarged = label.status === "discharged";

  // Urgency
  const urgency = isDischarged
    ? { label: "BAIXADA", bg: "#2D2D44", text: "#A0AEC0", border: "#2D2D44" }
    : isExpired
    ? { label: "VENCIDA", bg: "#7F1D1D", text: "#FECACA", border: "#E53E3E" }
    : cls === "today"
    ? { label: "VENCE HOJE", bg: "#7F1D1D", text: "#FECACA", border: "#E53E3E" }
    : cls === "tomorrow"
    ? { label: "ATENÇÃO", bg: "#78350F", text: "#FED7AA", border: "#ED8936" }
    : { label: "OK", bg: "#14532D", text: "#BBF7D0", border: "#48BB78" };

  const ConsIcon = conservationIcon(label.conservation_method);

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white p-3 pb-40">
      <div className="max-w-md mx-auto pt-2">
        {/* Header */}
        <div className="flex items-center justify-between px-1 py-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-[#FF6B00]" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Etiqueta</div>
              <div className="text-[10px] uppercase tracking-widest text-[#718096]">
                Baixa direta por QR
              </div>
            </div>
          </div>
          <button onClick={closeNav} className="text-[#718096] hover:text-white p-2" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Code field (Yeschef-style outlined input) */}
        <div className="mb-3 rounded-2xl border border-[#2D2D44] bg-[#161626] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#718096]">
            <Hash className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">Código</span>
          </div>
          <div className="font-mono font-bold text-base tracking-[0.2em] text-[#FF6B00]">
            {label.unique_code}
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-[#161626] rounded-3xl border border-[#2D2D44] overflow-hidden"
          style={{ borderLeftWidth: 4, borderLeftColor: urgency.border }}
        >
          {/* Product name + status badge */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              {!isDischarged ? (
                <CheckCircle2 className="h-6 w-6 text-[#48BB78] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-[#A0AEC0] shrink-0 mt-0.5" />
              )}
              <h2 className="text-2xl font-bold text-white leading-tight">{label.product_name}</h2>
            </div>
            <span
              className="px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wider shrink-0"
              style={{ background: urgency.bg, color: urgency.text }}
            >
              {urgency.label}
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-3 px-5 pb-4 text-sm">
            <div className="bg-[#1A1A2E] rounded-xl p-3 border border-[#2D2D44]">
              <div className="text-[10px] uppercase tracking-wider text-[#718096] font-semibold mb-0.5">Lote</div>
              <div className="text-white font-medium truncate">{label.batch || "—"}</div>
            </div>
            <div className="bg-[#1A1A2E] rounded-xl p-3 border border-[#2D2D44]">
              <div className="text-[10px] uppercase tracking-wider text-[#718096] font-semibold mb-0.5">Qtd.</div>
              <div className="text-white font-medium">
                {label.units_remaining ?? label.quantity} / {label.quantity}
              </div>
            </div>
            <div className="bg-[#1A1A2E] rounded-xl p-3 border border-[#2D2D44]">
              <div className="text-[10px] uppercase tracking-wider text-[#718096] font-semibold mb-0.5 flex items-center gap-1">
                <ConsIcon className="h-3 w-3" /> Conserv.
              </div>
              <div className="text-white font-medium text-xs">{CONSERVATION_LABEL[label.conservation_method || ""] || "—"}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="px-5 pb-4 space-y-2.5">
            <div className="flex items-center justify-between bg-[#1A1A2E] rounded-xl px-3 py-2.5 border border-[#2D2D44]">
              <div className="flex items-center gap-2 text-[#48BB78] text-xs font-semibold">
                <CalendarDays className="h-4 w-4" /> Preparo
              </div>
              <div className="text-white text-sm font-medium">
                {format(new Date(label.manufacture_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{
                background: isExpired ? "#3a1414" : "#1A1A2E",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isExpired ? "#7F1D1D" : "#2D2D44",
              }}
            >
              <div className={`flex items-center gap-2 text-xs font-semibold ${isExpired ? "text-[#FECACA]" : "text-[#ED8936]"}`}>
                <CalendarX className="h-4 w-4" /> Vencimento
              </div>
              <div className={`text-sm font-bold ${isExpired ? "text-[#FECACA]" : "text-white"}`}>
                {format(new Date(label.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Responsible / Restaurant */}
          <div className="px-5 pb-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3.5 w-3.5 text-[#718096]" />
              <span className="text-[#A0AEC0]">Responsável:</span>
              <span className="text-white font-medium truncate">{label.responsible || "—"}</span>
            </div>
            {label.restaurant_name && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="h-3.5 w-3.5 text-[#718096]" />
                <span className="text-[#A0AEC0]">Empresa:</span>
                <span className="text-white font-medium truncate">{label.restaurant_name}</span>
              </div>
            )}
          </div>

          {label.notes && (
            <div className="mx-5 mb-4 p-3 rounded-xl bg-[#1A1A2E] border border-[#2D2D44]">
              <div className="text-[10px] uppercase tracking-wider text-[#718096] font-semibold mb-1">Observação</div>
              <p className="text-sm text-[#E2E8F0] italic">{label.notes}</p>
            </div>
          )}

          {/* Last verification info */}
          {label.last_verification && !isDischarged && (
            <div className="mx-5 mb-4 p-3 rounded-xl bg-[#14532D]/30 border border-[#48BB78]/40">
              <div className="flex items-center gap-2 text-[#BBF7D0] text-xs font-semibold mb-1">
                <ShieldCheck className="h-4 w-4" /> Última verificação
              </div>
              <div className="text-xs text-[#E2E8F0]">
                {format(new Date(label.last_verification.verified_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                {label.last_verification.employee_name && <> · por <strong>{label.last_verification.employee_name}</strong></>}
              </div>
            </div>
          )}

          {/* Discharged block */}
          {isDischarged && label.discharge && (
            <div className="mx-5 mb-5 p-4 rounded-xl bg-[#2D2D44] border border-[#2D2D44]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-[#A0AEC0]" />
                <span className="font-bold text-white">Etiqueta já baixada</span>
              </div>
              <div className="text-sm text-[#A0AEC0] space-y-1">
                <div>Motivo: <strong className="text-white">{REASON_LABEL[label.discharge.reason]}</strong></div>
                <div>Em: {format(new Date(label.discharge.discharged_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                {label.discharge.employee_name && <div>Por: <strong className="text-white">{label.discharge.employee_name}</strong></div>}
                {label.discharge.notes && <div className="italic">"{label.discharge.notes}"</div>}
              </div>
            </div>
          )}
        </div>

        {/* Reason picker + sticky action bar (only if not discharged) */}
        {!isDischarged && (
          <>
            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-widest text-[#718096] font-semibold mb-2 px-1">
                Selecione o motivo da baixa:
              </div>
              <div className="space-y-2">
                <ReasonOption
                  selected={reason === "use"}
                  onClick={() => setReason("use")}
                  icon={<Utensils className="h-5 w-5" />}
                  color="#48BB78"
                  title="Baixa por Uso"
                  hint="Produto utilizado"
                />
                <ReasonOption
                  selected={reason === "loss"}
                  onClick={() => setReason("loss")}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color="#E53E3E"
                  title="Baixa por Perda"
                  hint="Produto descartado"
                />
                <ReasonOption
                  selected={reason === "error"}
                  onClick={() => setReason("error")}
                  icon={<Printer className="h-5 w-5" />}
                  color="#ED8936"
                  title="Baixa por Erro"
                  hint="Impressão errada"
                />
              </div>

              {reason === "loss" && (
                <div className="mt-3 space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#718096] font-semibold px-1">
                    Motivo da perda *
                  </label>
                  <Select value={lossReason} onValueChange={setLossReason}>
                    <SelectTrigger className="bg-[#161626] border-[#2D2D44] text-white">
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161626] border-[#2D2D44] text-white">
                      {LOSS_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-white focus:bg-[#2D2D44] focus:text-white">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {reason && (
                <Textarea
                  placeholder="Observação (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={200}
                  className="mt-3 bg-[#161626] border-[#2D2D44] text-white placeholder:text-[#4A5568]"
                />
              )}

              {/* ===== ESTOQUE DIGITAL — BAIXA POR USO QUANTITATIVA ===== */}
              {reason === "use" && (
                <div className="mt-3 rounded-2xl border border-[#48BB78]/40 bg-[#161626] p-4 shadow-[0_0_0_1px_rgba(72,187,120,0.06)]">
                  <div className="text-[10px] uppercase tracking-widest text-[#48BB78] font-bold mb-3">
                    Baixa por uso
                  </div>

                  {balance && (
                    <>
                      <div className="text-[10px] uppercase tracking-widest text-[#718096] font-semibold">
                        Saldo atual
                      </div>
                      <div className="text-3xl font-black tracking-tight text-white leading-none mt-0.5">
                        {formatBase(balance.value, balance.base)}
                      </div>
                    </>
                  )}

                  <div className="mt-4 text-[10px] uppercase tracking-widest text-[#718096] font-semibold mb-1.5">
                    Quantidade utilizada *
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      placeholder="0,000"
                      value={usedQty}
                      onChange={(e) => setUsedQty(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="flex-1 h-14 bg-[#0F0F1A] border border-[#2D2D44] focus:border-[#48BB78] outline-none rounded-xl px-4 text-white font-black text-2xl tracking-tight"
                    />
                    {unitOptions.length > 1 ? (
                      <div className="flex h-14 rounded-xl bg-[#0F0F1A] border border-[#2D2D44] p-1 gap-1">
                        {unitOptions.map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setUsedUnit(u)}
                            className={`px-4 rounded-lg text-sm font-bold transition-colors ${
                              effUnit === u ? "bg-[#48BB78] text-[#0F0F1A]" : "text-[#718096] hover:text-white"
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="h-14 px-5 inline-flex items-center rounded-xl bg-[#2D2D44] text-white font-bold text-sm">
                        {effUnit}
                      </span>
                    )}
                  </div>

                  {balance && overBalance ? (
                    <div className="mt-3 rounded-xl border border-[#E53E3E]/40 bg-[#E53E3E]/10 px-3 py-2.5">
                      <div className="text-sm font-bold text-[#E53E3E]">Quantidade superior ao saldo disponível.</div>
                      <div className="text-[11px] text-[#FEB2B2] mt-0.5">
                        Saldo disponível: <strong>{formatBase(balance.value, balance.base)}</strong>
                      </div>
                    </div>
                  ) : balance && qtyValid ? (
                    <div className="mt-3 rounded-xl bg-[#0F0F1A] border border-[#2D2D44] px-3 py-3">
                      <div className="flex items-center justify-between text-[11px] text-[#718096]">
                        <span>Uso</span>
                        <span className="text-[#E53E3E] font-bold">
                          −{formatBase(usedBase, balance.base)}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#2D2D44]">
                        <div className="text-[10px] uppercase tracking-widest text-[#718096] font-semibold">
                          Saldo após o uso
                        </div>
                        <div className="text-3xl font-black tracking-tight text-[#48BB78] leading-none mt-0.5">
                          {formatBase(afterBase, balance.base)}
                        </div>
                        {afterBase <= 0.0000001 && (
                          <div className="text-[11px] text-[#ED8936] mt-1 font-semibold">
                            Embalagem esgotada — histórico e rastreabilidade preservados.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-[#718096]">
                      Informe quanto foi utilizado para atualizar o Estoque Digital.
                    </p>
                  )}
                </div>
              )}

              {/* Perda / erro: quantidade opcional enquanto o fluxo não é quantitativo */}
              {reason !== "use" && reason && balance && (
                <div className="mt-3 rounded-2xl border border-[#2D2D44] bg-[#161626] p-4">
                  <div className="text-[10px] uppercase tracking-widest text-[#718096] font-semibold mb-1">
                    Quantidade (opcional)
                  </div>
                  <div className="text-xs text-[#A0AEC0] mb-3">
                    Saldo em estoque: <strong className="text-white">{formatBase(balance.value, balance.base)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={usedQty}
                      onChange={(e) => setUsedQty(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="flex-1 h-12 bg-[#0F0F1A] border border-[#2D2D44] rounded-xl px-3 text-white font-bold text-lg outline-none"
                    />
                    <span className="h-12 px-4 inline-flex items-center rounded-xl bg-[#2D2D44] text-white font-semibold text-sm">
                      {effUnit}
                    </span>
                  </div>
                  {qtyValid && (
                    <div className="mt-2 text-[11px] text-[#718096]">
                      Saldo após:{" "}
                      <strong className={overBalance ? "text-[#E53E3E]" : "text-white"}>
                        {overBalance ? "saldo insuficiente" : formatBase(afterBase, balance.base)}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {reason && reason !== "use" && (label.units_remaining ?? label.quantity ?? 1) > 1 && (
                <div className="mt-3 rounded-2xl border border-[#2D2D44] bg-[#161626] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-[#718096] font-semibold mb-2">
                    Quantas unidades? (restam {label.units_remaining ?? label.quantity})
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setUnitsToDischarge((n) => Math.max(1, n - 1))}
                      className="h-10 w-10 rounded-xl bg-[#2D2D44] text-white text-xl font-bold"
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      max={label.units_remaining ?? label.quantity ?? 1}
                      value={unitsToDischarge}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 1;
                        const max = Number(label.units_remaining ?? label.quantity ?? 1);
                        setUnitsToDischarge(Math.max(1, Math.min(v, max)));
                      }}
                      className="flex-1 h-10 bg-[#0F0F1A] border border-[#2D2D44] rounded-xl text-center text-white font-bold text-lg"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setUnitsToDischarge((n) =>
                          Math.min(Number(label.units_remaining ?? label.quantity ?? 1), n + 1),
                        )
                      }
                      className="h-10 w-10 rounded-xl bg-[#2D2D44] text-white text-xl font-bold"
                    >+</button>
                    <button
                      type="button"
                      onClick={() =>
                        setUnitsToDischarge(Number(label.units_remaining ?? label.quantity ?? 1))
                      }
                      className="h-10 px-3 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] font-semibold text-xs"
                    >Todas</button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerify}
                disabled={submitting}
                className="w-full mt-4 text-xs font-semibold text-[#48BB78] hover:text-[#3da066] py-2 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Apenas verificar (está OK)
              </button>
            </div>

            {/* Sticky bottom action */}
            <div className="fixed bottom-0 inset-x-0 px-3 pb-4 pt-3 bg-gradient-to-t from-[#0F0F1A] via-[#0F0F1A]/95 to-transparent">
              <div className="max-w-md mx-auto">
                <button
                  onClick={handleDischarge}
                  disabled={
                    !reason ||
                    submitting ||
                    (reason === "loss" && !lossReason) ||
                    missingUseQty ||
                    overBalance
                  }
                  className={`w-full h-14 rounded-2xl disabled:bg-[#2D2D44] disabled:text-[#4A5568] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-colors ${
                    reason === "use"
                      ? "bg-[#48BB78] hover:bg-[#3da066] text-[#0F0F1A]"
                      : "bg-[#E53E3E] hover:bg-[#c53030]"
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
                </button>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-[11px] text-[#4A5568] pt-6">
          MesaClik © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function ReasonOption({
  selected, onClick, icon, color, title, hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  color: string;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
      style={{
        background: selected ? `${color}1F` : "#161626",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: selected ? color : "#2D2D44",
        boxShadow: selected ? `0 0 0 3px ${color}25` : "none",
      }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}22`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white font-bold text-sm">{title}</div>
        <div className="text-[#A0AEC0] text-xs">{hint}</div>
      </div>
      <div
        className="h-5 w-5 rounded-full border-2 shrink-0"
        style={{
          borderColor: selected ? color : "#2D2D44",
          background: selected ? color : "transparent",
        }}
      />
    </button>
  );
}
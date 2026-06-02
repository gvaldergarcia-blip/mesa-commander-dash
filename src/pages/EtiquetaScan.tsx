import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CalendarDays, CalendarX, User, CheckCircle2, XCircle,
  Utensils, AlertTriangle, Package, X, Building2, Hash, Printer, ShieldCheck,
  Snowflake, Flame, Thermometer, Refrigerator,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONSERVATION_LABEL, REASON_LABEL, classifyExpiry } from "@/lib/labels/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Action = "verify" | "use" | "loss" | "error";

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
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<any>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [notes, setNotes] = useState("");
  const [lossReason, setLossReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!code) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_label_by_code", { _code: code });
    if (error) toast.error(error.message);
    setLabel(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [code]);

  const handleConfirm = async () => {
    if (!action || !code) return;
    setSubmitting(true);

    try {
      if (action === "verify") {
        const { data, error } = await (supabase as any).rpc("verify_label_by_code", {
          _code: code,
          _employee_id: null,
          _notes: notes.trim() || null,
        });
        if (error || !data?.success) throw new Error(error?.message || data?.error || "Erro ao verificar");
        toast.success("Etiqueta verificada");
      } else {
        const reasonKey = action; // 'use' | 'loss' | 'error'
        const composedNotes =
          action === "loss"
            ? [LOSS_REASONS.find((r) => r.value === lossReason)?.label, notes.trim()]
                .filter(Boolean)
                .join(" — ")
            : notes.trim() || null;

        const { data, error } = await (supabase as any).rpc("discharge_label_by_code", {
          _code: code,
          _reason: reasonKey,
          _employee_id: null,
          _notes: composedNotes || null,
        });
        if (error || !data?.success) throw new Error(error?.message || data?.error || "Erro ao baixar");
        toast.success(REASON_LABEL[reasonKey] + " registrada");
      }

      setAction(null);
      setNotes("");
      setLossReason("");
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
    <div className="min-h-screen bg-[#0F0F1A] text-white p-3 pb-24">
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

        {/* Card */}
        <div
          className="bg-[#161626] rounded-3xl border border-[#2D2D44] overflow-hidden"
          style={{ borderLeftWidth: 4, borderLeftColor: urgency.border }}
        >
          {/* Top: code + urgency badge */}
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#718096] mb-1">
                <Hash className="h-3 w-3" /> Código
              </div>
              <div className="font-mono font-bold text-lg tracking-widest text-[#FF6B00]">
                #{label.unique_code}
              </div>
            </div>
            <span
              className="px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wider shrink-0"
              style={{ background: urgency.bg, color: urgency.text }}
            >
              {urgency.label}
            </span>
          </div>

          {/* Product name */}
          <div className="px-5 pb-4">
            <h2 className="text-2xl font-bold text-white leading-tight">{label.product_name}</h2>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-3 px-5 pb-4 text-sm">
            <div className="bg-[#1A1A2E] rounded-xl p-3 border border-[#2D2D44]">
              <div className="text-[10px] uppercase tracking-wider text-[#718096] font-semibold mb-0.5">Lote</div>
              <div className="text-white font-medium truncate">{label.batch || "—"}</div>
            </div>
            <div className="bg-[#1A1A2E] rounded-xl p-3 border border-[#2D2D44]">
              <div className="text-[10px] uppercase tracking-wider text-[#718096] font-semibold mb-0.5">Qtd.</div>
              <div className="text-white font-medium">{label.quantity || "—"}</div>
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

        {/* Actions (only if not discharged) */}
        {!isDischarged && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <ActionButton
              color="#48BB78"
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Verificar"
              hint="Está OK"
              onClick={() => setAction("verify")}
            />
            <ActionButton
              color="#4299E1"
              icon={<Utensils className="h-5 w-5" />}
              label="Uso"
              hint="Consumido"
              onClick={() => setAction("use")}
            />
            <ActionButton
              color="#E53E3E"
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Perda"
              hint="Venceu / estragou"
              onClick={() => setAction("loss")}
            />
            <ActionButton
              color="#718096"
              icon={<Printer className="h-5 w-5" />}
              label="Erro Impressão"
              hint="Reimprimir"
              onClick={() => setAction("error")}
            />
          </div>
        )}

        <p className="text-center text-[11px] text-[#4A5568] pt-6">
          MesaClik © {new Date().getFullYear()}
        </p>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!action} onOpenChange={(o) => { if (!o) { setAction(null); setNotes(""); setLossReason(""); } }}>
        <AlertDialogContent className="bg-[#161626] border-[#2D2D44] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {action === "verify" && "Confirmar verificação"}
              {action === "use" && "Confirmar baixa por uso"}
              {action === "loss" && "Confirmar baixa por perda"}
              {action === "error" && "Confirmar erro de impressão"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0AEC0]">
              {action === "verify"
                ? "Será registrado que você verificou esta etiqueta e ela está OK."
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {action === "loss" && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-[#A0AEC0] font-semibold">
                Motivo da perda *
              </label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger className="bg-[#1A1A2E] border-[#2D2D44] text-white">
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

          <Textarea
            placeholder="Observação (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            className="bg-[#1A1A2E] border-[#2D2D44] text-white placeholder:text-[#4A5568]"
          />

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitting}
              className="bg-transparent border-[#2D2D44] text-[#A0AEC0] hover:bg-[#2D2D44] hover:text-white"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || (action === "loss" && !lossReason)}
              className={
                action === "verify" ? "bg-[#48BB78] hover:bg-[#3da066] text-white" :
                action === "use" ? "bg-[#4299E1] hover:bg-[#3182ce] text-white" :
                action === "loss" ? "bg-[#E53E3E] hover:bg-[#c53030] text-white" :
                "bg-[#718096] hover:bg-[#5a6573] text-white"
              }
              onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionButton({
  color, icon, label, hint, onClick,
}: { color: string; icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-[88px] rounded-2xl flex flex-col items-center justify-center gap-1 text-white font-bold shadow-lg active:scale-[0.97] transition-transform px-3 py-3"
      style={{ background: color, boxShadow: `0 8px 24px -8px ${color}80` }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-base">{label}</span>
      </div>
      <span className="text-[11px] font-medium opacity-90">{hint}</span>
    </button>
  );
}
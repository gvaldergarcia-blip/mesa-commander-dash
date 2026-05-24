import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarDays, CalendarX, User, CheckCircle2, XCircle, Utensils, AlertCircle, AlertTriangle, ChevronDown, Trash2, Package, Search, X, Building2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONSERVATION_LABEL, REASON_LABEL } from "@/lib/labels/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Reason = "use" | "loss" | "error";

export default function EtiquetaScan() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<any>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [notes, setNotes] = useState("");
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

  const handleDischarge = async () => {
    if (!reason || !code) return;
    setSubmitting(true);
    const { data, error } = await (supabase as any).rpc("discharge_label_by_code", {
      _code: code,
      _reason: reason,
      _notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error || !data?.success) {
      toast.error(error?.message || data?.error || "Erro ao baixar etiqueta");
      return;
    }
    toast.success("Etiqueta baixada");
    setReason(null);
    setNotes("");
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!label?.found) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="h-12 w-12 mx-auto text-red-500 mb-3" />
          <h1 className="text-xl font-bold text-slate-900">Etiqueta não encontrada</h1>
          <p className="text-slate-500 mt-2">O código <strong>#{code}</strong> não corresponde a nenhuma etiqueta.</p>
        </div>
      </div>
    );
  }

  const isExpired = label.is_expired;
  const isDischarged = label.status === "discharged";
  const statusPill = isDischarged
    ? { label: "BAIXADO", cls: "bg-slate-200 text-slate-600" }
    : isExpired
    ? { label: "VENCIDO", cls: "bg-red-100 text-red-700" }
    : { label: "ATIVO", cls: "bg-indigo-100 text-indigo-700" };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 p-4 pb-10">
      <div className="max-w-md mx-auto space-y-3 pt-2">
        {/* Unique code chip */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 text-center">
          <span className="font-mono font-bold text-lg tracking-widest text-slate-700">
            {label.unique_code}
          </span>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 space-y-5">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className={`h-6 w-6 shrink-0 ${isDischarged ? "text-slate-400" : isExpired ? "text-red-500" : "text-emerald-500"}`} />
              <h1 className="text-xl font-bold text-slate-900 uppercase truncate">{label.product_name}</h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider shrink-0 ${statusPill.cls}`}>
              {statusPill.label}
            </span>
          </div>

          {/* Lote / Quantidade / Conservação */}
          <div className="grid grid-cols-3 gap-3 text-sm border-t border-slate-100 pt-4">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Lote:</div>
              <div className="text-slate-800 font-medium">{label.batch || "N/A"}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Quantidade:</div>
              <div className="text-slate-800 font-medium">{label.quantity || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Conservação:</div>
              <div className="text-slate-800 font-medium">{CONSERVATION_LABEL[label.conservation_method || ""] || "—"}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                <CalendarDays className="h-4 w-4" /> Data de Preparo:
              </div>
              <div className="text-slate-700 text-sm mt-1 ml-6">
                {format(new Date(label.manufacture_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            <div>
              <div className={`flex items-center gap-2 text-sm font-semibold ${isExpired ? "text-red-600" : "text-red-500"}`}>
                <CalendarX className="h-4 w-4" /> Vencimento Final:
              </div>
              <div className={`text-sm mt-1 ml-6 ${isExpired ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                {format(new Date(label.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Responsible */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
              <User className="h-4 w-4" /> Responsável:
            </div>
            <div className="text-slate-800 text-sm mt-1 ml-6 font-medium">
              {label.responsible || "—"}
              {label.restaurant_name && <span className="text-slate-500 font-normal"> · {label.restaurant_name}</span>}
            </div>
          </div>

          {label.notes && (
            <div className="border-t border-slate-100 pt-4">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Observação:</div>
              <p className="text-sm text-slate-700 italic">{label.notes}</p>
            </div>
          )}

          {/* Discharge area */}
          {isDischarged && label.discharge ? (
            <div className="border-t border-slate-100 pt-4 bg-slate-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-3xl">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-slate-500" />
                <span className="font-bold text-slate-700">Etiqueta já baixada</span>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div>Motivo: <strong className="text-slate-800">{REASON_LABEL[label.discharge.reason]}</strong></div>
                <div>Em: {format(new Date(label.discharge.discharged_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                {label.discharge.employee_name && <div>Por: <strong className="text-slate-800">{label.discharge.employee_name}</strong></div>}
                {label.discharge.notes && <div className="italic">"{label.discharge.notes}"</div>}
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-4">
              <div className="text-sm text-slate-600 mb-3">Selecione o motivo do descarte:</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/30 transition-colors">
                    <Trash2 className="h-4 w-4" />
                    Baixar Etiqueta
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8} className="w-[280px] rounded-2xl p-2 bg-white border border-slate-200 shadow-2xl">
                  <DropdownMenuItem
                    onClick={() => setReason("use")}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer focus:bg-emerald-50"
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
                      <Utensils className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-sm">Baixa por Uso</div>
                      <div className="text-xs text-slate-500">Produto utilizado</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setReason("loss")}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer focus:bg-amber-50"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-sm">Baixa por Perda</div>
                      <div className="text-xs text-slate-500">Produto descartado</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setReason("error")}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer focus:bg-red-50"
                  >
                    <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-sm">Baixa por Erro</div>
                      <div className="text-xs text-slate-500">Impressão errada</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 pt-2">
          MesaClik © {new Date().getFullYear()} — Todos os direitos reservados.
        </p>
      </div>

      <AlertDialog open={!!reason} onOpenChange={(o) => !o && setReason(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar baixa</AlertDialogTitle>
            <AlertDialogDescription>
              {reason && REASON_LABEL[reason]} — esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={200} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={(e) => { e.preventDefault(); handleDischarge(); }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
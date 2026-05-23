import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CalendarDays, Clock, User, Building2, Tag, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONSERVATION_LABEL, REASON_LABEL } from "@/lib/labels/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Reason = "use" | "loss" | "error";

export default function EtiquetaScan() {
  const { code } = useParams<{ code: string }>();
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
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!label?.found) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <XCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
          <h1 className="text-xl font-bold">Etiqueta não encontrada</h1>
          <p className="text-muted-foreground mt-2">O código <strong>#{code}</strong> não corresponde a nenhuma etiqueta.</p>
        </Card>
      </div>
    );
  }

  const isExpired = label.is_expired;
  const isDischarged = label.status === "discharged";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-24">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Tag className="h-3 w-3" /> <span className="font-mono">#{label.unique_code}</span>
          </div>
          <h1 className="text-2xl font-bold">{label.product_name}</h1>
          <div className="mt-3 flex justify-center">
            {isDischarged ? (
              <span className="px-4 py-1.5 rounded-full bg-muted text-muted-foreground font-semibold text-sm">BAIXADO</span>
            ) : isExpired ? (
              <span className="px-4 py-1.5 rounded-full bg-destructive text-destructive-foreground font-semibold text-sm">VENCIDO</span>
            ) : (
              <span className="px-4 py-1.5 rounded-full bg-success text-success-foreground font-semibold text-sm">ATIVO</span>
            )}
          </div>
        </div>

        {isExpired && !isDischarged && (
          <Card className="p-4 bg-destructive/10 border-destructive/30 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm"><strong>Atenção:</strong> esta etiqueta está vencida. Recomenda-se dar baixa.</p>
          </Card>
        )}

        {/* Info */}
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Lote</div><div className="font-semibold">{label.batch || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Quantidade</div><div className="font-semibold">{label.quantity}</div></div>
            <div className="col-span-2"><div className="text-xs text-muted-foreground">Conservação</div><div className="font-semibold">{CONSERVATION_LABEL[label.conservation_method || ""] || "—"}</div></div>
          </div>
          <div className="space-y-2 pt-3 border-t border-border/40">
            <div className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Preparo: <strong>{format(new Date(label.manufacture_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</strong></div>
            <div className={`flex items-center gap-2 text-sm ${isExpired ? "text-destructive" : ""}`}><Clock className="h-4 w-4" /> Vencimento: <strong>{format(new Date(label.expiry_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</strong></div>
            <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" /> Responsável: <strong>{label.responsible || "—"}</strong></div>
            <div className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /> {label.restaurant_name || "—"}</div>
          </div>
          {label.notes && (
            <div className="pt-3 border-t border-border/40 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Observação</div>
              <p>{label.notes}</p>
            </div>
          )}
        </Card>

        {/* Discharge area */}
        {isDischarged && label.discharge ? (
          <Card className="p-4 bg-muted/40">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Etiqueta já baixada</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Motivo: <strong className="text-foreground">{REASON_LABEL[label.discharge.reason]}</strong></div>
              <div>Em: {format(new Date(label.discharge.discharged_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
              {label.discharge.employee_name && <div>Por: {label.discharge.employee_name}</div>}
              {label.discharge.notes && <div className="italic">"{label.discharge.notes}"</div>}
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Baixar Etiqueta</h3>
            <Button onClick={() => setReason("use")} className="w-full justify-start gap-3 h-14 text-base bg-success/15 text-success border border-success/30 hover:bg-success/25">
              <span className="text-xl">🍽️</span> Baixa por Uso <span className="ml-auto text-xs opacity-70">Produto utilizado</span>
            </Button>
            <Button onClick={() => setReason("loss")} className="w-full justify-start gap-3 h-14 text-base bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25">
              <span className="text-xl">⚠️</span> Baixa por Perda <span className="ml-auto text-xs opacity-70">Produto descartado</span>
            </Button>
            <Button onClick={() => setReason("error")} className="w-full justify-start gap-3 h-14 text-base bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">
              <span className="text-xl">✕</span> Baixa por Erro <span className="ml-auto text-xs opacity-70">Impressão errada</span>
            </Button>
          </div>
        )}
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
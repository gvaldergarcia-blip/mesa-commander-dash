import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Loader2, Truck, Calendar, Tag, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLabels } from "@/hooks/useLabels";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";

interface ActiveLot {
  issuance_id: string;
  batch: string | null;
  supplier_lot: string | null;
  traceability_lot: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  receipt_id: string | null;
  received_at: string | null;
  expiry_date: string | null;
  units_remaining: number;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string | null;
  productName: string;
  conservationMethod?: string | null;
}

export function ManipulationDialog({ open, onOpenChange, productId, productName, conservationMethod }: Props) {
  const { createLabel } = useLabels();
  const { activeEmployees } = useLabelEmployees();

  const [loadingLots, setLoadingLots] = useState(false);
  const [lots, setLots] = useState<ActiveLot[]>([]);
  const [lotId, setLotId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [newValidity, setNewValidity] = useState<string>(toDateInput(new Date(Date.now() + 3 * 86400000)));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !productId) return;
    setLotId("");
    setLots([]);
    setNotes("");
    setNewValidity(toDateInput(new Date(Date.now() + 3 * 86400000)));
    setLoadingLots(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("label_active_lots_for_product", {
          _product_id: productId,
        });
        if (error) throw error;
        const rows = (data || []) as ActiveLot[];
        setLots(rows);
        if (rows.length === 1) setLotId(rows[0].issuance_id);
      } catch (e: any) {
        toast.error(e.message || "Erro ao buscar lotes ativos");
      } finally {
        setLoadingLots(false);
      }
    })();
  }, [open, productId]);

  const selectedLot = useMemo(() => lots.find((l) => l.issuance_id === lotId) || null, [lots, lotId]);

  const confirm = async () => {
    if (!productId) return;
    if (!selectedLot) return toast.error("Selecione o lote de origem");
    if (!employeeId) return toast.error("Selecione o responsável");
    const manufacture = new Date();
    const expiry = new Date(`${newValidity}T23:59:00`);
    if (expiry <= manufacture) return toast.error("A nova validade precisa ser futura");

    // Novo lote interno MAN-YYYYMMDD-NNN
    let batch = `MAN-${Date.now().toString(36).toUpperCase()}`;
    try {
      const { data: gen } = await (supabase as any).rpc("label_generate_manipulation_lot");
      if (typeof gen === "string" && gen) batch = gen;
    } catch { /* fallback local */ }

    const employee = activeEmployees.find((e) => e.id === employeeId);
    const originLabel =
      selectedLot.supplier_lot ||
      selectedLot.traceability_lot ||
      selectedLot.batch ||
      "—";
    const originSupplier = selectedLot.supplier_name || "MesaClik";
    const originNote = `[Manipulação] Origem: ${originSupplier} · Lote ${originLabel}${notes.trim() ? ` · ${notes.trim()}` : ""}`;

    setSaving(true);
    try {
      await createLabel({
        label_product_id: productId,
        product_name: productName,
        manufacture_date: manufacture,
        expiry_date: expiry,
        quantity: 1,
        batch,
        responsible: employee?.name || null,
        employee_id: employee?.id || null,
        conservation_method: (conservationMethod as any) || "refrigerated",
        notes: originNote,
        origin_issuance_id: selectedLot.issuance_id,
        // supplier_id, supplier_lot e origin_traceability_lot vêm por trigger
      });
      toast.success(`Manipulação registrada · Lote ${batch}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar manipulação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" /> Manipular produto
          </DialogTitle>
          <DialogDescription>
            Registra uma manipulação de <b>{productName}</b>. Uma nova etiqueta será gerada com lote interno
            <span className="font-mono"> MAN-…</span> vinculado ao lote de origem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Lote de origem</Label>
            {loadingLots ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando lotes ativos…
              </div>
            ) : lots.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-3">
                Nenhum lote ativo disponível para este produto. Registre um recebimento antes de manipular.
              </div>
            ) : (
              <Select value={lotId} onValueChange={setLotId}>
                <SelectTrigger><SelectValue placeholder="Selecionar lote…" /></SelectTrigger>
                <SelectContent>
                  {lots.map((l) => (
                    <SelectItem key={l.issuance_id} value={l.issuance_id}>
                      {(l.supplier_lot || l.traceability_lot || l.batch || "—")}
                      {" · "}{l.supplier_name || "MesaClik"}
                      {" · "}{l.units_remaining} un
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedLot && (
              <div className="rounded-lg border bg-muted/30 p-2.5 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{selectedLot.supplier_name || "—"}</span>
                <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{selectedLot.supplier_lot || selectedLot.traceability_lot}</span>
                {selectedLot.expiry_date && (
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Val. orig.: {new Date(selectedLot.expiry_date).toLocaleDateString("pt-BR")}</span>
                )}
                {selectedLot.traceability_lot && selectedLot.supplier_lot && selectedLot.supplier_lot !== selectedLot.traceability_lot && (
                  <Badge variant="outline" className="text-[10px]">{selectedLot.traceability_lot}</Badge>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nova validade</Label>
              <Input type="date" min={toDateInput(new Date())} value={newValidity} onChange={(e) => setNewValidity(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: porcionado, higienizado…" />
          </div>

          {selectedLot && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex items-center gap-2">
              <span className="font-mono">{selectedLot.supplier_lot || selectedLot.traceability_lot}</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-primary font-semibold">MAN-…</span>
              <span className="text-muted-foreground ml-auto">Rastreabilidade preservada</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || !selectedLot || !employeeId} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar manipulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
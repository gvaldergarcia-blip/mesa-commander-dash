import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useLabelSuppliers } from "@/hooks/useLabelSuppliers";
import { useReceipts } from "@/hooks/useReceipts";
import { toast } from "sonner";

interface Line {
  raw_name: string;
  quantity: number;
  unit: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (receiptId: string) => void;
}

export function NewReceiptDialog({ open, onOpenChange, onCreated }: Props) {
  const { suppliers, createSupplier } = useLabelSuppliers();
  const { createReceipt, isCreating } = useReceipts();
  const [supplierId, setSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([{ raw_name: "", quantity: 1, unit: "un" }]);

  const addLine = () => setLines((l) => [...l, { raw_name: "", quantity: 1, unit: "un" }]);
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((l) => l.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln)));

  const reset = () => {
    setSupplierId("");
    setNewSupplierName("");
    setReference("");
    setLines([{ raw_name: "", quantity: 1, unit: "un" }]);
  };

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.raw_name.trim());
    if (!valid.length) {
      toast.error("Adicione ao menos um item");
      return;
    }
    try {
      let finalSupplierId = supplierId || null;
      if (!finalSupplierId && newSupplierName.trim()) {
        const s = await createSupplier({ name: newSupplierName.trim() });
        finalSupplierId = s.id;
      }
      const id = await createReceipt({
        supplier_id: finalSupplierId,
        reference: reference || undefined,
        source: "manual",
        items: valid,
      });
      reset();
      onOpenChange(false);
      onCreated?.(id);
    } catch (e) {
      /* toast handled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Novo recebimento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Digite o que chegou. O sistema reconhece produtos automaticamente e prepara as etiquetas.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              {suppliers.length > 0 ? (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar ou deixar em branco" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {!supplierId && (
                <Input
                  placeholder="ou digite o nome de um novo fornecedor"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Referência (NF-e, pedido)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens recebidos</Label>
              <Button variant="ghost" size="sm" onClick={addLine} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    placeholder="Nome do produto (como está na nota)"
                    value={line.raw_name}
                    onChange={(e) => updateLine(i, { raw_name: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-20"
                  />
                  <Select value={line.unit} onValueChange={(v) => updateLine(i, { unit: v })}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="l">l</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="cx">cx</SelectItem>
                    </SelectContent>
                  </Select>
                  {lines.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
            <strong className="text-primary">Como funciona:</strong> O sistema tenta reconhecer cada item automaticamente.
            Produtos conhecidos reutilizam categoria, validade e local. Itens novos ou incompletos aparecem em
            "Pendências" para você preencher apenas o que falta.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Analisar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
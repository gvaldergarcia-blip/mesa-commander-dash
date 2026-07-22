import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Loader2, Paperclip, FileText } from "lucide-react";
import { useLabelSuppliers } from "@/hooks/useLabelSuppliers";
import { useReceipts } from "@/hooks/useReceipts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Line {
  raw_name: string;
  quantity: number;
  unit: string;
  weight: number | null;
  weight_unit: string;
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
  const [lines, setLines] = useState<Line[]>([
    { raw_name: "", quantity: 1, unit: "un", weight: null, weight_unit: "kg" },
  ]);
  const [parsing, setParsing] = useState(false);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLine = () =>
    setLines((l) => [...l, { raw_name: "", quantity: 1, unit: "un", weight: null, weight_unit: "kg" }]);
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((l) => l.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln)));

  const reset = () => {
    setSupplierId("");
    setNewSupplierName("");
    setReference("");
    setLines([{ raw_name: "", quantity: 1, unit: "un", weight: null, weight_unit: "kg" }]);
    setAttachedName(null);
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 15MB)");
      return;
    }
    setParsing(true);
    setAttachedName(file.name);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-receipt-file", {
        body: { file_base64: base64, mime_type: file.type, filename: file.name },
      });
      if (error) throw error;
      const items: Line[] = (data?.items ?? []).map((it: any) => {
        const unit = String(it.unit || "un").toLowerCase();
        const isBulk = ["kg", "g", "l", "ml"].includes(unit);
        const rawWeight = it.weight != null ? Number(it.weight) : null;
        const rawWUnit = ["kg","g","l","ml"].includes(String(it.weight_unit || "").toLowerCase())
          ? String(it.weight_unit).toLowerCase()
          : null;

        if (isBulk) {
          // Venda a granel: 1 peça com o peso total informado na nota.
          const w = rawWeight ?? (Number(it.quantity) || null);
          return {
            raw_name: it.raw_name,
            quantity: 1,
            unit: "un",
            weight: w,
            weight_unit: rawWUnit || unit,
          };
        }
        // Peças: preserva quantidade exata; peso vem separado quando a nota informa.
        return {
          raw_name: it.raw_name,
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          unit,
          weight: rawWeight,
          weight_unit: rawWUnit || "kg",
        };
      });
      if (!items.length) {
        toast.warning("Nenhum item reconhecido no arquivo");
        return;
      }
      setLines(items);
      if (data?.supplier && !supplierId && !newSupplierName) setNewSupplierName(data.supplier);
      if (data?.reference && !reference) setReference(data.reference);
      toast.success(`${items.length} item(ns) importado(s) do arquivo`);
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível ler o arquivo", { description: err?.message });
      setAttachedName(null);
    } finally {
      setParsing(false);
    }
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
      const res = await createReceipt({
        supplier_id: finalSupplierId,
        reference: reference || undefined,
        source: "manual",
        items: valid.map((l) => ({
          raw_name: l.raw_name,
          quantity: l.quantity,
          unit: l.unit,
          weight: l.weight,
          weight_unit: l.weight ? l.weight_unit : null,
        })),
      });
      reset();
      onOpenChange(false);
      onCreated?.(res.receiptId);
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
            Digite ou anexe a lista do fornecedor. As etiquetas só são preparadas depois das fotos dos rótulos do fabricante.
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
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                  className="gap-1"
                >
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  {parsing ? "Lendo..." : "Anexar lista"}
                </Button>
                <Button variant="ghost" size="sm" onClick={addLine} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={handleFile}
            />
            {attachedName && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1 truncate">{attachedName}</span>
                <button
                  type="button"
                  onClick={() => setAttachedName(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  remover
                </button>
              </div>
            )}
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-start">
                  <Input
                    placeholder="Nome do produto (como está na nota)"
                    value={line.raw_name}
                    onChange={(e) => updateLine(i, { raw_name: e.target.value })}
                    className="flex-1 min-w-[180px]"
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-16"
                    title="Quantidade física (peças)"
                  />
                  <Select value={line.unit} onValueChange={(v) => updateLine(i, { unit: v })}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un</SelectItem>
                      <SelectItem value="peça">peça</SelectItem>
                      <SelectItem value="cx">cx</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.weight ?? ""}
                    onChange={(e) =>
                      updateLine(i, { weight: e.target.value === "" ? null : parseFloat(e.target.value) })
                    }
                    placeholder="Peso"
                    className="w-20"
                    title="Peso (opcional)"
                  />
                  <Select value={line.weight_unit} onValueChange={(v) => updateLine(i, { weight_unit: v })}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="l">l</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
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
            <strong className="text-primary">Quantidade × Peso:</strong> use <em>Quantidade</em> apenas para o número de peças físicas.
            O <em>Peso</em> (kg, g, l, ml) é atributo da peça e é impresso na etiqueta — nunca gera etiquetas extras. Ex.: 1 peça de 9,84 kg = 1 etiqueta.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar pendências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
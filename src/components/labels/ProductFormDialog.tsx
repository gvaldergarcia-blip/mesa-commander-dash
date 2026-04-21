import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LabelProduct, LabelProductInput } from "@/hooks/useLabelProducts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LabelProduct | null;
  onSubmit: (input: LabelProductInput) => Promise<unknown>;
  isSubmitting?: boolean;
}

export function ProductFormDialog({ open, onOpenChange, product, onSubmit, isSubmitting }: Props) {
  const [name, setName] = useState("");
  const [validityDays, setValidityDays] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setValidityDays(product?.validity_days?.toString() ?? "");
      setNotes(product?.notes ?? "");
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(validityDays, 10);
    if (!name.trim() || isNaN(days) || days <= 0) return;
    await onSubmit({ name, validity_days: days, notes });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            Cadastre produtos para gerar etiquetas com validade automática.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prod-name">Nome do produto *</Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Molho de tomate"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-days">Validade (em dias) *</Label>
            <Input
              id="prod-days"
              type="number"
              min={1}
              max={3650}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              placeholder="Ex: 5"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-notes">Observação (opcional)</Label>
            <Textarea
              id="prod-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: manter refrigerado"
              maxLength={200}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
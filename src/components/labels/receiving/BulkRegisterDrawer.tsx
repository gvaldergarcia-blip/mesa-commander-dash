import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectorCombobox } from "@/components/labels/SectorCombobox";
import { PRODUCT_CATEGORIES } from "@/lib/labels/categories";
import { buildQuickProductInput } from "@/lib/labels/productInput";
import type { LabelProduct } from "@/hooks/useLabelProducts";
import { Loader2, Link2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const CONSERVATIONS = [
  { value: "refrigerated", label: "Resfriado" },
  { value: "frozen", label: "Congelado" },
  { value: "ambient", label: "Temp. ambiente" },
  { value: "hot", label: "Quente" },
];

export interface BulkItem { key: string; name: string; unit: string }
interface Line {
  key: string; name: string; unit: string; category: string; conservation: string;
  sector: string; manipValue: string; manipUnit: "days" | "hours";
  linkTo: string | null; error: string | null; selected: boolean;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function similar(name: string, products: LabelProduct[]): LabelProduct | null {
  const tokens = norm(name).split(" ").filter((t) => t.length > 2);
  if (!tokens.length) return null;
  let best: { p: LabelProduct; s: number } | null = null;
  for (const p of products) {
    const pn = norm(p.name);
    const s = tokens.reduce((a, t) => a + (pn.includes(t) ? 1 : 0), 0) / tokens.length;
    if (s >= 0.4 && (!best || s > best.s)) best = { p, s };
  }
  return best?.p ?? null;
}

export function BulkRegisterDrawer({
  open, onOpenChange, items, supplier, products, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: BulkItem[];
  supplier: string;
  products: LabelProduct[];
  /** Cria/vincula; devolve erros por chave (itens sem erro foram salvos). */
  onSave: (entries: Array<{ key: string; name: string; linkTo: string | null; input?: any }>) => Promise<Record<string, string>>;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLines(items.map((i) => ({
      key: i.key, name: i.name, unit: i.unit || "un", category: "", conservation: "refrigerated",
      sector: "", manipValue: "3", manipUnit: "days", linkTo: null, error: null, selected: false,
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const suggestions = useMemo(() => {
    const m: Record<string, LabelProduct | null> = {};
    for (const l of lines) m[l.key] = similar(l.name, products);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map((l) => l.name).join("|"), products]);

  const up = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p, error: null } : l)));
  const selected = lines.filter((l) => l.selected);
  const applyAll = (p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.selected ? { ...l, ...p } : l)));

  const save = async () => {
    const entries: Array<{ key: string; name: string; linkTo: string | null; input?: any }> = [];
    const local: Record<string, string> = {};
    for (const l of lines) {
      if (l.linkTo) { entries.push({ key: l.key, name: l.name, linkTo: l.linkTo }); continue; }
      const { input, error } = buildQuickProductInput({
        name: l.name, unit: l.unit, supplierName: supplier, category: l.category || null,
        conservation: l.conservation, storageLocation: l.sector, manipValue: l.manipValue, manipUnit: l.manipUnit,
      });
      if (error) local[l.key] = error; else entries.push({ key: l.key, name: l.name, linkTo: null, input });
    }
    setSaving(true);
    try {
      const errs = { ...local, ...(entries.length ? await onSave(entries) : {}) };
      const remaining = lines.filter((l) => errs[l.key]).map((l) => ({ ...l, error: errs[l.key] }));
      setLines(remaining);
      if (!remaining.length) onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>Cadastrar {lines.length} produto{lines.length === 1 ? "" : "s"}</SheetTitle>
          <SheetDescription>Dados da nota já preenchidos. Ao salvar, cada item fica vinculado ao cadastro.</SheetDescription>
        </SheetHeader>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 p-3 text-xs">
            <span className="font-semibold">{selected.length} selecionado(s): aplicar</span>
            <Select onValueChange={(v) => applyAll({ category: v })}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>{PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={(v) => applyAll({ conservation: v })}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Conservação" /></SelectTrigger>
              <SelectContent>{CONSERVATIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="w-44"><SectorCombobox value="" onChange={(v) => applyAll({ sector: v })} /></div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {lines.map((l) => {
            const sug = suggestions[l.key];
            return (
              <div key={l.key} className={cn("space-y-2 rounded-xl border p-3", l.error ? "border-destructive bg-destructive/5" : "border-border")}>
                <div className="flex items-center gap-2">
                  <Checkbox checked={l.selected} onCheckedChange={(c) => up(l.key, { selected: !!c })} aria-label="Selecionar" />
                  <Input value={l.name} onChange={(e) => up(l.key, { name: e.target.value })} className="h-10 flex-1" disabled={!!l.linkTo} />
                  <Input value={l.unit} onChange={(e) => up(l.key, { unit: e.target.value })} className="h-10 w-16" disabled={!!l.linkTo} />
                </div>
                {l.error && <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{l.error}</p>}
                {sug && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs">
                    <span>{l.linkTo ? "Vinculado a" : "Parece ser"}: <strong>{sug.name}</strong></span>
                    <Button size="sm" variant={l.linkTo ? "secondary" : "default"} className="h-8 gap-1"
                      onClick={() => up(l.key, { linkTo: l.linkTo ? null : sug.id })}>
                      <Link2 className="h-3.5 w-3.5" />{l.linkTo ? "Desfazer" : "Vincular"}
                    </Button>
                  </div>
                )}
                {!l.linkTo && (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Select value={l.category || undefined} onValueChange={(v) => up(l.key, { category: v })}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>{PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={l.conservation} onValueChange={(v) => up(l.key, { conservation: v })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONSERVATIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <SectorCombobox value={l.sector} onChange={(v) => up(l.key, { sector: v })} />
                    <div className="flex gap-1">
                      <Input value={l.manipValue} onChange={(e) => up(l.key, { manipValue: e.target.value })} inputMode="numeric" className="h-10 w-16" aria-label="Validade pós-abertura" />
                      <Select value={l.manipUnit} onValueChange={(v) => up(l.key, { manipUnit: v as any })}>
                        <SelectTrigger className="h-10 flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="days">dias</SelectItem><SelectItem value="hours">horas</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {!l.linkTo && <p className="text-[11px] text-muted-foreground">Validade pós-abertura (obrigatória)</p>}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-4">
          <Button className="h-12 w-full" onClick={save} disabled={saving || !lines.length}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar todos
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

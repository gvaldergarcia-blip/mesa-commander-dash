import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { PRODUCT_CATEGORIES } from "@/lib/labels/categories";
import { DEFAULT_SECTORS } from "@/lib/labels/sectors";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";
import { useReceipts } from "@/hooks/useReceipts";

// Days between today (00:00) and a YYYY-MM-DD date, minimum 1.
function daysUntil(dateStr: string): number {
  if (!dateStr) return 1;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 1;
  const target = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getTime();
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target - todayUTC) / 86400000);
  return Math.max(1, diff);
}

// Default date = today + N days, formatted YYYY-MM-DD for <input type="date">.
function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: {
    id: string;
    raw_name: string;
    product_id: string | null;
    missing_fields: string[];
  } | null;
  supplierId?: string | null;
  onDone?: () => void;
}

// Resolves an "item pendente" — either link to existing product or create a new minimal one,
// and fill only the missing fields.
export function PendingItemDialog({ open, onOpenChange, item, supplierId, onDone }: Props) {
  const { products, createProduct } = useLabelProducts();
  const { linkItemToProduct } = useReceipts();
  const restaurantId = useRestaurantId();

  const [mode, setMode] = useState<"link" | "new">("new");

  // new product minimal fields
  const [name, setName] = useState("");
  const [validityDate, setValidityDate] = useState<string>(todayPlus(3));
  const [conservation, setConservation] = useState<string>("refrigerated");
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [sif, setSif] = useState<string>("");

  // existing product patch fields (only missing)
  const [patchValidityDate, setPatchValidityDate] = useState<string>(todayPlus(3));
  const [patchConservation, setPatchConservation] = useState<string>("refrigerated");
  const [patchCategory, setPatchCategory] = useState<string>("");
  const [patchLocation, setPatchLocation] = useState<string>("");
  const [patchSif, setPatchSif] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanBrand, setScanBrand] = useState<string>("");
  const [scanBatch, setScanBatch] = useState<string>("");
  const [scanWeight, setScanWeight] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (item) {
      setMode("new");
      setName(item.raw_name);
      setScanBrand("");
      setScanBatch("");
      setScanWeight("");
    }
  }, [item]);

  if (!item) return null;
  const needs = item.missing_fields;

  const handleScanPhoto = async (file: File) => {
    try {
      setScanning(true);
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = String(r.result || "");
          resolve(result.split(",")[1] || "");
        };
        r.onerror = () => reject(new Error("Falha ao ler arquivo"));
        r.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-package-photo", {
        body: { file_base64: base64, mime_type: file.type },
      });
      if (error) throw error;

      const d: any = data || {};
      let filled = 0;
      if (d.name && mode === "new") { setName(String(d.name)); filled++; }
      if (d.expires_at) {
        if (mode === "new") setValidityDate(d.expires_at);
        else setPatchValidityDate(d.expires_at);
        filled++;
      }
      if (d.sif) {
        if (mode === "new") setSif(String(d.sif));
        else setPatchSif(String(d.sif));
        filled++;
      }
      if (d.brand) { setScanBrand(String(d.brand)); filled++; }
      if (d.batch) { setScanBatch(String(d.batch)); filled++; }
      if (d.weight) { setScanWeight(String(d.weight)); filled++; }

      if (filled === 0) {
        toast.warning("Não consegui ler a etiqueta. Tente uma foto mais nítida.");
      } else {
        toast.success(`Etiqueta lida — ${filled} campo(s) preenchido(s)`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao ler foto");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      let productId = item.product_id;

      if (mode === "new" || !productId) {
        // create minimal product
        const created = await createProduct({
          name: name.trim() || item.raw_name.trim(),
          validity_days: daysUntil(validityDate),
          conservation_method: (conservation as any) || "refrigerated",
          category: category || null,
          storage_location: location || null,
          sif: sif.trim() || null,
          unit: "un",
          status: "active",
        });
        productId = created.id;
      } else if (mode === "link" && linkProductId) {
        productId = linkProductId;
        // patch missing fields on that product
        const patch: any = {};
        if (needs.includes("validade pós-abertura")) patch.validity_days = daysUntil(patchValidityDate);
        if (needs.includes("conservação")) patch.conservation_method = patchConservation;
        if (needs.includes("setor")) patch.category = patchCategory;
        if (needs.includes("local")) patch.storage_location = patchLocation;
        if (patchSif.trim()) patch.sif = patchSif.trim();
        if (Object.keys(patch).length) {
          const { error } = await (supabase as any).from("label_products").update(patch).eq("id", productId);
          if (error) throw error;
        }
      }

      if (productId) {
        await linkItemToProduct({
          itemId: item.id,
          productId,
          rawName: item.raw_name,
          supplierId: supplierId ?? null,
        });
        // Se a foto trouxe lote, gravar no label_issuance recém-criado deste produto
        if (scanBatch.trim() && productId) {
          try {
            const { data: last } = await (supabase as any)
              .from("label_issuances")
              .select("id")
              .eq("label_product_id", productId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (last?.id) {
              await (supabase as any)
                .from("label_issuances")
                .update({ batch: scanBatch.trim() })
                .eq("id", last.id);
            }
          } catch (e) { console.warn("Falha ao gravar lote", e); }
        }
        toast.success("Item resolvido — sistema aprendeu esse nome");
      }
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao resolver item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resolver "{item.raw_name}"
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha apenas o que falta. O sistema memoriza e nunca mais pergunta.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ler foto da etiqueta do fornecedor */}
          <div className="rounded-md border border-dashed p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  Ler etiqueta do fornecedor
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Tire uma foto do rótulo — nome, validade, lote, marca e SIF vão preencher sozinhos.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={scanning}
                onClick={() => fileInputRef.current?.click()}
              >
                {scanning ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />}
                {scanning ? "Lendo..." : "Tirar foto"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScanPhoto(f);
                }}
              />
            </div>
            {(scanBrand || scanBatch || scanWeight) && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {scanBrand && <span className="rounded bg-background border px-1.5 py-0.5">Marca: {scanBrand}</span>}
                {scanBatch && <span className="rounded bg-background border px-1.5 py-0.5">Lote: {scanBatch}</span>}
                {scanWeight && <span className="rounded bg-background border px-1.5 py-0.5">Peso: {scanWeight}</span>}
              </div>
            )}
          </div>

          <>
              <div className="space-y-1.5">
                <Label>Nome oficial do produto</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Validade (data)</Label>
                  <Input
                    type="date"
                    min={todayPlus(0)}
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {daysUntil(validityDate)} dia(s) a partir de hoje
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Conservação</Label>
                  <Select value={conservation} onValueChange={setConservation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refrigerated">Refrigerado</SelectItem>
                      <SelectItem value="frozen">Congelado</SelectItem>
                      <SelectItem value="ambient">Ambiente</SelectItem>
                      <SelectItem value="hot">Quente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Local</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex.: Câmara Fria, Estoque Seco…"
                    list="mesaclik-sectors"
                  />
                  <datalist id="mesaclik-sectors">
                    {DEFAULT_SECTORS.map((s) => (<option key={s} value={s} />))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>SIF (opcional)</Label>
                <Input value={sif} onChange={(e) => setSif(e.target.value)} placeholder="Ex.: 358 — se produto de origem animal" />
              </div>
          </>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar e aprender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  CheckCircle2,
  Package,
  Truck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { printLabelsMany, type PrintLabelData } from "../LabelPrintSheet";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSiteBaseUrl } from "@/config/site-url";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import {
  useDiaryPending,
  useRegisterPrints,
  type DiaryIssuance,
  type DiaryReceipt,
} from "@/hooks/useDiaryReceipts";
import { cn } from "@/lib/utils";

// ---------- helpers ----------
const remaining = (i: DiaryIssuance) =>
  Math.max(0, (i.quantity || 0) - (i.printed_labels || 0));

function pct(printed: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((printed / total) * 100));
}

export function OperationalDiary() {
  const { data, isLoading } = useDiaryPending();
  const { restaurant } = useRestaurant();
  const { activeEmployees } = useLabelEmployees();
  const registerPrints = useRegisterPrints();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const responsibleBySector = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of activeEmployees) {
      for (const s of e.sectors || []) if (!map.has(s)) map.set(s, e.name);
    }
    return map;
  }, [activeEmployees]);

  const { data: restaurantLegal } = useQuery({
    queryKey: ["restaurant-legal", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .schema("mesaclik")
        .from("restaurants")
        .select("cnpj, zip_code")
        .eq("id", restaurant!.id)
        .maybeSingle();
      return { cnpj: data?.cnpj || null, cep: data?.zip_code || null };
    },
  });

  // ---------- grouping ----------
  const groups = useMemo(() => {
    if (!data) return [] as Array<{
      receipt: DiaryReceipt;
      totalRemaining: number;
      totalQty: number;
      totalPrinted: number;
      sectors: Array<{ sector: string; items: DiaryIssuance[]; remaining: number; total: number; printed: number }>;
    }>;
    const buckets = new Map<string, DiaryIssuance[]>();
    for (const i of data.issuances) {
      const k = i.receipt_id!;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(i);
    }
    const out: any[] = [];
    for (const [rid, items] of buckets) {
      const receipt = data.receipts.get(rid);
      if (!receipt) continue;
      const sectorMap = new Map<string, DiaryIssuance[]>();
      for (const it of items) {
        const s = (it.storage_location || "Sem local").trim() || "Sem local";
        if (!sectorMap.has(s)) sectorMap.set(s, []);
        sectorMap.get(s)!.push(it);
      }
      const sectors = Array.from(sectorMap.entries()).map(([sector, its]) => {
        const total = its.reduce((a, b) => a + (b.quantity || 0), 0);
        const printed = its.reduce((a, b) => a + (b.printed_labels || 0), 0);
        return { sector, items: its, total, printed, remaining: total - printed };
      }).sort((a, b) => a.sector.localeCompare(b.sector));
      const totalQty = sectors.reduce((a, s) => a + s.total, 0);
      const totalPrinted = sectors.reduce((a, s) => a + s.printed, 0);
      const totalRemaining = totalQty - totalPrinted;
      out.push({ receipt, sectors, totalQty, totalPrinted, totalRemaining });
    }
    return out.sort((a, b) => (a.receipt.received_at < b.receipt.received_at ? 1 : -1));
  }, [data]);

  const buildPrintData = (l: DiaryIssuance, copies: number): PrintLabelData => {
    const sector = l.storage_location ?? null;
    const autoResp = sector ? responsibleBySector.get(sector) : null;
    const qrSvg = renderToStaticMarkup(
      <QRCodeSVG
        value={`${getSiteBaseUrl()}/etiquetas/scan/${l.unique_code}?op=1`}
        size={144}
        level="L"
        marginSize={1}
      />
    );
    const weightLabel = l.weight != null && l.weight_unit
      ? `${String(l.weight).replace(".", ",")} ${l.weight_unit}`
      : null;
    return {
      productName: l.product_name,
      manufactureDate: new Date(l.manufacture_date),
      expiryDate: new Date(l.expiry_date),
      responsible: l.responsible || autoResp || "—",
      quantity: copies,
      notes: l.notes,
      cif: l.cif,
      sif: l.sif ?? null,
      allergens: l.allergens,
      ingredients: l.ingredients,
      conservationLabel: l.conservation_method
        ? CONSERVATION_LABEL[l.conservation_method as keyof typeof CONSERVATION_LABEL] || null
        : null,
      storageLocation: sector,
      batch: l.batch,
      quantityWeight: weightLabel,
      restaurantName: restaurant?.name || null,
      restaurantCnpj: restaurantLegal?.cnpj || null,
      restaurantCep: restaurantLegal?.cep || null,
      checklistQrSvg: qrSvg,
      checklistQrLabel: `#${l.unique_code}`,
    };
  };

  const printBatch = async (items: DiaryIssuance[]) => {
    const jobs: PrintLabelData[] = [];
    const prints: { id: string; count: number }[] = [];
    for (const it of items) {
      const rem = remaining(it);
      if (rem <= 0) continue;
      jobs.push(buildPrintData(it, rem));
      prints.push({ id: it.id, count: rem });
    }
    if (!jobs.length) return;
    printLabelsMany(jobs);
    await registerPrints.mutateAsync(prints);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="font-semibold">Tudo em dia</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Nenhuma etiqueta pendente de impressão. Novos recebimentos aparecerão aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ receipt, sectors, totalQty, totalPrinted, totalRemaining }) => {
        const p = pct(totalPrinted, totalQty);
        const isCollapsed = collapsed[receipt.id];
        const supplierName = receipt.supplier?.name || "Sem fornecedor";
        return (
          <Card
            key={receipt.id}
            className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-all animate-fade-in"
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent border-b border-border/50">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold tracking-tight">{supplierName}</h3>
                      {receipt.reference && (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          NF {receipt.reference}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recebido {formatDistanceToNow(new Date(receipt.received_at), { addSuffix: true, locale: ptBR })}
                      {" · "}
                      {sectors.reduce((a, s) => a + s.items.length, 0)} produto(s) · {totalQty} etiqueta(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => printBatch(sectors.flatMap((s) => s.items))}
                    disabled={registerPrints.isPending || totalRemaining === 0}
                    className="gap-2 shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir {totalRemaining} etiqueta{totalRemaining === 1 ? "" : "s"} pendente{totalRemaining === 1 ? "" : "s"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed((c) => ({ ...c, [receipt.id]: !c[receipt.id] }))}
                    aria-label={isCollapsed ? "Expandir" : "Recolher"}
                  >
                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progresso</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {totalPrinted} de {totalQty} · <span className="text-foreground font-semibold">{p}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      p === 100 ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.max(p, 4)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sectors */}
            {!isCollapsed && (
              <div className="divide-y divide-border/50">
                {sectors.map(({ sector, items, total, printed, remaining: sectorRem }) => (
                  <div key={sector} className="p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="font-semibold text-sm">{sector}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {printed}/{total} etiquetas
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => printBatch(items)}
                        disabled={registerPrints.isPending || sectorRem === 0}
                        className="gap-1.5 h-8"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir setor ({sectorRem})
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {items.map((it) => {
                        const rem = remaining(it);
                        const done = rem === 0;
                        return (
                          <div
                            key={it.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-all",
                              done
                                ? "border-emerald-500/20 bg-emerald-500/5"
                                : "border-border/60 bg-muted/20 hover:bg-muted/40"
                            )}
                          >
                            <div className="h-8 w-8 rounded-md bg-background border border-border/60 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{it.product_name}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {done ? (
                                  <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Concluído
                                  </span>
                                ) : (
                                  <>
                                    Restam <span className="font-semibold text-foreground">{rem}</span> de {it.quantity}
                                  </>
                                )}
                                {it.weight != null && it.weight_unit && (
                                  <span className="ml-2">· {String(it.weight).replace(".", ",")} {it.weight_unit}</span>
                                )}
                              </div>
                            </div>
                            {!done && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printBatch([it])}
                                disabled={registerPrints.isPending}
                                className="h-8 gap-1.5 shrink-0"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                Imprimir {rem}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

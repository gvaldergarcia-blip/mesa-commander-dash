import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, Loader2, CheckCircle2, AlertTriangle, Clock, MapPin, Package, Lock, Printer,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSiteBaseUrl } from "@/config/site-url";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { printLabelsMany, type PrintLabelData } from "./LabelPrintSheet";
import { useLabelRenewals, type RenewalItem } from "@/hooks/useLabelRenewals";

const fmt = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const safeDate = (v: any, fallback: Date) => {
  if (!v) return fallback;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
};

function timeLabel(item: RenewalItem): { text: string; tone: string } {
  const h = Math.round(Math.abs(item.msLeft) / 3600_000);
  if (item.urgency === "expired") {
    return {
      text: h < 1 ? "Vencida agora" : h < 48 ? `Vencida há ${h}h` : `Vencida há ${Math.round(h / 24)} dias`,
      tone: "text-destructive",
    };
  }
  if (item.urgency === "today") return { text: h < 1 ? "Vence em minutos" : `Vence hoje · em ${h}h`, tone: "text-orange-500" };
  return { text: `Vence em ${h}h`, tone: "text-amber-500" };
}

export function RenewalPanel() {
  const {
    items, isLoading, lookaheadHours, setLookaheadHours,
  } = useLabelRenewals();
  const { restaurant } = useRestaurant();

  const { data: legal } = useQuery({
    queryKey: ["restaurant-legal", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .schema("mesaclik")
        .from("restaurants")
        .select("cnpj, zip_code, address_line")
        .eq("id", restaurant!.id)
        .maybeSingle();
      return { cnpj: data?.cnpj || null, cep: data?.zip_code || null, address: data?.address_line || null };
    },
  });

  const buildPrint = (row: any, prev: RenewalItem, manufacture: Date, expiry: Date, noteOverride?: string | null): PrintLabelData => {
    const qrSvg = row?.unique_code
      ? renderToStaticMarkup(
          <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/${row.unique_code}?op=1`} size={144} level="L" marginSize={1} />,
        )
      : null;
    const weightLabel = row?.weight != null && row?.weight_unit
      ? `${String(row.weight).replace(".", ",")} ${row.weight_unit}`
      : null;
    const cons = row?.conservation_method || prev.label.conservation_method;
    return {
      productName: row?.product_name || prev.label.product_name,
      manufactureDate: manufacture,
      expiryDate: expiry,
      originalExpiryDate: (() => {
        const raw = row?.original_expiry_date ?? (prev.label as any).original_expiry_date;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      })(),
      responsible: row?.responsible || prev.label.responsible || "—",
      quantity: Number(row?.quantity || 1),
      batch: row?.batch || null,
      template: "manipulation",
      sif: row?.sif ?? prev.label.sif ?? null,
      cif: row?.cif ?? prev.label.cif ?? null,
      allergens: row?.allergens ?? null,
      ingredients: row?.ingredients ?? null,
      notes: noteOverride !== undefined ? noteOverride : `Renovação · lote anterior ${prev.label.batch || "—"}`,
      conservationLabel: cons ? CONSERVATION_LABEL[cons as keyof typeof CONSERVATION_LABEL] || null : null,
      storageLocation: row?.storage_location ?? prev.label.storage_location ?? null,
      quantityWeight: weightLabel,
      restaurantName: restaurant?.name || null,
      restaurantCnpj: legal?.cnpj || null,
      restaurantCep: legal?.cep || null,
      restaurantAddress: legal?.address || null,
      checklistQrSvg: qrSvg,
      checklistQrLabel: row?.unique_code ? `#${row.unique_code}` : null,
    };
  };

  /**
   * Reimprime a etiqueta com nova data de manipulação (agora) e nova validade
   * calculada pela regra após abertura do próprio produto. Não cria registro novo.
   */
  const reprint = (item: RenewalItem) => {
    const l: any = item.label;
    const manufacture = new Date();
    const expiry = safeDate(item.nextExpiry, safeDate(l.expiry_date, manufacture));
    const note = item.ruleLabel
      ? `Manipulação ${fmt(manufacture)} · regra após abertura ${item.ruleLabel}`
      : l.notes ?? null;
    printLabelsMany([buildPrint(l, item, manufacture, expiry, note)]);
    toast.success(`Etiqueta enviada · validade ${fmt(expiry)}`);
  };

  const counts = useMemo(() => ({
    expired: items.filter((i) => i.urgency === "expired").length,
    today: items.filter((i) => i.urgency === "today").length,
    soon: items.filter((i) => i.urgency === "soon").length,
  }), [items]);

  if (isLoading) {
    return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Etiquetas para renovação</h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Produtos manipulados cuja validade venceu ou vence em breve e que ainda não foram
                totalmente utilizados. O sistema reaproveita lote, conservação, categoria, regra após
                abertura e fornecedor do cadastro.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(lookaheadHours)} onValueChange={(v) => setLookaheadHours(Number(v))}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { h: 0, label: "Somente hoje" },
                  { h: 12, label: "Próximas 12h" },
                  { h: 24, label: "Próximas 24h" },
                  { h: 48, label: "Próximos 2 dias" },
                  { h: 168, label: "Próximos 7 dias" },
                  { h: 720, label: "Próximos 30 dias" },
                ].map((o) => (
                  <SelectItem key={o.h} value={String(o.h)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="border-destructive/40 text-destructive">{counts.expired} vencidas</Badge>
            <Badge variant="outline" className="border-orange-500/40 text-orange-500">{counts.today} vencem hoje</Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500">{counts.soon} nas próximas horas</Badge>
          </div>
        )}
      </Card>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="font-semibold">Nenhuma etiqueta para renovar</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Todas as etiquetas de manipulação estão dentro da validade.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {items.map((item) => {
            const t = timeLabel(item);
            const l = item.label;
            return (
              <Card
                key={l.id}
                className={cn(
                  "p-4 flex flex-col md:flex-row md:items-center gap-3 border transition-all",
                  item.urgency === "expired"
                    ? "border-destructive/30 bg-destructive/[0.04]"
                    : item.urgency === "today"
                      ? "border-orange-500/30 bg-orange-500/[0.04]"
                      : "border-border/60",
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-background border border-border/60 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{l.product_name}</span>
                    {l.batch && <Badge variant="outline" className="text-[10px] font-mono">{l.batch}</Badge>}
                    <span className={cn("text-xs font-semibold inline-flex items-center gap-1", t.tone)}>
                      {item.urgency === "expired" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {t.text}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                    <div><span className="uppercase tracking-wider">Local</span><div className="text-foreground font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{l.storage_location || "—"}</div></div>
                    <div><span className="uppercase tracking-wider">Quantidade</span><div className="text-foreground font-medium">{l.units_remaining ?? l.quantity}{l.weight != null && l.weight_unit ? ` · ${String(l.weight).replace(".", ",")} ${l.weight_unit}` : ""}</div></div>
                    <div><span className="uppercase tracking-wider">Manipulado</span><div className="text-foreground font-medium">{fmt(l.manufacture_date)}</div></div>
                    <div><span className="uppercase tracking-wider">Validade de manipulação</span><div className="text-foreground font-medium">{fmt(l.expiry_date)}</div></div>
                    <div><span className="uppercase tracking-wider">Validade original (fabricante)</span><div className="text-foreground font-medium">{(l as any).original_expiry_date ? fmt((l as any).original_expiry_date) : "—"}<span className="ml-1 text-[10px] text-muted-foreground">não muda</span></div></div>
                    <div><span className="uppercase tracking-wider">Responsável</span><div className="text-foreground font-medium truncate">{l.responsible || l.employee_name || "—"}</div></div>
                    {item.renewable && item.nextExpiry && (
                      <>
                        <div>
                          <span className="uppercase tracking-wider">Nova data de manipulação</span>
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">agora (data/hora da renovação)</div>
                        </div>
                        <div>
                          <span className="uppercase tracking-wider">Nova validade de manipulação (regra: {item.ruleLabel})</span>
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(item.nextExpiry)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col gap-2 max-w-[260px]">
                  {!item.renewable && item.blockReason && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.blockReason}</span>
                    </div>
                  )}
                  <Button className="gap-2" onClick={() => reprint(item)}>
                    <Printer className="h-4 w-4" /> Reimprimir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

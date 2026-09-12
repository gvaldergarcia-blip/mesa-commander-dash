import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, Loader2, CheckCircle2, AlertTriangle, Clock, MapPin, Package, Lock, Printer,
  ArrowRight, CalendarDays,
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

interface RenewalPanelProps {
  actionOnly?: boolean;
}

export function RenewalPanel({ actionOnly = false }: RenewalPanelProps) {
  const {
    items, isLoading, lookaheadHours, setLookaheadHours, renewOne,
  } = useLabelRenewals();
  const { restaurant } = useRestaurant();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    setQuantities((current) => {
      const next = { ...current };
      items.forEach((item) => {
        if (next[item.label.id] == null) {
          next[item.label.id] = Math.max(1, Number(item.label.quantity ?? 1));
        }
      });
      return next;
    });
  }, [items]);

  const visibleItems = useMemo(
    () => actionOnly
      ? items.filter((item) => item.renewable && (item.urgency === "expired" || item.urgency === "today"))
      : items,
    [actionOnly, items],
  );

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
        const raw =
          row?.original_expiry_date ??
          (prev.label as any).original_expiry_date ??
          (prev.originalExpiry ? prev.originalExpiry.toISOString() : null);
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      })(),
      responsible: row?.responsible || prev.label.responsible || "—",
      quantity: Number(row?.quantity || 1),
      // MESMO CICLO: o lote original nunca muda na renovação.
      batch: prev.cycleLot ?? row?.batch ?? null,
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
  const reprint = async (item: RenewalItem) => {
    const l: any = item.label;
    if (item.cycleEnded) {
      toast.error("Validade original atingida — inicie um novo ciclo em Imprimir etiqueta");
      return;
    }
    const quantity = Math.max(1, Math.min(50, Math.floor(quantities[l.id] || 1)));
    setPrintingId(l.id);
    try {
      const result = await renewOne(item, quantity);
      const note = item.ruleLabel
        ? `Manipulação ${fmt(result.manufacture)} · regra após abertura ${item.ruleLabel}`
        : l.notes ?? null;
      printLabelsMany([
        buildPrint(
          { ...result.created, quantity },
          item,
          result.manufacture,
          result.expiry,
          note,
        ),
      ]);
      toast.success(`${quantity} etiqueta(s) renovada(s) · validade ${fmt(result.expiry)}`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível renovar a etiqueta");
    } finally {
      setPrintingId(null);
    }
  };

  const counts = useMemo(() => ({
    expired: visibleItems.filter((i) => i.urgency === "expired").length,
    today: visibleItems.filter((i) => i.urgency === "today").length,
    soon: visibleItems.filter((i) => i.urgency === "soon").length,
  }), [visibleItems]);

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

        {visibleItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="border-destructive/40 text-destructive">{counts.expired} vencidas</Badge>
            <Badge variant="outline" className="border-orange-500/40 text-orange-500">{counts.today} vencem hoje</Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500">{counts.soon} nas próximas horas</Badge>
          </div>
        )}
      </Card>

      {visibleItems.length === 0 ? (
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
          {visibleItems.map((item) => {
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
                <div className="h-10 w-10 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
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
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2 mt-3 text-xs">
                    <div><span className="text-muted-foreground">Local</span><div className="text-foreground font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{l.storage_location || "—"}</div></div>
                    <div><span className="text-muted-foreground">Lote do ciclo</span><div className="text-foreground font-mono font-medium">{item.cycleLot || "—"}</div></div>
                    <div><span className="text-muted-foreground">Responsável</span><div className="text-foreground font-medium truncate">{l.responsible || l.employee_name || "—"}</div></div>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/70 bg-background/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Comparação de validades
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Original do fabricante</div>
                        <div className="font-bold text-foreground">{item.originalExpiry ? fmt(item.originalExpiry) : "Não informada"}</div>
                        <div className="text-[10px] text-muted-foreground">limite máximo do produto</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Pós-abertura · {item.ruleLabel || "sem regra"}</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{item.nextExpiry ? fmt(item.nextExpiry) : "Não calculada"}</div>
                        <div className="text-[10px] text-muted-foreground">nova validade ao renovar agora</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col gap-2 w-full md:w-[210px]">
                  {!item.renewable && item.blockReason && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.blockReason}</span>
                    </div>
                  )}
                  {item.cycleEnded ? (
                    <div className="text-xs rounded-lg border border-destructive/40 bg-destructive/5 text-destructive px-3 py-2">
                      ⚠ Validade original atingida — novo ciclo necessário em <strong>Imprimir etiqueta</strong>.
                    </div>
                  ) : (
                    <>
                      <label className="text-xs font-medium text-muted-foreground" htmlFor={`renew-qty-${l.id}`}>
                        Quantidade de etiquetas
                      </label>
                      <Input
                        id={`renew-qty-${l.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={50}
                        value={quantities[l.id] ?? 1}
                        onChange={(event) => setQuantities((current) => ({
                          ...current,
                          [l.id]: Math.max(1, Math.min(50, Math.floor(Number(event.target.value) || 1))),
                        }))}
                        className="h-10 font-semibold"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Preenchido com as {l.quantity} impressas anteriormente. Você pode editar.
                      </p>
                      <Button className="gap-2" disabled={printingId === l.id || !item.renewable} onClick={() => reprint(item)}>
                        {printingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Renovar e imprimir
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

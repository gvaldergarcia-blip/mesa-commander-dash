import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle, PackageX, TrendingDown, Trash2, PackagePlus, Printer,
  ClipboardCheck, Users, Sparkles, Boxes, Timer, ArrowRight, MapPin,
} from "lucide-react";
import { useStockStatus } from "@/hooks/useStockStatus";
import { useLabels } from "@/hooks/useLabels";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { useLabelMovements } from "@/hooks/useReceipts";
import { useLabeledProducts } from "@/hooks/useLabeledProducts";
import { mergeSectors } from "@/lib/labels/sectors";
import { format, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Range = "7" | "30" | "90";

const EVENT_META: Record<string, { label: string; icon: any; tone: string }> = {
  receipt:      { label: "Recebimento",     icon: PackagePlus,    tone: "text-emerald-500 bg-emerald-500/10" },
  label_issued: { label: "Etiqueta emitida",icon: Printer,        tone: "text-blue-500 bg-blue-500/10" },
  discharge:    { label: "Baixa",           icon: PackageX,       tone: "text-slate-500 bg-slate-500/10" },
  waste:        { label: "Perda",           icon: Trash2,         tone: "text-rose-500 bg-rose-500/10" },
  adjustment:   { label: "Ajuste",          icon: ClipboardCheck, tone: "text-muted-foreground bg-muted" },
};

export function StockReportsTab() {
  const { statuses } = useStockStatus();
  const { labels } = useLabels();
  const { products } = useLabelProducts();
  const { activeEmployees } = useLabelEmployees();
  const { items: labeledProducts } = useLabeledProducts();
  const { data: movements = [] } = useLabelMovements(150);
  const [range, setRange] = useState<Range>("30");
  const [search, setSearch] = useState("");

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    return d;
  }, [range]);

  const sectors = useMemo(
    () => mergeSectors([...products.map((p) => p.storage_location), ...statuses.map((s) => s.sector)]),
    [products, statuses]
  );

  const respBySector = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of activeEmployees) for (const s of e.sectors || []) {
      if (!m.has(s)) m.set(s, []);
      m.get(s)!.push(e.name);
    }
    return m;
  }, [activeEmployees]);

  // ============ KPIs ============
  const activeLabels = labels.filter((l) => l.status !== "discharged");
  const labelsToday = labels.filter((l) => isToday(new Date(l.created_at)));
  const conferencesToday = statuses.filter((s) => s.marked_at && isToday(new Date(s.marked_at)));
  const needsRestock = statuses.filter((s) => s.status === "falta");
  const attention = statuses.filter((s) => s.status === "atencao");
  const expiredLabels = activeLabels.filter((l) => l.expiry_date && new Date(l.expiry_date) < new Date());
  const dischargesToday = labels.filter((l) => l.status === "discharged" && l.resolved_at && isToday(new Date(l.resolved_at)));
  const lastConference = [...statuses].sort((a, b) => new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime())[0];

  const sectorsConferredToday = new Set(conferencesToday.map((s) => s.sector).filter(Boolean));
  const pendingSectors = sectors.filter((s) => !sectorsConferredToday.has(s));

  // ============ Prioridades ============
  const priorities = useMemo(() => {
    const items: { sector: string; severity: "high" | "medium"; message: string }[] = [];
    // Setores com falta
    const bySectorFalta = new Map<string, number>();
    const bySectorAtencao = new Map<string, number>();
    needsRestock.forEach((s) => bySectorFalta.set(s.sector || "Sem setor", (bySectorFalta.get(s.sector || "Sem setor") || 0) + 1));
    attention.forEach((s) => bySectorAtencao.set(s.sector || "Sem setor", (bySectorAtencao.get(s.sector || "Sem setor") || 0) + 1));
    bySectorFalta.forEach((n, sec) => items.push({ sector: sec, severity: "high", message: `${n} produto(s) precisam repor` }));
    bySectorAtencao.forEach((n, sec) => items.push({ sector: sec, severity: "medium", message: `${n} produto(s) em atenção` }));
    // Etiquetas vencendo em ≤1 dia
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const expiringSoon = new Map<string, number>();
    activeLabels.forEach((l) => {
      if (!l.expiry_date) return;
      const exp = new Date(l.expiry_date);
      if (exp <= tomorrow) {
        const sec = (l as any).storage_location || "Sem setor";
        expiringSoon.set(sec, (expiringSoon.get(sec) || 0) + 1);
      }
    });
    expiringSoon.forEach((n, sec) => items.push({ sector: sec, severity: "high", message: `${n} etiqueta(s) vencem em até 24h` }));
    // Setores sem conferência hoje
    pendingSectors.forEach((sec) => {
      const hasProducts = labeledProducts.some((p) => p.sector === sec);
      if (hasProducts) items.push({ sector: sec, severity: "medium", message: "Conferência não realizada hoje" });
    });
    return items.sort((a, b) => (a.severity === "high" ? -1 : 1));
  }, [needsRestock, attention, activeLabels, pendingSectors, labeledProducts]);

  // ============ Situação por setor ============
  const sectorCards = useMemo(() => {
    return sectors.map((sec) => {
      const prods = labeledProducts.filter((p) => p.sector === sec);
      const sts = statuses.filter((s) => s.sector === sec);
      const ok = sts.filter((s) => s.status === "ok").length;
      const at = sts.filter((s) => s.status === "atencao").length;
      const falta = sts.filter((s) => s.status === "falta").length;
      const lastConf = [...sts].sort((a, b) => new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime())[0];
      const resp = respBySector.get(sec) || [];
      return { sector: sec, total: prods.length, ok, at, falta, lastConf, resp };
    }).filter((c) => c.total > 0 || c.falta > 0 || c.at > 0 || c.ok > 0)
      .sort((a, b) => (b.falta + b.at) - (a.falta + a.at));
  }, [sectors, labeledProducts, statuses, respBySector]);

  // ============ Perdas ============
  const losses = useMemo(() => {
    return labels
      .filter((l) => l.status === "discharged" && (l.discharge_reason === "vencimento" || l.discharge_reason === "loss"))
      .filter((l) => l.resolved_at && new Date(l.resolved_at) >= cutoff)
      .filter((l) => !search || l.product_name.toLowerCase().includes(search.toLowerCase()));
  }, [labels, cutoff, search]);

  const lossRankProducts = useMemo(() => {
    const m = new Map<string, number>();
    losses.forEach((l) => m.set(l.product_name, (m.get(l.product_name) || 0) + 1));
    return Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [losses]);

  const lossRankSectors = useMemo(() => {
    const m = new Map<string, number>();
    losses.forEach((l) => {
      const sec = (l as any).storage_location || "Sem setor";
      m.set(sec, (m.get(sec) || 0) + 1);
    });
    return Array.from(m.entries()).map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count);
  }, [losses]);

  const totalLostUnits = losses.reduce((s, l) => s + Number(l.quantity || 0), 0);

  // ============ Timeline ============
  const timeline = useMemo(() => {
    return (movements || []).slice(0, 25).map((m: any) => ({
      id: m.id,
      type: m.event_type,
      when: m.occurred_at,
      actor: m.actor_name || m.employee_name || null,
      product: m.product?.name || m.product_name || null,
      supplier: m.supplier?.name || null,
      qty: m.quantity,
    }));
  }, [movements]);

  // ============ Indicadores ============
  const totalSectorsWithProducts = sectorCards.length;
  const percentConferred = totalSectorsWithProducts
    ? Math.round((sectorsConferredToday.size / totalSectorsWithProducts) * 100)
    : 0;
  const bestSector = [...sectorCards].sort((a, b) => (b.ok - b.falta) - (a.ok - a.falta))[0];
  const worstLossSector = lossRankSectors[0];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Centro de Inteligência Operacional</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Tudo o que precisa da sua atenção agora — em um só lugar.
        </p>
      </header>

      {/* ============ RESUMO OPERACIONAL ============ */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Boxes}          label="Etiquetados ativos" value={labeledProducts.length} />
        <KPI icon={Printer}        label="Emitidas hoje"      value={labelsToday.length} tone="blue" />
        <KPI icon={ClipboardCheck} label="Conferências hoje"  value={conferencesToday.length} tone="emerald" />
        <KPI icon={PackageX}       label="Precisam repor"     value={needsRestock.length} tone="rose" />
        <KPI icon={AlertTriangle}  label="Vencidos"           value={expiredLabels.length} tone="rose" />
        <KPI icon={Trash2}         label="Baixas hoje"        value={dischargesToday.length} tone="violet" />
        <KPI icon={MapPin}         label="Setores pendentes"  value={pendingSectors.length} tone="amber" />
        <KPI
          icon={Timer}
          label="Última conferência"
          text={lastConference?.marked_at
            ? formatDistanceToNow(new Date(lastConference.marked_at), { addSuffix: true, locale: ptBR })
            : "—"}
        />
      </section>

      {/* ============ REQUER ATENÇÃO ============ */}
      <section>
        <SectionTitle icon={AlertTriangle} title="Requer atenção" subtitle="Ação imediata sugerida" />
        {priorities.length === 0 ? (
          <Card className="p-6 text-sm text-center text-muted-foreground">
            Tudo em ordem. Nenhuma pendência crítica agora. ✅
          </Card>
        ) : (
          <div className="grid gap-2">
            {priorities.slice(0, 8).map((p, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border",
                  p.severity === "high"
                    ? "border-rose-500/30 bg-rose-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                )}
              >
                <span className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  p.severity === "high" ? "bg-rose-500" : "bg-amber-500"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.sector}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.message}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ SITUAÇÃO POR SETOR ============ */}
      <section>
        <SectionTitle icon={MapPin} title="Situação por setor" subtitle="Visão consolidada de cada área" />
        {sectorCards.length === 0 ? (
          <Card className="p-6 text-sm text-center text-muted-foreground">
            Ainda não há setores com produtos etiquetados.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sectorCards.map((s) => (
              <Card key={s.sector} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.sector}</div>
                    <div className="text-xs text-muted-foreground">{s.total} produto(s)</div>
                  </div>
                  {s.falta > 0 ? (
                    <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10">crítico</Badge>
                  ) : s.at > 0 ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10">atenção</Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10">ok</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-emerald-500 font-semibold">✓ {s.ok}</span>
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">⚠ {s.at}</span>
                  <span className="flex items-center gap-1 text-rose-500 font-semibold">✕ {s.falta}</span>
                </div>
                <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Responsável</div>
                    <div className="font-medium truncate">{s.resp[0] || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" /> Última conf.</div>
                    <div className="font-medium">
                      {s.lastConf?.marked_at
                        ? format(new Date(s.lastConf.marked_at), "HH:mm", { locale: ptBR })
                        : "—"}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ============ PERDAS + TIMELINE ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle icon={Trash2} title="Perdas" subtitle={`Últimos ${range} dias`} inline />
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 text-xs">
              {(["7", "30", "90"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-colors",
                    range === r ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >{r}d</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Descartadas" value={losses.length} />
            <MiniStat label="Unidades" value={totalLostUnits} />
            <MiniStat label="Produtos afetados" value={lossRankProducts.length} />
          </div>
          <Input
            placeholder="Buscar produto perdido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Tabs defaultValue="produtos">
            <TabsList>
              <TabsTrigger value="produtos">Por produto</TabsTrigger>
              <TabsTrigger value="setores">Por setor</TabsTrigger>
            </TabsList>
            <TabsContent value="produtos" className="mt-3">
              <Card className="divide-y">
                {lossRankProducts.length === 0 ? (
                  <div className="p-6 text-sm text-center text-muted-foreground">Nenhuma perda no período. ✅</div>
                ) : lossRankProducts.slice(0, 10).map((p, i) => (
                  <div key={p.name} className="p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    <div className="flex-1 truncate font-medium">{p.name}</div>
                    <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10">{p.count}x</Badge>
                  </div>
                ))}
              </Card>
            </TabsContent>
            <TabsContent value="setores" className="mt-3">
              <Card className="divide-y">
                {lossRankSectors.length === 0 ? (
                  <div className="p-6 text-sm text-center text-muted-foreground">Nenhuma perda no período. ✅</div>
                ) : lossRankSectors.map((s, i) => (
                  <div key={s.sector} className="p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    <div className="flex-1 truncate font-medium">{s.sector}</div>
                    <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10">{s.count}x</Badge>
                  </div>
                ))}
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-3">
          <SectionTitle icon={Timer} title="Histórico operacional" subtitle="Últimos eventos" inline />
          <Card className="divide-y max-h-[520px] overflow-y-auto">
            {timeline.length === 0 ? (
              <div className="p-6 text-sm text-center text-muted-foreground">Sem eventos ainda.</div>
            ) : timeline.map((e) => {
              const meta = EVENT_META[e.type] ?? EVENT_META.adjustment;
              const Icon = meta.icon;
              return (
                <div key={e.id} className="p-3 flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg shrink-0", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">{format(new Date(e.when), "HH:mm", { locale: ptBR })}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(e.when), "dd/MM", { locale: ptBR })}</span>
                    </div>
                    <div className="text-sm font-medium truncate">
                      {meta.label}{e.product ? ` — ${e.product}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.actor || "Sistema"}{e.supplier ? ` • ${e.supplier}` : ""}{e.qty ? ` • ${e.qty}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      </div>

      {/* ============ INDICADORES ============ */}
      <section>
        <SectionTitle icon={Sparkles} title="Indicadores de operação" subtitle="Base para insights de IA" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <IndicatorCard label="Setores conferidos hoje" value={`${percentConferred}%`} hint={`${sectorsConferredToday.size} de ${totalSectorsWithProducts}`} />
          <IndicatorCard label="Setor mais organizado" value={bestSector?.sector || "—"} hint={bestSector ? `${bestSector.ok} ok / ${bestSector.falta} faltas` : ""} />
          <IndicatorCard label="Setor com mais perdas" value={worstLossSector?.sector || "—"} hint={worstLossSector ? `${worstLossSector.count} baixas` : ""} tone="rose" />
          <IndicatorCard label="Produto mais desperdiçado" value={lossRankProducts[0]?.name || "—"} hint={lossRankProducts[0] ? `${lossRankProducts[0].count} vezes` : ""} tone="rose" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Em breve: alertas automáticos sobre produtos que sempre entram em falta, categorias que mais vencem antes do uso e sugestões de compra.
        </p>
      </section>
    </div>
  );
}

// ================= UI ATOMS =================

function KPI({ icon: Icon, label, value, text, tone = "slate" }: { icon: any; label: string; value?: number; text?: string; tone?: "slate" | "rose" | "amber" | "violet" | "emerald" | "blue" }) {
  const tones: Record<string, string> = {
    slate:   "bg-card border-border/60",
    rose:    "bg-rose-500/5 border-rose-500/20",
    amber:   "bg-amber-500/5 border-amber-500/20",
    violet:  "bg-violet-500/5 border-violet-500/20",
    emerald: "bg-emerald-500/5 border-emerald-500/20",
    blue:    "bg-blue-500/5 border-blue-500/20",
  };
  const iconTone: Record<string, string> = {
    slate:   "text-muted-foreground",
    rose:    "text-rose-500",
    amber:   "text-amber-500",
    violet:  "text-violet-500",
    emerald: "text-emerald-500",
    blue:    "text-blue-500",
  };
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", iconTone[tone])} />
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</span>
      </div>
      {value !== undefined ? (
        <div className="text-3xl font-extrabold tabular-nums text-foreground">{value}</div>
      ) : (
        <div className="text-base font-semibold text-foreground truncate">{text}</div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, inline }: { icon: any; title: string; subtitle?: string; inline?: boolean }) {
  return (
    <div className={cn("mb-3", inline && "mb-0")}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{subtitle}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function IndicatorCard({ label, value, hint, tone = "slate" }: { label: string; value: string; hint?: string; tone?: "slate" | "rose" }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      tone === "rose" ? "border-rose-500/20 bg-rose-500/5" : "border-border/60 bg-card/40"
    )}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className="text-lg font-bold mt-1 truncate">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

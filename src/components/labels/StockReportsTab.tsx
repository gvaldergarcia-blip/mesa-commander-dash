import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle, Trash2, ClipboardCheck, Boxes, Timer, ArrowRight,
  MapPin, Search, CheckCircle2, AlertCircle, Circle, User, Package,
} from "lucide-react";
import { useStockStatus } from "@/hooks/useStockStatus";
import { useLabels } from "@/hooks/useLabels";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { useLabeledProducts } from "@/hooks/useLabeledProducts";
import { mergeSectors } from "@/lib/labels/sectors";
import { format, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Range = "7" | "30" | "90";

interface Props {
  onOpenSector?: (sector?: string) => void;
}

export function StockReportsTab({ onOpenSector }: Props = {}) {
  const { statuses } = useStockStatus();
  const { labels } = useLabels();
  const { products } = useLabelProducts();
  const { activeEmployees } = useLabelEmployees();
  const { items: labeledProducts } = useLabeledProducts();
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

  // ============ Indicadores ============
  const totalSectorsWithProducts = sectorCards.length;
  const percentConferred = totalSectorsWithProducts
    ? Math.round((sectorsConferredToday.size / totalSectorsWithProducts) * 100)
    : 0;
  const worstLossSector = lossRankSectors[0];
  const lastConfRelative = lastConference?.marked_at
    ? formatDistanceToNow(new Date(lastConference.marked_at), { addSuffix: true, locale: ptBR })
    : "—";

  return (
    <div className="space-y-12 max-w-6xl mx-auto">
      {/* ============ HEADER ============ */}
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Visão executiva da sua cozinha em tempo real.
        </p>
      </header>

      {/* ============ REQUER ATENÇÃO ============ */}
      <section className="space-y-4">
        <SectionHeader
          title="Requer atenção"
          hint={priorities.length ? `${priorities.length} pendência${priorities.length === 1 ? "" : "s"}` : "Nada pendente"}
        />
        {priorities.length === 0 ? (
          <EmptyPanel icon={CheckCircle2} title="Tudo em ordem" description="Nenhum alerta ativo neste momento." tone="ok" />
        ) : (
          <div className="space-y-2.5">
            {priorities.slice(0, 6).map((p, i) => {
              const info = sectorCards.find((s) => s.sector === p.sector);
              return (
                <AlertRow
                  key={i}
                  severity={p.severity}
                  sector={p.sector}
                  message={p.message}
                  responsible={info?.resp[0]}
                  lastConf={info?.lastConf?.marked_at}
                  onOpen={() => onOpenSector?.(p.sector)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ============ SAÚDE GERAL ============ */}
      <section className="space-y-4">
        <SectionHeader title="Saúde da operação" hint="Últimas 24h" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Produtos ativos"      value={labeledProducts.length} />
          <MetricCard label="Produtos críticos"    value={needsRestock.length} tone={needsRestock.length ? "danger" : "neutral"} />
          <MetricCard label="Vencidos"             value={expiredLabels.length} tone={expiredLabels.length ? "danger" : "neutral"} />
          <MetricCard label="Setores conferidos"   value={`${percentConferred}%`} hint={`${sectorsConferredToday.size} de ${totalSectorsWithProducts}`} />
          <MetricCard label="Conferências hoje"    value={conferencesToday.length} />
          <MetricCard label="Última conferência"   valueText={lastConfRelative} />
        </div>
      </section>

      {/* ============ SITUAÇÃO POR SETOR ============ */}
      <section className="space-y-4">
        <SectionHeader title="Situação por setor" hint={`${sectorCards.length} setor${sectorCards.length === 1 ? "" : "es"}`} />
        {sectorCards.length === 0 ? (
          <EmptyPanel icon={Package} title="Nenhum setor ativo" description="Setores aparecem aqui após o primeiro produto etiquetado." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sectorCards.map((s) => (
              <SectorCard
                key={s.sector}
                data={s}
                onOpen={() => onOpenSector?.(s.sector)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============ PERDAS ============ */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <SectionHeader title="Perdas" hint={`Últimos ${range} dias`} className="mb-0" />
          <RangeSwitch value={range} onChange={setRange} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Descartadas"        value={losses.length} tone={losses.length ? "danger" : "neutral"} compact />
          <MetricCard label="Unidades perdidas"  value={totalLostUnits} compact />
          <MetricCard label="Produtos afetados"  value={lossRankProducts.length} compact />
        </div>

        {(losses.length > 0 || search) && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-transparent"
            />
          </div>
        )}

        <Tabs defaultValue="produtos">
          <TabsList className="bg-muted/40">
            <TabsTrigger value="produtos">Por produto</TabsTrigger>
            <TabsTrigger value="setores">Por setor</TabsTrigger>
          </TabsList>
          <TabsContent value="produtos" className="mt-4">
            <RankList
              items={lossRankProducts.slice(0, 10).map((p) => ({ label: p.name, count: p.count }))}
              empty="Nenhuma perda no período."
            />
          </TabsContent>
          <TabsContent value="setores" className="mt-4">
            <RankList
              items={lossRankSectors.map((s) => ({ label: s.sector, count: s.count, onClick: () => onOpenSector?.(s.sector) }))}
              empty="Nenhuma perda no período."
            />
          </TabsContent>
        </Tabs>

        {worstLossSector && (
          <p className="text-xs text-muted-foreground pt-1">
            Setor com mais perdas no período: <span className="font-medium text-foreground">{worstLossSector.sector}</span> ({worstLossSector.count} baixa{worstLossSector.count === 1 ? "" : "s"}).
          </p>
        )}
      </section>
    </div>
  );
}

// ================= UI ATOMS =================

function SectionHeader({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function MetricCard({
  label, value, valueText, hint, tone = "neutral", compact,
}: {
  label: string; value?: number | string; valueText?: string; hint?: string;
  tone?: "neutral" | "danger" | "warning" | "ok"; compact?: boolean;
}) {
  const toneColor = {
    neutral: "text-foreground",
    danger: "text-rose-600 dark:text-rose-400",
    warning: "text-amber-600 dark:text-amber-500",
    ok: "text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.03)]",
      compact ? "p-4" : "p-5"
    )}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {value !== undefined ? (
        <div className={cn("mt-3 text-3xl font-semibold tabular-nums tracking-tight", toneColor)}>{value}</div>
      ) : (
        <div className={cn("mt-3 text-base font-semibold truncate", toneColor)}>{valueText}</div>
      )}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AlertRow({
  severity, sector, message, responsible, lastConf, onOpen,
}: {
  severity: "high" | "medium";
  sector: string;
  message: string;
  responsible?: string;
  lastConf?: string;
  onOpen?: () => void;
}) {
  const dot = severity === "high" ? "bg-rose-500" : "bg-amber-500";
  const label = severity === "high" ? "Crítico" : "Atenção";
  const labelColor = severity === "high" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-500";
  return (
    <div className="group rounded-2xl bg-card border border-border/40 hover:border-border transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-5 flex items-center gap-4">
      <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", labelColor)}>{label}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm font-semibold text-foreground truncate">{sector}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">{message}</p>
        {(responsible || lastConf) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {responsible && (
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> {responsible}</span>
            )}
            {lastConf && (
              <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> conferido {formatDistanceToNow(new Date(lastConf), { addSuffix: true, locale: ptBR })}</span>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpen}
        className="opacity-70 group-hover:opacity-100 transition-opacity"
      >
        Abrir setor
        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
      </Button>
    </div>
  );
}

function SectorCard({
  data, onOpen,
}: {
  data: { sector: string; total: number; ok: number; at: number; falta: number; lastConf?: any; resp: string[] };
  onOpen?: () => void;
}) {
  const status: "ok" | "warning" | "danger" =
    data.falta > 0 ? "danger" : data.at > 0 ? "warning" : "ok";

  const statusMeta = {
    ok:      { label: "Saudável", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
    warning: { label: "Atenção",  color: "text-amber-600 dark:text-amber-500",     dot: "bg-amber-500" },
    danger:  { label: "Crítico",  color: "text-rose-600 dark:text-rose-400",       dot: "bg-rose-500" },
  }[status];

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.03)] p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight truncate">{data.sector}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{data.total} produto{data.total === 1 ? "" : "s"}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", statusMeta.color)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
          {statusMeta.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCell icon={CheckCircle2} value={data.ok}    label="OK"      color="text-emerald-600 dark:text-emerald-400" />
        <StatCell icon={AlertCircle}  value={data.at}    label="Atenção" color="text-amber-600 dark:text-amber-500" />
        <StatCell icon={Circle}       value={data.falta} label="Falta"   color="text-rose-600 dark:text-rose-400" />
      </div>

      <div className="pt-4 border-t border-border/40 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="text-foreground">{data.resp[0] || "—"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            <span className="text-foreground">
              {data.lastConf?.marked_at
                ? format(new Date(data.lastConf.marked_at), "HH:mm", { locale: ptBR })
                : "—"}
            </span>
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpen} className="h-7 px-2 -mr-2 text-xs">
          Abrir <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StatCell({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", color)} strokeWidth={2} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function RangeSwitch({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 text-xs">
      {(["7", "30", "90"] as Range[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            "px-3 py-1.5 rounded-md font-medium transition-all",
            value === r ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r} dias
        </button>
      ))}
    </div>
  );
}

function RankList({ items, empty }: { items: { label: string; count: number; onClick?: () => void }[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="rounded-2xl border border-border/40 bg-card divide-y divide-border/40">
      {items.map((it, i) => (
        <div
          key={it.label}
          onClick={it.onClick}
          className={cn(
            "px-5 py-4 flex items-center gap-4",
            it.onClick && "cursor-pointer hover:bg-muted/30 transition-colors"
          )}
        >
          <span className="text-xs font-mono tabular-nums text-muted-foreground w-4">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-foreground">{it.label}</div>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-rose-500/70 rounded-full"
                style={{ width: `${(it.count / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground w-10 text-right">{it.count}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, description, tone = "neutral" }: { icon: any; title: string; description: string; tone?: "neutral" | "ok" }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-10 text-center">
      <div className={cn(
        "mx-auto h-10 w-10 rounded-full flex items-center justify-center mb-3",
        tone === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
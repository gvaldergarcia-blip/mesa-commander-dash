import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Tag, Package, Users, ShieldCheck, Activity, Snowflake, Flame, Thermometer, Refrigerator, CheckCircle2 } from "lucide-react";
import { Label } from "@/hooks/useLabels";
import { LabelStats, CONSERVATION_LABEL } from "@/lib/labels/utils";
import { LabelStatsCards } from "./LabelStatsCards";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  labels: Label[];
  stats: LabelStats;
  productCount: number;
  activeFilter: string | null;
  onSelectStat: (f: string | null) => void;
  onQuickAction: (action: "new-label" | "new-product" | "new-employee" | "validity") => void;
}

const CONSERVATION_COLORS: Record<string, string> = {
  refrigerated: "hsl(199 89% 58%)", // sky
  frozen: "hsl(217 91% 65%)",       // blue
  ambient: "hsl(38 92% 60%)",       // amber
  hot: "hsl(15 90% 58%)",           // orange
};

const CONSERVATION_ICONS: Record<string, any> = {
  refrigerated: Refrigerator,
  frozen: Snowflake,
  ambient: Thermometer,
  hot: Flame,
};

export function LabelDashboard({ labels, stats, productCount, activeFilter, onSelectStat, onQuickAction }: Props) {
  const conservationData = useMemo(() => {
    const counts: Record<string, number> = { refrigerated: 0, frozen: 0, ambient: 0, hot: 0 };
    labels.forEach((l) => {
      const k = l.conservation_method || "refrigerated";
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      key,
      name: CONSERVATION_LABEL[key] || key,
      value,
    }));
  }, [labels]);

  const totalConservation = conservationData.reduce((s, d) => s + d.value, 0);

  const quickActions = [
    { key: "new-label", label: "Nova Etiqueta", desc: "Criar etiqueta de produto", icon: Tag, color: "from-primary/20 to-primary/5", iconBox: "bg-primary/20 text-primary" },
    { key: "new-employee", label: "Novo Funcionário", desc: "Cadastrar funcionário", icon: Users, color: "from-violet-500/20 to-violet-500/5", iconBox: "bg-violet-500/20 text-violet-400" },
    { key: "validity", label: "Verificar Validades", desc: "Controle de vencimentos", icon: ShieldCheck, color: "from-amber-500/20 to-amber-500/5", iconBox: "bg-amber-500/20 text-amber-400" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <LabelStatsCards
        stats={stats}
        productCount={productCount}
        activeFilter={activeFilter}
        onSelect={onSelectStat}
      />

      {/* Quick Actions */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Ações Rápidas</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={() => onQuickAction(a.key as any)}
                className={cn(
                  "group rounded-2xl border border-border/50 bg-gradient-to-br p-5 text-left",
                  "hover:border-primary/40 hover:-translate-y-0.5 transition-all",
                  a.color
                )}
              >
                <div className={cn("inline-flex p-3 rounded-xl mb-3", a.iconBox)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-bold text-base group-hover:text-primary transition-colors">{a.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Conservation + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-primary" />
              <h3 className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Métodos de Conservação</h3>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{totalConservation} etiquetas</span>
          </div>

          {totalConservation === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Sem dados de conservação ainda.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="relative h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={conservationData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="hsl(var(--background))"
                      strokeWidth={3}
                    >
                      {conservationData.map((d) => (
                        <Cell key={d.key} fill={CONSERVATION_COLORS[d.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-3xl font-extrabold tabular-nums">{totalConservation}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
                </div>
              </div>
              <div className="space-y-2">
                {conservationData.map((d) => {
                  const Icon = CONSERVATION_ICONS[d.key];
                  const pct = totalConservation > 0 ? Math.round((d.value / totalConservation) * 100) : 0;
                  return (
                    <div key={d.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
                      <div className="p-2 rounded-lg" style={{ background: `${CONSERVATION_COLORS[d.key]}25`, color: CONSERVATION_COLORS[d.key] }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground">{pct}% do total</div>
                      </div>
                      <div className="text-lg font-bold tabular-nums">{d.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Status do Sistema</h3>
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-300">Sistema Online</span>
              </div>
              <p className="text-xs text-muted-foreground">Todos os serviços funcionando normalmente.</p>
            </div>
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-bold text-sky-300">Última Sincronização</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {labels.length > 0
                  ? formatDistanceToNow(new Date(labels[0].created_at), { addSuffix: true, locale: ptBR })
                  : "agora mesmo"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-bold text-violet-300">Etiquetas Ativas</span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {labels.filter((l) => l.status === "active").length} etiquetas em uso
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
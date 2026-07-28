import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Thermometer } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLabels, Label as LabelRow } from "@/hooks/useLabels";
import { useStockStatus } from "@/hooks/useStockStatus";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  refrigerated: "hsl(199 89% 58%)",
  frozen: "hsl(217 91% 65%)",
  ambient: "hsl(38 92% 60%)",
  hot: "hsl(15 90% 58%)",
};
const FALLBACK_COLORS = [
  "hsl(160 84% 45%)", "hsl(271 76% 63%)", "hsl(340 82% 62%)", "hsl(190 80% 45%)",
];

function colorFor(key: string, idx: number) {
  return COLORS[key] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}
function labelFor(key: string) {
  return CONSERVATION_LABEL[key] || (key === "unknown" ? "Não informado" : key);
}

export function ConservationDonutCard() {
  const { labels } = useLabels();
  const { statusMap } = useStockStatus();
  const [selected, setSelected] = useState<string | null>(null);

  // Lotes ativos: não baixados, não vencidos, com unidades restantes e
  // cujo produto não esteja marcado como "precisa repor" (falta).
  const activeLots = useMemo(
    () =>
      labels.filter((l) => {
        if (l.status !== "active") return false;
        if ((l.units_remaining ?? 0) <= 0) return false;
        if (l.label_product_id && statusMap.get(l.label_product_id)?.status === "falta") return false;
        return true;
      }),
    [labels, statusMap],
  );

  const groups = useMemo(() => {
    const map = new Map<string, LabelRow[]>();
    for (const l of activeLots) {
      const k = l.conservation_method || "unknown";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return Array.from(map.entries())
      .map(([key, rows], i) => ({
        key,
        name: labelFor(key),
        value: rows.length,
        color: colorFor(key, i),
        rows,
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeLots]);

  const total = activeLots.length;
  const selectedGroup = groups.find((g) => g.key === selected) || null;

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-primary" /> Produtos por Método de Conservação
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Distribuição dos produtos atualmente ativos na cozinha.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 tabular-nums">{total} lotes</Badge>
      </div>

      {total === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
          Nenhum produto ativo encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groups}
                  cx="50%" cy="50%"
                  innerRadius={62} outerRadius={92}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={3}
                  isAnimationActive
                  animationDuration={500}
                  onClick={(d: any) => setSelected(d?.payload?.key ?? null)}
                >
                  {groups.map((g) => (
                    <Cell key={g.key} fill={g.color} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, _n: any, p: any) =>
                    [`${v} lotes (${Math.round((Number(v) / total) * 100)}%)`, p?.payload?.name]}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-3xl font-extrabold tabular-nums leading-none">{total}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Produtos</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ativos</div>
            </div>
          </div>

          <div className="space-y-2">
            {groups.map((g) => {
              const pct = Math.round((g.value / total) * 100);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setSelected(g.key)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors text-left",
                  )}
                >
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{g.name}</span>
                  <span className="text-sm font-bold tabular-nums">{g.value}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selectedGroup} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: selectedGroup?.color }} />
              {selectedGroup?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedGroup?.value} lote(s) ativo(s) — ordenados pela validade mais próxima.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left py-2 pr-3">Produto</th>
                  <th className="text-left py-2 pr-3">Lote</th>
                  <th className="text-left py-2 pr-3">Setor</th>
                  <th className="text-left py-2 pr-3">Conservação</th>
                  <th className="text-right py-2 pr-3">Restante</th>
                  <th className="text-left py-2 pr-3">Validade</th>
                  <th className="text-right py-2">Dias</th>
                </tr>
              </thead>
              <tbody>
                {(selectedGroup?.rows || [])
                  .slice()
                  .sort((a, b) => +new Date(a.expiry_date) - +new Date(b.expiry_date))
                  .map((l) => {
                    const days = differenceInCalendarDays(new Date(l.expiry_date), new Date());
                    return (
                      <tr key={l.id} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-medium">{l.product_name}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{l.batch || "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{l.storage_location || "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{labelFor(l.conservation_method || "unknown")}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.units_remaining}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {format(new Date(l.expiry_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </td>
                        <td className={cn("py-2 text-right tabular-nums font-semibold",
                          days <= 0 ? "text-destructive" : days <= 1 ? "text-orange-500" : "text-muted-foreground")}>
                          {days}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

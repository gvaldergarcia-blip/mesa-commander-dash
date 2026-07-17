import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, PackageX, Download, TrendingDown, Trash2, Calendar } from "lucide-react";
import { useStockStatus } from "@/hooks/useStockStatus";
import { useLabels } from "@/hooks/useLabels";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { toCsv, downloadCsv } from "@/lib/labels/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Range = "7" | "30" | "90" | "all";

export function StockReportsTab() {
  const { statuses } = useStockStatus();
  const { labels } = useLabels();
  const { products } = useLabelProducts();
  const [range, setRange] = useState<Range>("30");
  const [search, setSearch] = useState("");

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const cutoff = useMemo(() => {
    if (range === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    return d;
  }, [range]);

  // ============ FALTAS ============
  const faltas = useMemo(() => {
    return statuses
      .filter((s) => s.status === "falta" || s.status === "atencao")
      .map((s) => {
        const p = productMap.get(s.product_id);
        return {
          id: s.product_id,
          name: p?.name || "Produto",
          sector: s.sector || p?.storage_location || p?.category || "Sem setor",
          status: s.status,
          marked_by: s.marked_by_name || "—",
          marked_at: s.marked_at,
          notes: s.notes,
        };
      })
      .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.status === "falta" ? -1 : 1));
  }, [statuses, productMap, search]);

  const faltasBySector = useMemo(() => {
    const map = new Map<string, { falta: number; atencao: number }>();
    faltas.forEach((f) => {
      const cur = map.get(f.sector) || { falta: 0, atencao: 0 };
      if (f.status === "falta") cur.falta++;
      else cur.atencao++;
      map.set(f.sector, cur);
    });
    return Array.from(map.entries()).sort((a, b) => (b[1].falta + b[1].atencao) - (a[1].falta + a[1].atencao));
  }, [faltas]);

  // ============ PERDAS (vencimento) ============
  const perdas = useMemo(() => {
    return labels
      .filter((l) => l.status === "discharged" && (l.discharge_reason === "vencimento" || l.discharge_reason === "loss"))
      .filter((l) => !cutoff || (l.resolved_at && new Date(l.resolved_at) >= cutoff))
      .filter((l) => !search || l.product_name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.resolved_at || b.created_at).getTime() - new Date(a.resolved_at || a.created_at).getTime());
  }, [labels, cutoff, search]);

  const perdasByProduct = useMemo(() => {
    const map = new Map<string, { count: number; qty: number; last: string }>();
    perdas.forEach((l) => {
      const cur = map.get(l.product_name) || { count: 0, qty: 0, last: l.resolved_at || l.created_at };
      cur.count++;
      cur.qty += Number(l.quantity || 0);
      if (new Date(l.resolved_at || l.created_at) > new Date(cur.last)) cur.last = l.resolved_at || l.created_at;
      map.set(l.product_name, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [perdas]);

  const totalQty = perdas.reduce((s, l) => s + Number(l.quantity || 0), 0);

  const exportFaltas = () => {
    const rows = faltas.map((f) => ({
      produto: f.name,
      setor: f.sector,
      status: f.status === "falta" ? "Precisa repor" : "Atenção",
      marcado_por: f.marked_by,
      data: format(new Date(f.marked_at), "dd/MM/yyyy HH:mm"),
      observacao: f.notes || "",
    }));
    downloadCsv(`faltas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  const exportPerdas = () => {
    const rows = perdas.map((l) => ({
      produto: l.product_name,
      lote: l.batch || "",
      quantidade: l.quantity,
      motivo: l.discharge_reason,
      fabricacao: l.manufacture_date,
      vencimento: l.expiry_date,
      baixado_em: l.resolved_at ? format(new Date(l.resolved_at), "dd/MM/yyyy HH:mm") : "",
      codigo: l.unique_code,
    }));
    downloadCsv(`perdas-vencimento-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Relatórios de Estoque</h2>
        <p className="text-sm text-muted-foreground">
          O que está faltando agora e o que foi jogado fora por vencimento.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={PackageX} label="Precisam repor" value={faltas.filter((f) => f.status === "falta").length} tone="rose" />
        <KPI icon={AlertTriangle} label="Em atenção" value={faltas.filter((f) => f.status === "atencao").length} tone="amber" />
        <KPI icon={Trash2} label="Perdas no período" value={perdas.length} tone="rose" />
        <KPI icon={TrendingDown} label="Unidades perdidas" value={totalQty} tone="violet" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-sm" />
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 text-xs">
          {(["7", "30", "90", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors",
                range === r ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "all" ? "Tudo" : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="faltas">
        <TabsList>
          <TabsTrigger value="faltas" className="gap-2"><PackageX className="h-4 w-4" /> Faltas</TabsTrigger>
          <TabsTrigger value="perdas" className="gap-2"><Trash2 className="h-4 w-4" /> Perdas por vencimento</TabsTrigger>
        </TabsList>

        {/* ===== FALTAS ===== */}
        <TabsContent value="faltas" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {faltas.length} item(s) marcados como <b>Precisa repor</b> ou <b>Atenção</b>.
            </div>
            <Button variant="outline" size="sm" onClick={exportFaltas} disabled={!faltas.length} className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          {faltasBySector.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {faltasBySector.map(([sector, v]) => (
                <div key={sector} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">{sector}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold tabular-nums text-rose-500">{v.falta}</span>
                    <span className="text-xs text-muted-foreground">falta</span>
                    {v.atencao > 0 && (
                      <>
                        <span className="text-sm font-semibold tabular-nums text-amber-500 ml-1">{v.atencao}</span>
                        <span className="text-xs text-muted-foreground">atenção</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Card className="divide-y">
            {faltas.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum produto marcado como falta ou atenção. 🎉</div>
            ) : (
              faltas.map((f) => (
                <div key={f.id} className="p-4 flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      f.status === "falta"
                        ? "border-rose-500/40 text-rose-500 bg-rose-500/10"
                        : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                    )}
                  >
                    {f.status === "falta" ? "Precisa repor" : "Atenção"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {f.sector} • Marcado por {f.marked_by} em {format(new Date(f.marked_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </TabsContent>

        {/* ===== PERDAS ===== */}
        <TabsContent value="perdas" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {perdas.length} etiqueta(s) baixadas por vencimento{range !== "all" ? ` nos últimos ${range} dias` : ""}.
            </div>
            <Button variant="outline" size="sm" onClick={exportPerdas} disabled={!perdas.length} className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          {perdasByProduct.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-bold mb-2">Ranking — produtos mais desperdiçados</div>
              <Card className="divide-y">
                {perdasByProduct.slice(0, 10).map((p, idx) => (
                  <div key={p.name} className="p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.qty} unidade(s) • última perda {format(new Date(p.last), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10">
                      {p.count}x
                    </Badge>
                  </div>
                ))}
              </Card>
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-bold mb-2">Histórico detalhado</div>
            <Card className="divide-y">
              {perdas.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma perda registrada no período. ✅</div>
              ) : (
                perdas.map((l) => (
                  <div key={l.id} className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                      <Trash2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{l.product_name}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        <span>Qtd: {l.quantity}</span>
                        {l.batch && <span>• Lote {l.batch}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> venceu {format(new Date(l.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {l.resolved_at && (
                          <span>• baixado {format(new Date(l.resolved_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10 uppercase text-[10px]">
                      {l.discharge_reason}
                    </Badge>
                  </div>
                ))
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "rose" | "amber" | "violet" }) {
  const tones: Record<string, string> = {
    rose: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  };
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className="text-3xl font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
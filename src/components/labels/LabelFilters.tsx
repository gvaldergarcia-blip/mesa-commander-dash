import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label as UILabel } from "@/components/ui/label";
import { LabelEmployee } from "@/hooks/useLabelEmployees";
import { cn } from "@/lib/utils";

export interface LabelFiltersState {
  search: string;
  employeeId: string;
  conservation: string;
  status: string;
  startDate: string;
  endDate: string;
  expiredOnly: boolean;
}

export const emptyFilters: LabelFiltersState = {
  search: "",
  employeeId: "all",
  conservation: "all",
  status: "all",
  startDate: "",
  endDate: "",
  expiredOnly: false,
};

interface Props {
  value: LabelFiltersState;
  onChange: (v: LabelFiltersState) => void;
  employees: LabelEmployee[];
  onExport: () => void;
}

export function LabelFilters({ value, onChange, employees, onExport }: Props) {
  const set = (k: keyof LabelFiltersState, v: any) => onChange({ ...value, [k]: v });

  const statusPills: { value: string; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Ativo" },
    { value: "expired", label: "Vencido" },
    { value: "today", label: "Vence Hoje" },
  ];
  const conservationPills: { value: string; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "refrigerated", label: "Resfriado" },
    { value: "frozen", label: "Congelado" },
    { value: "ambient", label: "Temp. Ambiente" },
  ];

  const pillClass = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
      active
        ? "text-white border-transparent"
        : "bg-[#1A1A2E] border-[#2D2D44] text-[#A0AEC0] hover:bg-[#22223A]"
    );

  const inputDark =
    "bg-[#1A1A2E] border-[#2D2D44] placeholder:text-[#718096] focus-visible:border-[#FF6B00] focus-visible:ring-0";

  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "#0F0F1A", borderColor: "#2D2D44" }}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="relative md:col-span-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#718096" }} />
          <Input
            placeholder="Buscar por produto..."
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            className={cn("pl-9", inputDark)}
          />
        </div>
        <Select value={value.employeeId} onValueChange={(v) => set("employeeId", v)}>
          <SelectTrigger className={cn("md:col-span-3", inputDark)}><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} className={cn("md:col-span-2", inputDark)} />
        <Input type="date" value={value.endDate} onChange={(e) => set("endDate", e.target.value)} className={cn("md:col-span-2", inputDark)} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0" style={{ color: "#718096" }}>Status:</span>
          {statusPills.map((p) => {
            const active = value.status === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => set("status", p.value)}
                className={pillClass(active)}
                style={active ? { backgroundColor: "#FF6B00" } : undefined}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0" style={{ color: "#718096" }}>Conservação:</span>
          {conservationPills.map((p) => {
            const active = value.conservation === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => set("conservation", p.value)}
                className={pillClass(active)}
                style={active ? { backgroundColor: "#FF6B00" } : undefined}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: "#2D2D44" }}>
        <div className="flex items-center gap-2 pl-1">
          <Switch
            id="expiredOnly"
            checked={value.expiredOnly}
            onCheckedChange={(v) => set("expiredOnly", v)}
            style={value.expiredOnly ? ({ ["--switch-bg" as any]: "#FF6B00" } as any) : undefined}
            className="data-[state=checked]:bg-[#FF6B00]"
          />
          <UILabel htmlFor="expiredOnly" className="text-sm cursor-pointer" style={{ color: "#A0AEC0" }}>
            Apenas vencidas
          </UILabel>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters)} className="gap-2" style={{ color: "#A0AEC0" }}>
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2 bg-[#1A1A2E] border-[#2D2D44] text-[#A0AEC0] hover:bg-[#22223A] hover:text-white">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
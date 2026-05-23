import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, Download } from "lucide-react";
import { LabelEmployee } from "@/hooks/useLabelEmployees";

export interface LabelFiltersState {
  search: string;
  employeeId: string;
  conservation: string;
  status: string;
  startDate: string;
  endDate: string;
}

export const emptyFilters: LabelFiltersState = {
  search: "",
  employeeId: "all",
  conservation: "all",
  status: "all",
  startDate: "",
  endDate: "",
};

interface Props {
  value: LabelFiltersState;
  onChange: (v: LabelFiltersState) => void;
  employees: LabelEmployee[];
  onExport: () => void;
}

export function LabelFilters({ value, onChange, employees, onExport }: Props) {
  const set = (k: keyof LabelFiltersState, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="relative md:col-span-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto..."
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={value.employeeId} onValueChange={(v) => set("employeeId", v)}>
          <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={value.conservation} onValueChange={(v) => set("conservation", v)}>
          <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Conservação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda conservação</SelectItem>
            <SelectItem value="refrigerated">Resfriado</SelectItem>
            <SelectItem value="frozen">Congelado</SelectItem>
            <SelectItem value="ambient">Ambiente</SelectItem>
            <SelectItem value="hot">Quente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={value.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="expired">Vencido</SelectItem>
            <SelectItem value="discharged">Baixado</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} className="md:col-span-1" />
        <Input type="date" value={value.endDate} onChange={(e) => set("endDate", e.target.value)} className="md:col-span-1" />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters)} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>
    </div>
  );
}
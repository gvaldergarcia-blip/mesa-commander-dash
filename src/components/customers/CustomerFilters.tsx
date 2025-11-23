import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerFilter, SourceFilter, MarketingFilter } from "@/hooks/useCustomersEnhanced";

type CustomerFiltersProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: CustomerFilter;
  onStatusFilterChange: (value: CustomerFilter) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (value: SourceFilter) => void;
  marketingFilter: MarketingFilter;
  onMarketingFilterChange: (value: MarketingFilter) => void;
  sortBy: 'name' | 'visits' | 'lastVisit';
  onSortByChange: (value: 'name' | 'visits' | 'lastVisit') => void;
};

export function CustomerFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  marketingFilter,
  onMarketingFilterChange,
  sortBy,
  onSortByChange,
}: CustomerFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full md:w-[180px]">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Filtrar status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="vip">⭐ VIP</SelectItem>
          <SelectItem value="new">🟢 Novos</SelectItem>
          <SelectItem value="active">✅ Ativos</SelectItem>
          <SelectItem value="inactive">⚪ Inativos</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          <SelectItem value="queue">🎫 Fila</SelectItem>
          <SelectItem value="reservation">📅 Reserva</SelectItem>
        </SelectContent>
      </Select>

      <Select value={marketingFilter} onValueChange={onMarketingFilterChange}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Marketing" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="opt-in">✅ Aceitam promoções</SelectItem>
          <SelectItem value="opt-out">❌ Não aceitam</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Nome A-Z</SelectItem>
          <SelectItem value="visits">Mais visitas</SelectItem>
          <SelectItem value="lastVisit">Última visita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

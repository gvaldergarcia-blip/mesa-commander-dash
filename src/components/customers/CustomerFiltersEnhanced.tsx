import { Search, Filter, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerFilter, SourceFilter, MarketingFilter, PeriodFilter } from "@/hooks/useRestaurantCustomers";

type CustomerFiltersEnhancedProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: CustomerFilter;
  onStatusFilterChange: (value: CustomerFilter) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (value: SourceFilter) => void;
  marketingFilter: MarketingFilter;
  onMarketingFilterChange: (value: MarketingFilter) => void;
  periodFilter: PeriodFilter;
  onPeriodFilterChange: (value: PeriodFilter) => void;
  sortBy: 'name' | 'visits' | 'lastVisit';
  onSortByChange: (value: 'name' | 'visits' | 'lastVisit') => void;
};

export function CustomerFiltersEnhanced({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  marketingFilter,
  onMarketingFilterChange,
  periodFilter,
  onPeriodFilterChange,
  sortBy,
  onSortByChange,
}: CustomerFiltersEnhancedProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full md:w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="vip">⭐ VIP</SelectItem>
            <SelectItem value="new">🆕 Novos</SelectItem>
            <SelectItem value="active">✅ Ativos</SelectItem>
            <SelectItem value="inactive">⚪ Inativos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
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
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Select value={periodFilter} onValueChange={onPeriodFilterChange}>
          <SelectTrigger className="w-full md:w-[160px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="7days">Últimos 7 dias</SelectItem>
            <SelectItem value="30days">Últimos 30 dias</SelectItem>
            <SelectItem value="90days">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastVisit">Última visita</SelectItem>
            <SelectItem value="name">Nome A-Z</SelectItem>
            <SelectItem value="visits">Mais visitas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

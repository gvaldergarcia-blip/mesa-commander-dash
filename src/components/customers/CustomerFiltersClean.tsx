import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CustomerFilter, SourceFilter, MarketingFilter, PeriodFilter } from "@/hooks/useRestaurantCustomers";
import { cn } from "@/lib/utils";

type CustomerFiltersCleanProps = {
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
  sortBy: 'name' | 'visits' | 'lastVisit' | 'birthday';
  onSortByChange: (value: 'name' | 'visits' | 'lastVisit' | 'birthday') => void;
};

export function CustomerFiltersClean({
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
}: CustomerFiltersCleanProps) {
  const activeFiltersCount = [
    statusFilter !== 'all',
    sourceFilter !== 'all',
    marketingFilter !== 'all',
    periodFilter !== 'all',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onStatusFilterChange('all');
    onSourceFilterChange('all');
    onMarketingFilterChange('all');
    onPeriodFilterChange('all');
    onSearchChange('');
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Search */}
      <div className="relative flex-1 w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail, telefone ou tag..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onSearchChange('')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Quick Filter */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className={cn(
            "w-[150px] h-10",
            statusFilter !== 'all' && "border-primary bg-primary/5"
          )}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="vip">⭐ VIP</SelectItem>
            <SelectItem value="new">🆕 Novos</SelectItem>
            <SelectItem value="active">🟢 Ativos</SelectItem>
            <SelectItem value="recurrent">🔄 Recorrentes</SelectItem>
            <SelectItem value="birthday">🎂 Aniversariantes</SelectItem>
            <SelectItem value="inactive">🔴 Em risco</SelectItem>
          </SelectContent>
        </Select>

        {/* More Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" className="h-10 gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filtros avançados</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                    Limpar tudo
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Origem</label>
                  <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="queue">🎫 Fila</SelectItem>
                      <SelectItem value="reservation">📅 Reserva</SelectItem>
                      <SelectItem value="both">🔀 Usa ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Marketing</label>
                  <Select value={marketingFilter} onValueChange={onMarketingFilterChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="opt-in">✅ Aceita promoções</SelectItem>
                      <SelectItem value="opt-out">❌ Não aceita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Período</label>
                  <Select value={periodFilter} onValueChange={onPeriodFilterChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo período</SelectItem>
                      <SelectItem value="7days">Últimos 7 dias</SelectItem>
                      <SelectItem value="30days">Últimos 30 dias</SelectItem>
                      <SelectItem value="90days">Últimos 90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-[160px] h-10">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastVisit">Última visita</SelectItem>
            <SelectItem value="name">Nome A-Z</SelectItem>
            <SelectItem value="visits">Mais visitas</SelectItem>
            <SelectItem value="birthday">Aniversário</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

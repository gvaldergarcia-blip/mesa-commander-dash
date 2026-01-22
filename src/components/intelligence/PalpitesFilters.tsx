import { Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  PalpiteStatusFilter, 
  PalpitePriorityFilter, 
  PalpiteTypeFilter 
} from '@/hooks/useAIPalpites';

interface PalpitesFiltersProps {
  statusFilter: PalpiteStatusFilter;
  onStatusChange: (value: PalpiteStatusFilter) => void;
  priorityFilter: PalpitePriorityFilter;
  onPriorityChange: (value: PalpitePriorityFilter) => void;
  typeFilter: PalpiteTypeFilter;
  onTypeChange: (value: PalpiteTypeFilter) => void;
}

export function PalpitesFilters({
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  typeFilter,
  onTypeChange,
}: PalpitesFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filtros:</span>
      </div>

      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="new">Novos</SelectItem>
          <SelectItem value="seen">Vistos</SelectItem>
          <SelectItem value="sent">Enviados</SelectItem>
          <SelectItem value="dismissed">Dispensados</SelectItem>
        </SelectContent>
      </Select>

      <Select value={priorityFilter} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="med">Média</SelectItem>
          <SelectItem value="low">Baixa</SelectItem>
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos tipos</SelectItem>
          <SelectItem value="LONG_WAIT_RECOVERY">Longa Espera</SelectItem>
          <SelectItem value="NO_SHOW_EDUCATE">No-Show Recorrente</SelectItem>
          <SelectItem value="COOLING_CUSTOMER">Cliente Esfriando</SelectItem>
          <SelectItem value="FREQUENT_CUSTOMER">Frequente</SelectItem>
          <SelectItem value="ALMOST_VIP">Quase VIP</SelectItem>
          <SelectItem value="POST_VISIT">Pós-Visita</SelectItem>
          <SelectItem value="WINBACK">Reconquistar</SelectItem>
          <SelectItem value="CHURN_RISK">Risco de Churn</SelectItem>
          <SelectItem value="VIP_ENGAGEMENT">Engajar VIP</SelectItem>
          <SelectItem value="NEW_CUSTOMER_FOLLOWUP">Cliente Novo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

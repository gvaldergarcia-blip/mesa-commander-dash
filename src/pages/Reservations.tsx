import { useState, useEffect } from "react";
import { Plus, Calendar, Clock, User, Phone, Search, Filter } from "lucide-react";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useReservations } from "@/hooks/useReservations";
import { useRestaurantCalendar } from "@/hooks/useRestaurantCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reservations() {
  const { restaurants } = useRestaurants();
  const { reservations, loading, updateReservationStatus, createReservation } = useReservations();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("week");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  
  const { calendarDays, loading: calendarLoading, toggleDayAvailability, isDayAvailable } = useRestaurantCalendar();
  
  // Wrapper para atualizar status e mudar o filtro automaticamente
  const handleUpdateStatus = async (reservationId: string, newStatus: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show') => {
    console.log('[Reservations] Atualizando status para:', newStatus);
    await updateReservationStatus(reservationId, newStatus);
    
    // Mapear status para a aba correspondente
    const tabMap: Record<string, string> = {
      'pending': 'pending',
      'confirmed': 'confirmed',
      'seated': 'completed',
      'completed': 'completed',
      'canceled': 'canceled',
      'no_show': 'canceled'
    };
    
    // Muda automaticamente para a aba do novo status
    const targetTab = tabMap[newStatus] || 'all';
    setActiveTab(targetTab);
    setStatusFilter(newStatus);
  };
  
  // Form state
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newPeople, setNewPeople] = useState("2");
  const [newNotes, setNewNotes] = useState("");
  
  const handleCreateReservation = async () => {
    if (!newName || !newPhone || !newDate || !newTime) return;
    
    const dateTime = `${newDate}T${newTime}:00`;
    
    await createReservation({
      customer_name: newName,
      phone: newPhone,
      starts_at: dateTime,
      people: parseInt(newPeople),
      notes: newNotes || undefined,
    });
    
    // Reset form
    setNewName("");
    setNewPhone("");
    setNewDate("");
    setNewTime("");
    setNewPeople("2");
    setNewNotes("");
    setIsDialogOpen(false);
  };

  // Helper functions
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    });
  };

  // Filtros de data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Filtrar apenas reservas expiradas que estão pendentes
  const filterExpiredPendingReservations = (resList: typeof reservations) => {
    const now = new Date();
    return resList.filter(reservation => {
      const resDate = new Date(reservation.starts_at);
      
      // Se a reserva já passou e está pendente, remove da lista
      if (resDate < now && reservation.status === 'pending') {
        return false;
      }
      
      return true;
    });
  };

  // Filtrar reservas por período
  const filterByPeriod = (resList: typeof reservations) => {
    if (periodFilter === "all") return resList;
    
    return resList.filter(reservation => {
      const resDate = new Date(reservation.starts_at);
      
      if (periodFilter === "today") {
        return resDate >= today && resDate < tomorrow;
      } else if (periodFilter === "week") {
        return resDate >= today && resDate <= weekEnd;
      } else if (periodFilter === "last7") {
        return resDate >= sevenDaysAgo && resDate <= today;
      } else if (periodFilter === "last30") {
        return resDate >= thirtyDaysAgo && resDate <= today;
      } else if (periodFilter === "custom" && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999);
        return resDate >= start && resDate <= end;
      }
      
      return true;
    });
  };

  // Filtrar reservas por aba
  const getReservationsByTab = (tab: string) => {
    let filtered = reservations;
    
    if (tab === "today") {
      filtered = reservations.filter(reservation => {
        const resDate = new Date(reservation.starts_at);
        return resDate >= today && resDate < tomorrow;
      });
    } else if (tab === "week") {
      filtered = reservations.filter(reservation => {
        const resDate = new Date(reservation.starts_at);
        return resDate >= today && resDate <= weekEnd;
      });
    }
    
    return filterExpiredPendingReservations(filtered);
  };

  // Aplicar filtros de busca e status
  const applyFilters = (resList: typeof reservations) => {
    let filtered = filterByPeriod(resList);
    
    return filtered.filter(reservation => {
      const matchesSearch = reservation.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           reservation.phone.includes(searchTerm);
      const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const todaysReservations = getReservationsByTab("today");
  const filteredReservations = applyFilters(filterExpiredPendingReservations(reservations));
  
  // Calcular métricas com base no período
  const periodReservations = filterByPeriod(reservations);
  const totalReservations = periodReservations.length;
  const confirmedCount = periodReservations.filter(r => r.status === "confirmed").length;
  const pendingCount = periodReservations.filter(r => r.status === "pending").length;
  const totalPeople = periodReservations.reduce((sum, r) => sum + r.people, 0);

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reservas</h1>
          <p className="text-muted-foreground">Gerencie as reservas do seu restaurante</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Reserva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Reserva</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Nome do cliente"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input 
                placeholder="Telefone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
                <Input 
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <Select value={newPeople} onValueChange={setNewPeople}>
                <SelectTrigger>
                  <SelectValue placeholder="Número de pessoas" />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'pessoa' : 'pessoas'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Observações especiais (opcional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
              <Button 
                className="w-full"
                onClick={handleCreateReservation}
                disabled={!newName || !newPhone || !newDate || !newTime}
              >
                Criar Reserva
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtro de Período */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodFilter === "custom" && (
              <>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Data início</label>
                  <Input 
                    type="date" 
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Data fim</label>
                  <Input 
                    type="date" 
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalReservations}</p>
                <p className="text-sm text-muted-foreground">Total Reservas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{confirmedCount}</p>
                <p className="text-sm text-muted-foreground">Confirmadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalPeople}</p>
                <p className="text-sm text-muted-foreground">Total pessoas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="today">Hoje</TabsTrigger>
          <TabsTrigger value="week">Esta Semana</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou telefone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="confirmed">Confirmadas</SelectItem>
                    <SelectItem value="completed">Concluídas</SelectItem>
                    <SelectItem value="canceled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reservations List */}
          <div className="space-y-3">
            {filteredReservations.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma reserva encontrada</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" 
                      ? "Nenhum resultado encontrado com os filtros atuais."
                      : "Não há reservas cadastradas ainda."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredReservations.map((reservation) => (
                <Card key={reservation.reservation_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(reservation.starts_at)}
                          </p>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold">{reservation.customer_name}</h3>
                            <StatusBadge status={reservation.status} />
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {reservation.phone}
                            </span>
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              {reservation.people} pessoas
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDate(reservation.starts_at)} às {formatTime(reservation.starts_at)}
                            </span>
                          </div>
                          {reservation.notes && (
                            <p className="text-sm text-muted-foreground mt-1 italic">
                              "{reservation.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {reservation.status === "pending" && (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-success hover:bg-success/90"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "confirmed")}
                            >
                              Confirmar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                        {reservation.status === "confirmed" && (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-success hover:bg-success/90"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed")}
                            >
                              Concluir
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "pending")}
                            >
                              Pendente
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={async () => {
                                await updateReservationStatus(reservation.reservation_id, "canceled", "no_show");
                                setActiveTab("all");
                                setStatusFilter("canceled");
                              }}
                            >
                              Não compareceu
                            </Button>
                          </>
                        )}
                        {reservation.status === "seated" && (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-accent hover:bg-accent/90"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed")}
                            >
                              Concluída
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou telefone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="confirmed">Confirmadas</SelectItem>
                    <SelectItem value="seated">Sentadas</SelectItem>
                    <SelectItem value="completed">Concluídas</SelectItem>
                    <SelectItem value="canceled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reservations List */}
          <div className="space-y-3">
            {applyFilters(todaysReservations).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma reserva para hoje</h3>
                  <p className="text-muted-foreground">
                    Não há reservas para hoje.
                  </p>
                </CardContent>
              </Card>
            ) : (
              applyFilters(todaysReservations).map((reservation) => (
                <Card key={reservation.reservation_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(reservation.starts_at)}
                          </p>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold">{reservation.customer_name}</h3>
                            <StatusBadge status={reservation.status} />
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {reservation.phone}
                            </span>
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              {reservation.people} pessoas
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTime(reservation.starts_at)}
                            </span>
                          </div>
                          {reservation.notes && (
                            <p className="text-sm text-muted-foreground mt-1 italic">
                              "{reservation.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {reservation.status === "pending" && (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-success hover:bg-success/90"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "confirmed")}
                            >
                              Confirmar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                        {reservation.status === "confirmed" && (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-accent hover:bg-accent/90"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed")}
                            >
                              Concluída
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "pending")}
                            >
                              Pendente
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                        {reservation.status === "seated" && (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-accent hover:bg-accent/90"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed")}
                            >
                              Concluída
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="week">
          <div className="space-y-3">
            {applyFilters(getReservationsByTab("week")).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma reserva esta semana</h3>
                  <p className="text-muted-foreground">
                    Não há reservas para esta semana.
                  </p>
                </CardContent>
              </Card>
            ) : (
              applyFilters(getReservationsByTab("week")).map((reservation) => (
              <Card key={reservation.reservation_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(reservation.starts_at)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold">{reservation.customer_name}</h3>
                          <StatusBadge status={reservation.status} />
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {reservation.phone}
                          </span>
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {reservation.people} pessoas
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDateShort(reservation.starts_at)} {formatTime(reservation.starts_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {reservation.status === "pending" && (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-success hover:bg-success/90"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "confirmed")}
                          >
                            Confirmar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                      {reservation.status === "confirmed" && (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-accent hover:bg-accent/90"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "completed")}
                          >
                            Concluída
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "pending")}
                          >
                            Pendente
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                      {reservation.status === "seated" && (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-accent hover:bg-accent/90"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "completed")}
                          >
                            Concluída
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "canceled")}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Calendário de Disponibilidade</CardTitle>
              <p className="text-sm text-muted-foreground">
                Marque os dias em que o restaurante não estará disponível para reservas
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {/* Calendar implementation */}
                  {(() => {
                    const today = new Date();
                    const currentMonth = today.getMonth();
                    const currentYear = today.getFullYear();
                    const firstDay = new Date(currentYear, currentMonth, 1);
                    const lastDay = new Date(currentYear, currentMonth + 1, 0);
                    const daysInMonth = lastDay.getDate();
                    const startingDayOfWeek = firstDay.getDay();
                    
                    const days = [];
                    
                    // Day headers
                    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
                      days.push(
                        <div key={`header-${day}`} className="text-center text-sm font-medium p-2">
                          {day}
                        </div>
                      );
                    });
                    
                    // Empty cells for days before month starts
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(<div key={`empty-${i}`} className="p-2"></div>);
                    }
                    
                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(currentYear, currentMonth, day);
                      const dateString = date.toISOString().split('T')[0];
                      const isAvailable = isDayAvailable(dateString);
                      const isPast = date < today;
                      
                      days.push(
                        <button
                          key={`day-${day}`}
                          onClick={() => !isPast && toggleDayAvailability(dateString, !isAvailable)}
                          disabled={isPast}
                          className={`
                            p-2 rounded-lg text-sm transition-colors
                            ${isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                            ${isAvailable 
                              ? 'bg-success/10 text-success hover:bg-success/20' 
                              : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            }
                          `}
                        >
                          {day}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-success/20"></div>
                    <span>Disponível</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-destructive/20"></div>
                    <span>Indisponível</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Plus, Calendar, Clock, User, Phone, Search, Filter, Mail } from "lucide-react";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useReservationsEnhanced, ReservationEnhanced } from "@/hooks/useReservationsEnhanced";
import { useRestaurantCalendar } from "@/hooks/useRestaurantCalendar";
import { VipBadge } from "@/components/queue/VipBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { reservationSchema, normalizeReservationToUTC } from "@/lib/validations/reservation";
import { logAudit } from "@/lib/audit";
import { RESTAURANT_ID } from "@/config/current-restaurant";
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
  const { reservations, loading, loadingVip, updateReservationStatus, createReservation } = useReservationsEnhanced();
  
  // Track if we have loaded data at least once to prevent flicker on refetch
  const [hasInitialData, setHasInitialData] = useState(false);
  
  useEffect(() => {
    if (!loading && reservations.length >= 0) {
      setHasInitialData(true);
    }
  }, [loading, reservations.length]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("week");
  const [partySizeFilter, setPartySizeFilter] = useState("all");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  
  // Debug: Log quando os filtros mudarem
  useEffect(() => {
    console.log('[Reservations] Filtros atualizados:', { 
      statusFilter, 
      searchTerm, 
      partySizeFilter,
      periodFilter,
      activeTab 
    });
  }, [statusFilter, searchTerm, partySizeFilter, periodFilter, activeTab]);
  
  const { calendarDays, loading: calendarLoading, toggleDayAvailability, isDayAvailable } = useRestaurantCalendar();
  
  // Wrapper para atualizar status e mudar o filtro automaticamente
  const handleUpdateStatus = async (
    reservationId: string, 
    newStatus: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show',
    reservationDate?: string
  ) => {
    console.log('[Reservations] Atualizando status para:', newStatus);
    
    // VALIDAÇÃO: Impedir conclusão antes da data marcada
    if (newStatus === 'completed' && reservationDate) {
      const now = new Date();
      const scheduledDate = new Date(reservationDate);
      
      // Se tentar concluir antes da data marcada
      if (now < scheduledDate) {
        toast({
          title: "Ação não permitida",
          description: "A reserva não pode ser concluída antes da data marcada pelo cliente.",
          variant: "destructive",
        });
        return; // Não prosseguir com a atualização
      }
    }
    
    await updateReservationStatus(reservationId, newStatus);
    
    // Muda automaticamente o filtro para o novo status
    setStatusFilter(newStatus);
  };
  
  const { toast } = useToast();

  // Form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newPeople, setNewPeople] = useState("2");
  const [newNotes, setNewNotes] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleCreateReservation = async () => {
    setFormErrors({});
    setIsSubmitting(true);

    try {
      // Validar com Zod
      const validationResult = reservationSchema.safeParse({
        customer_name: newName,
        customer_email: newEmail,
        date: newDate,
        time: newTime,
        party_size: parseInt(newPeople),
        notes: newNotes,
      });

      if (!validationResult.success) {
        const errors: Record<string, string> = {};
        validationResult.error.errors.forEach((err) => {
          const path = err.path[0]?.toString() || 'form';
          errors[path] = err.message;
        });
        setFormErrors(errors);
        
        // Mostrar primeiro erro
        const firstError = Object.values(errors)[0];
        toast({
          title: "Erro de validação",
          description: firstError,
          variant: "destructive",
        });
        return;
      }

      // Normalizar para UTC
      const normalizedData = normalizeReservationToUTC(validationResult.data);

      // Log do payload para debug
      console.log('[Reservation] Payload enviado:', normalizedData);

      // Criar reserva
      const result = await createReservation(normalizedData);

      // Log de auditoria
      await logAudit({
        entity: 'reservation',
        entityId: result?.id || 'unknown',
        action: 'create',
        restaurantId: RESTAURANT_ID,
        success: true,
        metadata: { party_size: normalizedData.people },
      });

      toast({
        title: "✅ Reserva criada",
        description: `Reserva para ${newName} confirmada`,
      });

      // Reset form
      setNewName("");
      setNewEmail("");
      setNewDate("");
      setNewTime("");
      setNewPeople("2");
      setNewNotes("");
      setIsDialogOpen(false);
    } catch (err: any) {
      console.error('[Reservation] Erro ao criar:', err);
      
      // Log de auditoria do erro
      await logAudit({
        entity: 'reservation',
        entityId: 'failed',
        action: 'create',
        restaurantId: RESTAURANT_ID,
        success: false,
        errorMessage: err.message,
      });

      const errorMessage = err.response?.data?.message || err.message || 'Erro desconhecido';
      const errorCode = err.response?.data?.code;

      // Mensagens específicas por código
      let userMessage = errorMessage;
      if (errorCode === 'HorarioIndisponivel') {
        userMessage = "⛔ Horário indisponível. Escolha outro horário.";
      } else if (errorCode === 'CampoInvalido') {
        userMessage = "⛔ Dados inválidos. Verifique os campos.";
      }

      toast({
        title: "Erro ao criar reserva",
        description: userMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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

  // Função para extrair apenas a data no formato YYYY-MM-DD
  const getDateOnly = (dateStr: string | Date) => {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getDateOnly(new Date());

  // Filtrar reservas por período
  const filterByPeriod = (resList: typeof reservations) => {
    if (periodFilter === "all") return resList;
    
    return resList.filter(reservation => {
      const resDate = new Date(reservation.starts_at);
      const resDateStr = getDateOnly(reservation.starts_at);
      
      if (periodFilter === "today") {
        return resDateStr === todayStr;
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

  // Filtrar reservas por aba - comparando apenas a data (YYYY-MM-DD)
  const getReservationsByTab = (tab: string) => {
    let filtered = reservations;
    
    if (tab === "today") {
      filtered = reservations.filter(reservation => {
        const resDateStr = getDateOnly(reservation.starts_at);
        return resDateStr === todayStr;
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
                           reservation.phone.includes(searchTerm) ||
                           (reservation.customer_email && reservation.customer_email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
      const matchesPartySize = partySizeFilter === "all" || 
        (partySizeFilter === "1-2" && reservation.people >= 1 && reservation.people <= 2) ||
        (partySizeFilter === "3-4" && reservation.people >= 3 && reservation.people <= 4) ||
        (partySizeFilter === "5-6" && reservation.people >= 5 && reservation.people <= 6) ||
        (partySizeFilter === "7-8" && reservation.people >= 7 && reservation.people <= 8) ||
        (partySizeFilter === "9-10" && reservation.people >= 9 && reservation.people <= 10) ||
        (partySizeFilter === "10+" && reservation.people > 10);
      
      return matchesSearch && matchesStatus && matchesPartySize;
    });
  };

  const todaysReservations = getReservationsByTab("today");
  const filteredReservations = applyFilters(filterExpiredPendingReservations(reservations));
  
  // Debug: Log reservas filtradas
  useEffect(() => {
    console.log('[Reservations] Reservas filtradas:', {
      total: reservations.length,
      filtered: filteredReservations.length,
      today: todaysReservations.length,
      statusFilter,
      matchingStatus: reservations.filter(r => statusFilter === 'all' || r.status === statusFilter).length
    });
  }, [filteredReservations.length, reservations.length, statusFilter, todaysReservations.length]);
  
  // Calcular métricas com base no período (usando o mesmo filtro de expiradas)
  const periodReservations = filterByPeriod(filterExpiredPendingReservations(reservations));
  const totalReservations = periodReservations.length;
  const confirmedCount = periodReservations.filter(r => r.status === "confirmed").length;
  const pendingCount = periodReservations.filter(r => r.status === "pending").length;
  const totalPeople = periodReservations
    .filter(r => r.status !== 'canceled' && r.status !== 'no_show')
    .reduce((sum, r) => sum + r.people, 0);

  // Only show loading on initial load, not on refetch (prevents flicker)
  if (loading && !hasInitialData) {
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
              <div>
                <Input 
                  placeholder="Nome do cliente"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (formErrors.customer_name) setFormErrors({...formErrors, customer_name: ''});
                  }}
                />
                {formErrors.customer_name && (
                  <p className="text-sm text-destructive mt-1">{formErrors.customer_name}</p>
                )}
              </div>

              <div>
                <Input 
                  type="email"
                  placeholder="E-mail do cliente"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    if (formErrors.customer_email) setFormErrors({...formErrors, customer_email: ''});
                  }}
                />
                {formErrors.customer_email && (
                  <p className="text-sm text-destructive mt-1">{formErrors.customer_email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input 
                    type="date"
                    value={newDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const selectedDate = e.target.value;
                      // Verificar se o dia está disponível no calendário
                      if (!isDayAvailable(selectedDate)) {
                        setFormErrors({...formErrors, date: 'Este dia está indisponível para reservas'});
                        return;
                      }
                      setNewDate(selectedDate);
                      if (formErrors.date) setFormErrors({...formErrors, date: ''});
                    }}
                  />
                  {formErrors.date && (
                    <p className="text-sm text-destructive mt-1">{formErrors.date}</p>
                  )}
                  {newDate && !isDayAvailable(newDate) && (
                    <p className="text-sm text-destructive mt-1">⚠️ Este dia está bloqueado no calendário</p>
                  )}
                </div>
                <div>
                  <Input 
                    type="time"
                    value={newTime}
                    onChange={(e) => {
                      setNewTime(e.target.value);
                      if (formErrors.time) setFormErrors({...formErrors, time: ''});
                    }}
                  />
                  {formErrors.time && (
                    <p className="text-sm text-destructive mt-1">{formErrors.time}</p>
                  )}
                </div>
              </div>

              <Select value={newPeople} onValueChange={setNewPeople}>
                <SelectTrigger>
                  <SelectValue placeholder="Número de pessoas" />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8].map(n => (
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
                disabled={isSubmitting || !newName || !newEmail || !newDate || !newTime || (newDate && !isDayAvailable(newDate))}
              >
                {isSubmitting ? "Criando..." : "Criar Reserva"}
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
                      placeholder="Buscar por nome, telefone ou email..."
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
                    <SelectItem value="no_show">Não compareceu</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={partySizeFilter} onValueChange={setPartySizeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tamanho do grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tamanhos</SelectItem>
                    <SelectItem value="1-2">1-2 pessoas</SelectItem>
                    <SelectItem value="3-4">3-4 pessoas</SelectItem>
                    <SelectItem value="5-6">5-6 pessoas</SelectItem>
                    <SelectItem value="7-8">7-8 pessoas</SelectItem>
                    <SelectItem value="9-10">9-10 pessoas</SelectItem>
                    <SelectItem value="10+">10+ pessoas</SelectItem>
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
                            {/* TAG VIP: Exibir se cliente tem 10+ visitas concluídas */}
                            {reservation.vipStatus && (
                              <VipBadge show={reservation.vipStatus.isVip} />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {reservation.phone}
                            </span>
                            {reservation.customer_email && (
                              <span className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {reservation.customer_email}
                              </span>
                            )}
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
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed", reservation.starts_at)}
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
                                await handleUpdateStatus(reservation.reservation_id, "no_show", reservation.starts_at);
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
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed", reservation.starts_at)}
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
                      placeholder="Buscar por nome, telefone ou email..."
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
                    <SelectItem value="no_show">Não compareceu</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={partySizeFilter} onValueChange={setPartySizeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tamanho do grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tamanhos</SelectItem>
                    <SelectItem value="1-2">1-2 pessoas</SelectItem>
                    <SelectItem value="3-4">3-4 pessoas</SelectItem>
                    <SelectItem value="5-6">5-6 pessoas</SelectItem>
                    <SelectItem value="7+">7+ pessoas</SelectItem>
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
                            {/* TAG VIP: Exibir se cliente tem 10+ visitas concluídas */}
                            {reservation.vipStatus && (
                              <VipBadge show={reservation.vipStatus.isVip} />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {reservation.phone}
                            </span>
                            {reservation.customer_email && (
                              <span className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {reservation.customer_email}
                              </span>
                            )}
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
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed", reservation.starts_at)}
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
                              onClick={() => handleUpdateStatus(reservation.reservation_id, "completed", reservation.starts_at)}
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

        <TabsContent value="week" className="space-y-4">
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
                      placeholder="Buscar por nome, telefone ou email..."
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
                    <SelectItem value="no_show">Não compareceu</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={partySizeFilter} onValueChange={setPartySizeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tamanho do grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tamanhos</SelectItem>
                    <SelectItem value="1-2">1-2 pessoas</SelectItem>
                    <SelectItem value="3-4">3-4 pessoas</SelectItem>
                    <SelectItem value="5-6">5-6 pessoas</SelectItem>
                    <SelectItem value="7+">7+ pessoas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reservations List */}
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
                          {/* TAG VIP: Exibir se cliente tem 10+ visitas concluídas */}
                          {reservation.vipStatus && (
                            <VipBadge show={reservation.vipStatus.isVip} />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {reservation.phone}
                          </span>
                          {reservation.customer_email && (
                            <span className="flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {reservation.customer_email}
                            </span>
                          )}
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
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "completed", reservation.starts_at)}
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
                            onClick={() => handleUpdateStatus(reservation.reservation_id, "completed", reservation.starts_at)}
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
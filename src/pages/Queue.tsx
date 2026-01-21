import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Filter, Clock, Users, Mail, Edit2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useQueueEnhanced } from "@/hooks/useQueueEnhanced";
import { useQueueWaitTimeAverages } from "@/hooks/useQueueWaitTimeAverages";
import { useQueueSettings } from "@/hooks/useQueueSettings";
import { useToast } from "@/hooks/use-toast";
import { RESTAURANT_ID } from "@/config/current-restaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { VipBadge } from "@/components/queue/VipBadge";
import { QueueAlert } from "@/components/queue/QueueAlert";
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
import { 
  calculateGroupPositions, 
  getSizeGroup, 
  getSizeGroupLabel,
  countWaitingByGroup,
  type SizeGroup 
} from "@/utils/queueUtils";

export default function Queue() {
  const { restaurants } = useRestaurants();
  const { queueEntries, loading, loadingVip, updateQueueStatus, addToQueue } = useQueueEnhanced();
  const { getAverageForSize, generalAverage, loading: loadingAverages } = useQueueWaitTimeAverages(RESTAURANT_ID);
  const { settings: queueSettings, loading: loadingSettings } = useQueueSettings(RESTAURANT_ID);
  const { toast } = useToast();

  // CONFIGURAÇÃO: Usar valores das configurações do restaurante
  const QUEUE_CAPACITY_LIMIT = queueSettings?.max_queue_capacity || 50;
  const MAX_PARTY_SIZE = queueSettings?.max_party_size || 8;
  const TOLERANCE_MINUTES = queueSettings?.tolerance_minutes || 10;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [partySizeFilter, setPartySizeFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [newNotes, setNewNotes] = useState("");

  const calculateWaitTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  // Considerar todos os entries para permitir visualização em todas as tabs
  const activeEntries = queueEntries;
  
  const totalWaiting = activeEntries.filter(entry => entry.status === "waiting").length;
  const totalPeople = activeEntries.filter(entry => entry.status === "waiting").reduce((sum, entry) => sum + entry.people, 0);
  
  // Calcular posições por GRUPO (filas paralelas)
  const groupPositions = useMemo(() => {
    return calculateGroupPositions(activeEntries);
  }, [activeEntries]);

  // Contagem de espera por grupo
  const waitingByGroup = useMemo(() => {
    return countWaitingByGroup(activeEntries);
  }, [activeEntries]);
  
  // Calcular tempo médio de espera dos que estão aguardando
  const avgWaitTimeMinutes = totalWaiting > 0
    ? Math.round(
        activeEntries
          .filter(entry => entry.status === "waiting")
          .reduce((sum, entry) => sum + calculateWaitTime(entry.created_at), 0) / totalWaiting
      )
    : 0;
  
  const avgWaitTime = avgWaitTimeMinutes + " min";

  // LÓGICA: Fila cheia (baseada na configuração do restaurante)
  const isQueueFull = totalWaiting >= QUEUE_CAPACITY_LIMIT;
  const isQueueCritical = totalWaiting >= QUEUE_CAPACITY_LIMIT;

  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredQueue = activeEntries.filter(entry => {
    if (!entry || !entry.customer_name) return false;
    
    const matchesSearch = !debouncedSearchTerm || 
                         entry.customer_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                         (entry.email && entry.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const matchesPartySize = partySizeFilter === "all" || 
      (partySizeFilter === "1-2" && entry.people >= 1 && entry.people <= 2) ||
      (partySizeFilter === "3-4" && entry.people >= 3 && entry.people <= 4) ||
      (partySizeFilter === "5-6" && entry.people >= 5 && entry.people <= 6) ||
      (partySizeFilter === "7-8" && entry.people >= 7 && entry.people <= 8) ||
      (partySizeFilter === "9-10" && entry.people >= 9 && entry.people <= 10) ||
      (partySizeFilter === "10+" && entry.people > 10);
    
    return matchesSearch && matchesStatus && matchesPartySize;
  });
  
  const handleCallCustomer = async (entry: typeof queueEntries[0]) => {
    try {
      await updateQueueStatus(entry.entry_id, "called");
      toast({
        title: "Cliente chamado",
        description: `${entry.customer_name} foi chamado`,
      });
    } catch (err) {
      // Erro já tratado pelo hook
    }
  };

  const handleSeatCustomer = async (entryId: string) => {
    try {
      await updateQueueStatus(entryId, "seated");
      setStatusFilter("seated");
    } catch (err) {
      // Erro já tratado pelo hook
    }
  };

  const handleCancelCustomer = async (entryId: string) => {
    try {
      await updateQueueStatus(entryId, "canceled");
      
      // Log de auditoria
      const { logAudit } = await import('@/lib/audit');
      await logAudit({
        entity: 'queue_entry',
        entityId: entryId,
        action: 'cancel',
        restaurantId: RESTAURANT_ID,
        success: true,
        metadata: { canceled_by: 'restaurant', source: 'dashboard' }
      });
      
      setStatusFilter("canceled");
    } catch (err) {
      // Erro já tratado pelo hook
    }
  };
  
  const handleAddToQueue = async () => {
    if (!newCustomerName || !newPartySize) {
      toast({
        title: "Erro",
        description: "Preencha o nome e número de pessoas",
        variant: "destructive",
      });
      return;
    }
    
    if (!newCustomerEmail) {
      toast({
        title: "Erro",
        description: "Preencha o email do cliente",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await addToQueue({
        customer_name: newCustomerName,
        email: newCustomerEmail,
        people: parseInt(newPartySize),
        notes: newNotes || undefined,
      });
      
      // Reset form
      setNewCustomerName("");
      setNewCustomerEmail("");
      setNewPartySize("2");
      setNewNotes("");
      setIsAddDialogOpen(false);
    } catch (err) {
      // Error already handled by addToQueue
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Alerta de Fila Cheia */}
      <QueueAlert totalWaiting={totalWaiting} capacityLimit={QUEUE_CAPACITY_LIMIT} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fila de Espera</h1>
          <p className="text-muted-foreground">Gerencie a fila em tempo real</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Cliente à Fila</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Nome do cliente *" 
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
              <Input 
                type="email"
                placeholder="Email do cliente *"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
              />
              <Select value={newPartySize} onValueChange={setNewPartySize}>
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
                placeholder="Observações (opcional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
              <Button 
                className="w-full"
                onClick={handleAddToQueue}
              >
                Adicionar à Fila
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={isQueueFull ? "border-2 border-destructive bg-destructive/5" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              {isQueueFull ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <Users className="h-5 w-5 text-primary" />
              )}
              <div>
                <p className={`text-2xl font-bold ${isQueueFull ? 'text-destructive' : ''}`}>
                  {totalWaiting}
                </p>
                <p className="text-sm text-muted-foreground">Grupos na fila</p>
                {isQueueFull && (
                  <p className="text-xs text-destructive font-semibold mt-1">
                    Fila cheia ({QUEUE_CAPACITY_LIMIT}+ grupos)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalPeople}</p>
                <p className="text-sm text-muted-foreground">Total de pessoas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{avgWaitTime}</p>
                <p className="text-sm text-muted-foreground">Tempo médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filas por Grupo - Visão Resumida */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Filas por Tamanho de Grupo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['1-2', '3-4', '5-6', '7+'] as SizeGroup[]).map((group) => {
              const count = waitingByGroup[group];
              const isActive = partySizeFilter === group;
              return (
                <button
                  key={group}
                  onClick={() => setPartySizeFilter(isActive ? 'all' : group)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive 
                      ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{getSizeGroupLabel(group)}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Clique em um grupo para filtrar. Cada grupo tem sua própria sequência de posições.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
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
                <SelectItem value="waiting">Aguardando</SelectItem>
                <SelectItem value="called">Chamados</SelectItem>
                <SelectItem value="seated">Sentados</SelectItem>
                <SelectItem value="canceled">Cancelados</SelectItem>
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
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Queue List */}
      <div className="space-y-3">
        {(() => {
          // Usar posições por grupo (filas paralelas)
          // Cada grupo tem sua própria sequência de posições (1, 2, 3...)
          return filteredQueue.map((entry) => {
            // Pegar posição do grupo específico deste entry
            const sizeGroup = getSizeGroup(entry.people);
            const position = entry.status === 'waiting' 
              ? groupPositions[sizeGroup].get(entry.entry_id) || null
              : null;
            
            // Calcular tempo aguardando e verificar tolerância (se chamado)
            const waitTimeMinutes = calculateWaitTime(entry.created_at);
            const calledTimeMinutes = entry.called_at ? calculateWaitTime(entry.called_at) : 0;
            const isOverTolerance = entry.status === 'called' && calledTimeMinutes > TOLERANCE_MINUTES;
          
          return (
            <Card key={entry.entry_id} className={`hover:shadow-md transition-shadow ${isOverTolerance ? 'border-destructive/50 bg-destructive/5' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {position && (
                      <div className="text-center">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                          {position}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getSizeGroupLabel(sizeGroup)}
                        </p>
                      </div>
                    )}
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold">{entry.customer_name}</h3>
                      <StatusBadge status={entry.status} />
                      {/* TAG VIP: Exibir apenas se cliente é VIP (10+ visitas concluídas) */}
                      {entry.vipStatus && (
                        <VipBadge show={entry.vipStatus.isVip} />
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {entry.email || entry.phone}
                      </span>
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {entry.people} pessoas
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {calculateWaitTime(entry.created_at)} min aguardando
                      </span>
                    </div>
                    {/* TEMPO MÉDIO HISTÓRICO: Baseado em dados reais dos últimos 30 dias */}
                    {!loadingAverages && (() => {
                      const avgTime = getAverageForSize(entry.people);
                      
                      // 1. Se tiver média da faixa específica, usa ela
                      if (avgTime !== null) {
                        return (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Tempo médio histórico para grupos desse tamanho: <span className="font-medium">{avgTime} min</span>
                          </p>
                        );
                      }
                      
                      // 2. Se não tiver média da faixa, usa a média geral
                      if (generalAverage !== null) {
                        return (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Tempo médio geral de espera: <span className="font-medium">{generalAverage} min</span>
                          </p>
                        );
                      }
                      
                      // 3. Só mostra "sem dados" se não tiver nada
                      return (
                        <p className="text-xs text-muted-foreground/50 mt-1 italic">
                          Ainda sem dados suficientes para calcular o tempo médio.
                        </p>
                      );
                    })()}
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-1 italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {entry.status === "waiting" && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCallCustomer(entry)}
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Chamar
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-success hover:bg-success/90"
                        onClick={() => handleSeatCustomer(entry.entry_id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Sentar
                      </Button>
                    </>
                  )}
                   {entry.status === "called" && (
                    <Button 
                      size="sm" 
                      className="bg-success hover:bg-success/90"
                      onClick={() => handleSeatCustomer(entry.entry_id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Sentar
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleCancelCustomer(entry.entry_id)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
        });
        })()}
      </div>

      {filteredQueue.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhum cliente na fila</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" || priorityFilter !== "all" 
                ? "Nenhum resultado encontrado com os filtros atuais."
                : "A fila está vazia no momento."}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeiro Cliente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
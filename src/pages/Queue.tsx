import { useState } from "react";
import { Plus, Search, Filter, Clock, Users, Phone, Edit2, PhoneCall, CheckCircle, XCircle } from "lucide-react";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useQueue } from "@/hooks/useQueue";
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

export default function Queue() {
  const { restaurants } = useRestaurants();
  const { queueEntries, loading, updateQueueStatus } = useQueue();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Apenas status ativos são considerados
  const activeEntries = queueEntries.filter(entry => 
    entry.status === "waiting" || entry.status === "called"
  );
  
  const totalWaiting = activeEntries.filter(entry => entry.status === "waiting").length;
  const totalPeople = activeEntries.filter(entry => entry.status === "waiting").reduce((sum, entry) => sum + entry.people, 0);
  
  // Calcular tempo médio de espera dos que estão aguardando
  const avgWaitTime = totalWaiting > 0
    ? Math.round(
        activeEntries
          .filter(entry => entry.status === "waiting")
          .reduce((sum, entry) => sum + calculateWaitTime(entry.created_at), 0) / totalWaiting
      ) + " min"
    : "0 min";

  const filteredQueue = activeEntries.filter(entry => {
    const matchesSearch = entry.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.phone.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const calculateWaitTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fila de Espera</h1>
          <p className="text-muted-foreground">Gerencie a fila em tempo real</p>
        </div>
        <Dialog>
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
              <Input placeholder="Nome do cliente" />
              <Input placeholder="Telefone" />
              <div className="grid grid-cols-2 gap-4">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Pessoas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 pessoa</SelectItem>
                    <SelectItem value="2">2 pessoas</SelectItem>
                    <SelectItem value="3">3 pessoas</SelectItem>
                    <SelectItem value="4">4 pessoas</SelectItem>
                    <SelectItem value="5+">5+ pessoas</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Observações (opcional)" />
              <Button className="w-full">Adicionar à Fila</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalWaiting}</p>
                <p className="text-sm text-muted-foreground">Grupos na fila</p>
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
                <SelectItem value="waiting">Aguardando</SelectItem>
                <SelectItem value="called">Chamados</SelectItem>
                <SelectItem value="seated">Sentados</SelectItem>
                <SelectItem value="canceled">Cancelados</SelectItem>
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
        {filteredQueue.map((entry, index) => {
          // Calcular posição apenas entre os "waiting"
          const waitingEntries = filteredQueue.filter(e => e.status === "waiting");
          const position = entry.status === "waiting" 
            ? waitingEntries.findIndex(e => e.entry_id === entry.entry_id) + 1
            : null;
          
          return (
            <Card key={entry.entry_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {position && (
                      <div className="text-center">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                          {position}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Posição</p>
                      </div>
                    )}
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold">{entry.customer_name}</h3>
                      <StatusBadge status={entry.status} />
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {entry.phone}
                      </span>
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {entry.people} pessoas
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {calculateWaitTime(entry.created_at)} min
                      </span>
                    </div>
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
                        onClick={() => updateQueueStatus(entry.entry_id, "called")}
                      >
                        <PhoneCall className="w-4 h-4 mr-1" />
                        Chamar
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-success hover:bg-success/90"
                        onClick={() => updateQueueStatus(entry.entry_id, "seated")}
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
                      onClick={() => updateQueueStatus(entry.entry_id, "seated")}
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
                    onClick={() => updateQueueStatus(entry.entry_id, "canceled")}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
        })}
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
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeiro Cliente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
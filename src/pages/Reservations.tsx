import { useState, useEffect } from "react";
import { Plus, Calendar, Clock, User, Phone, Search, Filter } from "lucide-react";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useReservations } from "@/hooks/useReservations";
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
  const [selectedDate, setSelectedDate] = useState("today");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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

  // Filtrar reservas de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysReservations = reservations.filter(reservation => {
    const resDate = new Date(reservation.starts_at);
    return resDate >= today && resDate < tomorrow;
  });

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
      month: "2-digit"
    });
  };

  const filteredReservations = todaysReservations.filter(reservation => {
    const matchesSearch = reservation.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reservation.phone.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{todaysReservations.length}</p>
                <p className="text-sm text-muted-foreground">Reservas hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">
                  {todaysReservations.filter(r => r.status === "confirmed").length}
                </p>
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
                <p className="text-2xl font-bold">
                  {todaysReservations.filter(r => r.status === "pending").length}
                </p>
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
                <p className="text-2xl font-bold">
                  {todaysReservations.reduce((sum, r) => sum + r.people, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total pessoas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Hoje</TabsTrigger>
          <TabsTrigger value="week">Esta Semana</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
        </TabsList>

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
            {filteredReservations.map((reservation) => (
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
                      <Button 
                        size="sm" 
                        className="bg-success hover:bg-success/90"
                        onClick={() => updateReservationStatus(reservation.reservation_id, "confirmed")}
                      >
                        Confirmar
                      </Button>
                    )}
                    {reservation.status === "confirmed" && (
                      <Button 
                        size="sm" 
                        className="bg-accent hover:bg-accent/90"
                        onClick={() => updateReservationStatus(reservation.reservation_id, "seated")}
                      >
                        Check-in
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      Editar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => updateReservationStatus(reservation.reservation_id, "canceled")}
                    >
                      Cancelar
                    </Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="week">
          <div className="space-y-3">
            {reservations.filter(res => {
              const resDate = new Date(res.starts_at);
              const today = new Date();
              const weekEnd = new Date(today);
              weekEnd.setDate(weekEnd.getDate() + 7);
              return resDate >= today && resDate <= weekEnd;
            }).map((reservation) => (
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
                            {formatDate(reservation.starts_at)} {formatTime(reservation.starts_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {reservation.status === "pending" && (
                        <Button 
                          size="sm" 
                          className="bg-success hover:bg-success/90"
                          onClick={() => updateReservationStatus(reservation.reservation_id, "confirmed")}
                        >
                          Confirmar
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => updateReservationStatus(reservation.reservation_id, "canceled")}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Calendário</h3>
              <p className="text-muted-foreground">
                Calendário interativo será implementado em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {filteredReservations.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma reserva encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" 
                ? "Nenhum resultado encontrado com os filtros atuais."
                : "Não há reservas para hoje."}
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primera Reserva
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
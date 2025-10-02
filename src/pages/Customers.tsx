import { useState } from "react";
import { Search, UserPlus, Phone, Mail, Calendar, TrendingUp, Heart, Eye } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Customers() {
  const { customers, loading } = useCustomers();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<typeof customers[0] | null>(null);

  const filteredCustomers = customers.filter(customer => {
    return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (customer.phone && customer.phone.includes(searchTerm)) ||
           (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => 
    c.last_visit_date && new Date(c.last_visit_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  const vipCustomers = customers.filter(c => c.vip_status).length;
  const marketingOptIns = customers.filter(c => c.marketing_opt_in).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    return days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : `${days} dias atrás`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome completo" />
              <Input placeholder="Telefone" />
              <Input placeholder="Email (opcional)" />
              <Input placeholder="Observações especiais (opcional)" />
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="marketing" />
                <label htmlFor="marketing" className="text-sm">
                  Cliente aceita receber promoções por email
                </label>
              </div>
              <Button className="w-full">Cadastrar Cliente</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-sm text-muted-foreground">Total clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{activeCustomers}</p>
                <p className="text-sm text-muted-foreground">Ativos (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{vipCustomers}</p>
                <p className="text-sm text-muted-foreground">VIPs (10+ visitas)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{marketingOptIns}</p>
                <p className="text-sm text-muted-foreground">Marketing opt-in</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Visitas</TableHead>
                <TableHead>Última Visita</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Marketing</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        {customer.vip_status && (
                          <Badge variant="secondary" className="bg-accent/10 text-accent text-xs">
                            VIP
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Phone className="w-3 h-3 mr-1" />
                        {customer.phone}
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Mail className="w-3 h-3 mr-1" />
                        {customer.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{customer.total_visits}</div>
                    <div className="text-xs text-muted-foreground">
                      Total de visitas
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.last_visit_date ? (
                      <>
                        <div className="text-sm">{formatDate(customer.last_visit_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {getDaysAgo(customer.last_visit_date)}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">Nunca visitou</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(customer.total_spent)}</div>
                    {customer.total_visits > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Ticket médio: {formatCurrency(customer.total_spent / customer.total_visits)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={customer.marketing_opt_in ? "default" : "secondary"}
                      className={customer.marketing_opt_in ? "bg-success/10 text-success" : ""}
                    >
                      {customer.marketing_opt_in ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="preferences">Preferências</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {getInitials(selectedCustomer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{selectedCustomer.name}</h3>
                    <p className="text-muted-foreground">{selectedCustomer.phone}</p>
                    <p className="text-muted-foreground">{selectedCustomer.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Estatísticas</h4>
                    <p>Total de visitas: {selectedCustomer.total_visits}</p>
                    {selectedCustomer.last_visit_date && (
                      <p>Última visita: {formatDate(selectedCustomer.last_visit_date)}</p>
                    )}
                    <p>Total gasto: {formatCurrency(selectedCustomer.total_spent)}</p>
                    {selectedCustomer.total_visits > 0 && (
                      <p>Ticket médio: {formatCurrency(selectedCustomer.total_spent / selectedCustomer.total_visits)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Preferências</h4>
                    <p>Marketing: {selectedCustomer.marketing_opt_in ? "Aceita" : "Não aceita"}</p>
                    <p>Status VIP: {selectedCustomer.vip_status ? "Sim" : "Não"}</p>
                  </div>
                </div>
                
                {selectedCustomer.notes && (
                  <div>
                    <h4 className="font-semibold">Observações</h4>
                    <p className="text-muted-foreground italic">"{selectedCustomer.notes}"</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="history">
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Histórico de Visitas</h3>
                  <p className="text-muted-foreground">
                    Histórico detalhado será implementado com a integração Supabase.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="preferences">
                <div className="text-center py-8">
                  <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Preferências Detalhadas</h3>
                  <p className="text-muted-foreground">
                    Sistema de preferências será implementado em breve.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {filteredCustomers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Nenhum resultado encontrado com o termo de busca."
                : "Ainda não há clientes cadastrados."}
            </p>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Cadastrar Primeiro Cliente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
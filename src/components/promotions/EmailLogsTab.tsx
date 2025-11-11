import { useState } from "react";
import { Mail, Send, Eye, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { useEligibleCustomers } from "@/hooks/useEligibleCustomers";
import { useEmailLogs } from "@/hooks/useEmailLogs";
import { CURRENT_RESTAURANT } from "@/config/current-restaurant";
import { ComposeEmailModal } from "./ComposeEmailModal";
import { CustomerDetailDrawer } from "./CustomerDetailDrawer";

export function EmailLogsTab() {
  const { customers, loading: customersLoading, includeInactive, setIncludeInactive } = useEligibleCustomers(CURRENT_RESTAURANT.id);
  const { emailLogs, loading: logsLoading } = useEmailLogs(CURRENT_RESTAURANT.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = 
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'opened':
        return <Eye className="w-4 h-4 text-primary" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      queued: 'Aguardando',
      sent: 'Enviado',
      delivered: 'Entregue',
      opened: 'Aberto',
      clicked: 'Clicado',
      bounced: 'Rejeitado',
      failed: 'Falhou',
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleComposeEmail = (customer: any) => {
    setSelectedCustomer(customer);
    setIsComposeOpen(true);
  };

  const handleViewDetails = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  if (customersLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lista de clientes elegíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes Elegíveis (Opt-in Ativo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros e busca */}
          <div className="flex items-center justify-between gap-4">
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <div className="flex items-center space-x-2">
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
              <Label htmlFor="include-inactive">Incluir inativos</Label>
            </div>
          </div>

          {/* Tabela de clientes */}
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">
                {includeInactive 
                  ? "Não há clientes cadastrados."
                  : "Não há clientes com opt-in ativo."
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead>Total visitas</TableHead>
                  <TableHead>Opt-in</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.customer_id}>
                    <TableCell>
                      <button
                        onClick={() => handleViewDetails(customer)}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {customer.full_name}
                      </button>
                    </TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(customer.last_visit_at)}
                    </TableCell>
                    <TableCell>{customer.visits_count}</TableCell>
                    <TableCell>
                      {customer.marketing_opt_in ? (
                        <Badge className="bg-success/10 text-success">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleComposeEmail(customer)}
                        disabled={!customer.marketing_opt_in || !customer.email}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Lançar promoção
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Histórico de envios */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Envios</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-muted-foreground">Carregando histórico...</p>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhum email enviado</h3>
              <p className="text-muted-foreground">
                Os logs de envio aparecerão aqui quando você enviar campanhas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>{log.email}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.subject}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-sm">{getStatusLabel(log.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedCustomer && (
        <>
          <ComposeEmailModal
            open={isComposeOpen}
            onOpenChange={setIsComposeOpen}
            customer={selectedCustomer}
            restaurantId={CURRENT_RESTAURANT.id}
          />
          <CustomerDetailDrawer
            open={isDetailOpen}
            onOpenChange={setIsDetailOpen}
            customer={selectedCustomer}
            onToggleOptIn={async () => {}}
            onComposeEmail={() => {
              setIsDetailOpen(false);
              handleComposeEmail(selectedCustomer);
            }}
          />
        </>
      )}
    </div>
  );
}

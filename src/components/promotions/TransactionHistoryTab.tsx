import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { usePaymentTransactions, PaymentTransaction } from '@/hooks/usePaymentTransactions';
import { Search, Eye, Wallet, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TransactionHistoryTab() {
  const { transactions, loading } = usePaymentTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getStatusBadge = (status: PaymentTransaction['status']) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success">✅ Pago</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning">🔄 Pendente</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/10 text-destructive">❌ Falhou</Badge>;
      case 'refunded':
        return <Badge className="bg-muted">💸 Reembolsado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getMethodName = (method: string) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'credit': return 'Cartão de Crédito';
      case 'debit': return 'Cartão de Débito';
      default: return method;
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      transaction.transaction_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getMethodName(transaction.payment_method).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Carregando transações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <CardTitle>Histórico de Pagamentos</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground">
              Total: {filteredTransactions.length} transações
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID ou método..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="px-4 py-2 border rounded-md bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
              <option value="failed">Falhados</option>
              <option value="refunded">Reembolsados</option>
            </select>
          </div>

          {/* Tabela */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma transação encontrada</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca.' 
                  : 'As transações de pagamento aparecerão aqui.'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID da Transação</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data e Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {transaction.transaction_code}
                        </span>
                      </TableCell>
                      <TableCell>{getMethodName(transaction.payment_method)}</TableCell>
                      <TableCell className="font-semibold">
                        R$ {transaction.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Painel lateral de detalhes */}
      <Sheet open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Transação</SheetTitle>
          </SheetHeader>
          
          {selectedTransaction && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Status do Pagamento</span>
                {getStatusBadge(selectedTransaction.status)}
              </div>

              {/* Informações principais */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ID da Transação</p>
                    <p className="font-mono text-sm font-semibold">
                      {selectedTransaction.transaction_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor</p>
                    <p className="text-lg font-bold text-primary">
                      R$ {selectedTransaction.amount.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Método de Pagamento</p>
                    <p className="font-semibold">{getMethodName(selectedTransaction.payment_method)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Data de Criação</p>
                    <p className="text-sm">
                      {format(new Date(selectedTransaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {selectedTransaction.paid_at && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Data de Pagamento</p>
                    <p className="text-sm font-semibold text-success">
                      {format(new Date(selectedTransaction.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {selectedTransaction.pix_code && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Código PIX</p>
                    <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                      {selectedTransaction.pix_code}
                    </p>
                  </div>
                )}

                {selectedTransaction.provider_transaction_id && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ID do Provedor</p>
                    <p className="font-mono text-xs">
                      {selectedTransaction.provider_transaction_id}
                    </p>
                  </div>
                )}
              </div>

              {/* Botão de Recibo */}
              <Button className="w-full" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Gerar Recibo PDF
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

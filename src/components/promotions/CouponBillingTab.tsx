import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCouponPublications } from '@/hooks/useCouponPublications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download } from 'lucide-react';

export function CouponBillingTab() {
  const { publications, loading, updatePublicationStatus } = useCouponPublications();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendente' },
      paid: { variant: 'default', label: 'Pago' },
      cancelled: { variant: 'destructive', label: 'Cancelado' },
    };
    
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const totalPending = publications
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.price, 0);

  const totalPaid = publications
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.price, 0);

  const handleExportCSV = () => {
    const headers = ['Data', 'Período', 'Duração (h)', 'Valor', 'Status'];
    const rows = publications.map(p => [
      format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      `${format(new Date(p.start_at), 'dd/MM HH:mm', { locale: ptBR })} - ${format(new Date(p.end_at), 'dd/MM HH:mm', { locale: ptBR })}`,
      p.duration_hours.toString(),
      `R$ ${p.price.toFixed(2)}`,
      p.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faturamento-cupons-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Publicações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publications.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {totalPending.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalPaid.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Histórico de Publicações</h3>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabela de Publicações */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : publications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Nenhuma publicação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                publications.map((publication) => (
                  <TableRow key={publication.id}>
                    <TableCell>
                      {format(new Date(publication.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(publication.start_at), 'dd/MM HH:mm', { locale: ptBR })}
                      {' - '}
                      {format(new Date(publication.end_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{publication.duration_hours}h</TableCell>
                    <TableCell className="font-medium">
                      R$ {publication.price.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(publication.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {publication.status === 'pending' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => updatePublicationStatus(publication.id, 'paid')}
                          >
                            Marcar como Pago
                          </Button>
                        )}
                        {publication.invoice_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(publication.invoice_url, '_blank')}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

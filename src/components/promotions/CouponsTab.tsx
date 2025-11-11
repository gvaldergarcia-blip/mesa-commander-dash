import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Copy, Trash2, TrendingUp } from 'lucide-react';
import { useCoupons } from '@/hooks/useCoupons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { NewCouponDialog } from './NewCouponDialog';

export function CouponsTab() {
  const { coupons, loading, deleteCoupon, duplicateCoupon } = useCoupons();
  const navigate = useNavigate();
  const [showNewDialog, setShowNewDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      scheduled: { variant: 'default', label: 'Agendado' },
      active: { variant: 'default', label: 'Ativo' },
      expired: { variant: 'destructive', label: 'Expirado' },
      cancelled: { variant: 'destructive', label: 'Cancelado' },
    };
    
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const activeCount = coupons.filter(c => c.status === 'active').length;
  const scheduledCount = coupons.filter(c => c.status === 'scheduled').length;
  const draftCount = coupons.filter(c => c.status === 'draft').length;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Cupons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coupons.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Agendados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{scheduledCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rascunhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{draftCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Meus Cupons</h3>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      {/* Tabela de Cupons */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Criado em</TableHead>
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
              ) : coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Nenhum cupom encontrado
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-medium">{coupon.title}</TableCell>
                    <TableCell>
                      {coupon.discount_type === 'percentage' 
                        ? `${coupon.discount_value}%` 
                        : `R$ ${coupon.discount_value.toFixed(2)}`
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(coupon.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {coupon.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(coupon.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/promotions/coupons/${coupon.id}/analytics`)}
                          title="Ver Analytics"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateCoupon(coupon.id)}
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        {coupon.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCoupon(coupon.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
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

      <NewCouponDialog open={showNewDialog} onOpenChange={setShowNewDialog} />
    </div>
  );
}

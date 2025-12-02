import { useState, useMemo } from 'react';
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
import { Plus, Copy, Trash2, TrendingUp, Calendar, Clock } from 'lucide-react';
import { useCoupons } from '@/hooks/useCoupons';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { NewCouponDialog } from './NewCouponDialog';

export function CouponsTab() {
  const { coupons, loading, deleteCoupon, duplicateCoupon } = useCoupons();
  const navigate = useNavigate();
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Calcular status real baseado em datas
  const getCouponRealStatus = (coupon: any) => {
    const now = new Date();
    const startDate = new Date(coupon.start_date);
    const endDate = new Date(coupon.end_date);
    
    // Se não tem payment_status = completed, é rascunho/pendente
    if (coupon.payment_status !== 'completed') {
      return 'draft';
    }
    
    // Se status não é active, manter o status original
    if (coupon.status !== 'active') {
      return coupon.status;
    }
    
    // Verificar datas
    if (isAfter(startOfDay(startDate), startOfDay(now))) {
      return 'scheduled'; // Começa no futuro
    }
    
    if (isBefore(endOfDay(endDate), startOfDay(now))) {
      return 'expired'; // Já terminou
    }
    
    return 'active'; // Está realmente ativo
  };

  // Contadores calculados corretamente
  const counters = useMemo(() => {
    const total = coupons.length;
    let active = 0;
    let scheduled = 0;
    let draft = 0;
    let expired = 0;

    coupons.forEach(coupon => {
      const realStatus = getCouponRealStatus(coupon);
      switch (realStatus) {
        case 'active':
          active++;
          break;
        case 'scheduled':
          scheduled++;
          break;
        case 'draft':
          draft++;
          break;
        case 'expired':
          expired++;
          break;
      }
    });

    return { total, active, scheduled, draft, expired };
  }, [coupons]);

  const getStatusBadge = (coupon: any) => {
    const realStatus = getCouponRealStatus(coupon);
    
    const variants: Record<string, { variant: any; label: string; className?: string }> = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      scheduled: { variant: 'outline', label: 'Agendado', className: 'border-blue-500 text-blue-600' },
      active: { variant: 'default', label: 'Ativo', className: 'bg-green-600' },
      expired: { variant: 'destructive', label: 'Expirado' },
      cancelled: { variant: 'destructive', label: 'Cancelado' },
    };
    
    const config = variants[realStatus] || variants.draft;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'dd/MM/yy', { locale: ptBR })} - ${format(end, 'dd/MM/yy', { locale: ptBR })}`;
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counters.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{counters.active}</div>
            <p className="text-xs text-muted-foreground">Visíveis no app</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-500" />
              Agendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{counters.scheduled}</div>
            <p className="text-xs text-muted-foreground">Início futuro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rascunhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{counters.draft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-red-500" />
              Expirados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{counters.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      {counters.active === 0 && counters.scheduled > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Nenhum cupom ativo no momento.</strong> Você tem {counters.scheduled} cupom(s) agendado(s) 
            que aparecerão no app quando a data de início chegar.
          </p>
        </div>
      )}

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
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
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
                    Nenhum cupom encontrado. Crie seu primeiro cupom!
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-medium">
                      {coupon.title}
                      {coupon.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {coupon.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateRange(coupon.start_date, coupon.end_date)}
                    </TableCell>
                    <TableCell>{getStatusBadge(coupon)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={coupon.payment_status === 'completed' ? 'default' : 'secondary'}
                        className={coupon.payment_status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {coupon.payment_status === 'completed' ? 'Pago' : 'Pendente'}
                      </Badge>
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

                        {getCouponRealStatus(coupon) === 'draft' && (
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
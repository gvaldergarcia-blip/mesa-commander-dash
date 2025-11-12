import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCoupons } from '@/hooks/useCoupons';
import { Eye, MousePointer, Zap, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CouponAnalyticsTab() {
  const { coupons, loading } = useCoupons();

  // Calcular métricas gerais
  const totalViews = coupons.reduce((sum, c) => sum + (c.views_count || 0), 0);
  const totalClicks = coupons.reduce((sum, c) => sum + (c.clicks_count || 0), 0);
  const totalUses = coupons.reduce((sum, c) => sum + (c.uses_count || 0), 0);
  const clickRate = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';

  // Ordenar por performance
  const sortedCoupons = [...coupons].sort((a, b) => 
    ((b.views_count || 0) + (b.clicks_count || 0)) - 
    ((a.views_count || 0) + (a.clicks_count || 0))
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Carregando analytics...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Visualizações</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/10">
                <MousePointer className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Cliques</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-success/10">
                <Zap className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUses.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Usos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-warning/10">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clickRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa de Clique</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Cupom</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedCoupons.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhum cupom com analytics</h3>
              <p className="text-muted-foreground">
                Os dados de desempenho aparecerão aqui após a publicação de cupons.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cupom</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Visualizações</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Usos</TableHead>
                    <TableHead className="text-right">Taxa de Clique</TableHead>
                    <TableHead>Período</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCoupons.map((coupon) => {
                    const couponClickRate = (coupon.views_count || 0) > 0 
                      ? (((coupon.clicks_count || 0) / (coupon.views_count || 1)) * 100).toFixed(1)
                      : '0';

                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{coupon.title}</p>
                            {coupon.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {coupon.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={coupon.status === 'active' ? 'default' : 'secondary'}
                          >
                            {coupon.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(coupon.views_count || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(coupon.clicks_count || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(coupon.uses_count || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${
                            parseFloat(couponClickRate) > 10 ? 'text-success' : 
                            parseFloat(couponClickRate) > 5 ? 'text-warning' : 
                            'text-muted-foreground'
                          }`}>
                            {couponClickRate}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(coupon.start_date), 'dd/MM', { locale: ptBR })}</p>
                            <p className="text-muted-foreground">
                              até {format(new Date(coupon.end_date), 'dd/MM', { locale: ptBR })}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

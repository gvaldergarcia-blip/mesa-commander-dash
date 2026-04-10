/**
 * Card de métricas de QR Code para relatórios
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

interface QrMetrics {
  totalQrFila: number;
  totalQrCadastro: number;
  totalQr: number;
  optInRate: number;
}

interface QrCodeReportsCardProps {
  startDate: string;
  endDate: string;
}

export function QrCodeReportsCard({ startDate, endDate }: QrCodeReportsCardProps) {
  const { restaurantId } = useRestaurant();
  const [metrics, setMetrics] = useState<QrMetrics | null>(null);

  useEffect(() => {
    if (!restaurantId) return;

    const fetchMetrics = async () => {
      // Count QR fila customers
      const { count: filaCount } = await supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('opt_in_source', 'qr_fila')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Count QR cadastro customers
      const { count: cadastroCount } = await supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('opt_in_source', 'qr_cadastro')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Count opt-in among QR customers
      const { count: optInCount } = await supabase
        .from('restaurant_customers')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('opt_in_source', ['qr_fila', 'qr_cadastro'])
        .eq('marketing_optin', true)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalFila = filaCount || 0;
      const totalCadastro = cadastroCount || 0;
      const total = totalFila + totalCadastro;
      const optIn = optInCount || 0;

      setMetrics({
        totalQrFila: totalFila,
        totalQrCadastro: totalCadastro,
        totalQr: total,
        optInRate: total > 0 ? Math.round((optIn / total) * 100) : 0,
      });
    };

    fetchMetrics();
  }, [restaurantId, startDate, endDate]);

  if (!metrics || metrics.totalQr === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-4 w-4 text-[#F97316]" />
          Clientes via QR Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{metrics.totalQr}</p>
            <p className="text-xs text-muted-foreground">Total via QR</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-2xl font-bold">{metrics.totalQrFila}</p>
            </div>
            <p className="text-xs text-muted-foreground">QR Fila</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-2xl font-bold">{metrics.totalQrCadastro}</p>
            </div>
            <p className="text-xs text-muted-foreground">QR Cadastro</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{metrics.optInRate}%</p>
            <p className="text-xs text-muted-foreground">Opt-in marketing</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

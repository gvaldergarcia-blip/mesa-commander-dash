import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { CalendarClock, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function CampaignsScheduleTab() {
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['dish-campaigns', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('menu_dish_campaigns')
        .select('id, message, image_url, status, scheduled_at, sent_at, error, phone, restaurant_customers(customer_name), menu_dishes(name)')
        .eq('restaurant_id', restaurantId)
        .order('scheduled_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const cancel = async (id: string) => {
    const { error } = await (supabase as any).rpc('cancel_dish_campaign', { p_id: id });
    if (error) toast.error(error.message);
    else { toast.success('Envio cancelado'); qc.invalidateQueries({ queryKey: ['dish-campaigns'] }); }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data?.length) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">
      <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-40" />
      Nenhum envio agendado ainda. Use o Chat IA para criar.
    </CardContent></Card>
  );

  return (
    <div className="space-y-2">
      {data.map((c: any) => (
        <Card key={c.id}>
          <CardContent className="p-3 flex gap-3 items-start">
            {c.image_url && <img src={c.image_url} alt="" className="w-16 h-16 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm truncate">{c.restaurant_customers?.customer_name ?? c.phone}</strong>
                {c.menu_dishes?.name && <Badge variant="outline" className="text-[10px]">{c.menu_dishes.name}</Badge>}
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.status === 'sent' ? 'Enviado em ' : 'Agendado para '}
                {new Date(c.sent_at ?? c.scheduled_at).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm mt-1 line-clamp-2">{c.message}</p>
              {c.error && <p className="text-xs text-red-500 mt-1">{c.error}</p>}
            </div>
            {c.status === 'pending' && (
              <Button size="sm" variant="ghost" onClick={() => cancel(c.id)}><X className="h-4 w-4" /></Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: 'Agendado', cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: CalendarClock },
    sent: { label: 'Enviado', cls: 'bg-green-500/15 text-green-600 border-green-500/30', icon: CheckCircle2 },
    failed: { label: 'Falhou', cls: 'bg-red-500/15 text-red-600 border-red-500/30', icon: AlertCircle },
    canceled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground', icon: X },
  };
  const s = map[status] ?? map.pending;
  const Icon = s.icon;
  return <Badge className={`text-[10px] ${s.cls}`}><Icon className="h-3 w-3 mr-1" />{s.label}</Badge>;
}
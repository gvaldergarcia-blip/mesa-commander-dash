import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/contexts/RestaurantContext';

type Status = 'validating' | 'success' | 'error';

const today = () => new Date().toISOString().slice(0, 10);

export default function ChecklistQrValidate() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { restaurantId, user } = useRestaurant();
  const [status, setStatus] = useState<Status>('validating');
  const [itemName, setItemName] = useState('Atividade do checklist');
  const [error, setError] = useState('Não foi possível validar este QR Code.');

  useEffect(() => {
    if (!itemId || !restaurantId) return;

    let cancelled = false;

    const validateQr = async () => {
      setStatus('validating');

      const { data: item, error: itemError } = await (supabase as any)
        .from('checklist_items')
        .select('id, name, restaurant_id, active')
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .maybeSingle();

      if (cancelled) return;

      if (itemError || !item) {
        setError('QR Code inválido para este restaurante.');
        setStatus('error');
        return;
      }

      setItemName(item.name);

      const { data: existing, error: existingError } = await (supabase as any)
        .from('checklist_completions')
        .select('id')
        .eq('item_id', item.id)
        .eq('restaurant_id', restaurantId)
        .eq('completion_date', today())
        .maybeSingle();

      if (cancelled) return;

      if (existingError) {
        setError('Não foi possível verificar a validação de hoje.');
        setStatus('error');
        return;
      }

      if (!existing) {
        const { error: insertError } = await (supabase as any)
          .from('checklist_completions')
          .insert({
            item_id: item.id,
            restaurant_id: restaurantId,
            completed_by: user?.id ?? null,
            completed_by_name: user?.email ?? 'Equipe',
            via_qr: true,
          });

        if (cancelled) return;

        if (insertError) {
          setError('QR lido, mas não foi possível concluir a atividade.');
          setStatus('error');
          return;
        }
      }

      setStatus('success');
    };

    validateQr();

    return () => {
      cancelled = true;
    };
  }, [itemId, restaurantId, user?.email, user?.id]);

  if (status === 'success') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-success text-success-foreground px-6 text-center">
        <div className="rounded-full border-4 border-success-foreground/30 p-6 mb-6 animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="h-32 w-32" strokeWidth={1.8} />
        </div>
        <h1 className="text-4xl font-bold">Atividade validada</h1>
        <p className="mt-3 max-w-sm text-xl font-medium text-success-foreground/90">{itemName}</p>
        <Button className="mt-8" variant="secondary" onClick={() => navigate('/checklists')}>
          Voltar ao checklist
        </Button>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center">
        <XCircle className="h-20 w-20 text-destructive mb-5" />
        <h1 className="text-2xl font-bold">QR não validado</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">{error}</p>
        <Button className="mt-8" onClick={() => navigate('/checklists')}>
          Voltar ao checklist
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-success text-success-foreground px-6 text-center">
      <Loader2 className="h-16 w-16 animate-spin mb-5" />
      <h1 className="text-3xl font-bold">Validando QR Code</h1>
      <p className="mt-2 text-success-foreground/90">Aguarde um instante…</p>
    </main>
  );
}
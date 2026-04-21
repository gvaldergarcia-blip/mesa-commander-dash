import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Status = 'validating' | 'success' | 'error';

export default function ChecklistQrValidate() {
  const { itemId } = useParams<{ itemId: string }>();
  const [status, setStatus] = useState<Status>('validating');
  const [itemName, setItemName] = useState('Atividade do checklist');
  const [error, setError] = useState('Não foi possível validar este QR Code.');

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    const validateQr = async () => {
      setStatus('validating');

      const { data, error: fnError } = await supabase.functions.invoke(
        'validate-checklist-qr',
        { body: { item_id: itemId } }
      );

      if (cancelled) return;

      if (fnError || !data?.success) {
        setError(data?.error || 'QR Code inválido.');
        setStatus('error');
        return;
      }

      if (data.item_name) setItemName(data.item_name);
      setStatus('success');
    };

    validateQr();

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (status === 'success') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-success text-success-foreground px-6 text-center">
        <div className="rounded-full border-4 border-success-foreground/30 p-6 mb-6 animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="h-32 w-32" strokeWidth={1.8} />
        </div>
      <h1 className="text-4xl font-bold">Atividade validada</h1>
        <p className="mt-3 max-w-sm text-xl font-medium text-success-foreground/90">{itemName}</p>
        <p className="mt-6 text-sm text-success-foreground/70">Você já pode fechar esta página.</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center">
        <XCircle className="h-20 w-20 text-destructive mb-5" />
        <h1 className="text-2xl font-bold">QR não validado</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">{error}</p>
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
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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

      try {
        // fetch direto: precisamos ler o body mesmo em 4xx (invoke esconde)
        const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-checklist-qr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
          },
          body: JSON.stringify({ item_id: itemId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data?.success) {
          setError(data?.error || `Falha (${res.status}) ao validar este QR Code.`);
          setStatus('error');
          return;
        }

        if (data.item_name) setItemName(data.item_name);
        setStatus('success');
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Não foi possível contactar o servidor.');
        setStatus('error');
      }
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
        <h1 className="text-4xl font-bold">Etiqueta verificada</h1>
        <p className="mt-3 max-w-sm text-xl font-medium text-success-foreground/90">{itemName}</p>
        <p className="mt-4 max-w-xs text-sm text-success-foreground/80">
          Atividade do checklist registrada automaticamente.
        </p>
        <p className="mt-6 text-xs text-success-foreground/60">Você já pode fechar esta página.</p>
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
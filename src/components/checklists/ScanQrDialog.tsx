import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChecklistItem } from '@/hooks/useChecklists';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
  onScanned: () => void | Promise<void>;
}

type Phase = 'starting' | 'scanning' | 'success' | 'invalid' | 'error';

const REGION_ID = 'checklist-qr-reader';
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function ScanQrDialog({ open, onOpenChange, item, onScanned }: Props) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);
  const handledRef = useRef(false);

  const extractId = (raw: string): string => {
    const value = raw.trim();

    try {
      const parsed = JSON.parse(value);
      const jsonId = parsed?.item_id || parsed?.itemId || parsed?.id;
      if (typeof jsonId === 'string') return jsonId.trim();
    } catch {
      // ignore
    }

    try {
      const url = new URL(value);
      const queryId = url.searchParams.get('item_id') || url.searchParams.get('itemId') || url.searchParams.get('id');
      if (queryId) return queryId.trim();

      const pathnameMatch = url.pathname.match(UUID_REGEX);
      if (pathnameMatch?.[0]) return pathnameMatch[0];

      const hashMatch = url.hash.match(UUID_REGEX);
      if (hashMatch?.[0]) return hashMatch[0];
    } catch {
      // not a URL
    }

    const inlineMatch = value.match(UUID_REGEX);
    return inlineMatch?.[0] ?? value;
  };

  const stopScanner = async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {
      // ignore scanner teardown noise
    }
  };

  const handleDecoded = async (decodedText: string) => {
    if (!item || handledRef.current) return;
    handledRef.current = true;
    const scannedId = extractId(decodedText);

    if (scannedId === item.id) {
      try {
        setPhase('success');
        await stopScanner();
        await onScanned();
        window.setTimeout(() => onOpenChange(false), 900);
      } catch (err: any) {
        console.error('[ScanQrDialog] completion error', err);
        setErrorMsg(err?.message ?? 'QR lido, mas não foi possível concluir a atividade.');
        setPhase('error');
        handledRef.current = false;
      }
      return;
    }

    setPhase('invalid');
    await stopScanner();
  };

  const startScanner = async (preferExactEnvironment = true) => {
    const scanner = new Html5Qrcode(REGION_ID, false);
    scannerRef.current = scanner;

    const constraints = preferExactEnvironment
      ? ({ facingMode: { exact: 'environment' } } as MediaTrackConstraints)
      : ({ facingMode: 'environment' } as MediaTrackConstraints);

    await scanner.start(
      constraints,
      {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1,
        disableFlip: false,
      },
      handleDecoded,
      () => {},
    );

    setPhase('scanning');
  };

  useEffect(() => {
    if (!open || !item) return;

    let cancelled = false;
    stoppedRef.current = false;
    handledRef.current = false;
    setPhase('starting');
    setErrorMsg('');

    const boot = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (cancelled) return;

        try {
          await startScanner(true);
        } catch {
          await stopScanner();
          stoppedRef.current = false;
          await startScanner(false);
        }
      } catch (err: any) {
        console.error('[ScanQrDialog] camera error', err);
        setErrorMsg(err?.message ?? 'Não foi possível acessar a câmera.');
        setPhase('error');
      }
    };

    boot();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, item?.id]);

  const handleRetry = async () => {
    await stopScanner();
    stoppedRef.current = false;
    handledRef.current = false;
    setPhase('starting');
    setErrorMsg('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      await startScanner(false);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Falha ao reiniciar a câmera.');
      setPhase('error');
    }
  };

  const title =
    phase === 'success'
      ? 'QR validado com sucesso ✓'
      : phase === 'invalid'
        ? 'QR Code inválido para este item'
        : phase === 'error'
          ? 'Erro de câmera'
          : phase === 'starting'
            ? 'Iniciando câmera…'
            : 'Aponte para o QR Code';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void stopScanner();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Escaneie o QR físico deste item. O app valida o ID internamente e não abre links externos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative w-full max-w-[300px] aspect-square rounded-lg overflow-hidden bg-black border-2 border-primary/40">
            <div id={REGION_ID} className="w-full h-full" />

            {phase === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-sm gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Iniciando câmera…
              </div>
            )}

            {phase === 'scanning' && (
              <>
                <div className="pointer-events-none absolute inset-6 border-2 border-primary/70 rounded-md" />
                <div
                  className="pointer-events-none absolute left-6 right-6 h-0.5 bg-primary shadow-[0_0_16px_hsl(var(--primary))] animate-[scanline_1.6s_ease-in-out_infinite]"
                  style={{ top: 24 }}
                />
              </>
            )}

            {phase === 'success' && (
              <div className="absolute inset-0 flex items-center justify-center bg-success text-success-foreground">
                <CheckCircle2 className="h-24 w-24" />
              </div>
            )}

            {phase === 'invalid' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 text-center px-4">
                <XCircle className="h-14 w-14 text-destructive" />
                <p className="text-sm font-medium">QR Code inválido para este item</p>
                <p className="text-xs text-muted-foreground">
                  O sistema aceita ID puro, JSON antigo e QR antigo com URL, mas precisa encontrar o UUID deste item.
                </p>
              </div>
            )}

            {phase === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 text-center px-4">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm font-medium">Não foi possível acessar a câmera</p>
                <p className="text-[11px] text-muted-foreground break-words">{errorMsg}</p>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground text-center">{item?.name}</p>

          {(phase === 'invalid' || phase === 'error') && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleRetry}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>

        <style>{`@keyframes scanline{0%{transform:translateY(0)}50%{transform:translateY(220px)}100%{transform:translateY(0)}}`}</style>
      </DialogContent>
    </Dialog>
  );
}

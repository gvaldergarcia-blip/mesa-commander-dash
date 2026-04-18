import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChecklistItem } from '@/hooks/useChecklists';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
  /** Called only when the scanned QR matches this item's ID. */
  onScanned: () => void;
}

type Phase = 'starting' | 'scanning' | 'success' | 'invalid' | 'error';

const REGION_ID = 'checklist-qr-reader';

/**
 * Real camera QR reader using html5-qrcode.
 * Validates that the scanned content equals the item.id; otherwise shows error.
 */
export function ScanQrDialog({ open, onOpenChange, item, onScanned }: Props) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  // Extract the bare item id from any QR payload (supports legacy JSON or plain UUID)
  const extractId = (raw: string): string => {
    const t = raw.trim();
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === 'object' && typeof parsed.item_id === 'string') {
        return parsed.item_id;
      }
    } catch { /* not JSON, fall through */ }
    return t;
  };

  const stopScanner = async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!open || !item) return;
    stoppedRef.current = false;
    setPhase('starting');
    setErrorMsg('');

    let cancelled = false;

    const start = async () => {
      try {
        // Wait one tick for the DOM region to mount
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
        const html5 = new Html5Qrcode(REGION_ID, /* verbose */ false);
        scannerRef.current = html5;

        await html5.start(
          { facingMode: { exact: 'environment' } as any },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            const scannedId = extractId(decodedText);
            if (scannedId === item.id) {
              setPhase('success');
              await stopScanner();
              onScanned();
              setTimeout(() => onOpenChange(false), 1100);
            } else {
              setPhase('invalid');
              await stopScanner();
            }
          },
          () => { /* per-frame fail callback — silent */ },
        ).catch(async (err) => {
          // Fallback: try without exact constraint (some browsers / desktops)
          try {
            await html5.start(
              { facingMode: 'environment' },
              { fps: 10, qrbox: { width: 240, height: 240 } },
              async (decodedText) => {
                const scannedId = extractId(decodedText);
                if (scannedId === item.id) {
                  setPhase('success');
                  await stopScanner();
                  onScanned();
                  setTimeout(() => onOpenChange(false), 1100);
                } else {
                  setPhase('invalid');
                  await stopScanner();
                }
              },
              () => {},
            );
          } catch (e2: any) {
            throw err ?? e2;
          }
        });

        if (!cancelled) setPhase('scanning');
      } catch (err: any) {
        console.error('[ScanQrDialog] camera error', err);
        setErrorMsg(err?.message ?? 'Não foi possível acessar a câmera.');
        setPhase('error');
      }
    };

    start();

    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const handleRetry = async () => {
    await stopScanner();
    stoppedRef.current = false;
    setPhase('starting');
    setErrorMsg('');
    // Trigger restart by closing/reopening effect deps — simplest: reload via setPhase + small delay
    setTimeout(() => {
      // Re-run by toggling: easiest is to re-mount via key in parent, but here we just kick the effect
      // by manually calling start again.
      const html5 = new Html5Qrcode(REGION_ID, false);
      scannerRef.current = html5;
      html5
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            if (!item) return;
            const t = decodedText.trim();
            let scannedId = t;
            try { const p = JSON.parse(t); if (p?.item_id) scannedId = p.item_id; } catch { /* noop */ }
            if (scannedId === item.id) {
              setPhase('success');
              await stopScanner();
              onScanned();
              setTimeout(() => onOpenChange(false), 1100);
            } else {
              setPhase('invalid');
              await stopScanner();
            }
          },
          () => {},
        )
        .then(() => setPhase('scanning'))
        .catch((e) => {
          setErrorMsg(e?.message ?? 'Falha ao reiniciar a câmera.');
          setPhase('error');
        });
    }, 100);
  };

  const title =
    phase === 'success' ? 'QR validado com sucesso ✓'
    : phase === 'invalid' ? 'QR Code inválido para este item'
    : phase === 'error' ? 'Erro de câmera'
    : phase === 'starting' ? 'Iniciando câmera…'
    : 'Aponte para o QR Code';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopScanner(); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Camera region — html5-qrcode injects a <video> here */}
          <div className="relative w-full max-w-[300px] aspect-square rounded-lg overflow-hidden bg-black border-2 border-primary/40">
            <div id={REGION_ID} className="w-full h-full" />

            {/* Overlay states */}
            {phase === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-sm gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Iniciando câmera…
              </div>
            )}
            {phase === 'scanning' && (
              <>
                {/* Scan frame + animated line */}
                <div className="pointer-events-none absolute inset-6 border-2 border-primary/70 rounded-md" />
                <div
                  className="pointer-events-none absolute left-6 right-6 h-0.5 bg-primary shadow-[0_0_16px_hsl(var(--primary))] animate-[scanline_1.6s_ease-in-out_infinite]"
                  style={{ top: 24 }}
                />
              </>
            )}
            {phase === 'success' && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90">
                <CheckCircle2 className="h-20 w-20 text-green-500" />
              </div>
            )}
            {phase === 'invalid' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 text-center px-4">
                <XCircle className="h-14 w-14 text-destructive" />
                <p className="text-sm font-medium">QR Code inválido para este item</p>
                <p className="text-xs text-muted-foreground">Verifique se o QR colado no local corresponde ao item selecionado.</p>
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

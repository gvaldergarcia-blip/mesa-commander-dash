import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChecklistItem } from '@/hooks/useChecklists';
import { CheckCircle2, ScanLine } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
  onScanned: () => void;
}

export function ScanQrDialog({ open, onOpenChange, item, onScanned }: Props) {
  const [phase, setPhase] = useState<'scanning' | 'done'>('scanning');

  useEffect(() => {
    if (!open) return;
    setPhase('scanning');
    const t = setTimeout(() => {
      setPhase('done');
      onScanned();
      setTimeout(() => onOpenChange(false), 900);
    }, 1800);
    return () => clearTimeout(t);
  }, [open, onScanned, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{phase === 'done' ? 'Concluído!' : 'Escaneando QR…'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="relative h-48 w-48 rounded-lg border-2 border-dashed border-primary/40 overflow-hidden bg-muted/30">
            {phase === 'scanning' ? (
              <>
                <ScanLine className="absolute inset-0 m-auto h-16 w-16 text-primary/40" />
                <div className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_20px_hsl(var(--primary))] animate-[scan_1.6s_ease-in-out_infinite]" style={{ top: 0 }} />
              </>
            ) : (
              <CheckCircle2 className="absolute inset-0 m-auto h-20 w-20 text-green-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center">{item?.name}</p>
        </div>
        <style>{`@keyframes scan{0%{top:0}50%{top:calc(100% - 4px)}100%{top:0}}`}</style>
      </DialogContent>
    </Dialog>
  );
}

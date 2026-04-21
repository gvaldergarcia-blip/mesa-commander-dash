import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';
import { ChecklistItem, ChecklistCategory } from '@/hooks/useChecklists';
import { getSiteBaseUrl } from '@/config/site-url';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
  category: ChecklistCategory | null;
}

export function QrCodeDialog({ open, onOpenChange, item, category }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!item || !category) return;
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR ${item.name}</title>
      <style>body{font-family:Inter,sans-serif;text-align:center;padding:40px;}h1{font-size:18px;margin:16px 0 4px}p{color:#666;margin:0}.code{margin-top:8px;font-size:12px;word-break:break-all;color:#444}</style>
      </head><body>${svg.outerHTML}<h1>${item.name}</h1><p>${category.name}</p><p class="code">${item.id}</p>
      <script>window.print();setTimeout(()=>window.close(),300);</script></body></html>`);
    w.document.close();
  };

  if (!item || !category) return null;

  const baseUrl = getSiteBaseUrl();
  const qrValue = `${baseUrl}/checklists/scan/${item.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code do item</DialogTitle>
          <DialogDescription>
            Ao escanear, abre a tela verde de validação desta atividade.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4" ref={ref}>
          <div className="bg-white p-4 rounded-lg border">
            <QRCodeSVG value={qrValue} size={200} level="M" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{item.name}</p>
            <p className="text-sm text-muted-foreground">{category.name}</p>
            <p className="text-xs text-muted-foreground mt-2 break-all">ID: {item.id}</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="w-full">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </DialogContent>
    </Dialog>
  );
}

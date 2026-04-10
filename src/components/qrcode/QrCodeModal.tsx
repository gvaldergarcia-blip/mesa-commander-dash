/**
 * Modal genérico para exibir QR Code do restaurante (fila ou cadastro).
 * Inclui: QR Code, link copiável, download PNG, download PDF.
 */
import { useState, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Download, FileText, Check, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSiteBaseUrl } from '@/config/site-url';

interface QrCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
  type: 'fila' | 'cadastro';
}

export function QrCodeModal({ open, onOpenChange, restaurantId, restaurantName, type }: QrCodeModalProps) {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = getSiteBaseUrl();
  const url = type === 'fila'
    ? `${baseUrl}/fila/qr/${restaurantId}`
    : `${baseUrl}/cadastro/${restaurantId}`;

  const title = type === 'fila' ? 'QR Code da Fila' : 'QR Code de Cadastro';
  const description = type === 'fila'
    ? 'Clientes escaneiam para entrar na fila automaticamente'
    : 'Clientes escaneiam para se cadastrar automaticamente';

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  }, [url, toast]);

  const handleDownloadPng = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a larger canvas with padding and text
    const size = 600;
    const padding = 40;
    const totalHeight = size + padding * 2 + 80;
    const totalWidth = size + padding * 2;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = totalWidth;
    exportCanvas.height = totalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Draw QR code scaled up
    ctx.drawImage(canvas, padding, padding, size, size);

    // Restaurant name below
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(restaurantName, totalWidth / 2, size + padding + 40);

    // Type label
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(type === 'fila' ? 'Escaneie para entrar na fila' : 'Escaneie para se cadastrar', totalWidth / 2, size + padding + 70);

    const link = document.createElement('a');
    link.download = `qrcode-${type}-${restaurantName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }, [restaurantName, type]);

  const handleDownloadPdf = useCallback(async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a printable HTML page and trigger print
    const imgData = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const label = type === 'fila' ? 'Escaneie para entrar na fila' : 'Escaneie para se cadastrar';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${restaurantName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
          .container { text-align: center; padding: 40px; }
          img { width: 300px; height: 300px; }
          h1 { margin-top: 24px; font-size: 28px; color: #111; }
          p { margin-top: 8px; font-size: 18px; color: #666; }
          .url { margin-top: 16px; font-size: 12px; color: #999; word-break: break-all; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="${imgData}" alt="QR Code" />
          <h1>${restaurantName}</h1>
          <p>${label}</p>
          <p class="url">${url}</p>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }, [restaurantName, type, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#F97316]" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={qrRef} className="p-4 bg-white rounded-lg border">
            <QRCodeCanvas
              value={url}
              size={220}
              level="H"
              marginSize={2}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          <div className="flex w-full gap-2">
            <Input value={url} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handleDownloadPng}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PNG
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownloadPdf}>
              <FileText className="h-4 w-4 mr-2" />
              Imprimir PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

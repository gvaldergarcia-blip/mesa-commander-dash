/**
 * Modal genérico para exibir QR Code do restaurante (fila ou cadastro).
 * Inclui: QR Code, link copiável e download PNG.
 */
import { useState, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Download, Check, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSiteBaseUrl } from '@/config/site-url';

interface QrCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
  type: 'fila' | 'cadastro';
  queueType?: 'normal' | 'exclusive';
  exclusiveQueueName?: string;
}

export function QrCodeModal({ open, onOpenChange, restaurantId, restaurantName, type, queueType = 'normal', exclusiveQueueName }: QrCodeModalProps) {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = getSiteBaseUrl();
  const basePath = type === 'fila'
    ? `${baseUrl}/fila/${restaurantId}`
    : `${baseUrl}/cadastro/${restaurantId}`;
  const url = type === 'fila' && queueType === 'exclusive'
    ? `${basePath}?tipo=exclusiva`
    : basePath;

  const queueLabel = queueType === 'exclusive' && exclusiveQueueName ? exclusiveQueueName : '';
  const title = type === 'fila'
    ? (queueType === 'exclusive' ? `QR Code - ${queueLabel || 'Fila Exclusiva'}` : 'QR Code da Fila')
    : 'QR Code de Cadastro';
  const description = type === 'fila'
    ? 'Clientes escaneiam para entrar na fila automaticamente'
    : 'Escaneie e ganhe benefícios exclusivos';

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  }, [url, toast]);

  const handleDownloadPng = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = () => {
      const size = 600;
      const padding = 40;
      const maxLogoWidth = size - 40;
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      const logoWidth = Math.min(maxLogoWidth, Math.round(logoAspect * 90));
      const logoHeight = Math.round(logoWidth / logoAspect);
      const totalHeight = size + padding * 2 + 90 + logoHeight + 24;
      const totalWidth = size + padding * 2;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = totalWidth;
      exportCanvas.height = totalHeight;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      ctx.drawImage(canvas, padding, padding, size, size);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(restaurantName, totalWidth / 2, size + padding + 40);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(type === 'fila' ? 'Escaneie para entrar na fila' : 'Escaneie e ganhe benefícios exclusivos', totalWidth / 2, size + padding + 70);

      ctx.drawImage(logoImg, (totalWidth - logoWidth) / 2, size + padding + 86, logoWidth, logoHeight);

      const link = document.createElement('a');
      link.download = `qrcode-${type}-${restaurantName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    };

    logoImg.onerror = () => {
      const size = 600;
      const padding = 40;
      const totalHeight = size + padding * 2 + 80;
      const totalWidth = size + padding * 2;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = totalWidth;
      exportCanvas.height = totalHeight;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      ctx.drawImage(canvas, padding, padding, size, size);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(restaurantName, totalWidth / 2, size + padding + 40);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(type === 'fila' ? 'Escaneie para entrar na fila' : 'Escaneie e ganhe benefícios exclusivos', totalWidth / 2, size + padding + 70);

      const link = document.createElement('a');
      link.download = `qrcode-${type}-${restaurantName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    };

    logoImg.src = '/images/mesaclik-logo-branding.jpg';
  }, [restaurantName, type]);

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

          <div className="w-full">
            <Button variant="outline" className="w-full" onClick={handleDownloadPng}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

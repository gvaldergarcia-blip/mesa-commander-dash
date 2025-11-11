import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PixPaymentProps = {
  amount: number;
};

export function PixPayment({ amount }: PixPaymentProps) {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string>('');
  const [pixCode, setPixCode] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular geração de QR Code e código PIX
    const generatePixCode = async () => {
      setLoading(true);
      // Aguardar 1 segundo para simular chamada à API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Gerar código PIX fictício
      const mockPixCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}520400005303986540${amount.toFixed(2)}5802BR5913MESACLIK6009SAO PAULO62070503***6304`;
      setPixCode(mockPixCode);
      
      // Gerar QR Code (usando API pública para demonstração)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockPixCode)}`;
      setQrCode(qrCodeUrl);
      
      setLoading(false);
    };

    generatePixCode();
  }, [amount]);

  const copyPixCode = () => {
    navigator.clipboard.writeText(pixCode);
    toast({
      title: 'Código copiado',
      description: 'O código PIX foi copiado para a área de transferência',
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Gerando código PIX...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Code */}
      <div className="bg-white p-6 rounded-lg border-2 border-border">
        <img
          src={qrCode}
          alt="QR Code PIX"
          className="w-full max-w-[300px] mx-auto"
        />
      </div>

      {/* Código PIX */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-center">ou copie o código:</p>
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-xs font-mono break-all text-muted-foreground">
            {pixCode}
          </p>
        </div>
        <Button
          onClick={copyPixCode}
          variant="outline"
          className="w-full gap-2"
        >
          <Copy className="w-4 h-4" />
          Copiar código PIX
        </Button>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
        <p className="text-sm text-foreground mb-2 font-medium">
          Como pagar com PIX:
        </p>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Abra o app do seu banco</li>
          <li>Escolha a opção PIX</li>
          <li>Escaneie o QR Code ou cole o código acima</li>
          <li>Confirme o pagamento</li>
        </ol>
      </div>

      {/* Status */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Aguardando pagamento...</span>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        O cupom será ativado automaticamente após a confirmação do pagamento
      </p>
    </div>
  );
}

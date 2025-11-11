import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Smartphone, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PaymentMethod = 'pix' | 'credit' | 'debit';

type CouponPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  couponId: string;
  amount: number;
  onPaymentComplete: () => void;
};

export function CouponPaymentDialog({
  open,
  onOpenChange,
  couponId,
  amount,
  onPaymentComplete,
}: CouponPaymentDialogProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({
        title: 'Selecione um método',
        description: 'Escolha uma forma de pagamento para continuar',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      // Aqui você integrará com o gateway de pagamento real
      // Por enquanto, simulamos um delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Após o pagamento, atualizar o cupom
      toast({
        title: 'Pagamento processado',
        description: 'Seu cupom será ativado em breve',
      });

      onPaymentComplete();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro no pagamento',
        description: 'Não foi possível processar o pagamento',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods = [
    {
      id: 'pix' as PaymentMethod,
      name: 'PIX',
      description: 'Pagamento instantâneo',
      icon: QrCode,
    },
    {
      id: 'credit' as PaymentMethod,
      name: 'Cartão de Crédito',
      description: 'Parcelamento disponível',
      icon: CreditCard,
    },
    {
      id: 'debit' as PaymentMethod,
      name: 'Cartão de Débito',
      description: 'Débito em conta',
      icon: Smartphone,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento do Cupom</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo do Valor */}
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Valor total</p>
            <p className="text-3xl font-bold text-primary">
              R$ {amount.toFixed(2)}
            </p>
          </div>

          {/* Métodos de Pagamento */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Escolha a forma de pagamento:</p>
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <div
                  key={method.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                    selectedMethod === method.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        selectedMethod === method.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{method.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {method.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayment}
              className="flex-1"
              disabled={!selectedMethod || processing}
            >
              {processing ? 'Processando...' : 'Pagar'}
            </Button>
          </div>

          {/* Aviso de Integração */}
          <p className="text-xs text-center text-muted-foreground">
            🚧 Gateway de pagamento em integração. Por enquanto, este é um modo de demonstração.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
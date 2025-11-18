import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield } from 'lucide-react';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentMethodSelector } from '@/components/checkout/PaymentMethodSelector';
import { PixPayment } from '@/components/checkout/PixPayment';
import { CardPayment } from '@/components/checkout/CardPayment';
import { supabase } from '@/integrations/supabase/client';

type PaymentMethod = 'pix' | 'credit' | 'debit' | null;

export default function CheckoutCupom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Dados do cupom vindos da URL
  const couponId = searchParams.get('couponId');
  const amount = Number(searchParams.get('amount')) || 0;
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const duration = Number(searchParams.get('duration')) || 0;
  const type = searchParams.get('type') || 'link';

  useEffect(() => {
    if (!couponId || !amount) {
      toast({
        title: 'Erro',
        description: 'Dados do cupom não encontrados',
        variant: 'destructive',
      });
      navigate('/promotions');
    }
  }, [couponId, amount, navigate, toast]);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({
        title: 'Selecione um método',
        description: 'Escolha uma forma de pagamento para continuar',
        variant: 'destructive',
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        title: 'Aceite necessário',
        description: 'É necessário aceitar os Termos de Pagamento',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      // Simulação de processamento de pagamento
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Gerar código de transação
      const transactionCode = `MC-${Date.now().toString().slice(-8)}`;

      // Criar registro de transação
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions' as any)
        .insert({
          restaurant_id: searchParams.get('restaurantId') || '',
          coupon_id: couponId,
          transaction_code: transactionCode,
          payment_method: selectedMethod,
          amount: amount,
          status: 'completed',
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Atualizar status do cupom para ativo
      const { error: couponError } = await supabase
        .from('coupons' as any)
        .update({
          status: 'active',
          payment_status: 'completed',
          payment_method: selectedMethod,
          paid_at: new Date().toISOString(),
        })
        .eq('id', couponId);

      if (couponError) throw couponError;

      // Redirecionar para página de sucesso
      const transactionId = (transaction as any)?.id || '';
      navigate(`/checkout-success?transactionId=${transactionId}&transactionCode=${transactionCode}&couponId=${couponId}&amount=${amount}&method=${selectedMethod}`);
    } catch (error) {
      console.error('Erro no pagamento:', error);
      toast({
        title: 'Erro no pagamento',
        description: 'Não foi possível processar o pagamento',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold">
                <span className="text-foreground">MESA</span>
                <span className="text-primary">CLIK</span>
              </h1>
            </div>
            
            <h2 className="text-lg font-semibold text-muted-foreground hidden md:block">
              Pagamento do Cupom MesaClik
            </h2>

            <Button
              variant="ghost"
              onClick={() => navigate('/promotions')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Coluna 1: Resumo da Compra */}
          <div className="lg:col-span-1">
            <OrderSummary
              type={type}
              startDate={startDate}
              endDate={endDate}
              duration={duration}
              amount={amount}
            />
          </div>

          {/* Coluna 2: Métodos de Pagamento */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Escolha a forma de pagamento</h3>
              
              <PaymentMethodSelector
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
              />

              {/* Área de pagamento específica do método */}
              <div className="mt-6">
                {selectedMethod === 'pix' && (
                  <PixPayment amount={amount} />
                )}
                {(selectedMethod === 'credit' || selectedMethod === 'debit') && (
                  <CardPayment type={selectedMethod} />
                )}
              </div>
            </Card>
          </div>

          {/* Coluna 3: Resumo Final e Confirmação */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h3 className="text-lg font-semibold mb-4">Resumo Final</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">R$ {amount.toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {amount.toFixed(2)}</span>
                </div>

                <Separator />

                {/* Aceite de Termos */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="payment-terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  />
                  <Label
                    htmlFor="payment-terms"
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    Li e aceito os{' '}
                    <a href="#" className="text-primary hover:underline">
                      Termos de Pagamento
                    </a>{' '}
                    do MesaClik
                  </Label>
                </div>

                {/* Botão de Pagamento */}
                <Button
                  onClick={handlePayment}
                  disabled={!selectedMethod || !acceptedTerms || processing}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {processing ? 'Processando...' : 'Confirmar Pagamento'}
                </Button>

                {/* Mensagem de Segurança */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <span>Seu pagamento é processado com segurança</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">
                Termos de Uso
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Política de Pagamentos
              </a>
            </div>
            <p>© 2025 MesaClik. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

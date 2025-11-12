import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [transactionData, setTransactionData] = useState<any>(null);

  const transactionId = searchParams.get('transactionId');
  const transactionCode = searchParams.get('transactionCode');
  const couponId = searchParams.get('couponId');
  const amount = searchParams.get('amount');
  const method = searchParams.get('method');

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      if (transactionId) {
        try {
          const { data, error } = await supabase
            .from('payment_transactions' as any)
            .select('*')
            .eq('id', transactionId)
            .single();

          if (error) throw error;
          setTransactionData(data);
        } catch (error) {
          console.error('Error fetching transaction:', error);
        }
      }
    };

    fetchTransactionDetails();
  }, [transactionId]);

  const getMethodName = (method: string | null) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'credit': return 'Cartão de Crédito';
      case 'debit': return 'Cartão de Débito';
      default: return 'Método desconhecido';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full p-8 md:p-12 animate-fade-in shadow-xl border-2">
        {/* Animação de Sucesso */}
        <div className="flex justify-center mb-8 animate-scale-in">
          <div className="rounded-full bg-success/10 p-6 ring-4 ring-success/20">
            <CheckCircle2 className="w-20 h-20 md:w-24 md:h-24 text-success" />
          </div>
        </div>

        {/* Mensagem Principal */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Cupom ativado com sucesso!
          </h1>
          
          <p className="text-lg text-muted-foreground">
            O pagamento foi confirmado e o cupom já está disponível no painel do restaurante.
          </p>
        </div>

        {/* Resumo Detalhado do Pagamento */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 md:p-8 mb-8 space-y-4 border border-primary/20">
          <h2 className="font-bold text-xl mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Resumo do Pagamento
          </h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground font-medium">ID da transação:</span>
              <span className="font-mono text-sm font-semibold bg-background/50 px-3 py-1 rounded">
                {transactionCode || transactionId?.slice(0, 13).toUpperCase() || 'MC-' + Date.now().toString().slice(-8)}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground font-medium">Método de pagamento:</span>
              <span className="font-semibold">{getMethodName(method)}</span>
            </div>
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground font-medium">Valor total:</span>
              <span className="font-bold text-2xl text-primary">
                R$ {Number(amount || 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground font-medium">Data e hora:</span>
              <span className="font-semibold">
                {new Date().toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-base pt-3 border-t border-border/50">
              <span className="text-muted-foreground font-medium">Status:</span>
              <span className="flex items-center gap-2 text-success font-bold">
                <CheckCircle2 className="w-5 h-5" />
                Pago
              </span>
            </div>
            
            {couponId && (
              <div className="flex justify-between items-center text-base">
                <span className="text-muted-foreground font-medium">Cupom vinculado:</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {couponId.slice(0, 8)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Botão de Retorno */}
        <Button
          onClick={() => navigate('/promotions')}
          size="lg"
          className="w-full h-14 text-lg font-bold mb-4"
        >
          Voltar ao painel de promoções
        </Button>

        {/* Informação Adicional */}
        <p className="text-sm text-muted-foreground text-center">
          Você receberá um e-mail automático confirmando este pagamento.
        </p>

        {/* Selo de Segurança */}
        <div className="mt-6 pt-6 border-t border-border/50 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
          </svg>
          Transação protegida por SSL
        </div>
      </Card>
    </div>
  );
}

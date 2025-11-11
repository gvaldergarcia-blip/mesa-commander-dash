import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const couponId = searchParams.get('couponId');
  const amount = searchParams.get('amount');
  const method = searchParams.get('method');

  useEffect(() => {
    // Aqui você pode atualizar o status do cupom no banco
    // para "ativo" após confirmação do pagamento
  }, [couponId]);

  const getMethodName = (method: string | null) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'credit': return 'Cartão de Crédito';
      case 'debit': return 'Cartão de Débito';
      default: return 'Método desconhecido';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center">
        {/* Ícone de Sucesso */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-success/10 p-4">
            <CheckCircle2 className="w-16 h-16 md:w-20 md:h-20 text-success" />
          </div>
        </div>

        {/* Mensagem Principal */}
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Pagamento confirmado com sucesso!
        </h1>
        
        <p className="text-muted-foreground mb-8">
          Seu cupom foi ativado e já está disponível no painel do restaurante.
        </p>

        {/* Resumo do Pagamento */}
        <div className="bg-muted/50 rounded-lg p-6 mb-8 space-y-3">
          <h2 className="font-semibold text-lg mb-4">Resumo do Pagamento</h2>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor pago:</span>
            <span className="font-medium">R$ {Number(amount).toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Método:</span>
            <span className="font-medium">{getMethodName(method)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Data:</span>
            <span className="font-medium">
              {new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          
          {couponId && (
            <div className="flex justify-between text-sm pt-3 border-t border-border">
              <span className="text-muted-foreground">ID da transação:</span>
              <span className="font-mono text-xs">{couponId.slice(0, 8)}...</span>
            </div>
          )}
        </div>

        {/* Botão de Retorno */}
        <Button
          onClick={() => navigate('/promotions')}
          size="lg"
          className="w-full md:w-auto px-8 h-12 text-base font-semibold"
        >
          Voltar ao painel
        </Button>

        {/* Informação Adicional */}
        <p className="text-xs text-muted-foreground mt-6">
          Um comprovante foi enviado para o email cadastrado.
        </p>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard } from 'lucide-react';

type CardPaymentProps = {
  type: 'credit' | 'debit';
};

export function CardPayment({ type }: CardPaymentProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.substring(0, 19); // 16 digits + 3 spaces
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return cleaned.substring(0, 14);
  };

  const detectCardBrand = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (cleaned.startsWith('5')) return 'Mastercard';
    if (cleaned.startsWith('6')) return 'Discover';
    if (cleaned.startsWith('3')) return 'Amex';
    return '';
  };

  const cardBrand = detectCardBrand(cardNumber);

  return (
    <div className="space-y-6">
      {/* Cartão Visual */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-start mb-8">
          <CreditCard className="w-10 h-10 opacity-80" />
          {cardBrand && (
            <span className="text-sm font-semibold">{cardBrand}</span>
          )}
        </div>
        
        <div className="space-y-4">
          <p className="text-xl font-mono tracking-wider">
            {cardNumber || '•••• •••• •••• ••••'}
          </p>
          
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs opacity-70 mb-1">Nome do titular</p>
              <p className="text-sm font-medium uppercase">
                {cardName || 'NOME COMPLETO'}
              </p>
            </div>
            <div>
              <p className="text-xs opacity-70 mb-1">Validade</p>
              <p className="text-sm font-medium">
                {expiryDate || 'MM/AA'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="cardName">Nome do titular</Label>
          <Input
            id="cardName"
            placeholder="Como está impresso no cartão"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="cardNumber">Número do cartão</Label>
          <Input
            id="cardNumber"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expiryDate">Validade</Label>
            <Input
              id="expiryDate"
              placeholder="MM/AA"
              value={expiryDate}
              onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
              maxLength={5}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="cvv">CVV</Label>
            <Input
              id="cvv"
              placeholder="123"
              type="password"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
              maxLength={4}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="cpf">CPF do titular</Label>
          <Input
            id="cpf"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            className="mt-1"
          />
        </div>
      </div>

      {/* Informação */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          {type === 'credit' 
            ? '💳 O valor será cobrado em sua próxima fatura'
            : '💳 Pagamento será debitado automaticamente após confirmação'
          }
        </p>
      </div>
    </div>
  );
}

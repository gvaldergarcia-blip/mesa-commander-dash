import React from 'react';
import { CreditCard, Smartphone, QrCode, Wallet } from 'lucide-react';

type PaymentMethod = 'pix' | 'credit' | 'debit' | null;

type PaymentMethodSelectorProps = {
  selectedMethod: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
};

const paymentMethods = [
  {
    id: 'pix' as const,
    name: 'PIX',
    description: 'Pagamento instantâneo',
    icon: QrCode,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    id: 'credit' as const,
    name: 'Cartão de Crédito',
    description: 'Parcelamento disponível',
    icon: CreditCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'debit' as const,
    name: 'Cartão de Débito',
    description: 'Débito em conta',
    icon: Smartphone,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
];

export function PaymentMethodSelector({ selectedMethod, onSelectMethod }: PaymentMethodSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {paymentMethods.map((method) => {
        const Icon = method.icon;
        const isSelected = selectedMethod === method.id;
        
        return (
          <button
            key={method.id}
            onClick={() => onSelectMethod(method.id)}
            className={`
              relative p-4 rounded-lg border-2 transition-all text-left
              ${isSelected 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 bg-card'
              }
            `}
          >
            <div className="flex items-center gap-4">
              <div className={`
                p-3 rounded-lg transition-colors
                ${isSelected ? 'bg-primary text-primary-foreground' : method.bgColor}
              `}>
                <Icon className={`w-6 h-6 ${isSelected ? '' : method.color}`} />
              </div>
              
              <div className="flex-1">
                <p className="font-semibold text-foreground">{method.name}</p>
                <p className="text-sm text-muted-foreground">{method.description}</p>
              </div>

              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

import React from 'react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Link as LinkIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type OrderSummaryProps = {
  type: string;
  startDate: string;
  endDate: string;
  duration: number;
  amount: number;
};

export function OrderSummary({ type, startDate, endDate, duration, amount }: OrderSummaryProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="p-6 sticky top-24">
      <h3 className="text-lg font-semibold mb-6">Resumo da Compra</h3>
      
      <div className="space-y-4">
        {/* Tipo */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Tipo</p>
          <div className="flex items-center gap-2">
            {type === 'link' ? (
              <>
                <LinkIcon className="w-4 h-4 text-primary" />
                <p className="font-medium">Cupom por Link</p>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-primary" />
                <p className="font-medium">Cupom por Upload</p>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Restaurante */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Restaurante</p>
          <p className="font-medium">Restaurante MesaClik</p>
        </div>

        <Separator />

        {/* Período */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Período do Cupom</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Início</p>
                <p className="text-muted-foreground">{formatDate(startDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Término</p>
                <p className="text-muted-foreground">{formatDate(endDate)}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Duração */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Duração total</p>
          <p className="font-semibold">{duration} {duration === 1 ? 'dia' : 'dias'}</p>
        </div>

        <Separator />

        {/* Valor */}
        <div className="bg-primary/5 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-2">Valor total</p>
          <p className="text-4xl font-bold text-primary">
            R$ {amount.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            R$ 2,00 a cada 2 dias de exibição
          </p>
        </div>
      </div>
    </Card>
  );
}

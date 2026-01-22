/**
 * Componente de formulário de consentimento para a fila
 * - Checkbox obrigatório de Termos + Privacidade
 * - Checkbox opcional de Marketing
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';

interface QueueConsentFormProps {
  termsAccepted: boolean;
  marketingOptin: boolean;
  onTermsChange: (accepted: boolean) => void;
  onMarketingChange: (optin: boolean) => void;
  disabled?: boolean;
  restaurantName?: string;
}

export function QueueConsentForm({
  termsAccepted,
  marketingOptin,
  onTermsChange,
  onMarketingChange,
  disabled = false,
  restaurantName = 'este restaurante',
}: QueueConsentFormProps) {
  return (
    <div className="space-y-4">
      {/* Checkbox obrigatório - Termos e Privacidade */}
      <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border">
        <Checkbox
          id="terms-consent"
          checked={termsAccepted}
          onCheckedChange={(checked) => onTermsChange(checked === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label
            htmlFor="terms-consent"
            className="text-sm font-medium leading-tight cursor-pointer"
          >
            Li e aceito os{' '}
            <Link
              to="/termos"
              target="_blank"
              className="text-orange-600 hover:text-orange-700 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link
              to="/privacidade"
              target="_blank"
              className="text-orange-600 hover:text-orange-700 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Política de Privacidade
            </Link>{' '}
            do MesaClik.
          </Label>
          <p className="text-xs text-muted-foreground">
            * Obrigatório para continuar
          </p>
        </div>
      </div>

      {/* Checkbox opcional - Marketing */}
      <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
        <Checkbox
          id="marketing-consent"
          checked={marketingOptin}
          onCheckedChange={(checked) => onMarketingChange(checked === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label
            htmlFor="marketing-consent"
            className="text-sm font-medium leading-tight cursor-pointer"
          >
            Quero receber ofertas e novidades por e-mail de {restaurantName}.
          </Label>
          <p className="text-xs text-muted-foreground">
            Opcional - Você pode cancelar a qualquer momento
          </p>
        </div>
      </div>
    </div>
  );
}

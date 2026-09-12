import { ReactNode } from 'react';
import { useModules } from '@/contexts/ModulesContext';
import { ModuleKey, MODULES_BY_KEY } from '@/config/modules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, MessageCircle } from 'lucide-react';

interface ModuleGuardProps {
  module: ModuleKey;
  children: ReactNode;
}

/**
 * Protege rotas que requerem um módulo específico.
 * Se o módulo não está no plano, exibe uma tela de bloqueio amigável
 * com convite para falar com o MesaClik, em vez de redirecionar silenciosamente.
 */
export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { hasModule, isLoading } = useModules();
  const allowed = hasModule(module);
  const moduleInfo = MODULES_BY_KEY[module];

  if (isLoading) return null;
  if (allowed) return <>{children}</>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Card className="border-muted">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Módulo não contratado</CardTitle>
          <CardDescription>
            O módulo <strong>{moduleInfo?.name || module}</strong> não está incluso no seu plano atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Quer liberar este e outros recursos? Fale com a equipe MesaClik e faremos um ajuste rápido na sua assinatura.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => window.open('https://wa.me/5511944684469', '_blank')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar no WhatsApp
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

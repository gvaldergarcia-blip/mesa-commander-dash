import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModules } from '@/contexts/ModulesContext';
import { useToast } from '@/hooks/use-toast';

interface ModuleGuardProps {
  module: 'fila' | 'reserva';
  children: ReactNode;
}

/**
 * Protege rotas que requerem um módulo específico.
 * Se o módulo não está no plano, redireciona para /dashboard com toast.
 */
export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { hasModule, isLoading } = useModules();
  const navigate = useNavigate();
  const { toast } = useToast();

  const allowed = hasModule(module);

  useEffect(() => {
    if (!isLoading && !allowed) {
      toast({
        title: 'Módulo não disponível',
        description: 'Seu plano não inclui este módulo. Fale conosco para fazer upgrade.',
        variant: 'destructive',
      });
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, allowed, navigate, toast]);

  if (isLoading) return null;
  if (!allowed) return null;

  return <>{children}</>;
}

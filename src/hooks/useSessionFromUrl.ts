import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lê access_token e refresh_token da URL (passados pelo site institucional)
 * e restaura a sessão no Supabase Auth deste domínio.
 */
export function useSessionFromUrl() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ error }) => {
        if (error) {
          console.error('[SessionFromUrl] Erro ao restaurar sessão:', error);
        } else {
          console.log('[SessionFromUrl] Sessão restaurada com sucesso');
        }
        // Limpar tokens da URL sem recarregar
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, []);
}

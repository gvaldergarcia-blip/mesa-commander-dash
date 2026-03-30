/**
 * Retorna a base URL do app para links em SMS/email.
 * Usa o domínio customizado se configurado via env var,
 * senão usa o origin atual (lovable.app em produção).
 */
export function getSiteBaseUrl(): string {
  // Se houver domínio customizado configurado, usar ele
  const customDomain = import.meta.env.VITE_PUBLIC_APP_URL;
  if (customDomain) {
    return customDomain.replace(/\/$/, '');
  }

  // Fallback: usar o origin atual (funciona em lovable.app e qualquer outro host)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'https://mesaclik.com.br';
}

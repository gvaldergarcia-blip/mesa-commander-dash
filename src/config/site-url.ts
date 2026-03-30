/**
 * Retorna a base URL de produção do site.
 * Em produção (mesaclik.com.br) usa o domínio real.
 * Em dev/preview usa window.location.origin como fallback.
 */
export function getSiteBaseUrl(): string {
  const PRODUCTION_URL = 'https://mesaclik.com.br';
  
  // Always use production URL for customer-facing links (SMS, emails)
  // so links work correctly regardless of where the admin panel is accessed from
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If already on production domain, use it
    if (hostname === 'mesaclik.com.br' || hostname === 'www.mesaclik.com.br') {
      return PRODUCTION_URL;
    }
  }
  
  // For SMS and email links, always use production domain
  return PRODUCTION_URL;
}

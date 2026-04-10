const OFFICIAL_APP_URL = 'https://app.mesaclik.com.br';
const LEGACY_ROOT_DOMAINS = new Set([
  'https://mesaclik.com.br',
  'https://www.mesaclik.com.br',
]);

function normalizePublicAppUrl(url?: string | null): string | null {
  if (!url) return null;

  const normalized = url.replace(/\/$/, '');
  if (LEGACY_ROOT_DOMAINS.has(normalized)) {
    return OFFICIAL_APP_URL;
  }

  return normalized;
}

/**
 * Retorna a base URL pública do app para links externos e QR Codes.
 * Domínios legados do site institucional são normalizados para o app oficial.
 */
export function getSiteBaseUrl(): string {
  const customDomain = normalizePublicAppUrl(import.meta.env.VITE_PUBLIC_APP_URL);
  if (customDomain) {
    return customDomain;
  }

  if (typeof window !== 'undefined') {
    return normalizePublicAppUrl(window.location.origin) ?? OFFICIAL_APP_URL;
  }

  return OFFICIAL_APP_URL;
}

const OFFICIAL_APP_URL = 'https://app.mesaclik.com.br';
const LEGACY_ROOT_DOMAINS = new Set([
  'https://mesaclik.com.br',
  'https://www.mesaclik.com.br',
]);

const PREVIEW_HOST_PATTERNS = [
  /\.lovableproject\.com$/i,
  /\.lovable\.app$/i,
  /\.lovable\.dev$/i,
];

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isLovablePreviewHost(hostname: string): boolean {
  return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

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
    const runtimeUrl = normalizePublicAppUrl(window.location.origin);

    if (runtimeUrl) {
      const hostname = new URL(runtimeUrl).hostname;

      if (isLocalhost(hostname)) {
        return runtimeUrl;
      }

      if (isLovablePreviewHost(hostname)) {
        return OFFICIAL_APP_URL;
      }

      return runtimeUrl;
    }
  }

  return OFFICIAL_APP_URL;
}

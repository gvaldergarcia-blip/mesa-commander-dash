/**
 * Security Feature Flags — Hardening de Produção MesaClik
 * 
 * Flags para ativar/desativar proteções gradualmente.
 * Em produção: todos devem ser `true`.
 * Em dev/preview: podem ser `false` para facilitar testes.
 * 
 * ROLLBACK: Para reverter qualquer proteção, basta setar a flag para `false`.
 */

const isProduction = () => {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname;
  return (
    !hostname.includes('localhost') &&
    !hostname.includes('lovable.app') &&
    !hostname.includes('127.0.0.1')
  );
};

export const SECURITY_FLAGS = {
  /**
   * Se `true`, o preview bypass (isAuthenticated/userRole fakes) 
   * só funciona com a env var VITE_PREVIEW_BYPASS=true.
   * Se `false`, usa o comportamento antigo (hostname-based).
   */
  STRICT_PREVIEW_BYPASS: isProduction(),

  /**
   * Se `true`, exige que tokens sejam removidos da URL imediatamente.
   * (Já implementado, mas agora com log de warning se falhar.)
   */
  SANITIZE_URL_TOKENS: true,

  /**
   * Se `true`, o frontend envia JWT em chamadas a Edge Functions sensíveis.
   * (O Supabase SDK já faz isso por padrão via supabase.functions.invoke.)
   */
  SEND_AUTH_HEADERS: true,
} as const;

/**
 * Lista de origens permitidas para CORS nas Edge Functions.
 * Usado pelas funções para validar o header Origin.
 */
export const ALLOWED_ORIGINS = [
  'https://mesaclik.com.br',
  'https://www.mesaclik.com.br',
  'https://app.mesaclik.com.br',
  'https://painel.mesaclik.com.br',
  // Preview/dev origins (serão bloqueadas em produção se necessário)
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

// Preview origins pattern (lovable.app subdomains)
export const PREVIEW_ORIGIN_PATTERN = /^https:\/\/.*\.lovable\.app$/;

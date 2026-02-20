/**
 * Feature Flags - Configuração de funcionalidades do painel MesaClik
 * 
 * Para reativar uma funcionalidade, basta alterar o valor para `true`
 * 
 * CUPONS_ENABLED: Controla toda a funcionalidade de cupons e promoções
 * - Menu lateral "Promoções"
 * - Rotas /promotions e /cupons
 * - Criação, edição e visualização de cupons
 * - Fluxo de pagamento de cupons
 * - Chamadas ao backend de cupons
 */

export const FEATURE_FLAGS = {
  /**
   * Habilita/desabilita funcionalidades de Cupons e Promoções
   * 
   * Quando FALSE:
   * - Oculta "Promoções" do menu lateral
   * - Bloqueia rotas /promotions e /cupons
   * - Desabilita queries e mutations de cupons
   * - Exibe mensagem "Funcionalidade desativada temporariamente"
   * 
   * Para REATIVAR: Altere para `true`
   */
  CUPONS_ENABLED: false,
  MARKETING_IA_ENABLED: false,
} as const;

/**
 * Mensagem padrão exibida quando uma funcionalidade está desativada
 */
export const FEATURE_DISABLED_MESSAGE = "Funcionalidade desativada temporariamente.";

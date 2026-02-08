/**
 * DEPRECATED: Este arquivo será removido em breve.
 * 
 * O sistema agora usa RestaurantContext para obter o restaurante
 * dinamicamente do usuário autenticado.
 * 
 * Para migrar:
 * - Importe useRestaurant() de '@/contexts/RestaurantContext'
 * - Use restaurantId do contexto em vez de RESTAURANT_ID
 * 
 * @deprecated Use useRestaurant() hook instead
 */

// IDs mantidos temporariamente para compatibilidade durante migração
// ATENÇÃO: Estes valores NÃO devem ser usados em produção!
export const CURRENT_RESTAURANT = {
  id: '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
  name: 'Mocotó',
  ownerId: 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208',
  address: 'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros, São Paulo',
  cuisine: 'Outros'
} as const;

/** @deprecated Use useRestaurantId() hook instead */
export const RESTAURANT_ID = CURRENT_RESTAURANT.id;

/** @deprecated Não usar em produção - sempre requer autenticação real */
export const DEV_FORCE_RESTAURANT = false; // Desabilitado para produção

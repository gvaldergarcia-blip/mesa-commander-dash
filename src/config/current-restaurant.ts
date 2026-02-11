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

// Valores vazios - nenhum restaurante hardcoded
export const CURRENT_RESTAURANT = {
  id: '',
  name: '',
  ownerId: '',
  address: '',
  cuisine: 'Outros'
} as const;

/** @deprecated Use useRestaurantId() hook instead */
export const RESTAURANT_ID = CURRENT_RESTAURANT.id;

/** Em preview, bypass está habilitado para facilitar desenvolvimento */
export const DEV_FORCE_RESTAURANT = false;

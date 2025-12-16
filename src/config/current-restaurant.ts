/**
 * Configuração do restaurante atual para desenvolvimento
 * 
 * Em produção, este valor deve vir da sessão do usuário autenticado
 * ou de um seletor de contexto no painel.
 */

export const CURRENT_RESTAURANT = {
  // ID from public.restaurants (syncs to mesaclik via triggers)
  id: '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
  name: 'Mocotó',
  ownerId: 'b1b07977-6c22-4422-88d3-3ddaa4c0eb59',
  address: 'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros, São Paulo',
  cuisine: 'Outros'
} as const;

export const RESTAURANT_ID = CURRENT_RESTAURANT.id;
export const DEV_FORCE_RESTAURANT = true;

/**
 * Configuração do restaurante atual para desenvolvimento
 * 
 * Em produção, este valor deve vir da sessão do usuário autenticado
 * ou de um seletor de contexto no painel.
 */

export const CURRENT_RESTAURANT = {
  id: '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
  name: 'Mocotó',
  ownerId: 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208', // Admin user from user_roles
  address: 'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros, São Paulo',
  cuisine: 'Outros'
} as const;

export const RESTAURANT_ID = CURRENT_RESTAURANT.id;
export const DEV_FORCE_RESTAURANT = true;

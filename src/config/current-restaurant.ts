/**
 * Configuração do restaurante atual para desenvolvimento
 * 
 * Em produção, este valor deve vir da sessão do usuário autenticado
 * ou de um seletor de contexto no painel.
 */

export const CURRENT_RESTAURANT = {
  id: 'b01b96fb-bd8c-46d6-b16b-b41ffdd0208',
  name: 'Mocotó',
  ownerId: 'b1b07977-6c22-4422-88d3-3ddaa4c0eb59',
  address: 'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros, São Paulo',
  cuisine: 'Outros'
} as const;

export const RESTAURANT_ID = CURRENT_RESTAURANT.id;
export const DEV_FORCE_RESTAURANT = true;

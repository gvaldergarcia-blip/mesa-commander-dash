/**
 * Configuração do restaurante atual para desenvolvimento
 * 
 * Em produção, este valor deve vir da sessão do usuário autenticado
 * ou de um seletor de contexto no painel.
 */

export const CURRENT_RESTAURANT = {
  id: '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
  name: 'Mocotó',
  address: 'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros, São Paulo',
  cuisine: 'Outros'
} as const;

export const RESTAURANT_ID = CURRENT_RESTAURANT.id;

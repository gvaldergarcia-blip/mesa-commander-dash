/**
 * Fonte única de tipos de culinária
 * Deve estar sincronizada com o enum cuisine_enum do banco de dados
 */

export const CUISINE_TYPES = [
  "Oriental",
  "Peruana",
  "Mexicana",
  "Cervejaria",
  "Árabe",
  "Asiática",
  "Espanhola",
  "Indiana",
  "Havaiana",
  "Mediterrânea",
  "Frutos do Mar",
  "Portuguesa",
  "Grega",
  "Cafeteria",
  "Outros",
  "Churrascaria",
  "Doceria",
  "Francesa",
  "Tailandesa",
  "Alemã",
  "Sorveteria",
  "Uruguaia",
  "Latino Americana",
  "Saudável",
  "Hamburgueria",
  "Padaria",
  "Japonesa",
  "Contemporânea",
  "Brasileira",
  "Argentina",
  "Pizzaria",
  "Steakhouse",
  "Italiana",
  "Bar"
] as const;

export type CuisineType = typeof CUISINE_TYPES[number];

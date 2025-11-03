/**
 * Fonte única de tipos de culinária
 * Deve estar sincronizada com o enum cuisine_enum do banco de dados
 */

export const CUISINE_TYPES = [
  "Brasileira",
  "Italiana",
  "Pizzaria",
  "Japonesa",
  "Churrascaria",
  "Frutos do Mar",
  "Mexicana",
  "Árabe",
  "Vegana/Vegetariana",
  "Outros"
] as const;

export type CuisineType = typeof CUISINE_TYPES[number];

-- Adicionar categorias faltantes ao enum cuisine_enum (schema public)
ALTER TYPE public.cuisine_enum ADD VALUE IF NOT EXISTS 'Cervejaria';
ALTER TYPE public.cuisine_enum ADD VALUE IF NOT EXISTS 'Árabe';
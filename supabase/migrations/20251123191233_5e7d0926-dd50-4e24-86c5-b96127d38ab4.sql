-- Limpar dados de teste da tabela customers
-- Critério: clientes com nomes contendo palavras de teste ou telefones com padrões repetitivos

DELETE FROM public.customers 
WHERE 
  -- Nomes de teste
  name ILIKE '%test%' OR
  name ILIKE '%driver%' OR
  name ILIKE '%exemplo%' OR
  name ILIKE '%sample%' OR
  name ILIKE '%demo%' OR
  name ILIKE '%fake%' OR
  -- Telefones com padrões repetitivos (números iguais)
  phone LIKE '%00000%' OR
  phone LIKE '%11111%' OR
  phone LIKE '%22222%' OR
  phone LIKE '%33333%' OR
  phone LIKE '%44444%' OR
  phone LIKE '%55555%' OR
  phone LIKE '%66666%' OR
  phone LIKE '%77777%' OR
  phone LIKE '%88888%' OR
  phone LIKE '%99999%';
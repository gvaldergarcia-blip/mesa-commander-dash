ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS original_expiry_date timestamptz;

COMMENT ON COLUMN public.label_issuances.original_expiry_date IS
  'VALIDADE ORIGINAL (fabricante). Pertence ao lote recebido. Informativa. NUNCA recalculada, NUNCA alterada na Renovação.';
COMMENT ON COLUMN public.label_issuances.expiry_date IS
  'VALIDADE DE MANIPULACAO (pos-abertura) = manufacture_date + regra pos-uso do produto. Unica validade usada pela Renovacao.';
COMMENT ON COLUMN public.label_issuances.manufacture_date IS
  'DATA DA MANIPULACAO (momento da abertura/manipulacao). Base de calculo da validade de manipulacao.';
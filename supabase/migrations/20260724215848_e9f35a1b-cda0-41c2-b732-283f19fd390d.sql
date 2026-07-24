ALTER TABLE public.label_issuances ADD COLUMN IF NOT EXISTS lot_source text;
COMMENT ON COLUMN public.label_issuances.lot_source IS 'Origem do lote: manufacturer (informado pelo fabricante/usuário), internal (gerado pelo MesaClik como LT-YYYYMMDD-NNN), none (produto recebido sem lote).';
ALTER TABLE public.label_receipt_items ADD COLUMN IF NOT EXISTS lot_source text;
COMMENT ON COLUMN public.label_receipt_items.lot_source IS 'Origem do lote registrada no recebimento (manufacturer | internal | none).';
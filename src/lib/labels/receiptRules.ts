interface ReceiptRow {
  name: string;
  productId: string | null;
  quantity: string;
  unit: string;
  batch: string;
  originalExpiry: string;
  weight: string;
  weightUnit: string;
}

export function missingReceiptPrintFields<T extends Pick<ReceiptRow, 'batch' | 'originalExpiry'>>(rows: T[]): T[] {
  return rows.filter((row) => !row.batch.trim() || !row.originalExpiry.trim());
}

export function buildReceiptStockMovements(rows: ReceiptRow[], restaurantId: string, receiptId: string, reference: string) {
  return rows.filter((row) => row.productId).map((row) => {
    const weight = Number(row.weight.replace(',', '.'));
    return {
      restaurant_id: restaurantId,
      event_type: 'receipt',
      product_id: row.productId,
      receipt_id: receiptId,
      quantity: Number(row.quantity.replace(',', '.')),
      unit: row.unit || 'un',
      occurred_at: new Date().toISOString(),
      notes: [
        reference.trim() ? `NF ${reference.trim()}` : null,
        row.batch.trim() ? `Lote ${row.batch.trim()}` : null,
        Number.isFinite(weight) && weight > 0 ? `Peso ${weight} ${row.weightUnit || 'kg'}` : null,
      ].filter(Boolean).join(' · ') || null,
    };
  });
}

export const RECEIPT_REFRESH_KEYS = ['label_receipts', 'label_stock_balance', 'label_stock_movements', 'label_movements', 'operational-diary'];
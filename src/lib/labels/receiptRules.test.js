import { describe, expect, test } from 'bun:test';
import { buildReceiptStockMovements, missingReceiptPrintFields, RECEIPT_REFRESH_KEYS } from './receiptRules';

const row = { name: 'Produto teste', productId: 'product-test', quantity: '2,5', unit: 'kg', batch: '', originalExpiry: '', weight: '', weightUnit: 'kg' };

describe('Regras de recebimento', () => {
  test('Só computar gera entrada no estoque mesmo sem lote e validade original', () => {
    const movements = buildReceiptStockMovements([row], 'restaurant-test', 'receipt-test', 'NF teste');
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ event_type: 'receipt', product_id: 'product-test', quantity: 2.5, unit: 'kg', receipt_id: 'receipt-test' });
    expect(RECEIPT_REFRESH_KEYS).toContain('label_stock_balance');
    expect(RECEIPT_REFRESH_KEYS).toContain('label_stock_movements');
  });
  test('Imprimir é bloqueado se qualquer produto não tiver lote', () => {
    const complete = { ...row, batch: 'L001', originalExpiry: '2026-12-01' };
    expect(missingReceiptPrintFields([complete, { ...complete, batch: '   ' }])).toHaveLength(1);
  });
  test('Imprimir é bloqueado se qualquer produto não tiver validade original', () => {
    const complete = { ...row, batch: 'L001', originalExpiry: '2026-12-01' };
    expect(missingReceiptPrintFields([complete, { ...complete, originalExpiry: '' }])).toHaveLength(1);
  });
  test('Imprimir é liberado quando todos têm lote e validade original', () => {
    expect(missingReceiptPrintFields([{ ...row, batch: 'L001', originalExpiry: '2026-12-01' }, { ...row, batch: 'L002', originalExpiry: '2026-11-01' }])).toEqual([]);
  });
});
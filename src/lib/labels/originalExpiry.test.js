import { describe, expect, test } from 'bun:test';
import { buildOriginalExpiryResolver, isRenewalCandidate } from './originalExpiry';

const now = Date.parse('2026-10-15T22:00:00Z');
const horizon = now + 12 * 3600000;
const label = { product_name: 'Produto teste', label_product_id: 'p1', batch: 'L1', created_at: '2026-10-10T12:00:00Z', expiry_date: '2026-10-15T20:00:00Z', original_expiry_date: '2026-10-16T23:59:00Z', status: 'active', units_remaining: 2 };

describe('Exclusão da renovação por validade original', () => {
  test('Original vencida exclui sem escanear ou dar baixa, mesmo com pós-abertura futura', () => {
    const expired = { ...label, original_expiry_date: '2026-10-14T23:59:00Z', expiry_date: '2026-10-16T01:00:00Z' };
    expect(isRenewalCandidate(expired, buildOriginalExpiryResolver([expired])(expired), now, horizon)).toBe(false);
  });
  test('Original válida mantém a renovação quando o prazo pós-abertura venceu', () => {
    expect(isRenewalCandidate(label, buildOriginalExpiryResolver([label])(label), now, horizon)).toBe(true);
  });
  test('Ao atingir o instante da original sai da renovação', () => {
    const expiry = new Date(label.original_expiry_date);
    expect(isRenewalCandidate(label, expiry, expiry.getTime() - 1, horizon)).toBe(true);
    expect(isRenewalCandidate(label, expiry, expiry.getTime(), horizon)).toBe(false);
  });
  test('Todas as etiquetas do ciclo usam a original mais antiga, independentemente da ordem', () => {
    const older = { ...label, original_expiry_date: '2026-10-14T23:59:00Z', status: 'discharged' };
    const missing = { ...label, original_expiry_date: null };
    for (const labels of [[label, missing, older], [older, label, missing]]) {
      const resolve = buildOriginalExpiryResolver(labels);
      expect(resolve(missing)?.toISOString()).toBe('2026-10-14T23:59:00.000Z');
      expect(isRenewalCandidate(label, resolve(label), now, horizon)).toBe(false);
    }
  });
  test('Um lote vencido não exclui outro lote válido do mesmo produto', () => {
    const expired = { ...label, batch: 'L2', original_expiry_date: '2026-10-14T23:59:00Z' };
    const resolve = buildOriginalExpiryResolver([expired, label]);
    expect(isRenewalCandidate(label, resolve(label), now, horizon)).toBe(true);
    expect(isRenewalCandidate(expired, resolve(expired), now, horizon)).toBe(false);
  });
});
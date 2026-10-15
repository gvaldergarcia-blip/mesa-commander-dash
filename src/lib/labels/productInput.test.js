import { describe, expect, test } from 'bun:test';
import { buildQuickProductInput } from './productInput';

const product = { name: 'Produto teste', unit: 'kg', conservation: 'refrigerated', manipValue: '', manipUnit: 'days' };

describe('Validade pós-abertura no cadastro pelo recebimento', () => {
  test('não cadastra sem prazo informado e não assume 3 dias', () => {
    const result = buildQuickProductInput(product);
    expect(result.input).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  test('preserva exatamente o prazo em dias informado pelo usuário', () => {
    const result = buildQuickProductInput({ ...product, manipValue: '5' });
    expect(result.error).toBeUndefined();
    expect(result.input).toMatchObject({ manipulation_validity_value: 5, manipulation_validity_unit: 'days', validity_days: 5 });
  });

  test('preserva exatamente o prazo em horas informado pelo usuário', () => {
    const result = buildQuickProductInput({ ...product, manipValue: '12', manipUnit: 'hours' });
    expect(result.error).toBeUndefined();
    expect(result.input).toMatchObject({ manipulation_validity_value: 12, manipulation_validity_unit: 'hours' });
  });

  test('não transforma valores inválidos em um prazo diferente', () => {
    for (const manipValue of [' ', '0', '-1', '3abc', '3.5', 'Infinity']) {
      const result = buildQuickProductInput({ ...product, manipValue });
      expect(result.input).toBeUndefined();
      expect(result.error).toBeDefined();
    }
  });
});
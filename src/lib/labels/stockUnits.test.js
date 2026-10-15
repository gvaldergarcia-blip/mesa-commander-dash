import { describe, expect, test } from 'bun:test';
import { toBase } from './stockUnits';

describe('Baixa quantitativa por uso', () => {
  test('45 g consumidos de 64 kg deixam exatamente 63,955 kg', () => {
    const entered = toBase(64, 'kg');
    const used = toBase(45, 'g');
    expect(entered.base).toBe(used.base);
    expect(entered.value - used.value).toBe(63955);
  });
  test('Consumo em unidades desconta somente as unidades utilizadas', () => {
    expect(toBase(12, 'un').value - toBase(3, 'un').value).toBe(9);
  });
  test('Um litro consumido de 2500 ml deixa 1500 ml', () => {
    expect(toBase(2500, 'ml').value - toBase(1, 'l').value).toBe(1500);
  });
});
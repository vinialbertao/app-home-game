import { describe, expect, it } from '@jest/globals';

import { formatBRL, parseBRL } from './money';

describe('formatBRL', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [5000, 'R$ 50,00'],
    [123456, 'R$ 1.234,56'],
    [100000000, 'R$ 1.000.000,00'],
    [-2550, '-R$ 25,50'],
  ])('%i centavos → %s', (cents, expected) => {
    expect(formatBRL(cents)).toBe(expected);
  });

  it('recusa valor que não é inteiro', () => {
    expect(() => formatBRL(10.5)).toThrow();
  });
});

describe('parseBRL', () => {
  it.each([
    ['50', 5000],
    ['50,5', 5050],
    ['50,05', 5005],
    ['1.234,56', 123456],
    ['R$ 20', 2000],
    [' 0,99 ', 99],
  ])('"%s" → %i centavos', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(['', 'abc', '10,123', '-5', '1.23,45', '12.5'])('"%s" é inválido', (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it('ida e volta não perde centavo', () => {
    for (const cents of [1, 99, 100, 101, 999999, 123456789]) {
      expect(parseBRL(formatBRL(cents))).toBe(cents);
    }
  });
});

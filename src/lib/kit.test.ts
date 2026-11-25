import { describe, expect, it } from '@jest/globals';

import { formatChipValue, KIT_PRESETS, parseWholeNumber, totalChips, totalValue, validateKitRows } from './kit';

describe('sugestões de maleta', () => {
  it.each([
    ['300', 300],
    ['500', 500],
  ])('maleta de %s fichas soma %i fichas', (id, expected) => {
    const preset = KIT_PRESETS.find((p) => p.id === id)!;
    expect(totalChips(preset.denominations)).toBe(expected);
  });

  it('cada maleta passa na própria validação', () => {
    for (const preset of KIT_PRESETS) {
      const rows = preset.denominations.map((d) => ({
        color: d.color,
        value: String(d.value),
        quantity: String(d.quantity),
      }));
      expect(validateKitRows(rows).ok).toBe(true);
    }
  });
});

describe('totais', () => {
  it('soma valor × quantidade', () => {
    expect(
      totalValue([
        { color: 'Branca', value: 25, quantity: 100 },
        { color: 'Preta', value: 1000, quantity: 3 },
      ]),
    ).toBe(5500);
  });

  it('formata com ponto de milhar', () => {
    expect(formatChipValue(25)).toBe('25');
    expect(formatChipValue(1000)).toBe('1.000');
    expect(formatChipValue(125000)).toBe('125.000');
  });
});

describe('parseWholeNumber', () => {
  it.each([
    ['500', 500],
    ['1.000', 1000],
    [' 25 ', 25],
    ['0', 0],
  ])('"%s" → %i', (input, expected) => {
    expect(parseWholeNumber(input)).toBe(expected);
  });

  it.each(['', '-5', '2,5', 'abc', '12345678'])('"%s" é inválido', (input) => {
    expect(parseWholeNumber(input)).toBeNull();
  });
});

describe('validateKitRows', () => {
  it('ordena do menor para o maior valor', () => {
    const result = validateKitRows([
      { color: 'Preta', value: '1000', quantity: '10' },
      { color: 'Branca', value: '25', quantity: '50' },
    ]);
    expect(result.ok && result.denominations.map((d) => d.color)).toEqual(['Branca', 'Preta']);
  });

  it('recusa cor repetida, valor repetido, valor zero e campos vazios', () => {
    const result = validateKitRows([
      { color: 'Branca', value: '25', quantity: '50' },
      { color: 'branca', value: '100', quantity: '50' },
      { color: 'Verde', value: '25', quantity: '50' },
      { color: 'Azul', value: '0', quantity: '10' },
      { color: '', value: '5000', quantity: '' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(5);
  });

  it('pede pelo menos uma cor', () => {
    expect(validateKitRows([]).ok).toBe(false);
  });
});

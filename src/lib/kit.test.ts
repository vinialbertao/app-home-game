import { describe, expect, it } from '@jest/globals';

import {
  formatChipValue,
  formatKitValue,
  KIT_PRESETS,
  kitValueToInput,
  parseKitValue,
  parseWholeNumber,
  totalChips,
  totalValue,
  validateKitRows,
  type KitKind,
} from './kit';

describe('sugestões de maleta', () => {
  it.each([
    ['cash', 'cash-300', 300],
    ['cash', 'cash-500', 500],
    ['tournament', 'tournament-300', 300],
    ['tournament', 'tournament-500', 500],
  ] as const)('%s / %s soma %i fichas', (kind, id, expected) => {
    const preset = KIT_PRESETS[kind].find((p) => p.id === id)!;
    expect(totalChips(preset.denominations)).toBe(expected);
  });

  it('cada maleta passa na própria validação, ida e volta pelo campo de texto', () => {
    for (const kind of ['cash', 'tournament'] as KitKind[]) {
      for (const preset of KIT_PRESETS[kind]) {
        const rows = preset.denominations.map((d) => ({
          color: d.color,
          value: kitValueToInput(d.value, kind),
          quantity: String(d.quantity),
        }));
        const result = validateKitRows(rows, kind);
        expect(result.ok && result.denominations).toEqual(preset.denominations);
      }
    }
  });
});

describe('totais e formatação', () => {
  it('soma valor × quantidade', () => {
    expect(
      totalValue([
        { color: 'Branca', value: 25, quantity: 100 },
        { color: 'Preta', value: 1000, quantity: 3 },
      ]),
    ).toBe(5500);
  });

  it('formata pontos com ponto de milhar', () => {
    expect(formatChipValue(25)).toBe('25');
    expect(formatChipValue(1000)).toBe('1.000');
    expect(formatChipValue(125000)).toBe('125.000');
  });

  it('formata por tipo de kit', () => {
    expect(formatKitValue(50, 'cash')).toBe('R$ 0,50');
    expect(formatKitValue(2500, 'cash')).toBe('R$ 25,00');
    expect(formatKitValue(2500, 'tournament')).toBe('2.500');
  });

  it('campo de edição do cash em reais', () => {
    expect(kitValueToInput(50, 'cash')).toBe('0,50');
    expect(kitValueToInput(150000, 'cash')).toBe('1500,00');
    expect(parseKitValue('0,50', 'cash')).toBe(50);
    expect(parseKitValue('5', 'cash')).toBe(500);
    expect(parseKitValue('1.000', 'tournament')).toBe(1000);
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
    const result = validateKitRows(
      [
        { color: 'Preta', value: '1000', quantity: '10' },
        { color: 'Branca', value: '25', quantity: '50' },
      ],
      'tournament',
    );
    expect(result.ok && result.denominations.map((d) => d.color)).toEqual(['Branca', 'Preta']);
  });

  it('no cash lê reais e guarda centavos', () => {
    const result = validateKitRows(
      [
        { color: 'Branca', value: '0,50', quantity: '100' },
        { color: 'Vermelha', value: '5', quantity: '50' },
      ],
      'cash',
    );
    expect(result.ok && result.denominations.map((d) => d.value)).toEqual([50, 500]);
  });

  it('recusa cor repetida, valor repetido, valor zero e campos vazios', () => {
    const result = validateKitRows(
      [
        { color: 'Branca', value: '25', quantity: '50' },
        { color: 'branca', value: '100', quantity: '50' },
        { color: 'Verde', value: '25', quantity: '50' },
        { color: 'Azul', value: '0', quantity: '10' },
        { color: '', value: '5000', quantity: '' },
      ],
      'tournament',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(5);
  });

  it('pede pelo menos uma cor', () => {
    expect(validateKitRows([], 'cash').ok).toBe(false);
  });
});

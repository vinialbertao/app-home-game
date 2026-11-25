import { describe, expect, it } from '@jest/globals';

import { countedValue, playerResults, reconcile, type CashDenomination, type CashPlayer } from './cash';
import { applyTransfers, settle } from './settlement';

// Kit do cash: R$ 0,50 / R$ 1 / R$ 5 / R$ 10 / R$ 25
const KIT: CashDenomination[] = [
  { id: 'c050', value: 50 },
  { id: 'c1', value: 100 },
  { id: 'c5', value: 500 },
  { id: 'c10', value: 1000 },
  { id: 'c25', value: 2500 },
];

/**
 * Noite de 6 jogadores, todos começando com R$ 20, com rebuys de valor livre.
 * Conta feita à mão:
 *
 * | Jogador | Entrou            | Contado  | Resultado |
 * |---------|-------------------|----------|-----------|
 * | Ana     | 20                | 75,00    | +55,00    |
 * | Bruno   | 20 + 20           | 0,00     | −40,00    |
 * | Caio    | 20 + 40           | 10,00    | −50,00    |
 * | Dani    | 20 + 20 + 30      | 55,50    | −14,50    |
 * | Edu     | 20                | 49,50    | +29,50    |
 * | Fabi    | 20                | 40,00    | +20,00    |
 * | Total   | 230,00            | 230,00   | 0         |
 *
 * Acerto (maior devedor paga o maior credor):
 *   Caio → Ana 50,00 · Bruno → Edu 29,50 · Dani → Fabi 14,50 · Bruno → Fabi 5,50 · Bruno → Ana 5,00
 */
const NIGHT: CashPlayer[] = [
  { playerId: 'ana', name: 'Ana', buyins: [2000], counts: { c25: 3 }, adjustments: [] },
  { playerId: 'bruno', name: 'Bruno', buyins: [2000, 2000], counts: {}, adjustments: [] },
  { playerId: 'caio', name: 'Caio', buyins: [2000, 4000], counts: { c10: 1 }, adjustments: [] },
  { playerId: 'dani', name: 'Dani', buyins: [2000, 2000, 3000], counts: { c25: 2, c5: 1, c050: 1 }, adjustments: [] },
  { playerId: 'edu', name: 'Edu', buyins: [2000], counts: { c25: 1, c10: 2, c1: 4, c050: 1 }, adjustments: [] },
  { playerId: 'fabi', name: 'Fabi', buyins: [2000], counts: { c25: 1, c10: 1, c5: 1 }, adjustments: [] },
];

describe('countedValue', () => {
  it('soma quantidade × valor de cada cor', () => {
    expect(countedValue({ c25: 2, c5: 1, c050: 1 }, KIT)).toBe(5550);
  });

  it('cor fora do kit não vale nada e quantidade vazia é zero', () => {
    expect(countedValue({ outra: 10 }, KIT)).toBe(0);
    expect(countedValue({}, KIT)).toBe(0);
  });
});

describe('noite de 6 jogadores (conta feita à mão)', () => {
  it('resultado de cada um', () => {
    const results = playerResults(NIGHT, KIT);
    expect(results.map((r) => [r.name, r.paidIn, r.counted, r.net])).toEqual([
      ['Ana', 2000, 7500, 5500],
      ['Bruno', 4000, 0, -4000],
      ['Caio', 6000, 1000, -5000],
      ['Dani', 7000, 5550, -1450],
      ['Edu', 2000, 4950, 2950],
      ['Fabi', 2000, 4000, 2000],
    ]);
  });

  it('conferência bate: entrou 230,00 e foi contado 230,00', () => {
    expect(reconcile(NIGHT, KIT)).toEqual({
      totalIn: 23000,
      totalCounted: 23000,
      totalAdjustments: 0,
      difference: 0,
      ok: true,
    });
  });

  it('acerto igual ao feito à mão, e todo mundo termina zerado', () => {
    const balances = playerResults(NIGHT, KIT).map((r) => ({ playerId: r.playerId, net: r.net }));
    const transfers = settle(balances);
    expect(transfers).toEqual([
      { from: 'caio', to: 'ana', amountCents: 5000 },
      { from: 'bruno', to: 'edu', amountCents: 2950 },
      { from: 'dani', to: 'fabi', amountCents: 1450 },
      { from: 'bruno', to: 'fabi', amountCents: 550 },
      { from: 'bruno', to: 'ana', amountCents: 500 },
    ]);
    for (const value of applyTransfers(balances, transfers).values()) expect(value).toBe(0);
  });
});

describe('conferência que não bate', () => {
  it('mostra quanto sobrou ou faltou', () => {
    const missing = NIGHT.map((p) => (p.playerId === 'ana' ? { ...p, counts: { c25: 2, c10: 2 } } : p));
    expect(reconcile(missing, KIT).difference).toBe(-500); // faltou R$ 5
    expect(reconcile(missing, KIT).ok).toBe(false);
  });

  it('o ajuste do host no jogador escolhido faz bater', () => {
    const fixed = NIGHT.map((p) =>
      p.playerId === 'ana' ? { ...p, counts: { c25: 2, c10: 2 }, adjustments: [500] } : p,
    );
    expect(reconcile(fixed, KIT).ok).toBe(true);
    expect(playerResults(fixed, KIT).find((r) => r.playerId === 'ana')?.net).toBe(5500);
  });
});

describe('valor total digitado direto', () => {
  it('vale no lugar das fichas por cor', () => {
    const typed = NIGHT.map((p) => (p.playerId === 'edu' ? { ...p, counts: {}, countedCents: 4950 } : p));
    expect(playerResults(typed, KIT).find((r) => r.playerId === 'edu')?.counted).toBe(4950);
    expect(reconcile(typed, KIT).ok).toBe(true);
  });

  it('total digitado zero é diferente de não contado', () => {
    const typed = NIGHT.map((p) => (p.playerId === 'bruno' ? { ...p, counts: { c25: 9 }, countedCents: 0 } : p));
    expect(playerResults(typed, KIT).find((r) => r.playerId === 'bruno')?.counted).toBe(0);
  });
});

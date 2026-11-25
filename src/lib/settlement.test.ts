import { describe, expect, it } from '@jest/globals';

import { applyTransfers, settle, SettlementError, type Balance } from './settlement';

function allZero(balances: Balance[]) {
  const transfers = settle(balances);
  for (const value of applyTransfers(balances, transfers).values()) expect(value).toBe(0);
  return transfers;
}

describe('settle', () => {
  it('ninguém deve nada: nenhuma transferência', () => {
    expect(settle([{ playerId: 'a', net: 0 }, { playerId: 'b', net: 0 }])).toEqual([]);
    expect(settle([])).toEqual([]);
  });

  it('um deve exatamente o que o outro ganhou: um Pix só', () => {
    expect(
      settle([
        { playerId: 'a', net: 1500 },
        { playerId: 'b', net: -1500 },
      ]),
    ).toEqual([{ from: 'b', to: 'a', amountCents: 1500 }]);
  });

  it('prefere pares exatos antes de quebrar valores', () => {
    const transfers = allZero([
      { playerId: 'a', net: 3000 },
      { playerId: 'b', net: 1000 },
      { playerId: 'c', net: -1000 },
      { playerId: 'd', net: -3000 },
    ]);
    expect(transfers).toHaveLength(2);
  });

  it('recusa saldos que não fecham, nem por 1 centavo', () => {
    expect(() =>
      settle([
        { playerId: 'a', net: 1000 },
        { playerId: 'b', net: -999 },
      ]),
    ).toThrow(SettlementError);
  });

  it('recusa valor que não é centavo inteiro', () => {
    expect(() =>
      settle([
        { playerId: 'a', net: 10.5 },
        { playerId: 'b', net: -10.5 },
      ]),
    ).toThrow();
  });

  it('nunca passa de jogadores com saldo − 1 transferências e sempre zera todo mundo', () => {
    // 200 noites aleatórias de 2 a 12 jogadores
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let night = 0; night < 200; night++) {
      const count = 2 + Math.floor(random() * 11);
      const nets = Array.from({ length: count - 1 }, () => Math.round((random() - 0.5) * 40000));
      nets.push(-nets.reduce((s, v) => s + v, 0));
      const balances = nets.map((net, i) => ({ playerId: `p${i}`, net }));
      const transfers = allZero(balances);
      const withBalance = balances.filter((b) => b.net !== 0).length;
      expect(transfers.length).toBeLessThanOrEqual(Math.max(withBalance - 1, 0));
      for (const t of transfers) {
        expect(Number.isInteger(t.amountCents)).toBe(true);
        expect(t.amountCents).toBeGreaterThan(0);
      }
    }
  });
});

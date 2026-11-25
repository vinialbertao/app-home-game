import { describe, expect, it } from '@jest/globals';

import { buildSettlementSummary } from './cashSummary';

describe('buildSettlementSummary', () => {
  const names: Record<string, string> = { ana: 'Ana', bruno: 'Bruno' };

  it('lista o resultado do maior para o menor e os Pix', () => {
    const text = buildSettlementSummary({
      groupName: 'Pecinhas',
      dateLabel: '25/11',
      results: [
        { playerId: 'bruno', name: 'Bruno', paidIn: 4000, counted: 0, adjustment: 0, net: -4000 },
        { playerId: 'ana', name: 'Ana', paidIn: 2000, counted: 6000, adjustment: 0, net: 4000 },
      ],
      transfers: [{ from: 'bruno', to: 'ana', amountCents: 4000 }],
      nameOf: (id) => names[id],
    });
    expect(text).toContain('Cash — Pecinhas (25/11)');
    expect(text.indexOf('Ana: +R$ 40,00')).toBeLessThan(text.indexOf('Bruno: -R$ 40,00'));
    expect(text).toContain('Bruno → Ana: R$ 40,00');
  });

  it('quando ninguém deve nada', () => {
    const text = buildSettlementSummary({
      groupName: 'G',
      dateLabel: '1/1',
      results: [{ playerId: 'ana', name: 'Ana', paidIn: 2000, counted: 2000, adjustment: 0, net: 0 }],
      transfers: [],
      nameOf: (id) => names[id],
    });
    expect(text).toContain('Ninguém deve nada');
  });
});

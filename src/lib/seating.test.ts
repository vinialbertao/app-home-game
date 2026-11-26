import { describe, expect, it } from '@jest/globals';

import {
  applyMoves,
  drawFinalTable,
  drawSeats,
  freeSeat,
  planBalance,
  planTableChange,
  removeFromTables,
  seatBack,
  seededRandom,
  shuffle,
  tableSizes,
  type SeatedTable,
} from './seating';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const table = (number: number, players: string[], dealerId: string | null = null): SeatedTable => ({
  number,
  seats: players.map((playerId, i) => ({ seat: i + 1, playerId })),
  dealerId,
});

describe('tableSizes', () => {
  it.each([
    [9, [9]],
    [10, [5, 5]],
    [14, [7, 7]],
    [16, [8, 8]],
    [17, [9, 8]],
    [18, [9, 9]],
    [19, [7, 6, 6]],
    [2, [2]],
  ])('%i jogadores → %j', (players, sizes) => {
    expect(tableSizes(players)).toEqual(sizes);
  });
  it('respeita outro tamanho de mesa', () => {
    expect(tableSizes(14, 6)).toEqual([5, 5, 4]);
  });
});

describe('shuffle', () => {
  it('mantém os mesmos itens', () => {
    expect(shuffle(ids(10), seededRandom(3)).sort()).toEqual(ids(10).sort());
  });
});

describe('drawSeats', () => {
  it('14 jogadores: 2 mesas de 7, todos sentados uma vez, lugares 1 a 7', () => {
    const tables = drawSeats({ playerIds: ids(14), hostPlayerId: null, random: seededRandom(1) });
    expect(tables.map((t) => t.seats.length)).toEqual([7, 7]);
    const all = tables.flatMap((t) => t.seats.map((s) => s.playerId));
    expect(new Set(all).size).toBe(14);
    tables.forEach((t) => expect(t.seats.map((s) => s.seat).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]));
  });
  it('o host fica sempre na mesa 1', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const tables = drawSeats({ playerIds: ids(17), hostPlayerId: 'p17', random: seededRandom(seed) });
      expect(tables[0].seats.some((s) => s.playerId === 'p17')).toBe(true);
    }
  });
  it('host que não joga não entra no sorteio', () => {
    const tables = drawSeats({ playerIds: ids(6), hostPlayerId: 'host', random: seededRandom(2) });
    expect(tables.flatMap((t) => t.seats).some((s) => s.playerId === 'host')).toBe(false);
    expect(tables[0].seats).toHaveLength(6);
  });
  it('sorteios diferentes dão lugares diferentes', () => {
    const a = drawSeats({ playerIds: ids(14), hostPlayerId: null, random: seededRandom(1) });
    const b = drawSeats({ playerIds: ids(14), hostPlayerId: null, random: seededRandom(99) });
    expect(a).not.toEqual(b);
  });
});

describe('freeSeat', () => {
  it('acha o menor lugar livre', () => {
    const t = {
      number: 1,
      seats: [
        { seat: 1, playerId: 'a' },
        { seat: 3, playerId: 'b' },
      ],
      dealerId: null,
    };
    expect(freeSeat(t)).toBe(2);
  });
  it('mesa cheia → null', () => {
    expect(freeSeat(table(1, ids(9)))).toBeNull();
  });
});

describe('planBalance', () => {
  it('equilibrado (diferença de 1) não move ninguém', () => {
    expect(planBalance([table(1, ids(7)), table(2, ids(6))], { random: seededRandom(1) })).toBeNull();
  });
  it('diferença de 2 move alguém da maior para a menor, nunca o dealer nem o host', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const move = planBalance(
        [table(1, ['h', 'a', 'b', 'c', 'd', 'e', 'f']), table(2, ['x', 'y', 'z', 'w', 'v'], 'x')],
        {
          hostPlayerId: 'h',
          random: seededRandom(seed),
        },
      );
      expect(move).toMatchObject({ fromTable: 1, toTable: 2, toSeat: 6 });
      expect(['h', 'x']).not.toContain(move!.playerId);
    }
  });
  it('tira da mesa 2 quando ela é a maior, sem mexer no dealer dela', () => {
    const move = planBalance([table(1, ['h', 'a', 'b']), table(2, ['x', 'y', 'z', 'w', 'v'], 'x')], {
      hostPlayerId: 'h',
      random: seededRandom(4),
    });
    expect(move).toMatchObject({ fromTable: 2, toTable: 1, toSeat: 4 });
    expect(move!.playerId).not.toBe('x');
  });
});

describe('planTableChange', () => {
  it('ainda não cabe em menos mesas → nada', () => {
    expect(planTableChange([table(1, ids(6)), table(2, ids(5))], { random: seededRandom(1) })).toEqual({
      kind: 'none',
    });
  });
  it('2 mesas e quem sobrou cabe em uma → mesa final', () => {
    expect(planTableChange([table(1, ids(5)), table(2, ids(4))], { random: seededRandom(1) })).toEqual({
      kind: 'final',
    });
  });
  it('3 mesas com 18 → desfaz a mesa 3 e espalha nas outras sem passar de 9', () => {
    const tables = [
      table(1, ids(6)),
      table(
        2,
        ids(6).map((p) => `b${p}`),
      ),
      table(
        3,
        ids(6).map((p) => `c${p}`),
      ),
    ];
    const change = planTableChange(tables, { random: seededRandom(2) });
    expect(change.kind).toBe('break');
    if (change.kind !== 'break') return;
    expect(change.table).toBe(3);
    expect(change.moves).toHaveLength(6);
    expect(change.moves.filter((m) => m.toTable === 1)).toHaveLength(3);
    expect(change.moves.filter((m) => m.toTable === 2)).toHaveLength(3);
    const seats = change.moves.map((m) => `${m.toTable}-${m.toSeat}`);
    expect(new Set(seats).size).toBe(6);
  });
});

describe('simulação: 14 jogadores, eliminações até a mesa final', () => {
  it('balanceia sempre com no máximo 1 de diferença e junta na mesa final com 9', () => {
    const random = seededRandom(7);
    let tables = drawSeats({ playerIds: ids(14), hostPlayerId: 'p1', random });
    tables[1].dealerId = tables[1].seats[0].playerId;
    let finalAt: number | null = null;
    for (let remaining = 14; remaining > 2; remaining--) {
      // elimina alguém que não é host nem dealer
      const victims = tables
        .flatMap((t) => t.seats.map((s) => s.playerId))
        .filter((p) => p !== 'p1' && !tables.some((t) => t.dealerId === p));
      const out = victims[Math.floor(random() * victims.length)];
      tables = tables.map((t) => ({ ...t, seats: t.seats.filter((s) => s.playerId !== out) }));

      const change = planTableChange(tables, { random });
      if (change.kind === 'final') {
        finalAt = remaining - 1;
        tables = [
          drawFinalTable(
            tables.flatMap((t) => t.seats.map((s) => s.playerId)),
            random,
          ),
        ];
        continue;
      }
      const move = planBalance(tables, { hostPlayerId: 'p1', random });
      if (move) {
        tables = tables.map((t) => {
          if (t.number === move.fromTable) return { ...t, seats: t.seats.filter((s) => s.playerId !== move.playerId) };
          if (t.number === move.toTable)
            return { ...t, seats: [...t.seats, { seat: move.toSeat, playerId: move.playerId }] };
          return t;
        });
      }
      const sizes = tables.map((t) => t.seats.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
    expect(finalAt).toBe(9);
    expect(tables).toHaveLength(1);
  });
});

describe('applyMoves', () => {
  it('move o jogador e mantém os lugares em ordem', () => {
    const result = applyMoves(
      [table(1, ['a', 'b', 'c']), table(2, ['x'])],
      [{ playerId: 'b', fromTable: 1, toTable: 2, toSeat: 2 }],
    );
    expect(result[0].seats.map((s) => s.playerId)).toEqual(['a', 'c']);
    expect(result[1].seats).toEqual([
      { seat: 1, playerId: 'x' },
      { seat: 2, playerId: 'b' },
    ]);
  });
  it('mesa desfeita some, e o dealer dela deixa de ser dealer', () => {
    const result = applyMoves(
      [table(1, ['a']), table(2, ['x'], 'x')],
      [{ playerId: 'x', fromTable: 2, toTable: 1, toSeat: 2 }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].dealerId).toBeNull();
  });
});

describe('seatBack e removeFromTables', () => {
  it('quem volta senta na mesa com menos gente', () => {
    const result = seatBack([table(1, ['a', 'b', 'c']), table(2, ['x', 'y'])], 'z');
    expect(result[1].seats.map((s) => s.playerId)).toEqual(['x', 'y', 'z']);
  });
  it('tirar o dealer da mesa limpa o dealer', () => {
    const result = removeFromTables([table(2, ['x', 'y'], 'x')], 'x');
    expect(result[0]).toMatchObject({ dealerId: null, seats: [{ seat: 2, playerId: 'y' }] });
  });
});

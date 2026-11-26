/**
 * Mesas do torneio: sorteio dos lugares, balanceamento, desfazer mesa e mesa final.
 * Funções puras: o sorteio recebe a função `random` (Math.random no app, uma fixa nos testes).
 */

export type Seat = { seat: number; playerId: string };

/** Uma mesa em jogo. `dealerId` = jogador que é o dealer (na mesa 1 é sempre o host, então fica null). */
export type SeatedTable = { number: number; seats: Seat[]; dealerId: string | null };

export type Random = () => number;

export const DEFAULT_MAX_SEATS = 9;

/** Tamanho de cada mesa: o mínimo de mesas que cabe, dividindo por igual (17 → [9, 8]; 16 → [8, 8]). */
export function tableSizes(players: number, maxSeats = DEFAULT_MAX_SEATS): number[] {
  if (players <= 0) return [];
  const tables = Math.ceil(players / maxSeats);
  const base = Math.floor(players / tables);
  const extra = players % tables;
  return Array.from({ length: tables }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Embaralha (Fisher–Yates) sem mexer na lista original. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sorteia os lugares. O host (se estiver jogando) vai para a mesa 1, que é a dele.
 * Cada mesa recebe os lugares 1, 2, 3... em ordem sorteada.
 */
export function drawSeats({
  playerIds,
  hostPlayerId,
  maxSeats = DEFAULT_MAX_SEATS,
  random,
}: {
  playerIds: string[];
  hostPlayerId: string | null;
  maxSeats?: number;
  random: Random;
}): SeatedTable[] {
  const sizes = tableSizes(playerIds.length, maxSeats);
  const hostPlays = hostPlayerId !== null && playerIds.includes(hostPlayerId);
  const others = shuffle(
    playerIds.filter((id) => !(hostPlays && id === hostPlayerId)),
    random,
  );
  let next = 0;
  return sizes.map((size, i) => {
    const members =
      i === 0 && hostPlays ? [hostPlayerId, ...others.slice(next, next + size - 1)] : others.slice(next, next + size);
    next += i === 0 && hostPlays ? size - 1 : size;
    const order = shuffle(members, random);
    return { number: i + 1, seats: order.map((playerId, s) => ({ seat: s + 1, playerId })), dealerId: null };
  });
}

/** Menor lugar livre da mesa (até `maxSeats`), ou null se está cheia. */
export function freeSeat(table: SeatedTable, maxSeats = DEFAULT_MAX_SEATS): number | null {
  const taken = new Set(table.seats.map((s) => s.seat));
  for (let seat = 1; seat <= maxSeats; seat++) if (!taken.has(seat)) return seat;
  return null;
}

export type Move = { playerId: string; fromTable: number; toTable: number; toSeat: number };

/** Quem pode trocar de mesa: ninguém que seja dealer nem o host. */
function movable(table: SeatedTable, hostPlayerId: string | null): string[] {
  return table.seats.map((s) => s.playerId).filter((id) => id !== table.dealerId && id !== hostPlayerId);
}

/**
 * Balanceamento: se a maior mesa tem 2 ou mais jogadores a mais que a menor, sorteia alguém da maior
 * (nunca o dealer nem o host) para o menor lugar livre da menor. null = está equilibrado.
 */
export function planBalance(
  tables: SeatedTable[],
  {
    hostPlayerId = null,
    maxSeats = DEFAULT_MAX_SEATS,
    random,
  }: { hostPlayerId?: string | null; maxSeats?: number; random: Random },
): Move | null {
  if (tables.length < 2) return null;
  const bySize = [...tables].sort((a, b) => a.seats.length - b.seats.length || a.number - b.number);
  const smallest = bySize[0];
  const largest = bySize[bySize.length - 1];
  if (largest.seats.length - smallest.seats.length < 2) return null;
  const candidates = movable(largest, hostPlayerId);
  const toSeat = freeSeat(smallest, maxSeats);
  if (candidates.length === 0 || toSeat === null) return null;
  const playerId = candidates[Math.floor(random() * candidates.length)];
  return { playerId, fromTable: largest.number, toTable: smallest.number, toSeat };
}

export type TableChange =
  | { kind: 'none' }
  /** Todos cabem numa mesa: junta e sorteia de novo na mesa 1. */
  | { kind: 'final' }
  /** Dá para ter uma mesa a menos: desfaz a mesa `table` e manda cada um para um lugar livre das outras. */
  | { kind: 'break'; table: number; moves: Move[] };

/**
 * Quando quem sobrou cabe em menos mesas, desfaz uma: a de número mais alto (a mesa 1 é a do host).
 * Os jogadores dela vão para as mesas com menos gente, um por vez, em ordem sorteada.
 */
export function planTableChange(
  tables: SeatedTable[],
  { maxSeats = DEFAULT_MAX_SEATS, random }: { maxSeats?: number; random: Random },
): TableChange {
  const remaining = tables.reduce((sum, t) => sum + t.seats.length, 0);
  if (tables.length < 2 || remaining > (tables.length - 1) * maxSeats) return { kind: 'none' };
  if (tables.length === 2 || remaining <= maxSeats) return { kind: 'final' };

  const broken = tables.reduce((a, b) => (b.number > a.number ? b : a));
  const others = tables.filter((t) => t.number !== broken.number).map((t) => ({ ...t, seats: [...t.seats] }));
  const moves: Move[] = [];
  for (const playerId of shuffle(
    broken.seats.map((s) => s.playerId),
    random,
  )) {
    const target = others.reduce((a, b) => (b.seats.length < a.seats.length ? b : a));
    const toSeat = freeSeat(target, maxSeats);
    if (toSeat === null) return { kind: 'none' };
    target.seats.push({ seat: toSeat, playerId });
    moves.push({ playerId, fromTable: broken.number, toTable: target.number, toSeat });
  }
  return { kind: 'break', table: broken.number, moves };
}

/** Mesa final: todos os que sobraram na mesa 1, lugares sorteados de novo. */
export function drawFinalTable(playerIds: string[], random: Random): SeatedTable {
  return {
    number: 1,
    seats: shuffle(playerIds, random).map((playerId, i) => ({ seat: i + 1, playerId })),
    dealerId: null,
  };
}

/** Gerador pseudoaleatório com semente (para testes e para repetir um sorteio). */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

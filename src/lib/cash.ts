/**
 * Contas do cash game. Ficha é dinheiro: o kit do cash tem o valor de cada cor em centavos,
 * então não existe conversão nem arredondamento — tudo é soma de inteiros.
 */
import type { Cents } from './money';

export type CashDenomination = { id: string; value: Cents };

export type CashPlayer = {
  /** id do jogador na lista do grupo (players.id) */
  playerId: string;
  name: string;
  /** tudo o que entrou: buy-in e rebuys, em centavos */
  buyins: Cents[];
  /** quantidade de fichas de cada cor na contagem final (denominationId → quantidade) */
  counts: Record<string, number>;
  /** ajustes da conferência que caem neste jogador (positivo: ele recebe mais) */
  adjustments: Cents[];
};

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export function paidIn(player: CashPlayer): Cents {
  return sum(player.buyins);
}

/** Valor em reais (centavos) das fichas contadas. Cor que não está no kit não vale nada. */
export function countedValue(counts: Record<string, number>, denominations: CashDenomination[]): Cents {
  return denominations.reduce((total, d) => total + (counts[d.id] ?? 0) * d.value, 0);
}

export type PlayerResult = {
  playerId: string;
  name: string;
  paidIn: Cents;
  counted: Cents;
  adjustment: Cents;
  /** quanto ganhou (positivo) ou perdeu (negativo) na noite */
  net: Cents;
};

export function playerResults(players: CashPlayer[], denominations: CashDenomination[]): PlayerResult[] {
  return players.map((p) => {
    const counted = countedValue(p.counts, denominations);
    const adjustment = sum(p.adjustments);
    const paid = paidIn(p);
    return { playerId: p.playerId, name: p.name, paidIn: paid, counted, adjustment, net: counted + adjustment - paid };
  });
}

export type Reconciliation = {
  /** tudo o que entrou na mesa */
  totalIn: Cents;
  /** tudo o que foi contado em fichas */
  totalCounted: Cents;
  /** soma dos ajustes registrados pelo host */
  totalAdjustments: Cents;
  /** contado + ajustes − entrou. Zero = bateu. Positivo = sobrou ficha; negativo = faltou. */
  difference: Cents;
  ok: boolean;
};

/** Conferência: as fichas contadas (com os ajustes) batem com o dinheiro que entrou? */
export function reconcile(players: CashPlayer[], denominations: CashDenomination[]): Reconciliation {
  const results = playerResults(players, denominations);
  const totalIn = sum(results.map((r) => r.paidIn));
  const totalCounted = sum(results.map((r) => r.counted));
  const totalAdjustments = sum(results.map((r) => r.adjustment));
  const difference = totalCounted + totalAdjustments - totalIn;
  return { totalIn, totalCounted, totalAdjustments, difference, ok: difference === 0 };
}

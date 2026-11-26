import type { Cents } from './money';

/**
 * Premiação do torneio. As porcentagens são inteiras e somam 100.
 * Padrão do grupo: um pouco mais de premiados que o comum (~40% do campo).
 */

/** Quantos premiados por padrão para um número de jogadores. */
export function defaultPrizePlaces(players: number): number {
  if (players <= 1) return 1;
  if (players <= 5) return 2;
  if (players <= 8) return 3;
  if (players <= 11) return 4;
  if (players <= 14) return 5;
  if (players <= 17) return 6;
  if (players <= 20) return 7;
  return 8;
}

/** Porcentagens prontas por número de premiados (1º, 2º, ...). Cada linha soma 100. */
const PERCENT_TABLE: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [40, 27, 19, 14],
  5: [36, 24, 17, 13, 10],
  6: [33, 22, 16, 12, 9, 8],
  7: [30, 20, 15, 12, 9, 7, 7],
  8: [28, 19, 14, 11, 9, 7, 6, 6],
};

/** Porcentagens para `places` premiados. Acima de 8, divide em partes decrescentes que somam 100. */
export function defaultPrizePercents(places: number): number[] {
  const table = PERCENT_TABLE[places];
  if (table) return [...table];
  // Pesos decrescentes (places, places-1, ..., 1), arredondados; a sobra vai para o 1º.
  const weights = Array.from({ length: places }, (_, i) => places - i);
  const total = weights.reduce((a, b) => a + b, 0);
  const percents = weights.map((w) => Math.floor((w * 100) / total));
  percents[0] += 100 - percents.reduce((a, b) => a + b, 0);
  return percents;
}

/** Erro em português se as porcentagens não servem, ou null. */
export function checkPrizePercents(percents: number[]): string | null {
  if (percents.length === 0) return 'Precisa ter pelo menos 1 premiado.';
  if (percents.some((p) => !Number.isInteger(p) || p <= 0)) return 'Cada porcentagem precisa ser um número inteiro maior que zero.';
  const sum = percents.reduce((a, b) => a + b, 0);
  if (sum !== 100) return `As porcentagens somam ${sum}%. Precisam somar 100%.`;
  for (let i = 1; i < percents.length; i++) {
    if (percents[i] > percents[i - 1]) return `O ${i + 1}º não pode ganhar mais que o ${i}º.`;
  }
  return null;
}

/**
 * Valor de cada prêmio a partir do total arrecadado. Arredonda para reais inteiros (para baixo)
 * e a sobra de centavos vai para o 1º, para a soma bater exatamente com o total.
 */
export function prizeAmounts(poolCents: Cents, percents: number[]): Cents[] {
  if (percents.length === 0) return [];
  const amounts = percents.map((p) => Math.floor((poolCents * p) / 100 / 100) * 100);
  amounts[0] += poolCents - amounts.reduce((a, b) => a + b, 0);
  return amounts;
}

/** Confere um acordo de mesa final: valores editados à mão precisam somar o total. */
export function checkPrizeDeal(poolCents: Cents, amounts: Cents[]): string | null {
  if (amounts.some((a) => !Number.isInteger(a) || a < 0)) return 'Os prêmios não podem ser negativos.';
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum !== poolCents) return 'A soma dos prêmios precisa ser igual ao total arrecadado.';
  return null;
}

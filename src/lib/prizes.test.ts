import { describe, expect, it } from '@jest/globals';

import { checkPrizeDeal, checkPrizePercents, defaultPrizePercents, defaultPrizePlaces, prizeAmounts } from './prizes';

describe('defaultPrizePlaces', () => {
  it.each([
    [4, 2],
    [5, 2],
    [8, 3],
    [9, 4],
    [14, 5],
    [15, 6],
    [20, 7],
    [24, 8],
  ])('%i jogadores → %i premiados', (players, places) => {
    expect(defaultPrizePlaces(players)).toBe(places);
  });
});

describe('defaultPrizePercents', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 12])('%i premiados somam 100 e vão diminuindo', (places) => {
    const percents = defaultPrizePercents(places);
    expect(percents).toHaveLength(places);
    expect(checkPrizePercents(percents)).toBeNull();
  });
});

describe('checkPrizePercents', () => {
  it('recusa soma diferente de 100', () => {
    expect(checkPrizePercents([60, 30])).toBe('As porcentagens somam 90%. Precisam somar 100%.');
  });
  it('recusa 2º ganhando mais que o 1º', () => {
    expect(checkPrizePercents([40, 60])).toBe('O 2º não pode ganhar mais que o 1º.');
  });
  it('recusa zero e número quebrado', () => {
    expect(checkPrizePercents([100, 0])).not.toBeNull();
    expect(checkPrizePercents([50.5, 49.5])).not.toBeNull();
  });
});

describe('prizeAmounts', () => {
  it('8 jogadores de R$ 50 com 3 rebuys: total R$ 550 em 50/30/20', () => {
    expect(prizeAmounts(55000, [50, 30, 20])).toEqual([27500, 16500, 11000]);
  });
  it('arredonda para reais e a sobra vai para o 1º, somando exato', () => {
    const amounts = prizeAmounts(33350, [40, 27, 19, 14]);
    expect(amounts.slice(1).every((a) => a % 100 === 0)).toBe(true);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(33350);
    expect(amounts).toEqual([13450, 9000, 6300, 4600]);
  });
});

describe('checkPrizeDeal', () => {
  it('aceita acordo que soma o total', () => {
    expect(checkPrizeDeal(30000, [12000, 12000, 6000])).toBeNull();
  });
  it('recusa acordo que não soma o total', () => {
    expect(checkPrizeDeal(30000, [15000, 15000, 1000])).toBe(
      'A soma dos prêmios precisa ser igual ao total arrecadado.',
    );
  });
});

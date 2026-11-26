import { describe, expect, it } from '@jest/globals';

import {
  checkStructure,
  distributeStack,
  generateStructure,
  levelNumbers,
  placeBreaks,
  stackTotal,
  stacksAvailable,
  structureMinutes,
  type StructureInput,
  type StructureLevel,
} from './structure';

const kit300 = [
  { color: 'Branca', value: 25, quantity: 100 },
  { color: 'Vermelha', value: 100, quantity: 100 },
  { color: 'Verde', value: 500, quantity: 50 },
  { color: 'Preta', value: 1000, quantity: 50 },
];

const kit500 = [
  { color: 'Branca', value: 25, quantity: 100 },
  { color: 'Vermelha', value: 100, quantity: 150 },
  { color: 'Verde', value: 500, quantity: 100 },
  { color: 'Preta', value: 1000, quantity: 100 },
  { color: 'Azul', value: 5000, quantity: 50 },
];

const base: StructureInput = {
  players: 8,
  kit: kit300,
  levelMinutes: 20,
  targetMinutes: 240,
  rebuy: { enabled: true, maxPerPlayer: null },
  addon: { enabled: true },
};

const blindsOnly = (levels: StructureLevel[]) =>
  levels.filter((l): l is Extract<StructureLevel, { kind: 'level' }> => l.kind === 'level');

describe('distributeStack', () => {
  it('fecha o valor exato sem passar do limite de cada cor', () => {
    const stack = distributeStack(kit300, [5, 5, 2, 2], 3000);
    expect(stack).not.toBeNull();
    expect(stackTotal(stack!)).toBe(3000);
    stack!.forEach((chip, i) => expect(chip.count).toBeLessThanOrEqual([5, 5, 2, 2][i]));
  });
  it('exige fichas pequenas para os primeiros blinds', () => {
    expect(distributeStack(kit300, [2, 2, 2, 2], 3000)).toBeNull();
  });
  it('não usa ficha que vale mais que 1/3 do stack', () => {
    const stack = distributeStack(kit500, [10, 10, 10, 10, 10], 5000);
    expect(stack?.find((c) => c.value === 5000)?.count).toBe(0);
  });
});

describe('generateStructure', () => {
  it('8 jogadores, kit de 300, 4 horas: stack que o kit monta para todos', () => {
    const s = generateStructure(base);
    expect(s.startingStack).toBe(stackTotal(s.stack));
    expect(s.startingStack).toBeGreaterThanOrEqual(2000);
    expect(stacksAvailable(kit300, s.stack)).toBeGreaterThanOrEqual(8 + 4 + 8);
    expect(s.warnings).toEqual([]);
  });

  it('começa com a menor ficha de small blind e os blinds só sobem', () => {
    const levels = blindsOnly(generateStructure(base).levels);
    expect(levels[0]).toMatchObject({ smallBlind: 25, bigBlind: 50 });
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].bigBlind).toBeGreaterThan(levels[i - 1].bigBlind);
      expect(levels[i].bigBlind).toBe(levels[i].smallBlind * 2);
    }
  });

  it('o small blind sempre dá para pagar com as fichas que ainda estão em jogo', () => {
    const s = generateStructure({ ...base, kit: kit500, players: 10 });
    let smallest = 25;
    for (const level of s.levels) {
      if (level.kind === 'break' && level.colorUp) {
        smallest = Number(/por \D+\((\d+)\)/.exec(level.colorUp)![1]);
      }
      if (level.kind === 'level') expect(level.smallBlind % smallest).toBe(0);
    }
  });

  it('dura perto do pedido (com 3 níveis de sobra no fim)', () => {
    const s = generateStructure(base);
    const extra = 3 * 20;
    const minutes = structureMinutes(s.levels) - extra;
    expect(minutes).toBeGreaterThanOrEqual(220);
    expect(minutes).toBeLessThanOrEqual(270);
  });

  it('intervalo do add-on logo depois do último nível de rebuy', () => {
    const s = generateStructure(base);
    expect(s.rebuyUntilLevel).toBe(3);
    const numbers = levelNumbers(s.levels);
    const at = numbers.indexOf(3);
    expect(s.levels[at + 1]).toMatchObject({ kind: 'break', addon: true });
  });

  it('sem rebuy e sem add-on, não tem período de rebuy', () => {
    const s = generateStructure({ ...base, rebuy: { enabled: false, maxPerPlayer: null }, addon: { enabled: false } });
    expect(s.rebuyUntilLevel).toBeNull();
    expect(s.levels.some((l) => l.kind === 'break' && l.addon)).toBe(false);
  });

  it('troca as fichas pequenas (color up) e sempre sobram pelo menos 2 cores', () => {
    const s = generateStructure({ ...base, kit: kit500, players: 10, targetMinutes: 360 });
    const colorUps = s.levels.filter((l) => l.kind === 'break' && l.colorUp);
    expect(colorUps.length).toBeGreaterThan(0);
    expect(colorUps.length).toBeLessThanOrEqual(kit500.length - 2);
  });

  it('avisa quando o kit não dá com rebuys e add-on', () => {
    const s = generateStructure({ ...base, kit: kit500, players: 14 });
    expect(s.startingStack).toBeGreaterThan(0);
    expect(s.warnings.join(' ')).toMatch(/pode não dar/);
  });

  it('avisa quando o kit não dá nem para os jogadores', () => {
    const s = generateStructure({ ...base, players: 40 });
    expect(s.levels).toEqual([]);
    expect(s.warnings).toEqual(['O kit não tem fichas suficientes para 40 jogadores.']);
  });
});

describe('checkStructure', () => {
  it('aceita a estrutura gerada', () => {
    expect(checkStructure(generateStructure(base).levels)).toEqual([]);
  });
  it('acha os problemas de uma estrutura editada', () => {
    const levels: StructureLevel[] = [
      { kind: 'level', smallBlind: 100, bigBlind: 50, ante: 0, minutes: 20 },
      { kind: 'break', minutes: 0, colorUp: null, addon: false },
    ];
    expect(checkStructure(levels)).toEqual([
      'Nível 1: o big blind não pode ser menor que o small.',
      'Intervalo: a duração precisa ser de 1 a 240 minutos.',
    ]);
  });
});

describe('placeBreaks', () => {
  const lvl = (bb: number, minutes = 20): StructureLevel => ({
    kind: 'level',
    smallBlind: bb / 2,
    bigBlind: bb,
    ante: 0,
    minutes,
  });
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => lvl(n * 100));
  const breakAfter = (l: StructureLevel[]) => {
    const numbers = levelNumbers(l);
    return l.flatMap((x, i) => (x.kind === 'break' ? [numbers[i - 1]] : []));
  };

  it('intervalo a cada 1h com níveis de 20 min: depois dos níveis 3, 6 e 9', () => {
    expect(breakAfter(placeBreaks(levels, 60, 10))).toEqual([3, 6, 9]);
  });
  it('a cada 2h: depois dos níveis 6; a cada 1h30: depois do 5 (100 min) e do 9 (180 min)', () => {
    expect(breakAfter(placeBreaks(levels, 120, 10))).toEqual([6]);
    expect(breakAfter(placeBreaks(levels, 90, 10))).toEqual([5, 9]);
  });
  it('troca os intervalos antigos, com a duração nova', () => {
    const old: StructureLevel[] = [lvl(100), { kind: 'break', minutes: 5, colorUp: null, addon: false }, ...levels];
    const result = placeBreaks(old, 60, 15);
    expect(breakAfter(result)).toEqual([3, 6, 9]);
    expect(result.filter((x) => x.kind === 'break').every((x) => x.minutes === 15)).toBe(true);
    expect(result.filter((x) => x.kind === 'level')).toHaveLength(11);
  });
  it('sem intervalo: só os níveis', () => {
    expect(placeBreaks(levels, null, 10)).toEqual(levels);
  });
  it('a troca de fichas vai para o primeiro intervalo novo depois do mesmo nível', () => {
    const old: StructureLevel[] = [
      ...levels.slice(0, 3),
      { kind: 'break', minutes: 10, colorUp: 'Trocar as brancas', addon: false },
      ...levels.slice(3),
    ];
    const result = placeBreaks(old, 120, 10);
    const breaks = result.filter((x) => x.kind === 'break');
    expect(breaks).toEqual([{ kind: 'break', minutes: 10, colorUp: 'Trocar as brancas', addon: false }]);
  });
  it('o gerador respeita o intervalo escolhido (sem intervalo, só o do add-on na 1ª hora)', () => {
    const every2h = generateStructure({ ...base, breakEveryMinutes: 120 });
    expect(breakAfter(every2h.levels).slice(0, 2)).toEqual([6, 12]); // rebuy e add-on até o 1º intervalo
    const none = generateStructure({ ...base, breakEveryMinutes: null });
    expect(breakAfter(none.levels)).toEqual([3]);
  });
});

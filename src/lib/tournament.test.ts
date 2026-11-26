import { describe, expect, it } from '@jest/globals';

import type { StructureLevel } from './structure';
import {
  canRebuyMore,
  checkKit,
  checkSettings,
  DEFAULT_SHOT_CLOCK,
  estimatedPool,
  markAddonBreak,
  rebuyOpen,
  type TournamentSettings,
} from './tournament';

const level = (bb: number): StructureLevel => ({
  kind: 'level',
  smallBlind: bb / 2,
  bigBlind: bb,
  ante: 0,
  minutes: 20,
});
const pause: StructureLevel = { kind: 'break', minutes: 10, colorUp: null, addon: false };

const settings: TournamentSettings = {
  players: 8,
  buyinCents: 5000,
  rebuy: { enabled: true, maxPerPlayer: null, untilLevel: 3 },
  addon: { enabled: true, cents: 5000, chips: 3000 },
  startingStack: 3000,
  stack: [],
  levelMinutes: 20,
  targetMinutes: 240,
  shotClock: DEFAULT_SHOT_CLOCK,
  prizePercents: [50, 30, 20],
};

describe('markAddonBreak', () => {
  const levels = [level(50), pause, level(100), level(200), level(300), pause, level(400), pause];
  const addonFlags = (l: StructureLevel[]) => l.map((x) => x.kind === 'break' && x.addon);

  it('marca o intervalo logo depois do último nível de rebuy', () => {
    expect(addonFlags(markAddonBreak(levels, 4, true))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });
  it('sem intervalo logo depois, cria um de 10 minutos (com insert)', () => {
    const marked = markAddonBreak(levels, 2, true, { insert: true });
    expect(marked).toHaveLength(levels.length + 1);
    expect(marked[3]).toMatchObject({ kind: 'break', minutes: 10, addon: true });
  });
  it('mudando o período, o intervalo criado sai do lugar antigo', () => {
    const first = markAddonBreak(levels, 2, true, { insert: true });
    const moved = markAddonBreak(first, 4, true, { insert: true });
    expect(moved).toHaveLength(levels.length);
    expect(addonFlags(moved)).toEqual([false, false, false, false, false, true, false, false]);
  });
  it('sem insert (estrutura salva), não cria intervalo', () => {
    expect(markAddonBreak(levels, 2, true)).toHaveLength(levels.length);
  });
  it('sem add-on, nenhum intervalo é do add-on', () => {
    expect(addonFlags(markAddonBreak(levels, 4, false)).some(Boolean)).toBe(false);
  });
});

describe('estimatedPool', () => {
  it('jogadores × buy-in', () => {
    expect(estimatedPool({ players: 8, buyinCents: 5000 })).toBe(40000);
  });
});

describe('checkSettings', () => {
  it('aceita a configuração padrão', () => {
    expect(checkSettings(settings, 12)).toEqual([]);
  });
  it('recusa período de rebuy fora da estrutura', () => {
    expect(checkSettings({ ...settings, rebuy: { ...settings.rebuy, untilLevel: 20 } }, 12)).toEqual([
      'O período de rebuy precisa terminar entre o nível 1 e o 12.',
    ]);
  });
  it('recusa add-on sem valor', () => {
    expect(checkSettings({ ...settings, addon: { enabled: true, cents: 0, chips: 3000 } }, 12)).toEqual([
      'Digite o valor e as fichas do add-on.',
    ]);
  });
});

describe('checkKit', () => {
  const kit = [
    { color: 'Branca', value: 25, quantity: 100 },
    { color: 'Vermelha', value: 100, quantity: 100 },
    { color: 'Verde', value: 500, quantity: 50 },
    { color: 'Preta', value: 1000, quantity: 50 },
  ];
  const stack = [
    { color: 'Branca', value: 25, count: 8 },
    { color: 'Vermelha', value: 100, count: 8 },
    { color: 'Verde', value: 500, count: 4 },
    { color: 'Preta', value: 1000, count: 2 },
  ];
  const withStack = { ...settings, stack, startingStack: 5000, addon: { enabled: true, cents: 5000, chips: 5000 } };

  it('8 jogadores com stack de 5.000: dá para todos, mas pode faltar com rebuys e add-on', () => {
    const result = checkKit(kit, withStack);
    expect(result.blocking).toBeNull();
    expect(result.warning).toMatch(/Pode faltar ficha: o kit monta 12 stacks/);
  });
  it('14 jogadores: não dá nem para o stack inicial', () => {
    expect(checkKit(kit, { ...withStack, players: 14 }).blocking).toMatch(/monta 12 stacks/);
  });
  it('sem rebuy e sem add-on, 8 jogadores cabem sem aviso', () => {
    const result = checkKit(kit, {
      ...withStack,
      rebuy: { enabled: false, maxPerPlayer: null, untilLevel: null },
      addon: { enabled: false, cents: 0, chips: 0 },
    });
    expect(result).toEqual({ blocking: null, warning: null });
  });
});

describe('rebuyOpen', () => {
  const levels = [level(50), level(100), pause, level(200)];
  const s = { rebuy: { enabled: true, maxPerPlayer: null, untilLevel: 2 } };
  it('antes de começar, aberto', () => expect(rebuyOpen(s, levels, null)).toBe(true));
  it('no último nível de rebuy, aberto', () => expect(rebuyOpen(s, levels, 2)).toBe(true));
  it('no intervalo do add-on, ainda aberto', () => expect(rebuyOpen(s, levels, 3)).toBe(true));
  it('no nível seguinte, fechado', () => expect(rebuyOpen(s, levels, 4)).toBe(false));
  it('sem rebuy, sempre fechado', () =>
    expect(rebuyOpen({ rebuy: { enabled: false, maxPerPlayer: null, untilLevel: 2 } }, levels, null)).toBe(false));
});

describe('canRebuyMore', () => {
  it('sem limite', () =>
    expect(canRebuyMore({ rebuy: { enabled: true, maxPerPlayer: null, untilLevel: 2 } }, 5)).toBe(true));
  it('com limite 1', () => {
    const s = { rebuy: { enabled: true, maxPerPlayer: 1, untilLevel: 2 } };
    expect(canRebuyMore(s, 0)).toBe(true);
    expect(canRebuyMore(s, 1)).toBe(false);
  });
});

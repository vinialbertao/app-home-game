import { describe, expect, it } from '@jest/globals';

import type { StructureLevel } from './structure';
import {
  checkSettings,
  DEFAULT_SHOT_CLOCK,
  estimatedPool,
  markAddonBreak,
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
  it('marca só o primeiro intervalo depois do último nível de rebuy', () => {
    const levels = [level(50), pause, level(100), level(200), level(300), pause, level(400), pause];
    const marked = markAddonBreak(levels, 3, true);
    expect(marked.map((l) => l.kind === 'break' && l.addon)).toEqual([
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
  it('sem add-on, nenhum intervalo é do add-on', () => {
    const marked = markAddonBreak([level(50), pause], 1, false);
    expect(marked[1]).toMatchObject({ addon: false });
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

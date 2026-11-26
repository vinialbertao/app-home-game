import type { Cents } from './money';
import { defaultPrizePercents, defaultPrizePlaces } from './prizes';
import { levelNumbers, type StackChip, type StructureLevel } from './structure';

/** Relógio da jogada (shot clock). Padrão da WSOP: 20 s antes do flop, 30 s depois, 6 time banks de 30 s. */
export type ShotClockSettings = {
  enabled: boolean;
  preflopSeconds: number;
  postflopSeconds: number;
  timeBanks: number;
  timeBankSeconds: number;
  fromLevel: number;
};

export const DEFAULT_SHOT_CLOCK: ShotClockSettings = {
  enabled: true,
  preflopSeconds: 20,
  postflopSeconds: 30,
  timeBanks: 6,
  timeBankSeconds: 30,
  fromLevel: 1,
};

/** Tudo que o torneio precisa além dos níveis. Fica em `structures.settings` (e é copiado para o jogo). */
export type TournamentSettings = {
  players: number;
  buyinCents: Cents;
  /** Rebuy = mesmo valor e mesmas fichas do buy-in. untilLevel = último nível com rebuy e entrada de atrasado. */
  rebuy: { enabled: boolean; maxPerPlayer: number | null; untilLevel: number | null };
  addon: { enabled: boolean; cents: Cents; chips: number };
  startingStack: number;
  stack: StackChip[];
  levelMinutes: number;
  targetMinutes: number;
  shotClock: ShotClockSettings;
  prizePercents: number[];
};

/** Estrutura completa em edição: configurações + níveis (com o intervalo do add-on marcado). */
export type TournamentDraft = { settings: TournamentSettings; levels: StructureLevel[] };

export function defaultPrizes(players: number): number[] {
  return defaultPrizePercents(defaultPrizePlaces(players));
}

/** Marca como "intervalo do add-on" o primeiro intervalo depois do último nível de rebuy. */
export function markAddonBreak(
  levels: StructureLevel[],
  untilLevel: number | null,
  addonEnabled: boolean,
): StructureLevel[] {
  const numbers = levelNumbers(levels);
  const at = untilLevel === null ? -1 : numbers.indexOf(untilLevel);
  let marked = false;
  return levels.map((level, i) => {
    if (level.kind !== 'break') return level;
    const isAddon = addonEnabled && !marked && at >= 0 && i > at;
    if (isAddon) marked = true;
    return { ...level, addon: isAddon };
  });
}

/** Arrecadação prevista só com os buy-ins (para mostrar os prêmios antes do torneio). */
export function estimatedPool(settings: Pick<TournamentSettings, 'players' | 'buyinCents'>): Cents {
  return settings.players * settings.buyinCents;
}

/** Problemas nas configurações (vazio = tudo certo). */
export function checkSettings(settings: TournamentSettings, levelCount: number): string[] {
  const problems: string[] = [];
  if (settings.players < 2) problems.push('O torneio precisa de pelo menos 2 jogadores.');
  if (settings.buyinCents <= 0) problems.push('Digite o valor do buy-in.');
  if (settings.startingStack <= 0) problems.push('O stack inicial precisa ser maior que zero.');
  if (settings.rebuy.enabled || settings.addon.enabled) {
    const until = settings.rebuy.untilLevel;
    if (until === null || until < 1 || until > levelCount) {
      problems.push(`O período de rebuy precisa terminar entre o nível 1 e o ${levelCount}.`);
    }
  }
  if (settings.rebuy.maxPerPlayer !== null && settings.rebuy.maxPerPlayer < 1) {
    problems.push('O máximo de rebuys por pessoa precisa ser 1 ou mais (ou sem limite).');
  }
  if (settings.addon.enabled && (settings.addon.cents <= 0 || settings.addon.chips <= 0)) {
    problems.push('Digite o valor e as fichas do add-on.');
  }
  const clock = settings.shotClock;
  if (clock.enabled) {
    if (clock.preflopSeconds < 5 || clock.postflopSeconds < 5)
      problems.push('O relógio da jogada precisa de pelo menos 5 segundos.');
    if (clock.timeBanks < 0 || clock.timeBankSeconds < 5)
      problems.push('Confira os time banks (quantidade e segundos).');
    if (clock.fromLevel < 1) problems.push('O relógio da jogada começa no nível 1 ou depois.');
  }
  return problems;
}

export type SetupInput = {
  players: number;
  buyinCents: Cents;
  rebuy: { enabled: boolean; maxPerPlayer: number | null };
  addon: { enabled: boolean; cents: Cents };
  levelMinutes: number;
  targetMinutes: number;
};

/** Junta o que o host digitou com a estrutura gerada, num rascunho pronto para editar. */
export function draftFromGenerated(
  input: SetupInput,
  generated: { startingStack: number; stack: StackChip[]; levels: StructureLevel[]; rebuyUntilLevel: number | null },
): TournamentDraft {
  return {
    levels: generated.levels,
    settings: {
      players: input.players,
      buyinCents: input.buyinCents,
      rebuy: { ...input.rebuy, untilLevel: generated.rebuyUntilLevel },
      addon: { enabled: input.addon.enabled, cents: input.addon.cents, chips: generated.startingStack },
      startingStack: generated.startingStack,
      stack: generated.stack,
      levelMinutes: input.levelMinutes,
      targetMinutes: input.targetMinutes,
      shotClock: { ...DEFAULT_SHOT_CLOCK },
      prizePercents: defaultPrizes(input.players),
    },
  };
}

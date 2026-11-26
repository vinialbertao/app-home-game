import type { Cents } from './money';
import { defaultPrizePercents, defaultPrizePlaces } from './prizes';
import {
  expectedRebuys,
  levelNumbers,
  stacksAvailable,
  type KitChip,
  type StackChip,
  type StructureLevel,
} from './structure';

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
  /** Intervalo a cada quantos minutos de jogo (null = sem intervalo) e quanto dura. Estruturas antigas não têm. */
  breaks?: BreakSettings;
  shotClock: ShotClockSettings;
  prizePercents: number[];
};

export type BreakSettings = { everyMinutes: number | null; minutes: number };

export const DEFAULT_BREAKS: BreakSettings = { everyMinutes: 60, minutes: 10 };

/** Estrutura completa em edição: configurações + níveis (com o intervalo do add-on marcado). */
export type TournamentDraft = { settings: TournamentSettings; levels: StructureLevel[] };

export function defaultPrizes(players: number): number[] {
  return defaultPrizePercents(defaultPrizePlaces(players));
}

/**
 * O add-on é no intervalo logo depois do último nível de rebuy (`untilLevel`).
 * Se não há intervalo ali e `insert` for true, cria um de 10 minutos. Intervalos que o app tinha criado
 * para o add-on num lugar antigo saem. Os outros intervalos nunca são do add-on.
 */
export function markAddonBreak(
  levels: StructureLevel[],
  untilLevel: number | null,
  addonEnabled: boolean,
  { insert = false }: { insert?: boolean } = {},
): StructureLevel[] {
  const cleaned = levels
    .filter((level) => !(level.kind === 'break' && level.addedForAddon))
    .map((level) => (level.kind === 'break' ? { ...level, addon: false } : level));
  if (!addonEnabled || untilLevel === null) return cleaned;

  const at = levelNumbers(cleaned).indexOf(untilLevel);
  if (at < 0) return cleaned;
  const next = cleaned[at + 1];
  if (next?.kind === 'break') {
    return cleaned.map((level, i) => (i === at + 1 ? { ...next, addon: true } : level));
  }
  if (!insert || at === cleaned.length - 1) return cleaned;
  return [
    ...cleaned.slice(0, at + 1),
    { kind: 'break', minutes: 10, colorUp: null, addon: true, addedForAddon: true },
    ...cleaned.slice(at + 1),
  ];
}

/**
 * Confere se o kit dá conta do torneio, sempre com os números atuais (jogadores, stack, rebuy, add-on).
 * `blocking`: não dá nem para o stack inicial de todo mundo (não deixa salvar).
 * `warning`: pode faltar ficha se metade pedir rebuy e quase todos fizerem add-on (pede confirmação).
 */
export function checkKit(
  kit: KitChip[],
  settings: TournamentSettings,
): { blocking: string | null; warning: string | null } {
  const available = stacksAvailable(kit, settings.stack);
  if (settings.stack.every((chip) => chip.count === 0) || available < settings.players) {
    return {
      blocking: `O kit monta ${available} stacks de ${settings.startingStack} e o torneio tem ${settings.players} jogadores. Diminua o stack ou os jogadores.`,
      warning: null,
    };
  }
  const rebuys = expectedRebuys(settings.players, settings.rebuy);
  const addonStacks =
    settings.addon.enabled && settings.startingStack > 0
      ? Math.ceil((settings.players * settings.addon.chips) / settings.startingStack)
      : 0;
  const needed = settings.players + rebuys + addonStacks;
  if (available < needed) {
    return {
      blocking: null,
      warning: `Pode faltar ficha: o kit monta ${available} stacks e, se metade pedir rebuy e todos fizerem add-on, são precisos ${needed}.`,
    };
  }
  return { blocking: null, warning: null };
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
  if (settings.breaks) {
    const { everyMinutes, minutes } = settings.breaks;
    if (everyMinutes !== null && (everyMinutes < 15 || everyMinutes > 600))
      problems.push('O intervalo precisa ser a cada 15 minutos a 10 horas.');
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120)
      problems.push('Cada intervalo dura de 1 a 120 minutos.');
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
  breaks?: BreakSettings;
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
      breaks: input.breaks ?? { ...DEFAULT_BREAKS },
      shotClock: { ...DEFAULT_SHOT_CLOCK },
      prizePercents: defaultPrizes(input.players),
    },
  };
}

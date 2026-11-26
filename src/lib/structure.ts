/**
 * Gerador da estrutura do torneio: stack inicial (quantas fichas de cada cor), níveis de blinds,
 * intervalos, troca de fichas pequenas (color up) e avisos sobre o kit.
 * Tudo em PONTOS (as fichas do kit do torneio), nunca em reais.
 */

export type KitChip = { color: string; value: number; quantity: number };

export type StackChip = { color: string; value: number; count: number };

export type StructureLevel =
  | { kind: 'level'; smallBlind: number; bigBlind: number; ante: number; minutes: number }
  | { kind: 'break'; minutes: number; colorUp: string | null; addon: boolean };

export type StructureInput = {
  players: number;
  kit: KitChip[];
  /** Minutos de cada nível (ex.: 20). */
  levelMinutes: number;
  /** Duração desejada do torneio inteiro, em minutos (ex.: 240). */
  targetMinutes: number;
  /** De quanto em quanto tempo tem intervalo (padrão 60 min) e quanto dura (padrão 10 min). */
  breakEveryMinutes?: number;
  breakMinutes?: number;
  rebuy: { enabled: boolean; maxPerPlayer: number | null };
  addon: { enabled: boolean };
};

export type Structure = {
  startingStack: number;
  stack: StackChip[];
  levels: StructureLevel[];
  /** Último nível com rebuy e entrada de atrasado (o add-on é no intervalo logo depois). null = sem rebuy. */
  rebuyUntilLevel: number | null;
  /** Total de fichas que o app espera em jogo (stacks + rebuys + add-ons previstos). */
  expectedChipsInPlay: number;
  warnings: string[];
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function sortChips<T extends { value: number }>(chips: T[]): T[] {
  return [...chips].sort((a, b) => a.value - b.value);
}

/** Quantos stacks iguais a este o kit consegue montar. */
export function stacksAvailable(kit: KitChip[], stack: StackChip[]): number {
  let result = Infinity;
  for (const chip of stack) {
    if (chip.count === 0) continue;
    const inKit = kit.find((k) => k.value === chip.value && k.color === chip.color)?.quantity ?? 0;
    result = Math.min(result, Math.floor(inKit / chip.count));
  }
  return result === Infinity ? 0 : result;
}

export function stackTotal(stack: StackChip[]): number {
  return stack.reduce((sum, chip) => sum + chip.value * chip.count, 0);
}

/**
 * Monta um stack de `total` pontos sem passar de `caps[i]` fichas de cada cor.
 * Exige pelo menos 4 da menor e 2 da segunda cor, prefere cerca de 10 e 8 (troco), e poucas grandes.
 * Devolve null se não dá para fechar o valor exato.
 */
export function distributeStack(chips: KitChip[], caps: number[], total: number): StackChip[] | null {
  const sorted = sortChips(chips);
  const unit = sorted.reduce((g, c) => gcd(g, c.value), 0);
  if (unit === 0 || total % unit !== 0) return null;
  const target = total / unit;
  const wanted = sorted.map((_, i) => (i === 0 ? 10 : i === 1 ? 8 : Math.max(2, 6 - i)));
  // Nenhuma ficha vale mais que 1/3 do stack: ninguém começa com uma ficha só de 5.000.
  const limits = sorted.map((chip, i) => (chip.value * 3 > total ? 0 : caps[i]));
  // Precisa de fichas pequenas para pagar os primeiros blinds e dar troco.
  const minimums = sorted.map((_, i) => (i === 0 ? 4 : i === 1 ? 2 : 0));

  // Programação dinâmica: menor "custo" (distância das quantidades desejadas) para cada soma.
  type Cell = { cost: number; counts: number[] } | null;
  let best: Cell[] = Array.from({ length: target + 1 }, () => null);
  best[0] = { cost: 0, counts: [] };
  sorted.forEach((chip, i) => {
    const step = chip.value / unit;
    const next: Cell[] = Array.from({ length: target + 1 }, () => null);
    for (let sum = 0; sum <= target; sum++) {
      const cell = best[sum];
      if (!cell) continue;
      for (let count = minimums[i]; count <= limits[i] && sum + count * step <= target; count++) {
        const cost = cell.cost + Math.abs(count - wanted[i]);
        const at = sum + count * step;
        const current = next[at];
        if (!current || cost < current.cost) next[at] = { cost, counts: [...cell.counts, count] };
      }
    }
    best = next;
  });

  const found = best[target];
  if (!found) return null;
  return sorted.map((chip, i) => ({ color: chip.color, value: chip.value, count: found.counts[i] }));
}

/** Rebuys previstos para planejar as fichas: metade dos jogadores (limitado pelo máximo por pessoa). */
export function expectedRebuys(players: number, rebuy: StructureInput['rebuy']): number {
  if (!rebuy.enabled) return 0;
  const perPlayer = rebuy.maxPerPlayer === null ? 1 : Math.min(rebuy.maxPerPlayer, 1);
  return Math.ceil(players * 0.5 * perPlayer);
}

/** Valores de big blind possíveis, em ordem: 2, 4, 6, 8, 10, 12, 16, 20, 24, 30... vezes a menor ficha / 2. */
function bigBlindLadder(smallestChip: number, max: number): number[] {
  const multipliers = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
  const values = new Set<number>();
  for (let exp = 0; exp < 8; exp++) {
    for (const m of multipliers) {
      const value = Math.round(2 * smallestChip * m * 10 ** exp);
      if (value <= max) values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

/** Escolhe o próximo big blind: maior que o anterior, small blind múltiplo da menor ficha em jogo. */
function pickBigBlind(ladder: number[], previous: number, target: number, minChip: number): number {
  const options = ladder.filter((bb) => bb > previous && (bb / 2) % minChip === 0);
  if (options.length === 0) return previous * 2;
  return options.reduce((best, bb) =>
    Math.abs(Math.log(bb / target)) < Math.abs(Math.log(best / target)) ? bb : best,
  );
}

export function generateStructure(input: StructureInput): Structure {
  const warnings: string[] = [];
  const kit = sortChips(input.kit.filter((c) => c.quantity > 0 && c.value > 0));
  const players = Math.max(2, Math.round(input.players));
  const breakEvery = input.breakEveryMinutes ?? 60;
  const breakMinutes = input.breakMinutes ?? 10;
  const levelMinutes = Math.max(1, Math.round(input.levelMinutes));

  if (kit.length < 2) {
    return {
      startingStack: 0,
      stack: [],
      levels: [],
      rebuyUntilLevel: null,
      expectedChipsInPlay: 0,
      warnings: ['Cadastre o kit do torneio com pelo menos 2 cores de ficha.'],
    };
  }

  // ---------- Stack inicial ----------
  const rebuys = expectedRebuys(players, input.rebuy);
  const addons = input.addon.enabled ? players : 0;
  const planned = players + rebuys + addons;
  const smallest = kit[0].value;

  const tryStacks = (entries: number): StackChip[] | null => {
    const caps = kit.map((c) => Math.min(20, Math.floor(c.quantity / entries)));
    const maxStack = kit.reduce((sum, c, i) => sum + c.value * caps[i], 0);
    // (o limite de 1/3 por ficha é aplicado dentro de distributeStack)
    const target = Math.min(200 * smallest, maxStack);
    for (const step of [40, 20, 10, 4, 1].map((m) => m * smallest)) {
      for (let total = Math.floor(target / step) * step; total >= target * 0.6 && total > 0; total -= step) {
        const stack = distributeStack(kit, caps, total);
        if (stack) return stack;
      }
    }
    return null;
  };

  let stack = tryStacks(planned);
  if (!stack) {
    stack = tryStacks(players);
    if (stack) {
      warnings.push(
        `Com rebuys e add-on o kit pode não dar: ele monta ${stacksAvailable(kit, stack)} stacks e podem ser precisos ${planned}.`,
      );
    }
  }
  if (!stack) {
    return {
      startingStack: 0,
      stack: [],
      levels: [],
      rebuyUntilLevel: null,
      expectedChipsInPlay: 0,
      warnings: [`O kit não tem fichas suficientes para ${players} jogadores.`],
    };
  }
  const startingStack = stackTotal(stack);
  if (startingStack < 40 * smallest) {
    warnings.push(`O stack ficou pequeno (${startingStack}): o torneio vai ser rápido. Um kit maior ajuda.`);
  }
  const available = stacksAvailable(kit, stack);
  if (available < planned && !warnings.length) {
    warnings.push(`O kit monta ${available} stacks e, com rebuys e add-on, podem ser precisos ${planned}.`);
  }

  // ---------- Níveis ----------
  const breaksCount = Math.floor(input.targetMinutes / (breakEvery + breakMinutes));
  const playMinutes = Math.max(levelMinutes * 4, input.targetMinutes - breaksCount * breakMinutes);
  const levelCount = Math.max(4, Math.round(playMinutes / levelMinutes));
  const levelsPerBreak = Math.max(1, Math.round(breakEvery / levelMinutes));
  // Mais 3 níveis depois da duração desejada, para o torneio não "acabar a estrutura" se demorar.
  const totalLevels = levelCount + 3;

  const expectedChipsInPlay = startingStack * (players + rebuys) + startingStack * Math.round(addons * 0.75);
  const firstBigBlind = 2 * smallest;
  const lastBigBlind = Math.max(firstBigBlind * 4, expectedChipsInPlay / 25);
  const ratio = Math.pow(lastBigBlind / firstBigBlind, 1 / Math.max(1, levelCount - 1));
  const ladder = bigBlindLadder(smallest, expectedChipsInPlay * 2);

  const rebuyUntilLevel = input.rebuy.enabled || input.addon.enabled ? Math.min(levelsPerBreak, levelCount - 1) : null;

  const levels: StructureLevel[] = [];
  let minChipIndex = 0;
  let previousBigBlind = 0;
  for (let i = 1; i <= totalLevels; i++) {
    const target = firstBigBlind * Math.pow(ratio, i - 1);
    const bigBlind =
      i === 1 ? firstBigBlind : pickBigBlind(ladder, previousBigBlind, target, kit[minChipIndex].value);
    levels.push({ kind: 'level', smallBlind: bigBlind / 2, bigBlind, ante: 0, minutes: levelMinutes });
    previousBigBlind = bigBlind;

    const isLast = i === totalLevels;
    const addonBreak = rebuyUntilLevel !== null && i === rebuyUntilLevel;
    const regularBreak = i % levelsPerBreak === 0;
    if (!isLast && (addonBreak || regularBreak)) {
      // Color up: some a menor ficha quando o próximo small blind já usa a próxima cor
      // (e pelo menos 4 fichas da menor). Sempre sobram pelo menos 2 cores.
      let colorUp: string | null = null;
      const nextTargetSmall = (firstBigBlind * Math.pow(ratio, i)) / 2;
      const current = kit[minChipIndex];
      const next = kit[minChipIndex + 1];
      if (next && minChipIndex < kit.length - 2 && nextTargetSmall >= Math.max(next.value, 4 * current.value)) {
        colorUp = `Trocar as fichas ${current.color} (${current.value}) por ${next.color} (${next.value})`;
        minChipIndex++;
      }
      levels.push({ kind: 'break', minutes: breakMinutes, colorUp, addon: addonBreak && input.addon.enabled });
    }
  }

  return { startingStack, stack, levels, rebuyUntilLevel, expectedChipsInPlay, warnings };
}

/** Minutos totais da estrutura (níveis + intervalos). */
export function structureMinutes(levels: StructureLevel[]): number {
  return levels.reduce((sum, level) => sum + level.minutes, 0);
}

/** Número do nível (1, 2, 3...) de cada posição; intervalos ficam com null. */
export function levelNumbers(levels: StructureLevel[]): (number | null)[] {
  let n = 0;
  return levels.map((level) => (level.kind === 'level' ? ++n : null));
}

/** Confere uma estrutura editada à mão. Devolve a lista de problemas (vazia = tudo certo). */
export function checkStructure(levels: StructureLevel[]): string[] {
  const problems: string[] = [];
  const numbers = levelNumbers(levels);
  if (!levels.some((l) => l.kind === 'level')) problems.push('Precisa ter pelo menos 1 nível.');
  levels.forEach((level, i) => {
    const name = level.kind === 'level' ? `Nível ${numbers[i]}` : 'Intervalo';
    if (!Number.isInteger(level.minutes) || level.minutes < 1 || level.minutes > 240) {
      problems.push(`${name}: a duração precisa ser de 1 a 240 minutos.`);
    }
    if (level.kind === 'level') {
      if (level.smallBlind <= 0 || level.bigBlind <= 0) problems.push(`${name}: os blinds precisam ser maiores que zero.`);
      else if (level.bigBlind < level.smallBlind) problems.push(`${name}: o big blind não pode ser menor que o small.`);
      if (level.ante < 0) problems.push(`${name}: o ante não pode ser negativo.`);
    }
  });
  return problems;
}

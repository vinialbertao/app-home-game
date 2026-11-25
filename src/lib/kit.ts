import { formatBRL, parseBRL } from './money';

/**
 * Kit de fichas. Cada grupo tem dois:
 * - cash: a ficha é dinheiro; o valor de cada cor está em CENTAVOS (R$ 0,50 = 50).
 * - tournament: o valor é em pontos (25, 100, 500...).
 */
export type KitKind = 'cash' | 'tournament';

export type Denomination = {
  color: string;
  value: number;
  quantity: number;
};

export type KitPreset = {
  id: string;
  label: string;
  denominations: Denomination[];
};

/** Sugestões prontas para as maletas mais comuns. A pessoa edita depois. */
export const KIT_PRESETS: Record<KitKind, KitPreset[]> = {
  cash: [
    {
      id: 'cash-300',
      label: 'Maleta de 300 fichas',
      denominations: [
        { color: 'Branca', value: 100, quantity: 100 },
        { color: 'Vermelha', value: 500, quantity: 100 },
        { color: 'Verde', value: 1000, quantity: 50 },
        { color: 'Preta', value: 2500, quantity: 50 },
      ],
    },
    {
      id: 'cash-500',
      label: 'Maleta de 500 fichas',
      denominations: [
        { color: 'Branca', value: 50, quantity: 100 },
        { color: 'Vermelha', value: 100, quantity: 150 },
        { color: 'Verde', value: 500, quantity: 100 },
        { color: 'Preta', value: 1000, quantity: 100 },
        { color: 'Azul', value: 2500, quantity: 50 },
      ],
    },
  ],
  tournament: [
    {
      id: 'tournament-300',
      label: 'Maleta de 300 fichas',
      denominations: [
        { color: 'Branca', value: 25, quantity: 100 },
        { color: 'Vermelha', value: 100, quantity: 100 },
        { color: 'Verde', value: 500, quantity: 50 },
        { color: 'Preta', value: 1000, quantity: 50 },
      ],
    },
    {
      id: 'tournament-500',
      label: 'Maleta de 500 fichas',
      denominations: [
        { color: 'Branca', value: 25, quantity: 150 },
        { color: 'Vermelha', value: 100, quantity: 150 },
        { color: 'Verde', value: 500, quantity: 100 },
        { color: 'Preta', value: 1000, quantity: 50 },
        { color: 'Azul', value: 5000, quantity: 50 },
      ],
    },
  ],
};

export function totalChips(denominations: Denomination[]): number {
  return denominations.reduce((sum, d) => sum + d.quantity, 0);
}

/** Soma de valor × quantidade (centavos no cash, pontos no torneio). */
export function totalValue(denominations: Denomination[]): number {
  return denominations.reduce((sum, d) => sum + d.value * d.quantity, 0);
}

/** Ordena do menor para o maior valor (a ordem em que aparece na tela). */
export function sortByValue<T extends Denomination>(denominations: T[]): T[] {
  return [...denominations].sort((a, b) => a.value - b.value);
}

/** Lê um número inteiro digitado ("1.000", "500") — null se não for inteiro positivo ou zero. */
export function parseWholeNumber(input: string): number | null {
  const cleaned = input.replace(/[.\s]/g, '');
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** "1000" → "1.000" (pontos, sem unidade) */
export function formatChipValue(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Valor de uma ficha para mostrar: "R$ 0,50" no cash, "1.000" no torneio. */
export function formatKitValue(value: number, kind: KitKind): string {
  return kind === 'cash' ? formatBRL(value) : formatChipValue(value);
}

/** Valor de uma ficha para o campo de edição: "0,50" no cash, "1000" no torneio. */
export function kitValueToInput(value: number, kind: KitKind): string {
  if (kind === 'tournament') return String(value);
  return formatBRL(value).replace('R$ ', '').replace(/\./g, '');
}

/** Lê o valor digitado de uma ficha: reais no cash ("0,50", "5"), pontos no torneio ("1.000"). */
export function parseKitValue(input: string, kind: KitKind): number | null {
  return kind === 'cash' ? parseBRL(input) : parseWholeNumber(input);
}

export type KitRowInput = { color: string; value: string; quantity: string };

export type KitValidation =
  | { ok: true; denominations: Denomination[] }
  | { ok: false; errors: string[] };

/** Confere as linhas digitadas na tela do kit. */
export function validateKitRows(rows: KitRowInput[], kind: KitKind): KitValidation {
  const errors: string[] = [];
  const denominations: Denomination[] = [];
  const seenColors = new Set<string>();
  const seenValues = new Set<number>();

  if (rows.length === 0) errors.push('Adicione pelo menos uma cor de ficha.');

  rows.forEach((row, index) => {
    const line = `Linha ${index + 1}`;
    const color = row.color.trim();
    const value = parseKitValue(row.value, kind);
    const quantity = parseWholeNumber(row.quantity);

    if (!color) errors.push(`${line}: falta a cor.`);
    else if (color.length > 30) errors.push(`${line}: nome da cor muito longo.`);
    else if (seenColors.has(color.toLowerCase())) errors.push(`${line}: a cor "${color}" está repetida.`);

    if (value === null || value <= 0) {
      errors.push(
        kind === 'cash'
          ? `${line}: o valor precisa ser em reais, como 0,50 ou 5.`
          : `${line}: o valor precisa ser um número inteiro maior que zero.`,
      );
    } else if (seenValues.has(value)) {
      errors.push(`${line}: já existe uma ficha de ${formatKitValue(value, kind)}.`);
    }

    if (quantity === null) errors.push(`${line}: a quantidade precisa ser um número inteiro.`);

    if (color && value !== null && value > 0 && quantity !== null) {
      seenColors.add(color.toLowerCase());
      seenValues.add(value);
      denominations.push({ color, value, quantity });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, denominations: sortByValue(denominations) };
}

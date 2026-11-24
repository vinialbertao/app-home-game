/**
 * Dinheiro no app é sempre um número inteiro de CENTAVOS (R$ 50,00 = 5000).
 * Nunca use número com vírgula para dinheiro: 0,1 + 0,2 não dá 0,3 em ponto flutuante,
 * e o acerto de contas não pode errar nem por um centavo.
 */
export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Valor em centavos inválido: ${value}`);
  }
}

/** 5000 → "R$ 50,00"; -1234567 → "-R$ 12.345,67". Formatação fixa, igual em todo aparelho. */
export function formatBRL(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = (abs % 100).toString().padStart(2, '0');
  return `${sign}R$ ${reais},${centavos}`;
}

/**
 * Lê o que a pessoa digitou ("50", "50,5", "1.234,56", "R$ 20") e devolve centavos.
 * Devolve null se não for um valor válido. Não aceita negativos nem mais de 2 casas.
 */
export function parseBRL(input: string): Cents | null {
  const cleaned = input.replace(/R\$/i, '').replace(/\s/g, '');
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(cleaned)) return null;
  const [intPart, decPart = ''] = cleaned.replace(/\./g, '').split(',');
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

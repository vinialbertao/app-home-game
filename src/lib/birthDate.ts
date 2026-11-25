/**
 * Data de nascimento: o app mostra e lê "DD/MM/AAAA" e guarda "AAAA-MM-DD" (ISO).
 * O banco também recusa menor de 18; aqui é para avisar na hora, antes de enviar.
 */
export const MIN_AGE = 18;

/** Vai formatando enquanto a pessoa digita: "25121990" → "25/12/1990". */
export function maskBirthDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "25/12/1990" → "1990-12-25"; null se não for uma data que existe. */
export function parseBirthDate(input: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Idade completa em `today` (as duas datas em "AAAA-MM-DD"). */
export function ageOn(birthIso: string, todayIso: string): number {
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Data de hoje no horário local, em "AAAA-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type BirthDateCheck =
  | { ok: true; iso: string }
  | { ok: false; error: string };

/** Valida o que foi digitado e devolve a data ISO ou a mensagem para mostrar. */
export function checkBirthDate(input: string, today: string = todayIso()): BirthDateCheck {
  const iso = parseBirthDate(input);
  if (!iso) return { ok: false, error: 'Digite a data no formato DD/MM/AAAA.' };
  if (iso > today) return { ok: false, error: 'Essa data ainda não chegou.' };
  if (ageOn(iso, today) < MIN_AGE) {
    return { ok: false, error: `O app é só para maiores de ${MIN_AGE} anos.` };
  }
  return { ok: true, iso };
}

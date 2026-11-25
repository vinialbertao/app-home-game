/** ID do jogador: "MF-" + 6 caracteres sem 0/O e 1/I (gerado no banco). */
const PLAYER_ID = /^MF-[A-HJ-NP-Z2-9]{6}$/;

/** Aceita "mf-7k4q2x", "7K4Q2X", " MF 7K4Q2X " → "MF-7K4Q2X"; null se não for um ID. */
export function normalizePlayerId(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '');
  const body = cleaned.startsWith('MF') ? cleaned.slice(2) : cleaned;
  const id = `MF-${body}`;
  return PLAYER_ID.test(id) ? id : null;
}

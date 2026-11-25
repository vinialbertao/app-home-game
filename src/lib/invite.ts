/**
 * Código de convite do grupo: 8 caracteres sem 0/O e 1/I (gerado no banco).
 * Mostrado como "ABCD-2345" para ficar fácil de ler e ditar.
 */
const INVITE_ALPHABET = /^[A-HJ-NP-Z2-9]{8}$/;

/** Limpa o que a pessoa colou ("abcd-2345", " ABCD 2345 ") → "ABCD2345", ou null se não for um código. */
export function normalizeInviteCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '');
  return INVITE_ALPHABET.test(cleaned) ? cleaned : null;
}

/** Procura um código dentro de um texto colado inteiro (a mensagem do WhatsApp, por exemplo). */
export function extractInviteCode(text: string): string | null {
  const direct = normalizeInviteCode(text);
  if (direct) return direct;
  // Pega o último candidato: na mensagem do convite o código vem no fim,
  // e o nome do grupo (antes) pode ter uma palavra de 8 letras parecida com um código.
  const matches = [...text.toUpperCase().matchAll(/\b([A-HJ-NP-Z2-9]{4})-?([A-HJ-NP-Z2-9]{4})\b/g)];
  const last = matches.at(-1);
  return last ? `${last[1]}${last[2]}` : null;
}

/** "ABCD2345" → "ABCD-2345" */
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Mensagem pronta para mandar no WhatsApp. */
export function buildInviteMessage(groupName: string, code: string): string {
  return [
    `Bora jogar! Você foi convidado para o grupo "${groupName}" no Mesa Final HG.`,
    '',
    `No app, toque em "Entrar com código" e use: ${formatInviteCode(code)}`,
  ].join('\n');
}

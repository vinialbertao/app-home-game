import type { TournamentDraft } from '@/lib/tournament';

/**
 * Rascunho da estrutura entre a tela de editar e a de escolher os jogadores.
 * Fica só na memória do app (não é dado do servidor): se o app fechar, volta para a tela da estrutura.
 */
let pending: { groupId: string; name: string; draft: TournamentDraft } | null = null;

export function setPendingTournament(value: { groupId: string; name: string; draft: TournamentDraft }) {
  pending = value;
}

export function getPendingTournament(groupId: string) {
  return pending && pending.groupId === groupId ? pending : null;
}

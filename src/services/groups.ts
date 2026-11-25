import { useMutation, useQuery } from '@tanstack/react-query';

import { normalizeInviteCode } from '@/lib/invite';

import { queryClient, queryKeys } from './queryClient';
import { useUserId } from './session';
import { getSupabase } from './supabase';

export type GroupRole = 'admin' | 'member';

export type MyGroup = {
  id: string;
  name: string;
  inviteCode: string;
  role: GroupRole;
  playerCount: number;
};

export type GroupDetails = {
  id: string;
  name: string;
  inviteCode: string;
  cashKitId: string | null;
  tournamentKitId: string | null;
  role: GroupRole;
};

/** Mensagens de erro das funções do banco, em português para a tela. */
function rpcErrorMessage(error: { message?: string } | null, fallback: string): string {
  const message = error?.message ?? '';
  if (message.includes('Convite inválido')) return 'Código não encontrado. Confira e tente de novo.';
  if (message.includes('Removido do grupo')) {
    return 'Você foi removido deste grupo. Só o admin pode te trazer de volta.';
  }
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'Sem conexão com o servidor. Confira a internet.';
  }
  return fallback;
}

/** Grupos de que eu participo, com meu papel e o número de jogadores ativos. */
export function useMyGroups() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myGroups,
    queryFn: async (): Promise<MyGroup[]> => {
      const { data, error } = await getSupabase()
        .from('groups')
        .select('id, name, invite_code, group_members!inner(role, user_id), players(count)')
        .eq('group_members.user_id', userId)
        .eq('players.active', true)
        .order('name');
      if (error) throw error;
      return data.map((g) => ({
        id: g.id,
        name: g.name,
        inviteCode: g.invite_code,
        role: (g.group_members[0]?.role ?? 'member') as GroupRole,
        playerCount: g.players[0]?.count ?? 0,
      }));
    },
  });
}

export function useGroup(groupId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.group(groupId),
    queryFn: async (): Promise<GroupDetails> => {
      const { data, error } = await getSupabase()
        .from('groups')
        .select('id, name, invite_code, default_cash_kit_id, default_tournament_kit_id, group_members!inner(role, user_id)')
        .eq('id', groupId)
        .eq('group_members.user_id', userId)
        .single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        inviteCode: data.invite_code,
        cashKitId: data.default_cash_kit_id,
        tournamentKitId: data.default_tournament_kit_id,
        role: (data.group_members[0]?.role ?? 'member') as GroupRole,
      };
    },
  });
}

export function useCreateGroup() {
  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      const { data, error } = await getSupabase().rpc('create_group', { p_name: name.trim() });
      if (error) throw new Error(rpcErrorMessage(error, 'Não foi possível criar o grupo.'));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myGroups }),
  });
}

export function useJoinGroup() {
  return useMutation({
    mutationFn: async (code: string): Promise<string> => {
      const normalized = normalizeInviteCode(code);
      if (!normalized) throw new Error('O código tem 8 letras e números, como K7MQ-2XPA.');
      const { data, error } = await getSupabase().rpc('join_group', { p_invite_code: normalized });
      if (error) throw new Error(rpcErrorMessage(error, 'Não foi possível entrar no grupo.'));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myGroups }),
  });
}

export function useRenameGroup(groupId: string) {
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await getSupabase().from('groups').update({ name: name.trim() }).eq('id', groupId);
      if (error) throw new Error('Não foi possível renomear o grupo.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups });
    },
  });
}

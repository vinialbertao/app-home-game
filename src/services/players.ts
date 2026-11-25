import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient, queryKeys } from './queryClient';
import { getSupabase } from './supabase';

export type Player = {
  id: string;
  name: string;
  pixKey: string | null;
  active: boolean;
  profileId: string | null;
  /** ID do jogador (MF-...) da conta vinculada, se houver */
  publicId: string | null;
};

export type Member = {
  userId: string;
  role: 'admin' | 'member';
  displayName: string;
  publicId: string;
  avatarUrl: string | null;
};

export type FoundProfile = {
  id: string;
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
};

function invalidatePlayers(groupId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.players(groupId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.myGroups });
}

/** Lista de jogadores do grupo (ativos primeiro, depois por nome). */
export function usePlayers(groupId: string) {
  return useQuery({
    queryKey: queryKeys.players(groupId),
    queryFn: async (): Promise<Player[]> => {
      const { data, error } = await getSupabase()
        .from('players')
        .select('id, name, pix_key, active, profile_id, profiles(public_id)')
        .eq('group_id', groupId)
        .order('active', { ascending: false })
        .order('name');
      if (error) throw error;
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        pixKey: p.pix_key,
        active: p.active,
        profileId: p.profile_id,
        publicId: p.profiles?.public_id ?? null,
      }));
    },
  });
}

/** Quem tem conta e entrou no grupo (pelo convite ou criando). */
export function useMembers(groupId: string) {
  return useQuery({
    queryKey: queryKeys.members(groupId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await getSupabase()
        .from('group_members')
        .select('user_id, role, profiles(display_name, public_id, avatar_url)')
        .eq('group_id', groupId);
      if (error) throw error;
      return data
        .filter((m) => m.profiles)
        .map((m) => ({
          userId: m.user_id,
          role: m.role as Member['role'],
          displayName: m.profiles!.display_name,
          publicId: m.profiles!.public_id,
          avatarUrl: m.profiles!.avatar_url,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
    },
  });
}

type PlayerInput = { name: string; pixKey?: string | null; profileId?: string | null };

export function useAddPlayer(groupId: string) {
  return useMutation({
    mutationFn: async (input: PlayerInput) => {
      const { error } = await getSupabase()
        .from('players')
        .insert({
          group_id: groupId,
          name: input.name.trim(),
          pix_key: input.pixKey?.trim() || null,
          profile_id: input.profileId ?? null,
        });
      if (error) {
        if (error.code === '23505') throw new Error('Essa conta já está ligada a outro nome da lista.');
        throw new Error('Não foi possível adicionar o jogador.');
      }
    },
    onSuccess: () => invalidatePlayers(groupId),
  });
}

type PlayerUpdate = { name?: string; pixKey?: string | null; profileId?: string | null; active?: boolean };

export function useUpdatePlayer(groupId: string) {
  return useMutation({
    mutationFn: async ({ playerId, changes }: { playerId: string; changes: PlayerUpdate }) => {
      const update: { name?: string; pix_key?: string | null; profile_id?: string | null; active?: boolean } = {};
      if (changes.name !== undefined) update.name = changes.name.trim();
      if (changes.pixKey !== undefined) update.pix_key = changes.pixKey?.trim() || null;
      if (changes.profileId !== undefined) update.profile_id = changes.profileId;
      if (changes.active !== undefined) update.active = changes.active;

      const { data, error } = await getSupabase()
        .from('players')
        .update(update)
        .eq('id', playerId)
        .select('id');
      if (error) {
        if (error.code === '23505') throw new Error('Essa conta já está ligada a outro nome da lista.');
        throw new Error('Não foi possível salvar.');
      }
      if (!data || data.length === 0) throw new Error('Só o admin do grupo pode editar a lista.');
    },
    onSuccess: () => invalidatePlayers(groupId),
  });
}

/**
 * Tira o jogador da lista. Se ele já jogou alguma partida, o histórico precisa dele:
 * então ele só fica inativo (some da lista de quem joga, mas continua no histórico).
 */
export function useRemovePlayer(groupId: string) {
  return useMutation({
    mutationFn: async (playerId: string): Promise<'deleted' | 'deactivated'> => {
      const supabase = getSupabase();
      const { error } = await supabase.from('players').delete().eq('id', playerId);
      if (!error) return 'deleted';
      if (error.code === '23503') {
        const { error: updateError } = await supabase.from('players').update({ active: false }).eq('id', playerId);
        if (updateError) throw new Error('Não foi possível remover o jogador.');
        return 'deactivated';
      }
      throw new Error('Não foi possível remover o jogador.');
    },
    onSuccess: () => invalidatePlayers(groupId),
  });
}

/** Acha uma conta pelo ID do jogador (MF-XXXXXX). */
export async function findProfileByPublicId(publicId: string): Promise<FoundProfile | null> {
  const { data, error } = await getSupabase().rpc('find_profile_by_public_id', { p_public_id: publicId });
  if (error) throw new Error('Não foi possível buscar agora. Tente de novo.');
  const row = data?.[0];
  return row
    ? { id: row.id, publicId: row.public_id, displayName: row.display_name, avatarUrl: row.avatar_url }
    : null;
}

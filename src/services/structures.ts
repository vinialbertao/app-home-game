import { useMutation, useQuery } from '@tanstack/react-query';

import type { StructureLevel } from '@/lib/structure';
import { markAddonBreak, type TournamentDraft, type TournamentSettings } from '@/lib/tournament';

import type { Json } from './database.types';
import { queryClient, queryKeys } from './queryClient';
import { getSupabase } from './supabase';

export type SavedStructure = TournamentDraft & { id: string; name: string; updatedAt: string };

type LevelRow = {
  position: number;
  is_break: boolean;
  small_blind: number | null;
  big_blind: number | null;
  ante: number;
  duration_minutes: number;
  color_up: string | null;
};

function fromRows(rows: LevelRow[], settings: TournamentSettings): StructureLevel[] {
  const levels = [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row): StructureLevel =>
      row.is_break
        ? { kind: 'break', minutes: row.duration_minutes, colorUp: row.color_up, addon: false }
        : {
            kind: 'level',
            smallBlind: row.small_blind ?? 0,
            bigBlind: row.big_blind ?? 0,
            ante: row.ante,
            minutes: row.duration_minutes,
          },
    );
  return markAddonBreak(levels, settings.rebuy.untilLevel, settings.addon.enabled);
}

function toRows(structureId: string, levels: StructureLevel[]) {
  return levels.map((level, i) => ({
    structure_id: structureId,
    position: i + 1,
    is_break: level.kind === 'break',
    small_blind: level.kind === 'level' ? level.smallBlind : null,
    big_blind: level.kind === 'level' ? level.bigBlind : null,
    ante: level.kind === 'level' ? level.ante : 0,
    duration_minutes: level.minutes,
    color_up: level.kind === 'break' ? level.colorUp : null,
  }));
}

/** Estruturas de torneio salvas pelo grupo (as mais recentes primeiro). */
export function useGroupStructures(groupId: string) {
  return useQuery({
    queryKey: queryKeys.structures(groupId),
    queryFn: async (): Promise<SavedStructure[]> => {
      const { data, error } = await getSupabase()
        .from('structures')
        .select(
          'id, name, settings, updated_at, levels(position, is_break, small_blind, big_blind, ante, duration_minutes, color_up)',
        )
        .eq('group_id', groupId)
        .eq('is_saved', true)
        .order('updated_at', { ascending: false });
      if (error) throw new Error('Não foi possível carregar as estruturas salvas.');
      return data.map((row) => {
        const settings = row.settings as unknown as TournamentSettings;
        return {
          id: row.id,
          name: row.name,
          updatedAt: row.updated_at,
          settings,
          levels: fromRows(row.levels, settings),
        };
      });
    },
  });
}

/**
 * Salva a estrutura no grupo. Com `id`, atualiza a existente (troca os níveis); sem `id`, cria uma nova.
 * Devolve o id. `saved` = aparece na lista "Estruturas do grupo" (as dos jogos ficam escondidas).
 */
export function useSaveStructure(groupId: string) {
  return useMutation({
    mutationFn: async ({
      id,
      name,
      draft,
      saved = true,
    }: {
      id?: string | null;
      name: string;
      draft: TournamentDraft;
      saved?: boolean;
    }): Promise<string> => {
      const supabase = getSupabase();
      const settings = draft.settings as unknown as Json;
      let structureId = id ?? null;
      if (structureId) {
        const { data, error } = await supabase
          .from('structures')
          .update({ name: name.trim(), settings, is_saved: saved })
          .eq('id', structureId)
          .select('id');
        if (error || !data?.length) throw new Error('Só quem criou a estrutura (ou o admin) pode mudar ela.');
        const { error: deleteError } = await supabase.from('levels').delete().eq('structure_id', structureId);
        if (deleteError) throw new Error('Não foi possível salvar os níveis.');
      } else {
        const { data, error } = await supabase
          .from('structures')
          .insert({ group_id: groupId, name: name.trim(), settings, is_saved: saved })
          .select('id')
          .single();
        if (error) throw new Error('Não foi possível salvar a estrutura.');
        structureId = data.id;
      }
      const { error: levelsError } = await supabase.from('levels').insert(toRows(structureId, draft.levels));
      if (levelsError) throw new Error('Não foi possível salvar os níveis.');
      return structureId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.structures(groupId) }),
  });
}

export function useDeleteStructure(groupId: string) {
  return useMutation({
    mutationFn: async (structureId: string) => {
      const { data, error } = await getSupabase().from('structures').delete().eq('id', structureId).select('id');
      if (error) throw new Error('Essa estrutura já foi usada num torneio e não pode ser apagada.');
      if (!data?.length) throw new Error('Só quem criou a estrutura (ou o admin) pode apagar.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.structures(groupId) }),
  });
}

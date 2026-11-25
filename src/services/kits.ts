import { useMutation, useQuery } from '@tanstack/react-query';

import { sortByValue, type Denomination, type KitKind } from '@/lib/kit';

import { queryClient, queryKeys } from './queryClient';
import { getSupabase } from './supabase';

export type StoredDenomination = Denomination & { id: string };

export type GroupKit = {
  id: string;
  name: string;
  kind: KitKind;
  denominations: StoredDenomination[];
};

/** Busca um kit com as fichas (null se o grupo ainda não tem esse kit). */
export async function fetchKit(kitId: string): Promise<GroupKit> {
  const { data, error } = await getSupabase()
    .from('chip_kits')
    .select('id, name, kind, chip_denominations(id, color, value, quantity)')
    .eq('id', kitId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    kind: data.kind as KitKind,
    denominations: sortByValue(data.chip_denominations),
  };
}

/** Kit padrão do grupo de um tipo (cash ou torneio). `kitId` undefined = grupo ainda carregando. */
export function useGroupKit(groupId: string, kind: KitKind, kitId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.kits(groupId), kind, kitId ?? 'none'],
    enabled: kitId !== undefined,
    queryFn: async (): Promise<GroupKit | null> => (kitId ? fetchKit(kitId) : null),
  });
}

/**
 * Salva o kit padrão do grupo (cash ou torneio): cria o kit se ainda não existe e troca as fichas
 * pelas da tela (atualiza as que mudaram, cria as novas, apaga as que saíram).
 */
export function useSaveGroupKit(groupId: string, kind: KitKind) {
  return useMutation({
    mutationFn: async ({ current, denominations }: { current: GroupKit | null; denominations: Denomination[] }) => {
      const supabase = getSupabase();
      let kitId = current?.id ?? null;

      if (!kitId) {
        const { data: user } = await supabase.auth.getUser();
        const { data: kit, error } = await supabase
          .from('chip_kits')
          .insert({
            group_id: groupId,
            name: kind === 'cash' ? 'Kit do cash' : 'Kit do torneio',
            kind,
            created_by: user.user?.id,
          })
          .select('id')
          .single();
        if (error) throw new Error('Não foi possível criar o kit.');
        kitId = kit.id;
        const link = kind === 'cash' ? { default_cash_kit_id: kitId } : { default_tournament_kit_id: kitId };
        const { error: linkError } = await supabase.from('groups').update(link).eq('id', groupId);
        if (linkError) throw new Error('Não foi possível definir o kit do grupo.');
      }

      const existing = current?.denominations ?? [];
      const byColor = new Map(existing.map((d) => [d.color.toLowerCase(), d]));
      const keepIds = new Set<string>();
      for (const d of denominations) {
        const match = byColor.get(d.color.toLowerCase());
        if (match) keepIds.add(match.id);
      }

      // Apaga primeiro as que saíram, para não bater no "cor única por kit"
      const toDelete = existing.filter((d) => !keepIds.has(d.id)).map((d) => d.id);
      if (toDelete.length > 0) {
        const { error } = await supabase.from('chip_denominations').delete().in('id', toDelete);
        if (error) {
          if (error.code === '23503') {
            throw new Error('Uma das cores removidas já foi usada numa contagem de jogo e não pode sair do kit.');
          }
          throw new Error('Não foi possível salvar o kit.');
        }
      }

      for (const [position, d] of denominations.entries()) {
        const match = byColor.get(d.color.toLowerCase());
        const { error } = match
          ? await supabase
              .from('chip_denominations')
              .update({ color: d.color, value: d.value, quantity: d.quantity, position })
              .eq('id', match.id)
          : await supabase
              .from('chip_denominations')
              .insert({ kit_id: kitId, color: d.color, value: d.value, quantity: d.quantity, position });
        if (error) throw new Error('Não foi possível salvar o kit.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kits(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });
}

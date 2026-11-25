import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient, queryKeys } from './queryClient';
import { useUserId } from './session';
import { getSupabase } from './supabase';

/** Colunas públicas do perfil. Nunca select('*'): a data de nascimento é privada. */
export const PROFILE_COLUMNS = 'id, public_id, display_name, avatar_url, pix_key' as const;

export type MyProfile = {
  id: string;
  public_id: string;
  display_name: string;
  avatar_url: string | null;
  pix_key: string | null;
};

export function useMyProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

type ProfileUpdate = { displayName?: string; pixKey?: string | null };

export function useUpdateMyProfile() {
  const userId = useUserId();
  return useMutation({
    mutationFn: async (changes: ProfileUpdate) => {
      const update: { display_name?: string; pix_key?: string | null } = {};
      if (changes.displayName !== undefined) update.display_name = changes.displayName.trim();
      if (changes.pixKey !== undefined) update.pix_key = changes.pixKey?.trim() || null;
      const { error } = await getSupabase().from('profiles').update(update).eq('id', userId);
      if (error) throw new Error('Não foi possível salvar.');
    },
    onSuccess: invalidateProfileEverywhere,
  });
}

/**
 * Troca a foto: envia para o Storage em avatars/<id da conta>/avatar e guarda o link no perfil.
 * O "?v=" no link força os celulares a baixarem a foto nova em vez da antiga guardada.
 */
export function useUploadAvatar() {
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ uri, mimeType }: { uri: string; mimeType?: string | null }) => {
      const supabase = getSupabase();
      const contentType = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
      const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/avatar.${extension}`;

      const body = await fetch(uri).then((response) => response.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, body, { contentType, upsert: true });
      if (uploadError) throw new Error('Não foi possível enviar a foto. Tente uma imagem menor.');

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
      if (error) throw new Error('Não foi possível salvar a foto.');
    },
    onSuccess: invalidateProfileEverywhere,
  });
}

function invalidateProfileEverywhere() {
  queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
  // nome e foto aparecem também nas listas dos grupos
  queryClient.invalidateQueries({ queryKey: ['members'] });
  queryClient.invalidateQueries({ queryKey: ['players'] });
}

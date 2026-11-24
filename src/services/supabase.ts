// Guarda a sessão de login no celular (expo-sqlite), para não precisar logar toda vez.
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { env, isSupabaseConfigured } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

let client: AppSupabaseClient | null = null;

/**
 * Cliente único do Supabase. Dá erro claro se o .env não estiver preenchido.
 * Docs: https://docs.expo.dev/guides/using-supabase/
 */
export function getSupabase(): AppSupabaseClient {
  if (client) return client;
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado: crie o arquivo .env com EXPO_PUBLIC_SUPABASE_URL e ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (modelo em .env.example) e reinicie o npx expo start.',
    );
  }

  client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // No celular, só renova o login enquanto o app está aberto na tela
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }

  return client;
}

export type ServerStatus = 'connected' | 'not-configured' | 'offline';

/**
 * Confere se o app fala com o banco, sem precisar de login: chama o painel com um
 * código que não existe. Resposta vazia = banco no ar e chave aceita.
 */
export async function checkServerConnection(): Promise<ServerStatus> {
  if (!isSupabaseConfigured()) return 'not-configured';
  try {
    const { error } = await getSupabase().rpc('get_panel', { p_code: 'TESTE0' });
    return error ? 'offline' : 'connected';
  } catch {
    return 'offline';
  }
}

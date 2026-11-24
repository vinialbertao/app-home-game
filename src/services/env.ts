/**
 * Configuração vinda do arquivo .env (fora do GitHub; modelo em .env.example).
 * O cliente do Supabase entra aqui em src/services/ na Fase 2.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabasePublishableKey.length > 0;
}

import { Redirect } from 'expo-router';

/**
 * Porta de entrada. Na Fase 3 decide entre Login e Meus grupos conforme a sessão do Supabase;
 * por enquanto sempre manda para o Login.
 */
export default function Index() {
  return <Redirect href="/login" />;
}

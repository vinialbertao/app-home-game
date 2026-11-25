import { authErrorMessage, normalizeEmail } from '@/lib/authForm';

import { queryClient } from './queryClient';
import { getSupabase } from './supabase';

/** Resultado simples para as telas: ok, ou a mensagem de erro já em português. */
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<ActionResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e as Error) };
  }
}

type SignUpInput = {
  displayName: string;
  birthDateIso: string;
  email: string;
  password: string;
};

/** Cria a conta. O banco cria o perfil com o ID do jogador (trigger) e recusa menor de 18. */
export async function signUp(input: SignUpInput): Promise<ActionResult> {
  try {
    const { data, error } = await getSupabase().auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password,
      options: {
        data: { display_name: input.displayName.trim(), birth_date: input.birthDateIso },
      },
    });
    if (error) return { ok: false, error: authErrorMessage(error) };
    if (!data.session) {
      // Só acontece se a confirmação de e-mail estiver ligada no Supabase
      return {
        ok: false,
        error: 'Conta criada, mas falta confirmar o e-mail. Abra o link que chegou no seu e-mail e depois entre.',
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e as Error) };
  }
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
  queryClient.clear();
}

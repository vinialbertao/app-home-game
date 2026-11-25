import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { isSupabaseConfigured } from './env';
import { getSupabase } from './supabase';

type SessionState = {
  session: Session | null;
  /** true enquanto o app ainda está lendo o login guardado no celular */
  isLoading: boolean;
};

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

/** Lê o login guardado e acompanha entrar/sair. Envolve o app inteiro (src/app/_layout.tsx). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() => ({
    session: null,
    isLoading: isSupabaseConfigured(),
  }));

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, isLoading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, isLoading: false });
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, isLoading: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** id da conta logada. Use só em telas protegidas (lá sempre existe sessão). */
export function useUserId(): string {
  const { session } = useSession();
  if (!session) throw new Error('useUserId usado fora de uma tela protegida');
  return session.user.id;
}

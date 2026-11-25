import { Redirect } from 'expo-router';

import { useSession } from '@/services/session';

/** Porta de entrada: logado vai para a tela inicial; sem login vai para o Login. */
export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? '/groups' : '/login'} />;
}

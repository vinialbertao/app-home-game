import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { queryClient } from '@/services/queryClient';
import { SessionProvider, useSession } from '@/services/session';
import { colors } from '@/theme';

// Segura a tela de abertura até o app saber se tem alguém logado
SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Telas de dentro só abrem com login; login e cadastro só sem login.
 * Docs: https://docs.expo.dev/router/advanced/protected/
 */
function RootNavigator() {
  const { session, isLoading } = useSession();
  const isLoggedIn = !!session;

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync().catch(() => {});
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!isLoggedIn} redirectTo="/groups">
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: 'Criar conta' }} />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn} redirectTo="/login">
        <Stack.Screen name="groups/index" options={{ headerShown: false, title: 'Início' }} />
        <Stack.Screen name="groups/new" options={{ title: 'Criar grupo', presentation: 'modal' }} />
        <Stack.Screen name="groups/join" options={{ title: 'Entrar com código', presentation: 'modal' }} />
        <Stack.Screen name="groups/[groupId]/index" options={{ title: 'Grupo' }} />
        <Stack.Screen name="groups/[groupId]/players/index" options={{ title: 'Jogadores' }} />
        <Stack.Screen name="groups/[groupId]/players/[playerId]" options={{ title: 'Jogador' }} />
        <Stack.Screen name="groups/[groupId]/players/link" options={{ title: 'Ligar conta' }} />
        <Stack.Screen name="groups/[groupId]/kit" options={{ title: 'Kit de fichas' }} />
        <Stack.Screen name="groups/[groupId]/cash" options={{ title: 'Novo cash' }} />
        <Stack.Screen name="groups/[groupId]/tournament" options={{ title: 'Torneio' }} />
        <Stack.Screen name="groups/[groupId]/tournament-start" options={{ title: 'Quem vai jogar' }} />
        <Stack.Screen name="games/[gameId]/tournament" options={{ title: 'Torneio' }} />
        <Stack.Screen name="games/[gameId]/index" options={{ title: 'Cash' }} />
        <Stack.Screen name="games/[gameId]/player/[gamePlayerId]" options={{ title: 'Jogador' }} />
        <Stack.Screen name="games/[gameId]/add-player" options={{ title: 'Adicionar jogador', presentation: 'modal' }} />
        <Stack.Screen name="games/[gameId]/count/index" options={{ title: 'Contagem' }} />
        <Stack.Screen name="games/[gameId]/count/[gamePlayerId]" options={{ title: 'Fichas' }} />
        <Stack.Screen name="games/[gameId]/adjust" options={{ title: 'Ajuste', presentation: 'modal' }} />
        <Stack.Screen name="games/[gameId]/settlement" options={{ title: 'Acerto' }} />
        <Stack.Screen name="games/[gameId]/pix/[settlementId]" options={{ title: 'Pix', presentation: 'modal' }} />
        <Stack.Screen name="profile" options={{ title: 'Meus dados' }} />
      </Stack.Protected>
    </Stack>
  );
}

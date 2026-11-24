import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

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
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
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
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="groups/index" options={{ title: 'Meus grupos' }} />
        <Stack.Screen name="groups/[groupId]/index" options={{ title: 'Grupo' }} />
        <Stack.Screen name="groups/[groupId]/cash" options={{ title: 'Cash game' }} />
        <Stack.Screen name="groups/[groupId]/tournament" options={{ title: 'Torneio' }} />
        <Stack.Screen name="profile" options={{ title: 'Meu perfil' }} />
      </Stack>
    </ThemeProvider>
  );
}

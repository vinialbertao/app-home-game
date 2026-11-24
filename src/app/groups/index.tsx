import { router, Stack } from 'expo-router';

import { AppText, Button, Card, Screen } from '@/components';

/** Meus grupos. Fase 3: lista real do Supabase, "Criar grupo" e entrada por convite. */
export default function GroupsScreen() {
  return (
    <Screen footer={<Button title="Criar grupo" variant="secondary" disabled />}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button title="Perfil" variant="ghost" onPress={() => router.push('/profile')} />
          ),
        }}
      />
      <AppText muted>Grupos privados: só entra quem recebe o convite.</AppText>

      <Card
        accessibilityLabel="Abrir grupo de exemplo"
        onPress={() =>
          router.push({ pathname: '/groups/[groupId]', params: { groupId: 'exemplo' } })
        }
      >
        <AppText variant="heading">Grupo de exemplo</AppText>
        <AppText variant="caption">Dados de mentira até a Fase 3</AppText>
      </Card>
    </Screen>
  );
}

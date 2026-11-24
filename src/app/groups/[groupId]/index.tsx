import { router, Stack, useLocalSearchParams } from 'expo-router';

import { AppText, Button, Card, EmptyState, Screen } from '@/components';

/** Tela do grupo: jogadores, kit, novo jogo, retomar partida e histórico. Dados reais na Fase 3. */
export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  return (
    <Screen
      footer={
        <>
          <Button
            title="Novo cash"
            onPress={() => router.push({ pathname: '/groups/[groupId]/cash', params: { groupId } })}
          />
          <Button
            title="Novo torneio"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/groups/[groupId]/tournament', params: { groupId } })
            }
          />
        </>
      }
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button title="Perfil" variant="ghost" onPress={() => router.push('/profile')} />
          ),
        }}
      />
      <AppText variant="title">Grupo de exemplo</AppText>

      <Card>
        <AppText variant="heading">Jogadores</AppText>
        <AppText variant="caption">A lista do grupo aparece aqui.</AppText>
      </Card>
      <Card>
        <AppText variant="heading">Kit de fichas</AppText>
        <AppText variant="caption">Cores, valores e quantidades do kit fixo.</AppText>
      </Card>

      <EmptyState title="Nenhum jogo ainda" message="O histórico do grupo aparece aqui." />
    </Screen>
  );
}

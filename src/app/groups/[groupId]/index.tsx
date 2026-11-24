import { router, Stack, useLocalSearchParams } from 'expo-router';

import { AppText, Button, Card, EmptyState, Screen } from '@/components';
import { findSampleGroup } from '@/services/sampleData';

/** Tela do grupo: jogadores, kit, novo jogo, retomar partida e histórico. Dados reais na Fase 3. */
export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = findSampleGroup(groupId);
  const name = group?.name ?? 'Grupo';

  return (
    <Screen
      footer={
        <>
          {group?.liveGame ? (
            <Button
              title="Retomar partida"
              onPress={() =>
                router.push({
                  pathname: group.liveGame === 'cash' ? '/groups/[groupId]/cash' : '/groups/[groupId]/tournament',
                  params: { groupId },
                })
              }
            />
          ) : null}
          <Button
            title="Novo cash"
            variant={group?.liveGame ? 'secondary' : 'primary'}
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
      <Stack.Screen options={{ title: name }} />
      <AppText variant="title">{name}</AppText>

      <Card>
        <AppText variant="heading">Jogadores</AppText>
        <AppText variant="caption">
          {group ? `${group.playerCount} jogadores. A lista aparece aqui.` : 'A lista do grupo aparece aqui.'}
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">Kit de fichas</AppText>
        <AppText variant="caption">Cores, valores e quantidades do kit fixo.</AppText>
      </Card>

      {group?.lastGame ? (
        <Card>
          <AppText variant="heading">Histórico</AppText>
          <AppText variant="caption">Último jogo: {group.lastGame}</AppText>
        </Card>
      ) : (
        <EmptyState title="Nenhum jogo ainda" message="O histórico do grupo aparece aqui." />
      )}
    </Screen>
  );
}

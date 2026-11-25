import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, LoadingState, Screen } from '@/components';
import { buildInviteMessage, formatInviteCode } from '@/lib/invite';
import { formatChipValue, totalChips, totalValue } from '@/lib/kit';
import { useGroup } from '@/services/groups';
import { useGroupKit } from '@/services/kits';
import { useMembers, usePlayers } from '@/services/players';
import { colors, spacing } from '@/theme';

/** Tela do grupo: convite, jogadores, kit e os botões de novo jogo. */
export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const players = usePlayers(groupId);
  const members = useMembers(groupId);
  const kit = useGroupKit(groupId, group.data?.defaultKitId);

  if (!group.data) {
    return (
      <Screen>
        <LoadingState error={group.error} onRetry={() => group.refetch()} />
      </Screen>
    );
  }

  const isAdmin = group.data.role === 'admin';
  const activePlayers = players.data?.filter((p) => p.active) ?? [];
  const linkedIds = new Set(players.data?.map((p) => p.profileId).filter(Boolean));
  const pendingCount = members.data?.filter((m) => !linkedIds.has(m.userId)).length ?? 0;

  async function shareInvite() {
    if (!group.data) return;
    await Share.share({ message: buildInviteMessage(group.data.name, group.data.inviteCode) });
  }

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
            onPress={() => router.push({ pathname: '/groups/[groupId]/tournament', params: { groupId } })}
          />
        </>
      }
    >
      <Stack.Screen options={{ title: group.data.name }} />
      <View style={styles.header}>
        <AppText variant="title">{group.data.name}</AppText>
        <AppText variant="caption">{isAdmin ? 'Você é admin deste grupo' : 'Você é membro deste grupo'}</AppText>
      </View>

      <Card>
        <AppText variant="heading">Convidar</AppText>
        <AppText variant="caption">Código do grupo</AppText>
        <AppText variant="number" style={styles.code} selectable>
          {formatInviteCode(group.data.inviteCode)}
        </AppText>
        <Button title="Mandar convite" variant="secondary" onPress={shareInvite} />
      </Card>

      <Card
        accessibilityLabel="Abrir lista de jogadores"
        onPress={() => router.push({ pathname: '/groups/[groupId]/players', params: { groupId } })}
      >
        <View style={styles.row}>
          <AppText variant="heading" style={styles.flex}>
            Jogadores
          </AppText>
          <AppText variant="caption">Ver lista ›</AppText>
        </View>
        <AppText variant="caption">
          {players.data
            ? activePlayers.length > 0
              ? activePlayers.map((p) => p.name).join(', ')
              : 'Ninguém na lista ainda.'
            : 'Carregando…'}
        </AppText>
        {isAdmin && pendingCount > 0 ? (
          <AppText variant="caption" style={styles.warning}>
            {pendingCount === 1
              ? '1 pessoa entrou pelo convite e falta ligar a um nome da lista.'
              : `${pendingCount} pessoas entraram pelo convite e falta ligar a nomes da lista.`}
          </AppText>
        ) : null}
      </Card>

      <Card
        accessibilityLabel="Abrir kit de fichas"
        onPress={() => router.push({ pathname: '/groups/[groupId]/kit', params: { groupId } })}
      >
        <View style={styles.row}>
          <AppText variant="heading" style={styles.flex}>
            Kit de fichas
          </AppText>
          <AppText variant="caption">{isAdmin ? 'Editar ›' : 'Ver ›'}</AppText>
        </View>
        <AppText variant="caption">
          {kit.data
            ? `${kit.data.denominations.length} cores · ${formatChipValue(totalChips(kit.data.denominations))} fichas · ${formatChipValue(totalValue(kit.data.denominations))} em valor`
            : kit.data === null
              ? isAdmin
                ? 'Ainda sem kit. Toque para cadastrar.'
                : 'O admin ainda não cadastrou o kit.'
              : 'Carregando…'}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  flex: { flex: 1 },
  code: { fontSize: 28, lineHeight: 34, letterSpacing: 2, color: colors.gold },
  warning: { color: colors.warning },
});

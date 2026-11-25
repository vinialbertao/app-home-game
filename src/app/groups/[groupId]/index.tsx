import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, LoadingState, Screen } from '@/components';
import { buildInviteMessage, formatInviteCode } from '@/lib/invite';
import { formatChipValue, totalChips, totalValue, type KitKind } from '@/lib/kit';
import { formatBRL } from '@/lib/money';
import { useGroupGames, useGroupOpenSettlements, type GameSummary } from '@/services/games';
import { useGroup } from '@/services/groups';
import { useGroupKit, type GroupKit } from '@/services/kits';
import { useMembers, usePlayers } from '@/services/players';
import { colors, spacing } from '@/theme';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tela do grupo: partida em andamento, acertos pendentes, convite, jogadores, kits e histórico. */
export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const players = usePlayers(groupId);
  const members = useMembers(groupId);
  const cashKit = useGroupKit(groupId, 'cash', group.data?.cashKitId);
  const tournamentKit = useGroupKit(groupId, 'tournament', group.data?.tournamentKitId);
  const games = useGroupGames(groupId);
  const openSettlements = useGroupOpenSettlements(groupId);
  const [codeCopied, setCodeCopied] = useState(false);

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
  const liveGames = games.data?.filter((g) => g.status === 'live' || g.status === 'counting') ?? [];
  const finishedGames = games.data?.filter((g) => g.status === 'finished') ?? [];

  async function copyInviteCode() {
    if (!group.data) return;
    await Clipboard.setStringAsync(formatInviteCode(group.data.inviteCode));
    setCodeCopied(true);
  }

  async function shareInvite() {
    if (!group.data) return;
    await Share.share({ message: buildInviteMessage(group.data.name, group.data.inviteCode) });
  }

  const openGame = (gameId: string) => router.push({ pathname: '/games/[gameId]', params: { gameId } });

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

      {liveGames.map((game) => (
        <Card key={game.id} accessibilityLabel="Retomar partida" onPress={() => openGame(game.id)}>
          <View style={styles.row}>
            <View style={styles.liveDot} />
            <AppText variant="heading" style={styles.flex}>
              {game.type === 'cash' ? 'Cash' : 'Torneio'} em andamento
            </AppText>
            <AppText variant="caption">Retomar ›</AppText>
          </View>
          <AppText variant="caption">
            {game.playerCount} jogadores · {game.status === 'counting' ? 'contando fichas' : 'mesa ao vivo'}
          </AppText>
        </Card>
      ))}

      {openSettlements.data && openSettlements.data.length > 0 ? (
        <Card>
          <AppText variant="heading">Acertos pendentes</AppText>
          {openSettlements.data.map((s) => (
            <Button
              key={s.id}
              variant="ghost"
              title={`${s.fromName} → ${s.toName} · ${formatBRL(s.amountCents)} · ${
                s.paidAt ? 'falta "Recebi"' : 'falta pagar'
              }`}
              onPress={() => openGame(s.gameId)}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <AppText variant="heading">Convidar</AppText>
        <AppText variant="caption">Código do grupo</AppText>
        <AppText variant="number" style={styles.code} selectable>
          {formatInviteCode(group.data.inviteCode)}
        </AppText>
        <Button title="Mandar convite" variant="secondary" onPress={shareInvite} />
        <Button
          title={codeCopied ? 'Código copiado' : 'Copiar só o código'}
          variant="ghost"
          onPress={copyInviteCode}
        />
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

      <KitCard groupId={groupId} kind="cash" kit={cashKit.data} isAdmin={isAdmin} />
      <KitCard groupId={groupId} kind="tournament" kit={tournamentKit.data} isAdmin={isAdmin} />

      {finishedGames.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading">Histórico</AppText>
          {finishedGames.map((game) => (
            <HistoryRow key={game.id} game={game} onPress={() => openGame(game.id)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function KitCard({
  groupId,
  kind,
  kit,
  isAdmin,
}: {
  groupId: string;
  kind: KitKind;
  kit: GroupKit | null | undefined;
  isAdmin: boolean;
}) {
  const value = kit ? totalValue(kit.denominations) : 0;
  return (
    <Card
      accessibilityLabel={kind === 'cash' ? 'Abrir kit do cash' : 'Abrir kit do torneio'}
      onPress={() => router.push({ pathname: '/groups/[groupId]/kit', params: { groupId, kind } })}
    >
      <View style={styles.row}>
        <AppText variant="heading" style={styles.flex}>
          {kind === 'cash' ? 'Kit do cash' : 'Kit do torneio'}
        </AppText>
        <AppText variant="caption">{isAdmin ? 'Editar ›' : 'Ver ›'}</AppText>
      </View>
      <AppText variant="caption">
        {kit
          ? `${kit.denominations.length} cores · ${formatChipValue(totalChips(kit.denominations))} fichas · ${
              kind === 'cash' ? formatBRL(value) : `${formatChipValue(value)} pontos`
            }`
          : kit === null
            ? isAdmin
              ? 'Ainda sem kit. Toque para cadastrar.'
              : 'O admin ainda não cadastrou este kit.'
            : 'Carregando…'}
      </AppText>
    </Card>
  );
}

function HistoryRow({ game, onPress }: { game: GameSummary; onPress: () => void }) {
  return (
    <Card accessibilityLabel={`Abrir jogo de ${formatDate(game.startedAt)}`} onPress={onPress}>
      <View style={styles.row}>
        <AppText variant="label" style={styles.flex}>
          {game.type === 'cash' ? 'Cash' : 'Torneio'} · {formatDate(game.startedAt)}
        </AppText>
        <AppText variant="caption">{game.playerCount} jogadores ›</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  code: { fontSize: 28, lineHeight: 34, letterSpacing: 2, color: colors.gold },
  warning: { color: colors.warning },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
});

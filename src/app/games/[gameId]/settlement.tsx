import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen } from '@/components';
import { playerResults } from '@/lib/cash';
import { buildSettlementSummary } from '@/lib/cashSummary';
import { formatBRL } from '@/lib/money';
import {
  toCashDenominations,
  toCashPlayers,
  useCashGame,
  useMarkSettlement,
  useReopenCount,
  type CashGame,
  type Settlement,
} from '@/services/games';
import { useGroup } from '@/services/groups';
import { useUserId } from '@/services/session';
import { colors, radius, spacing } from '@/theme';

function signed(cents: number): string {
  if (cents > 0) return `+${formatBRL(cents)}`;
  if (cents < 0) return `−${formatBRL(-cents)}`;
  return formatBRL(0);
}

function dateLabel(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Acerto do cash: resultado de cada um, os Pix (com QR) e quem já pagou e recebeu. */
export default function SettlementScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useCashGame(gameId);
  if (!game.data) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }
  return <SettlementView game={game.data} />;
}

function SettlementView({ game }: { game: CashGame }) {
  const userId = useUserId();
  const group = useGroup(game.groupId);
  const mark = useMarkSettlement(game.groupId, game.id);
  const reopen = useReopenCount(game);

  const results = playerResults(toCashPlayers(game), toCashDenominations(game)).sort((a, b) => b.net - a.net);
  const byPlayerId = new Map(game.players.map((p) => [p.playerId, p]));
  const nameOf = (playerId: string) => byPlayerId.get(playerId)?.name ?? 'Jogador';
  const isMe = (playerId: string) => byPlayerId.get(playerId)?.profileId === userId;
  const anyMarked = game.settlements.some((s) => s.paidAt || s.receivedAt);
  const allDone = game.settlements.every((s) => s.paidAt && s.receivedAt);

  async function shareSummary() {
    await Share.share({
      message: buildSettlementSummary({
        groupName: group.data?.name ?? 'Grupo',
        dateLabel: dateLabel(game.startedAt),
        results,
        transfers: game.settlements.map((s) => ({ from: s.fromPlayerId, to: s.toPlayerId, amountCents: s.amountCents })),
        nameOf,
      }),
    });
  }

  function confirmReopen() {
    Alert.alert('Refazer o acerto?', 'Volta para a contagem. Só dá enquanto ninguém marcou pagamento.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Voltar para a contagem',
        onPress: () =>
          reopen.mutate(undefined, {
            onSuccess: () => router.replace({ pathname: '/games/[gameId]/count', params: { gameId: game.id } }),
          }),
      },
    ]);
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Mandar resumo no WhatsApp" variant="secondary" onPress={shareSummary} />
          {game.isHost && !anyMarked ? (
            <Button title="Refazer acerto" variant="ghost" onPress={confirmReopen} loading={reopen.isPending} />
          ) : null}
        </>
      }
    >
      <Stack.Screen options={{ title: `Acerto · ${dateLabel(game.startedAt)}` }} />

      <Card>
        <AppText variant="heading">Resultado</AppText>
        {results.map((r) => (
          <View key={r.playerId} style={styles.line}>
            <AppText style={styles.flex}>{r.name}</AppText>
            <AppText variant="number" style={r.net > 0 ? styles.win : r.net < 0 ? styles.loss : undefined}>
              {signed(r.net)}
            </AppText>
          </View>
        ))}
      </Card>

      <View style={styles.section}>
        <AppText variant="heading">Pix do acerto</AppText>
        {game.settlements.length === 0 ? (
          <AppText muted>Ninguém deve nada. 🤝</AppText>
        ) : (
          <AppText variant="caption">
            {allDone
              ? 'Tudo pago e recebido. ✓'
              : 'Quem paga toca em “Paguei”; quem recebe confere e toca em “Recebi”.'}
          </AppText>
        )}
        {game.settlements.map((s) => (
          <TransferCard
            key={s.id}
            settlement={s}
            fromName={nameOf(s.fromPlayerId)}
            toName={nameOf(s.toPlayerId)}
            canMarkPaid={game.isHost || isMe(s.fromPlayerId)}
            canMarkReceived={game.isHost || isMe(s.toPlayerId)}
            isPayer={isMe(s.fromPlayerId)}
            onPix={() =>
              router.push({ pathname: '/games/[gameId]/pix/[settlementId]', params: { gameId: game.id, settlementId: s.id } })
            }
            onMark={(field, value) => mark.mutate({ settlementId: s.id, field, value })}
            busy={mark.isPending}
          />
        ))}
      </View>

      <FormMessage message={mark.error?.message ?? reopen.error?.message} />
    </Screen>
  );
}

function TransferCard({
  settlement,
  fromName,
  toName,
  canMarkPaid,
  canMarkReceived,
  isPayer,
  onPix,
  onMark,
  busy,
}: {
  settlement: Settlement;
  fromName: string;
  toName: string;
  canMarkPaid: boolean;
  canMarkReceived: boolean;
  isPayer: boolean;
  onPix: () => void;
  onMark: (field: 'paid' | 'received', value: boolean) => void;
  busy: boolean;
}) {
  const paid = !!settlement.paidAt;
  const received = !!settlement.receivedAt;
  return (
    <Card>
      <View style={styles.line}>
        <AppText variant="label" style={styles.flex}>
          {fromName} → {toName}
        </AppText>
        <AppText variant="number" style={styles.gold}>
          {formatBRL(settlement.amountCents)}
        </AppText>
      </View>
      <View style={styles.badges}>
        <Badge on={paid} label={paid ? 'Pago' : 'Não pago'} />
        <Badge on={received} label={received ? 'Recebido' : 'Não recebido'} />
      </View>
      {!received ? (
        <Button title={isPayer ? 'Pagar com Pix' : 'Ver Pix'} variant="secondary" onPress={onPix} />
      ) : null}
      <View style={styles.actions}>
        {canMarkPaid ? (
          <View style={styles.flex}>
            <Button
              title={paid ? 'Desmarcar pago' : 'Paguei'}
              variant={paid ? 'ghost' : 'primary'}
              compact
              onPress={() => onMark('paid', !paid)}
              disabled={busy}
            />
          </View>
        ) : null}
        {canMarkReceived ? (
          <View style={styles.flex}>
            <Button
              title={received ? 'Desmarcar recebido' : 'Recebi'}
              variant={received ? 'ghost' : 'primary'}
              compact
              onPress={() => onMark('received', !received)}
              disabled={busy}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function Badge({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={[styles.badge, on && styles.badgeOn]}>
      <AppText variant="caption" style={on ? styles.win : undefined}>
        {on ? '✓ ' : ''}
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  win: { color: colors.success },
  loss: { color: colors.danger },
  gold: { color: colors.gold },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  badgeOn: { backgroundColor: colors.primarySoft },
  actions: { flexDirection: 'row', gap: spacing.sm },
});

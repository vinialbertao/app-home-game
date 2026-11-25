import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen } from '@/components';
import { playerResults, reconcile } from '@/lib/cash';
import { formatBRL } from '@/lib/money';
import { settle, SettlementError } from '@/lib/settlement';
import {
  toCashDenominations,
  toCashPlayers,
  useCashGame,
  useDeleteAdjustment,
  useSaveSettlement,
  useSetGameStatus,
  type CashGame,
} from '@/services/games';
import { colors, spacing } from '@/theme';

function signed(cents: number): string {
  if (cents > 0) return `+${formatBRL(cents)}`;
  if (cents < 0) return `−${formatBRL(-cents)}`;
  return formatBRL(0);
}

/** Contagem final e conferência: o que foi contado bate com o que entrou? */
export default function CountScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useCashGame(gameId);

  if (!game.data) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }
  if (game.data.status === 'finished') {
    return <Redirect href={{ pathname: '/games/[gameId]/settlement', params: { gameId } }} />;
  }
  if (game.data.status === 'live') {
    return <Redirect href={{ pathname: '/games/[gameId]', params: { gameId } }} />;
  }
  return <Counting game={game.data} />;
}

function Counting({ game }: { game: CashGame }) {
  const saveSettlement = useSaveSettlement(game);
  const setStatus = useSetGameStatus(game);
  const deleteAdjustment = useDeleteAdjustment(game);

  const players = toCashPlayers(game);
  const denominations = toCashDenominations(game);
  const results = playerResults(players, denominations);
  const check = reconcile(players, denominations);
  const notCounted = game.players.filter((p) => !p.isCounted);
  const allCounted = notCounted.length === 0;

  function closeSettlement() {
    try {
      const transfers = settle(results.map((r) => ({ playerId: r.playerId, net: r.net })));
      saveSettlement.mutate(transfers, {
        onSuccess: () =>
          router.replace({ pathname: '/games/[gameId]/settlement', params: { gameId: game.id } }),
      });
    } catch (e) {
      Alert.alert('Não fechou', e instanceof SettlementError ? e.message : 'Confira a contagem e tente de novo.');
    }
  }

  function backToTable() {
    setStatus.mutate('live', {
      onSuccess: () => router.replace({ pathname: '/games/[gameId]', params: { gameId: game.id } }),
    });
  }

  const nameOf = (gamePlayerId: string) => game.players.find((p) => p.id === gamePlayerId)?.name ?? 'Jogador';

  return (
    <Screen
      footer={
        game.isHost ? (
          <>
            <Button
              title="Fechar o acerto"
              onPress={closeSettlement}
              disabled={!allCounted || !check.ok}
              loading={saveSettlement.isPending}
            />
            <Button title="Voltar para a mesa" variant="ghost" onPress={backToTable} />
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Contagem' }} />

      <Card>
        <AppText variant="heading">Conferência</AppText>
        <View style={styles.line}>
          <AppText style={styles.flex}>Entrou na mesa</AppText>
          <AppText variant="number">{formatBRL(check.totalIn)}</AppText>
        </View>
        <View style={styles.line}>
          <AppText style={styles.flex}>Fichas contadas</AppText>
          <AppText variant="number">{formatBRL(check.totalCounted)}</AppText>
        </View>
        {check.totalAdjustments !== 0 ? (
          <View style={styles.line}>
            <AppText style={styles.flex}>Ajustes</AppText>
            <AppText variant="number">{signed(check.totalAdjustments)}</AppText>
          </View>
        ) : null}
        {!allCounted ? (
          <AppText variant="caption" style={styles.warning}>
            Falta contar: {notCounted.map((p) => p.name).join(', ')}.
          </AppText>
        ) : check.ok ? (
          <AppText variant="label" style={styles.ok}>
            ✓ Bateu certinho
          </AppText>
        ) : (
          <>
            <AppText variant="label" style={styles.error}>
              {check.difference > 0
                ? `Sobrou ${formatBRL(check.difference)} em fichas`
                : `Faltou ${formatBRL(-check.difference)} em fichas`}
            </AppText>
            <AppText variant="caption">
              Confira a contagem de cada um. Se não achar o erro, o host registra um ajuste.
            </AppText>
            {game.isHost ? (
              <Button
                title="Registrar ajuste"
                variant="secondary"
                onPress={() => router.push({ pathname: '/games/[gameId]/adjust', params: { gameId: game.id } })}
              />
            ) : null}
          </>
        )}
      </Card>

      {game.players.map((player) => {
        const result = results.find((r) => r.playerId === player.playerId)!;
        const counted = player.isCounted;
        return (
          <Card
            key={player.id}
            accessibilityLabel={`Contar fichas de ${player.name}`}
            onPress={
              game.isHost
                ? () =>
                    router.push({
                      pathname: '/games/[gameId]/count/[gamePlayerId]',
                      params: { gameId: game.id, gamePlayerId: player.id },
                    })
                : undefined
            }
          >
            <View style={styles.line}>
              <View style={styles.flex}>
                <AppText variant="label">{player.name}</AppText>
                <AppText variant="caption">
                  Colocou {formatBRL(result.paidIn)}
                  {counted ? ` · contou ${formatBRL(result.counted)}` : ''}
                </AppText>
              </View>
              {counted ? (
                <AppText variant="number" style={result.net >= 0 ? styles.ok : styles.error}>
                  {signed(result.net)}
                </AppText>
              ) : (
                <AppText variant="caption" style={styles.warning}>
                  {game.isHost ? 'Contar ›' : 'Falta contar'}
                </AppText>
              )}
            </View>
          </Card>
        );
      })}

      {game.adjustments.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading">Ajustes</AppText>
          {game.adjustments.map((a) => (
            <Card key={a.id}>
              <View style={styles.line}>
                <View style={styles.flex}>
                  <AppText variant="label">
                    {nameOf(a.gamePlayerId)}: {signed(a.amountCents)}
                  </AppText>
                  <AppText variant="caption">{a.reason}</AppText>
                </View>
                {game.isHost ? (
                  <Button
                    title="Apagar"
                    variant="ghost"
                    compact
                    onPress={() => deleteAdjustment.mutate(a.id)}
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <FormMessage message={saveSettlement.error?.message ?? setStatus.error?.message} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  ok: { color: colors.success },
  error: { color: colors.danger },
  warning: { color: colors.warning },
});

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen } from '@/components';
import { countedValue } from '@/lib/cash';
import { parseWholeNumber } from '@/lib/kit';
import { formatBRL } from '@/lib/money';
import { toCashDenominations, useCashGame, useSaveCount, type CashGame, type GamePlayer } from '@/services/games';
import { colors, minTouchSize, radius, spacing, typography } from '@/theme';

/** Contar as fichas de um jogador: quantidade de cada cor; o app soma em reais. */
export default function CountPlayerScreen() {
  const { gameId, gamePlayerId } = useLocalSearchParams<{ gameId: string; gamePlayerId: string }>();
  const game = useCashGame(gameId);
  const player = game.data?.players.find((p) => p.id === gamePlayerId);

  if (!game.data || !player) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }
  return <CountForm game={game.data} player={player} />;
}

function CountForm({ game, player }: { game: CashGame; player: GamePlayer }) {
  const saveCount = useSaveCount(game);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(game.denominations.map((d) => [d.id, player.counts?.[d.id] ? String(player.counts[d.id]) : ''])),
  );
  const [error, setError] = useState<string | null>(null);

  const counts: Record<string, number> = {};
  let invalid = false;
  for (const d of game.denominations) {
    const text = values[d.id]?.trim() ?? '';
    const quantity = text === '' ? 0 : parseWholeNumber(text);
    if (quantity === null) invalid = true;
    counts[d.id] = quantity ?? 0;
  }
  const total = countedValue(counts, toCashDenominations(game));
  const paid = player.buyins.reduce((sum, b) => sum + b.amountCents, 0);
  const net = total - paid;

  function step(denominationId: string, delta: number) {
    setValues((current) => {
      const now = parseWholeNumber(current[denominationId] || '0') ?? 0;
      return { ...current, [denominationId]: String(Math.max(0, now + delta)) };
    });
  }

  function save() {
    if (invalid) return setError('Use só números inteiros nas quantidades.');
    setError(null);
    saveCount.mutate(
      { gamePlayerId: player.id, counts },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
    );
  }

  if (!game.isHost) {
    return (
      <Screen>
        <Stack.Screen options={{ title: player.name }} />
        <AppText muted>Só o host conta as fichas.</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <View style={styles.totalRow}>
            <AppText variant="caption" style={styles.flex}>
              Fichas de {player.name}
            </AppText>
            <AppText variant="number" style={styles.gold}>
              {formatBRL(total)}
            </AppText>
          </View>
          <AppText variant="caption">
            Colocou {formatBRL(paid)} · {net >= 0 ? `ganhou ${formatBRL(net)}` : `perdeu ${formatBRL(-net)}`}
          </AppText>
          <Button title="Salvar contagem" onPress={save} loading={saveCount.isPending} />
        </>
      }
    >
      <Stack.Screen options={{ title: `Fichas de ${player.name}` }} />
      <AppText muted>Quantas fichas de cada cor? Deixe em branco a cor que ele não tem.</AppText>

      {game.denominations.map((d) => (
        <Card key={d.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="label">{d.color}</AppText>
              <AppText variant="caption">{formatBRL(d.value)} cada</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Uma ficha ${d.color} a menos`}
              style={styles.stepButton}
              onPress={() => step(d.id, -1)}
            >
              <AppText variant="heading">−</AppText>
            </Pressable>
            <TextInput
              style={styles.input}
              value={values[d.id]}
              onChangeText={(text) => setValues((current) => ({ ...current, [d.id]: text }))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={`Quantidade de fichas ${d.color}`}
              keyboardAppearance="dark"
              selectTextOnFocus
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Uma ficha ${d.color} a mais`}
              style={styles.stepButton}
              onPress={() => step(d.id, 1)}
            >
              <AppText variant="heading">+</AppText>
            </Pressable>
          </View>
        </Card>
      ))}

      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline' },
  gold: { color: colors.gold, fontSize: 24, lineHeight: 30 },
  stepButton: {
    width: minTouchSize,
    height: minTouchSize,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...typography.number,
    width: 72,
    minHeight: minTouchSize,
    textAlign: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});

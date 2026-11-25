import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen, SegmentedControl, TextField } from '@/components';
import { countedValue } from '@/lib/cash';
import { parseWholeNumber } from '@/lib/kit';
import { formatBRL, parseBRL } from '@/lib/money';
import { toCashDenominations, useCashGame, useSaveCount, type CashGame, type GamePlayer } from '@/services/games';
import { colors, minTouchSize, radius, spacing, typography } from '@/theme';

type Mode = 'chips' | 'total';

/**
 * Contar as fichas de um jogador, de um dos dois jeitos:
 * por fichas (quantidade de cada cor, o app soma) ou pelo valor total que a pessoa já calculou.
 */
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
  const isMine = player.id === game.data.myGamePlayerId;
  const canCount = game.data.isHost || (isMine && game.data.status === 'counting');
  if (!canCount) {
    return (
      <Screen>
        <Stack.Screen options={{ title: player.name }} />
        <AppText muted>
          {isMine
            ? 'Você conta as suas fichas quando o host encerrar a mesa.'
            : 'Cada um conta as próprias fichas; o host conta por quem não tem o app.'}
        </AppText>
      </Screen>
    );
  }
  return <CountForm game={game.data} player={player} />;
}

function CountForm({ game, player }: { game: CashGame; player: GamePlayer }) {
  const saveCount = useSaveCount(game);
  const [mode, setMode] = useState<Mode>(player.countedCents !== null ? 'total' : 'chips');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(game.denominations.map((d) => [d.id, player.counts?.[d.id] ? String(player.counts[d.id]) : ''])),
  );
  const [totalText, setTotalText] = useState(
    player.countedCents !== null ? formatBRL(player.countedCents).replace('R$ ', '') : '',
  );
  const [error, setError] = useState<string | null>(null);

  // Por fichas
  const counts: Record<string, number> = {};
  let invalidChips = false;
  for (const d of game.denominations) {
    const text = values[d.id]?.trim() ?? '';
    const quantity = text === '' ? 0 : parseWholeNumber(text);
    if (quantity === null) invalidChips = true;
    counts[d.id] = quantity ?? 0;
  }
  const chipsTotal = countedValue(counts, toCashDenominations(game));

  // Valor total
  const typedTotal = totalText.trim() === '' ? null : parseBRL(totalText);

  const total = mode === 'chips' ? chipsTotal : (typedTotal ?? 0);
  const paid = player.buyins.reduce((sum, b) => sum + b.amountCents, 0);
  const net = total - paid;

  function step(denominationId: string, delta: number) {
    setValues((current) => {
      const now = parseWholeNumber(current[denominationId] || '0') ?? 0;
      return { ...current, [denominationId]: String(Math.max(0, now + delta)) };
    });
  }

  function save() {
    if (mode === 'chips') {
      if (invalidChips) return setError('Use só números inteiros nas quantidades.');
      setError(null);
      saveCount.mutate(
        { gamePlayerId: player.id, mode: 'chips', counts },
        { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
      );
    } else {
      if (typedTotal === null) return setError('Digite o valor total em reais, como 85 ou 42,50.');
      setError(null);
      saveCount.mutate(
        { gamePlayerId: player.id, mode: 'total', totalCents: typedTotal },
        { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
      );
    }
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
      <Stack.Screen
        options={{ title: player.id === game.myGamePlayerId ? 'Minhas fichas' : `Fichas de ${player.name}` }}
      />

      <SegmentedControl<Mode>
        accessibilityLabel="Como contar"
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
        options={[
          { value: 'chips', label: 'Por fichas' },
          { value: 'total', label: 'Valor total' },
        ]}
      />

      {mode === 'total' ? (
        <Card>
          <TextField
            label="Quanto deu, em reais?"
            value={totalText}
            onChangeText={setTotalText}
            keyboardType="decimal-pad"
            placeholder="85,00"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            hint="Para quem já fez a conta das próprias fichas. Vale no lugar da contagem por cor."
          />
        </Card>
      ) : (
        <>
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
        </>
      )}

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

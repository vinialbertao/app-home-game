import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { formatBRL, parseBRL } from '@/lib/money';
import { useAddBuyin, useCashGame, useDeleteBuyin } from '@/services/games';
import { spacing } from '@/theme';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Um jogador na mesa: rebuy de qualquer valor, desfazer lançamentos e contar as fichas de quem vai embora. */
export default function GamePlayerScreen() {
  const { gameId, gamePlayerId } = useLocalSearchParams<{ gameId: string; gamePlayerId: string }>();
  const game = useCashGame(gameId);
  const player = game.data?.players.find((p) => p.id === gamePlayerId);
  const addBuyin = useAddBuyin({ id: gameId, groupId: game.data?.groupId ?? '' });
  const deleteBuyin = useDeleteBuyin({ id: gameId, groupId: game.data?.groupId ?? '' });
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!game.data || !player) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }

  const isHost = game.data.isHost;
  const canEdit = isHost && game.data.status === 'live';
  const buyin = game.data.settings.buyin_cents;
  const total = player.buyins.reduce((sum, b) => sum + b.amountCents, 0);
  const quickValues = [...new Set([buyin, buyin * 2, buyin * 3])];

  function rebuy(cents: number | null) {
    if (!cents || cents <= 0) return setError('Digite o valor do rebuy, como 40.');
    setError(null);
    addBuyin.mutate(
      { gamePlayerId: player!.id, kind: 'rebuy', amountCents: cents },
      { onSuccess: () => setAmount(''), onError: (e) => setError(e.message) },
    );
  }

  function undo(buyinId: string, label: string) {
    Alert.alert('Desfazer lançamento?', label, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desfazer',
        style: 'destructive',
        onPress: () => deleteBuyin.mutate(buyinId, { onError: (e) => setError(e.message) }),
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: player.name }} />

      <Card>
        <AppText variant="caption">Colocou na mesa</AppText>
        <AppText variant="number" style={styles.total}>
          {formatBRL(total)}
        </AppText>
      </Card>

      {canEdit ? (
        <Card>
          <AppText variant="heading">Rebuy</AppText>
          <View style={styles.quick}>
            {quickValues.map((cents) => (
              <View key={cents} style={styles.flex}>
                <Button
                  title={`+ ${formatBRL(cents)}`}
                  variant="secondary"
                  compact
                  onPress={() => rebuy(cents)}
                  disabled={addBuyin.isPending}
                />
              </View>
            ))}
          </View>
          <TextField
            label="Outro valor (R$)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="40"
            returnKeyType="done"
            onSubmitEditing={() => rebuy(parseBRL(amount))}
          />
          <Button title="Lançar rebuy" onPress={() => rebuy(parseBRL(amount))} loading={addBuyin.isPending} />
        </Card>
      ) : null}

      <View style={styles.section}>
        <AppText variant="heading">Lançamentos</AppText>
        {player.buyins.map((b) => {
          const label = `${b.kind === 'buyin' ? 'Buy-in' : 'Rebuy'} de ${formatBRL(b.amountCents)} às ${formatTime(b.createdAt)}`;
          return (
            <Card key={b.id}>
              <View style={styles.row}>
                <AppText style={styles.flex}>{label}</AppText>
                {canEdit ? (
                  <Button title="Desfazer" variant="ghost" compact onPress={() => undo(b.id, label)} />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>

      {isHost && game.data.status === 'live' ? (
        <Button
          title={player.counts ? 'Ver contagem das fichas' : 'Vai embora? Contar as fichas dele agora'}
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/games/[gameId]/count/[gamePlayerId]',
              params: { gameId, gamePlayerId: player.id },
            })
          }
        />
      ) : null}

      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 32, lineHeight: 40 },
  quick: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});

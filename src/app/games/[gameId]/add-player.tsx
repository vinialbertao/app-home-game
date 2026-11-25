import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { formatBRL, parseBRL } from '@/lib/money';
import { useAddPlayerToGame, useCashGame } from '@/services/games';
import { usePlayers } from '@/services/players';
import { spacing } from '@/theme';

/** Coloca na mesa quem chegou depois: alguém da lista do grupo ou um nome novo. */
export default function AddPlayerScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useCashGame(gameId);
  const players = usePlayers(game.data?.groupId ?? '');
  const addPlayer = useAddPlayerToGame({ id: gameId, groupId: game.data?.groupId ?? '' });
  const [amount, setAmount] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!game.data || !players.data) {
    return (
      <Screen>
        <LoadingState error={game.error ?? players.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }

  const buyinText = amount ?? String(game.data.settings.buyin_cents / 100).replace('.', ',');
  const buyinCents = parseBRL(buyinText);
  const atTable = new Set(game.data.players.map((p) => p.playerId));
  const available = players.data.filter((p) => p.active && !atTable.has(p.id));

  function add(input: { playerId?: string; newName?: string }) {
    if (!buyinCents || buyinCents <= 0) return setError('Digite o valor do buy-in.');
    if (input.newName !== undefined && !input.newName.trim()) return setError('Digite o nome.');
    setError(null);
    addPlayer.mutate(
      { ...input, buyinCents },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
    );
  }

  return (
    <Screen>
      <TextField
        label="Buy-in de quem chegou (R$)"
        value={buyinText}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <View style={styles.section}>
        <AppText variant="heading">Da lista do grupo</AppText>
        {available.length === 0 ? (
          <AppText muted>Todo mundo da lista já está na mesa.</AppText>
        ) : (
          available.map((player) => (
            <Card
              key={player.id}
              accessibilityLabel={`Colocar ${player.name} na mesa`}
              onPress={() => add({ playerId: player.id })}
            >
              <View style={styles.row}>
                <AppText variant="label" style={styles.flex}>
                  {player.name}
                </AppText>
                <AppText variant="caption">{buyinCents ? `+ ${formatBRL(buyinCents)}` : ''}</AppText>
              </View>
            </Card>
          ))
        )}
      </View>

      <Card>
        <TextField
          label="Ou um nome novo"
          value={newName}
          onChangeText={setNewName}
          autoCapitalize="words"
          maxLength={40}
          placeholder="Nome"
          hint="Entra também na lista de jogadores do grupo."
        />
        <Button
          title="Colocar na mesa"
          variant="secondary"
          onPress={() => add({ newName })}
          loading={addPlayer.isPending}
        />
      </Card>

      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});

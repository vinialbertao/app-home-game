import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { reconcile } from '@/lib/cash';
import { formatBRL } from '@/lib/money';
import { toCashDenominations, toCashPlayers, useAddAdjustment, useCashGame } from '@/services/games';
import { colors, minTouchSize, radius, spacing } from '@/theme';

/**
 * Ajuste da conferência (só o host): o app não decide. O host escolhe em qual jogador a diferença cai
 * e escreve o motivo. O valor é o que falta para a conta fechar.
 */
export default function AdjustScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useCashGame(gameId);
  const addAdjustment = useAddAdjustment({ id: gameId, groupId: game.data?.groupId ?? '' });
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!game.data) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }

  const check = reconcile(toCashPlayers(game.data), toCashDenominations(game.data));
  const amount = -check.difference; // o que entra no resultado do jogador escolhido

  if (check.ok) {
    return (
      <Screen>
        <AppText muted>A conferência já bateu. Não precisa de ajuste.</AppText>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (!playerId) return setError('Escolha em qual jogador o ajuste cai.');
    if (reason.trim().length < 3) return setError('Escreva o motivo (ex.: ficha caiu no chão).');
    setError(null);
    addAdjustment.mutate(
      { gamePlayerId: playerId, amountCents: amount, reason },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
    );
  }

  return (
    <Screen footer={<Button title="Registrar ajuste" onPress={save} loading={addAdjustment.isPending} />}>
      <Card>
        <AppText variant="label" style={styles.error}>
          {check.difference > 0
            ? `Sobrou ${formatBRL(check.difference)} em fichas`
            : `Faltou ${formatBRL(-check.difference)} em fichas`}
        </AppText>
        <AppText variant="caption">
          {amount < 0
            ? `O jogador escolhido recebe ${formatBRL(-amount)} a menos no acerto.`
            : `O jogador escolhido recebe ${formatBRL(amount)} a mais no acerto.`}{' '}
          Fica registrado com o motivo.
        </AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="heading">Em quem cai o ajuste?</AppText>
        {game.data.players.map((p) => {
          const isOn = playerId === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn }}
              accessibilityLabel={p.name}
              onPress={() => setPlayerId(p.id)}
              style={[styles.option, isOn && styles.optionOn]}
            >
              <View style={[styles.radio, isOn && styles.radioOn]} />
              <AppText variant="label">{p.name}</AppText>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Motivo"
        value={reason}
        onChangeText={setReason}
        placeholder="Ex.: ficha caiu no chão, contagem do Pedro"
        maxLength={200}
      />
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  error: { color: colors.danger },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
});

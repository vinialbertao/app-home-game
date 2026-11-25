import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { formatBRL, parseBRL } from '@/lib/money';
import { useStartCashGame } from '@/services/games';
import { useGroup } from '@/services/groups';
import { usePlayers } from '@/services/players';
import { colors, minTouchSize, radius, spacing } from '@/theme';

/** Configurar a sessão de cash: quem veio, buy-in inicial e blinds. Usa o kit do cash do grupo. */
export default function NewCashScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const players = usePlayers(groupId);
  const startGame = useStartCashGame();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [buyin, setBuyin] = useState('20');
  const [smallBlind, setSmallBlind] = useState('');
  const [bigBlind, setBigBlind] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!group.data || !players.data) {
    return (
      <Screen>
        <LoadingState error={group.error ?? players.error} onRetry={() => players.refetch()} />
      </Screen>
    );
  }

  const kitId = group.data.cashKitId;
  if (!kitId) {
    return (
      <Screen>
        <EmptyState
          title="Falta o kit do cash"
          message={
            group.data.role === 'admin'
              ? 'Cadastre quanto vale cada cor de ficha em reais antes de começar.'
              : 'Peça para o admin do grupo cadastrar o kit do cash.'
          }
          action={
            group.data.role === 'admin' ? (
              <Button
                title="Cadastrar kit do cash"
                onPress={() =>
                  router.replace({ pathname: '/groups/[groupId]/kit', params: { groupId, kind: 'cash' } })
                }
              />
            ) : undefined
          }
        />
      </Screen>
    );
  }

  const active = players.data.filter((p) => p.active);
  const buyinCents = parseBRL(buyin);

  function toggle(playerId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function start() {
    if (selected.size < 2) return setError('Marque pelo menos 2 jogadores.');
    if (!buyinCents || buyinCents <= 0) return setError('Digite o valor do buy-in, como 20 ou 30.');
    const sb = smallBlind.trim() ? parseBRL(smallBlind) : null;
    const bb = bigBlind.trim() ? parseBRL(bigBlind) : null;
    if ((smallBlind.trim() && sb === null) || (bigBlind.trim() && bb === null)) {
      return setError('Os blinds são em reais, como 0,50 e 1.');
    }
    setError(null);
    startGame.mutate(
      {
        groupId,
        kitId: kitId!,
        playerIds: [...selected],
        buyinCents,
        smallBlindCents: sb,
        bigBlindCents: bb,
      },
      {
        onSuccess: (gameId) => router.replace({ pathname: '/games/[gameId]', params: { gameId } }),
        onError: (e) => setError(e.message),
      },
    );
  }

  const total = buyinCents ? buyinCents * selected.size : 0;

  return (
    <Screen
      footer={
        <>
          {selected.size > 0 && buyinCents ? (
            <AppText variant="caption" style={styles.center}>
              {selected.size} jogadores × {formatBRL(buyinCents)} = {formatBRL(total)} na mesa
            </AppText>
          ) : null}
          <Button title="Começar o cash" onPress={start} loading={startGame.isPending} />
        </>
      }
    >
      <View style={styles.section}>
        <AppText variant="heading">Quem veio?</AppText>
        {active.length === 0 ? (
          <AppText muted>Ninguém na lista do grupo ainda.</AppText>
        ) : (
          active.map((player) => {
            const isOn = selected.has(player.id);
            return (
              <Pressable
                key={player.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn }}
                accessibilityLabel={player.name}
                onPress={() => toggle(player.id)}
                style={[styles.check, isOn && styles.checkOn]}
              >
                <View style={[styles.box, isOn && styles.boxOn]}>
                  {isOn ? <AppText style={styles.tick}>✓</AppText> : null}
                </View>
                <AppText variant="label">{player.name}</AppText>
              </Pressable>
            );
          })
        )}
        <AppText variant="caption">Quem chegar depois entra pela mesa, no botão “Adicionar jogador”.</AppText>
      </View>

      <Card>
        <TextField
          label="Buy-in de cada um (R$)"
          value={buyin}
          onChangeText={setBuyin}
          keyboardType="decimal-pad"
          placeholder="20"
          hint="Todo mundo começa com esse valor. Os rebuys depois são livres."
        />
        <View style={styles.blinds}>
          <View style={styles.flex}>
            <TextField
              label="Small blind (R$)"
              value={smallBlind}
              onChangeText={setSmallBlind}
              keyboardType="decimal-pad"
              placeholder="0,50"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Big blind (R$)"
              value={bigBlind}
              onChangeText={setBigBlind}
              keyboardType="decimal-pad"
              placeholder="1"
            />
          </View>
        </View>
      </Card>

      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  blinds: { flexDirection: 'row', gap: spacing.md },
  check: {
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
  checkOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontWeight: '700', lineHeight: 18 },
});

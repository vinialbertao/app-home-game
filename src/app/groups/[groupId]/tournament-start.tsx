import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  CheckRow,
  EmptyState,
  FormMessage,
  LoadingState,
  NumberField,
  Screen,
} from '@/components';
import { formatBRL } from '@/lib/money';
import { DEFAULT_MAX_SEATS, tableSizes } from '@/lib/seating';
import { useGroup } from '@/services/groups';
import { usePlayers } from '@/services/players';
import { useUserId } from '@/services/session';
import { useStartTournament } from '@/services/tournament';
import { getPendingTournament } from '@/services/tournamentDraft';
import { spacing } from '@/theme';

/** Torneio 5b: marcar quem vai jogar, quantos lugares por mesa, e sortear as mesas. */
export default function TournamentStartScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const players = usePlayers(groupId);
  const pending = getPendingTournament(groupId);

  if (!pending) {
    return (
      <Screen>
        <EmptyState
          title="Estrutura não encontrada"
          message="Volte para a tela do torneio e toque em “Escolher jogadores e começar”."
          action={<Button title="Voltar" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }
  if (!group.data || !players.data) {
    return (
      <Screen>
        <LoadingState error={group.error ?? players.error} onRetry={() => players.refetch()} />
      </Screen>
    );
  }
  if (!group.data.tournamentKitId) {
    return (
      <Screen>
        <EmptyState title="Falta o kit do torneio" message="Cadastre o kit do torneio na tela do grupo." />
      </Screen>
    );
  }

  return (
    <PickPlayers
      groupId={groupId}
      kitId={group.data.tournamentKitId}
      pending={pending}
      players={players.data.filter((p) => p.active)}
    />
  );
}

function PickPlayers({
  groupId,
  kitId,
  pending,
  players,
}: {
  groupId: string;
  kitId: string;
  pending: NonNullable<ReturnType<typeof getPendingTournament>>;
  players: { id: string; name: string; profileId: string | null }[];
}) {
  const userId = useUserId();
  const start = useStartTournament();
  const [selected, setSelected] = useState<Set<string>>(new Set(players.map((p) => p.id)));
  const [maxSeats, setMaxSeats] = useState<number | null>(DEFAULT_MAX_SEATS);
  const [error, setError] = useState<string | null>(null);

  const hostPlayer = players.find((p) => p.profileId === userId) ?? null;
  const sizes = maxSeats && maxSeats >= 2 ? tableSizes(selected.size, maxSeats) : [];
  const { settings } = pending.draft;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function begin() {
    if (selected.size < 2) return setError('Marque pelo menos 2 jogadores.');
    if (!maxSeats || maxSeats < 2 || maxSeats > 12) return setError('Cada mesa tem de 2 a 12 lugares.');
    setError(null);
    start.mutate(
      {
        groupId,
        kitId,
        name: pending.name,
        draft: pending.draft,
        playerIds: [...selected],
        maxSeats,
        hostPlayerId: hostPlayer?.id ?? null,
      },
      {
        onSuccess: (gameId) => router.replace({ pathname: '/games/[gameId]/tournament', params: { gameId } }),
        onError: (e) => setError(e.message),
      },
    );
  }

  return (
    <Screen
      footer={
        <>
          {sizes.length > 0 ? (
            <AppText variant="caption" style={styles.center}>
              {sizes.length === 1 ? '1 mesa' : `${sizes.length} mesas`}: {sizes.join(' e ')} jogadores ·{' '}
              {formatBRL(selected.size * settings.buyinCents)} em buy-ins
            </AppText>
          ) : null}
          <Button title="Sortear mesas" onPress={begin} loading={start.isPending} />
        </>
      }
    >
      <View style={styles.section}>
        <AppText variant="heading">Quem vai jogar?</AppText>
        {players.map((player) => (
          <CheckRow
            key={player.id}
            label={player.id === hostPlayer?.id ? `${player.name} (você, mesa 1)` : player.name}
            checked={selected.has(player.id)}
            onToggle={() => toggle(player.id)}
          />
        ))}
        {!hostPlayer ? (
          <AppText variant="caption">
            Seu nome não está ligado a nenhum jogador da lista: o app entende que você só vai organizar.
          </AppText>
        ) : null}
      </View>
      <Card>
        <NumberField
          label="Lugares por mesa (no máximo)"
          value={maxSeats}
          onChange={setMaxSeats}
          hint="O app usa o mínimo de mesas e divide os jogadores por igual."
        />
      </Card>
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  center: { textAlign: 'center' },
});

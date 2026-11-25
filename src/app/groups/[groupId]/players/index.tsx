import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, EmptyState, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { useGroup } from '@/services/groups';
import { useAddPlayer, useMembers, usePlayers, type Member, type Player } from '@/services/players';
import { colors, spacing } from '@/theme';

/** Lista de jogadores: todos veem; o admin adiciona, edita e liga as contas aos nomes. */
export default function PlayersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const players = usePlayers(groupId);
  const members = useMembers(groupId);
  const addPlayer = useAddPlayer(groupId);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!group.data || !players.data) {
    return (
      <Screen>
        <LoadingState error={group.error ?? players.error} onRetry={() => players.refetch()} />
      </Screen>
    );
  }

  const isAdmin = group.data.role === 'admin';
  const linkedIds = new Set(players.data.map((p) => p.profileId).filter(Boolean));
  const pending = members.data?.filter((m) => !linkedIds.has(m.userId)) ?? [];
  const active = players.data.filter((p) => p.active);
  const inactive = players.data.filter((p) => !p.active);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return setError('Digite o nome do jogador.');
    if (players.data?.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return setError(`"${name}" já está na lista.`);
    }
    setError(null);
    addPlayer.mutate({ name }, { onSuccess: () => setNewName(''), onError: (e) => setError(e.message) });
  }

  function addMemberAsPlayer(member: Member) {
    setError(null);
    addPlayer.mutate(
      { name: member.displayName, profileId: member.userId },
      { onError: (e) => setError(e.message) },
    );
  }

  return (
    <Screen>
      {isAdmin && pending.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading">Entraram pelo convite</AppText>
          <AppText variant="caption">
            Ligue cada pessoa a um nome que já está na lista, ou adicione como jogador novo.
          </AppText>
          {pending.map((member) => (
            <Card key={member.userId}>
              <View style={styles.row}>
                <Avatar name={member.displayName} photoUrl={member.avatarUrl} size={40} />
                <View style={styles.flex}>
                  <AppText variant="label">{member.displayName}</AppText>
                  <AppText variant="caption">ID {member.publicId}</AppText>
                </View>
              </View>
              <Button
                title="Adicionar como jogador novo"
                variant="secondary"
                onPress={() => addMemberAsPlayer(member)}
                loading={addPlayer.isPending}
              />
              <Button
                title="Ligar a um nome da lista"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/groups/[groupId]/players/link',
                    params: { groupId, userId: member.userId },
                  })
                }
              />
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="heading">
          Jogadores ({active.length})
        </AppText>
        {active.length === 0 ? (
          <EmptyState title="Lista vazia" message={isAdmin ? 'Adicione os nomes de quem joga.' : undefined} />
        ) : (
          active.map((player) => <PlayerRow key={player.id} groupId={groupId} player={player} isAdmin={isAdmin} />)
        )}
      </View>

      {isAdmin ? (
        <View style={styles.section}>
          <TextField
            label="Adicionar jogador"
            value={newName}
            onChangeText={setNewName}
            placeholder="Nome"
            autoCapitalize="words"
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            hint="Quem ainda não tem o app entra só com o nome."
          />
          <Button title="Adicionar" variant="secondary" onPress={handleAdd} loading={addPlayer.isPending} />
        </View>
      ) : null}
      <FormMessage message={error} />

      {inactive.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading">Fora da lista ({inactive.length})</AppText>
          <AppText variant="caption">Saíram, mas continuam no histórico dos jogos.</AppText>
          {inactive.map((player) => (
            <PlayerRow key={player.id} groupId={groupId} player={player} isAdmin={isAdmin} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function PlayerRow({ groupId, player, isAdmin }: { groupId: string; player: Player; isAdmin: boolean }) {
  const details = [
    player.publicId ? `Conta ${player.publicId}` : 'Sem conta no app',
    player.pixKey ? 'Pix cadastrado' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <View style={styles.row}>
      <Avatar name={player.name} size={40} />
      <View style={styles.flex}>
        <AppText variant="label" style={!player.active && styles.inactive}>
          {player.name}
        </AppText>
        <AppText variant="caption">{details}</AppText>
      </View>
      {isAdmin ? <AppText variant="caption">Editar ›</AppText> : null}
    </View>
  );

  if (!isAdmin) return <Card>{content}</Card>;
  return (
    <Card
      accessibilityLabel={`Editar ${player.name}`}
      onPress={() =>
        router.push({ pathname: '/groups/[groupId]/players/[playerId]', params: { groupId, playerId: player.id } })
      }
    >
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  inactive: { color: colors.textMuted },
});

import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppText,
  Avatar,
  Card,
  EmptyState,
  FormMessage,
  LoadingState,
  Screen,
} from "@/components";
import { useMembers, usePlayers, useUpdatePlayer } from "@/services/players";
import { spacing } from "@/theme";

/** Ligar quem entrou pelo convite a um nome que já está na lista (só admin). */
export default function LinkMemberScreen() {
  const { groupId, userId } = useLocalSearchParams<{
    groupId: string;
    userId: string;
  }>();
  const players = usePlayers(groupId);
  const members = useMembers(groupId);
  const updatePlayer = useUpdatePlayer(groupId);
  const [error, setError] = useState<string | null>(null);

  const member = members.data?.find((m) => m.userId === userId);
  if (!member || !players.data) {
    return (
      <Screen>
        <LoadingState
          error={members.error ?? players.error}
          onRetry={() => members.refetch()}
        />
      </Screen>
    );
  }

  const unlinked = players.data.filter((p) => p.active && !p.profileId);

  function link(playerId: string) {
    setError(null);
    updatePlayer.mutate(
      { playerId, changes: { profileId: userId } },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
    );
  }

  return (
    <Screen>
      <View style={styles.row}>
        <Avatar
          name={member.displayName}
          photoUrl={member.avatarUrl}
          size={48}
        />
        <View style={styles.flex}>
          <AppText variant="heading">{member.displayName}</AppText>
          <AppText variant="caption">ID {member.publicId}</AppText>
        </View>
      </View>
      <AppText muted>Qual destes nomes é {member.displayName}?</AppText>

      {unlinked.length === 0 ? (
        <EmptyState
          title="Nenhum nome livre"
          message="Todos os nomes da lista já têm conta. Volte e use “Adicionar como jogador novo”."
        />
      ) : (
        unlinked.map((player) => (
          <Card
            key={player.id}
            accessibilityLabel={`Ligar a ${player.name}`}
            onPress={() => link(player.id)}
          >
            <View style={styles.row}>
              <Avatar name={player.name} size={40} />
              <AppText variant="label" style={styles.flex}>
                {player.name}
              </AppText>
              <AppText variant="caption">Ligar ›</AppText>
            </View>
          </Card>
        ))
      )}
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});

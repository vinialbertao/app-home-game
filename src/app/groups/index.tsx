import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, Card, EmptyState, LoadingState } from '@/components';
import { useMyGroups, type MyGroup } from '@/services/groups';
import { useMyProfile } from '@/services/profile';
import { colors, radius, spacing } from '@/theme';

/** Tela inicial: perfil do jogador no topo e "Meus grupos" embaixo. */
export default function HomeScreen() {
  const profile = useMyProfile();
  const groups = useMyGroups();

  const refreshing = profile.isRefetching || groups.isRefetching;
  const onRefresh = () => {
    profile.refetch();
    groups.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {profile.data ? (
          <View style={styles.profile}>
            <Avatar name={profile.data.display_name} photoUrl={profile.data.avatar_url} size={104} />
            <AppText variant="title" style={styles.center}>
              {profile.data.display_name}
            </AppText>
            <AppText variant="caption" style={styles.playerId}>
              ID {profile.data.public_id}
            </AppText>
            <View style={styles.profileButton}>
              <Button title="Meus dados" variant="secondary" onPress={() => router.push('/profile')} />
            </View>
          </View>
        ) : (
          <LoadingState error={profile.error} onRetry={() => profile.refetch()} />
        )}

        <View style={styles.sectionHeader}>
          <AppText variant="heading">Meus grupos</AppText>
          {groups.data && groups.data.length > 0 ? (
            <AppText variant="caption">
              {groups.data.length} {groups.data.length === 1 ? 'grupo' : 'grupos'}
            </AppText>
          ) : null}
        </View>

        {!groups.data ? (
          <LoadingState error={groups.error} onRetry={() => groups.refetch()} />
        ) : groups.data.length === 0 ? (
          <EmptyState
            title="Nenhum grupo ainda"
            message="Crie o grupo da sua mesa ou entre com o código que um amigo te mandou."
          />
        ) : (
          groups.data.map((group) => <GroupCard key={group.id} group={group} />)
        )}

        <View style={styles.actions}>
          <Button title="Criar grupo" onPress={() => router.push('/groups/new')} />
          <Button title="Entrar com código" variant="secondary" onPress={() => router.push('/groups/join')} />
        </View>

        <AppText variant="caption" style={styles.center}>
          Grupos privados: só entra quem recebe o código.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupCard({ group }: { group: MyGroup }) {
  return (
    <Card
      accessibilityLabel={`Abrir ${group.name}`}
      onPress={() => router.push({ pathname: '/groups/[groupId]', params: { groupId: group.id } })}
    >
      <View style={styles.cardTop}>
        <AppText variant="heading" style={styles.flex}>
          {group.name}
        </AppText>
        {group.role === 'admin' ? (
          <View style={styles.badge}>
            <AppText variant="caption" style={styles.badgeText}>
              Admin
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption">
        {group.playerCount} {group.playerCount === 1 ? 'jogador' : 'jogadores'}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  profile: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  playerId: { letterSpacing: 1, fontVariant: ['tabular-nums'] },
  profileButton: { marginTop: spacing.md, minWidth: 180 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { color: colors.success, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  center: { textAlign: 'center' },
});

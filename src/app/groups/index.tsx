import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, Screen } from '@/components';
import { sampleGroups, sampleProfile, type SampleGroup } from '@/services/sampleData';
import { colors, radius, spacing } from '@/theme';

/**
 * Tela inicial depois do login: perfil do jogador no topo e "Meus grupos" embaixo.
 * Fase 3: perfil e grupos reais do Supabase, "Criar grupo" e entrada por convite.
 */
export default function HomeScreen() {
  const profile = sampleProfile;

  return (
    <Screen withTopInset footer={<Button title="Criar grupo" variant="secondary" disabled />}>
      <View style={styles.profile}>
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={104} />
        <AppText variant="title">{profile.name}</AppText>
        <AppText variant="caption" style={styles.playerId}>
          ID {profile.playerId}
        </AppText>
        <View style={styles.profileButton}>
          <Button title="Meus dados" variant="secondary" onPress={() => router.push('/profile')} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="heading">Meus grupos</AppText>
        <AppText variant="caption">{sampleGroups.length} grupos</AppText>
      </View>

      {sampleGroups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}

      <AppText variant="caption" style={styles.note}>
        Grupos privados: só entra quem recebe o convite.
      </AppText>
    </Screen>
  );
}

function GroupCard({ group }: { group: SampleGroup }) {
  return (
    <Card
      accessibilityLabel={`Abrir ${group.name}`}
      onPress={() => router.push({ pathname: '/groups/[groupId]', params: { groupId: group.id } })}
    >
      <View style={styles.cardTop}>
        <AppText variant="heading" style={styles.flex}>
          {group.name}
        </AppText>
        {group.liveGame ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <AppText variant="caption" style={styles.liveText}>
              {group.liveGame === 'cash' ? 'Cash rolando' : 'Torneio rolando'}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption">
        {group.playerCount} jogadores
        {group.isAdmin ? ' · Você é admin' : ''}
        {' · '}
        {group.lastGame ? `Último jogo: ${group.lastGame}` : 'Nenhum jogo ainda'}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontWeight: '600' },
  note: { textAlign: 'center' },
});

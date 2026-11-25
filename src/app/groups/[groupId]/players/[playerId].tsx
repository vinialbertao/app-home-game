import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { buildInviteMessage } from '@/lib/invite';
import { isOutsideGroup, normalizePlayerId } from '@/lib/playerId';
import { useGroup } from '@/services/groups';
import { useUserId } from '@/services/session';
import {
  findProfileByPublicId,
  useMembers,
  usePlayers,
  useRemoveFromGroup,
  useRemovePlayer,
  useRestorePlayer,
  useUpdatePlayer,
  type FoundProfile,
  type Player,
} from '@/services/players';
import { colors, spacing } from '@/theme';

/** Editar jogador (só admin): nome, chave Pix, conta ligada, tirar da lista. */
export default function EditPlayerScreen() {
  const { groupId, playerId } = useLocalSearchParams<{
    groupId: string;
    playerId: string;
  }>();
  const players = usePlayers(groupId);
  const player = players.data?.find((p) => p.id === playerId);
  if (!player) {
    return (
      <Screen>
        <LoadingState error={players.error} onRetry={() => players.refetch()} />
      </Screen>
    );
  }
  return <EditPlayerForm groupId={groupId} current={player} />;
}

function EditPlayerForm({ groupId, current }: { groupId: string; current: Player }) {
  const group = useGroup(groupId);
  const members = useMembers(groupId);
  const updatePlayer = useUpdatePlayer(groupId);
  const removePlayer = useRemovePlayer(groupId);
  const removeFromGroup = useRemoveFromGroup(groupId);
  const restorePlayer = useRestorePlayer(groupId);
  const myId = useUserId();
  const [name, setName] = useState(current.name);
  const [pixKey, setPixKey] = useState(current.pixKey ?? '');
  const [searchId, setSearchId] = useState('');
  const [found, setFound] = useState<FoundProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'error' | 'success';
  } | null>(null);

  const memberIds = members.data?.map((m) => m.userId) ?? [];
  const outsideGroup = members.data !== undefined && isOutsideGroup(current.profileId, memberIds);
  const member = members.data?.find((m) => m.userId === current.profileId);
  const canRemoveFromGroup = member !== undefined && member.userId !== myId;

  async function shareInvite() {
    if (!group.data) return;
    await Share.share({
      message: buildInviteMessage(group.data.name, group.data.inviteCode),
    });
  }

  function save() {
    if (!name.trim())
      return setMessage({
        text: 'O nome não pode ficar vazio.',
        tone: 'error',
      });
    updatePlayer.mutate(
      { playerId: current.id, changes: { name, pixKey } },
      {
        onSuccess: () => setMessage({ text: 'Salvo.', tone: 'success' }),
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  async function search() {
    const id = normalizePlayerId(searchId);
    setFound(null);
    if (!id)
      return setMessage({
        text: 'O ID tem o formato MF-7K4Q2X.',
        tone: 'error',
      });
    setSearching(true);
    try {
      const profile = await findProfileByPublicId(id);
      if (!profile) setMessage({ text: `Nenhuma conta com o ID ${id}.`, tone: 'error' });
      else {
        setMessage(null);
        setFound(profile);
      }
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: 'error' });
    } finally {
      setSearching(false);
    }
  }

  function link(profile: FoundProfile) {
    updatePlayer.mutate(
      { playerId: current.id, changes: { profileId: profile.id } },
      {
        onSuccess: () => {
          setFound(null);
          setSearchId('');
          if (!isOutsideGroup(profile.id, memberIds)) {
            setMessage({
              text: `${current.name} agora está ligado à conta de ${profile.displayName}.`,
              tone: 'success',
            });
            return;
          }
          setMessage(null);
          Alert.alert(
            'Ainda não está no grupo',
            `${profile.displayName} foi ligado a ${current.name}, mas ainda não entrou no grupo. Até entrar pelo convite, não vê os jogos nem conta as próprias fichas. Quer enviar o convite?`,
            [
              { text: 'Agora não', style: 'cancel' },
              { text: 'Enviar convite', onPress: shareInvite },
            ],
          );
        },
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  function unlink() {
    updatePlayer.mutate(
      { playerId: current.id, changes: { profileId: null } },
      {
        onSuccess: () => setMessage({ text: 'Conta desligada deste nome.', tone: 'success' }),
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  function confirmRemove() {
    Alert.alert('Tirar da lista?', `${current.name} sai da lista de jogadores do grupo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Tirar',
        style: 'destructive',
        onPress: () =>
          removePlayer.mutate(current.id, {
            onSuccess: () => router.back(),
            onError: (e) => setMessage({ text: e.message, tone: 'error' }),
          }),
      },
    ]);
  }

  function confirmRemoveFromGroup() {
    if (!member) return;
    Alert.alert(
      'Remover do grupo?',
      `${member.displayName} sai do grupo, perde o acesso aos jogos e não volta pelo convite (só você traz de volta, em “Fora da lista”). Os jogos que já jogou continuam no histórico.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            removeFromGroup.mutate(
              { userId: member.userId, playerId: current.id },
              {
                onSuccess: () => router.back(),
                onError: (e) => setMessage({ text: e.message, tone: 'error' }),
              },
            ),
        },
      ],
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: current.name }} />

      <TextField label="Nome" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} />
      <TextField
        label="Chave Pix (opcional)"
        value={pixKey}
        onChangeText={setPixKey}
        placeholder="CPF, celular, e-mail ou chave aleatória"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={77}
        hint={
          current.profileId
            ? 'Se a pessoa cadastrar a chave no perfil dela, vale a do perfil.'
            : 'Usada no QR code do acerto para quem não tem o app.'
        }
      />
      <Button title="Salvar" onPress={save} loading={updatePlayer.isPending} />

      <Card>
        <AppText variant="heading">Conta no app</AppText>
        {current.profileId ? (
          <>
            <AppText variant="caption">Ligado à conta {current.publicId ?? ''}.</AppText>
            {outsideGroup ? (
              <View style={styles.notice}>
                <AppText variant="label" style={styles.warning}>
                  Ainda não entrou no grupo
                </AppText>
                <AppText variant="caption">
                  Joga normalmente pela sua mesa, mas só vê os jogos e conta as próprias fichas depois de entrar pelo
                  convite.
                </AppText>
                <Button title="Enviar convite" variant="secondary" onPress={shareInvite} />
              </View>
            ) : null}
            <Button title="Desligar conta" variant="ghost" onPress={unlink} />
          </>
        ) : (
          <>
            <AppText variant="caption">
              Peça o ID que aparece na tela inicial do app da pessoa (ex.: MF-7K4Q2X).
            </AppText>
            <TextField
              label="ID do jogador"
              value={searchId}
              onChangeText={setSearchId}
              placeholder="MF-7K4Q2X"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <Button title="Buscar" variant="secondary" onPress={search} loading={searching} />
            {found ? (
              <View style={styles.found}>
                <View style={styles.row}>
                  <Avatar name={found.displayName} photoUrl={found.avatarUrl} size={40} />
                  <View style={styles.flex}>
                    <AppText variant="label">{found.displayName}</AppText>
                    <AppText variant="caption">ID {found.publicId}</AppText>
                  </View>
                </View>
                <Button title={`Ligar a ${current.name}`} onPress={() => link(found)} />
              </View>
            ) : null}
          </>
        )}
      </Card>

      <FormMessage message={message?.text} tone={message?.tone} />

      {canRemoveFromGroup ? (
        <Button
          title="Remover do grupo"
          variant="danger"
          onPress={confirmRemoveFromGroup}
          loading={removeFromGroup.isPending}
        />
      ) : current.active ? (
        <Button title="Tirar da lista" variant="danger" onPress={confirmRemove} loading={removePlayer.isPending} />
      ) : (
        <>
          <Button
            title="Voltar para a lista"
            variant="secondary"
            loading={restorePlayer.isPending}
            onPress={() =>
              restorePlayer.mutate(current.id, {
                onSuccess: () => router.back(),
                onError: (e) => setMessage({ text: e.message, tone: 'error' }),
              })
            }
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  found: { gap: spacing.sm, marginTop: spacing.sm },
  notice: { gap: spacing.xs, marginTop: spacing.sm },
  warning: { color: colors.warning },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { normalizePlayerId } from '@/lib/playerId';
import {
  findProfileByPublicId,
  useMembers,
  usePlayers,
  useRemovePlayer,
  useUpdatePlayer,
  type FoundProfile,
  type Player,
} from '@/services/players';
import { spacing } from '@/theme';

/** Editar jogador (só admin): nome, chave Pix, conta ligada, tirar da lista. */
export default function EditPlayerScreen() {
  const { groupId, playerId } = useLocalSearchParams<{ groupId: string; playerId: string }>();
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
  const members = useMembers(groupId);
  const updatePlayer = useUpdatePlayer(groupId);
  const removePlayer = useRemovePlayer(groupId);
  const [name, setName] = useState(current.name);
  const [pixKey, setPixKey] = useState(current.pixKey ?? '');
  const [searchId, setSearchId] = useState('');
  const [found, setFound] = useState<FoundProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  function save() {
    if (!name.trim()) return setMessage({ text: 'O nome não pode ficar vazio.', tone: 'error' });
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
    if (!id) return setMessage({ text: 'O ID tem o formato MF-7K4Q2X.', tone: 'error' });
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
          const isMember = members.data?.some((m) => m.userId === profile.id);
          setMessage({
            text: isMember
              ? `${current.name} agora está ligado à conta de ${profile.displayName}.`
              : `Ligado. ${profile.displayName} ainda não entrou no grupo: mande o código de convite.`,
            tone: 'success',
          });
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

      {current.active ? (
        <Button title="Tirar da lista" variant="danger" onPress={confirmRemove} loading={removePlayer.isPending} />
      ) : (
        <Button
          title="Voltar para a lista"
          variant="secondary"
          onPress={() => updatePlayer.mutate({ playerId: current.id, changes: { active: true } })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  found: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});

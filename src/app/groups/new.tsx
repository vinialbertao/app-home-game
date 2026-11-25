import { router } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, FormMessage, Screen, TextField } from '@/components';
import { useCreateGroup } from '@/services/groups';

/** Criar grupo: quem cria vira admin e já entra na lista de jogadores. */
export default function NewGroupScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createGroup = useCreateGroup();

  function handleCreate() {
    if (!name.trim()) return setError('Dê um nome para o grupo.');
    setError(null);
    createGroup.mutate(name, {
      onSuccess: (groupId) => router.replace({ pathname: '/groups/[groupId]', params: { groupId } }),
      onError: (e) => setError(e.message),
    });
  }

  return (
    <Screen footer={<Button title="Criar grupo" onPress={handleCreate} loading={createGroup.isPending} />}>
      <AppText muted>
        Você vira o admin: cuida da lista de jogadores, do kit de fichas e manda o código de convite.
      </AppText>
      <TextField
        label="Nome do grupo"
        value={name}
        onChangeText={setName}
        placeholder="Ex.: Poker de quinta"
        autoCapitalize="sentences"
        maxLength={60}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleCreate}
      />
      <FormMessage message={error} />
    </Screen>
  );
}

import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, FormMessage, Screen, TextField } from '@/components';
import { extractInviteCode, formatInviteCode } from '@/lib/invite';
import { useJoinGroup } from '@/services/groups';

/** Entrar num grupo com o código que veio no WhatsApp. */
export default function JoinGroupScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const joinGroup = useJoinGroup();

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    const found = extractInviteCode(text);
    if (found) {
      setCode(formatInviteCode(found));
      setError(null);
    } else {
      setError('Não achei um código no que foi copiado. Copie a mensagem do convite e tente de novo.');
    }
  }

  function handleJoin() {
    setError(null);
    joinGroup.mutate(code, {
      onSuccess: (groupId) => router.replace({ pathname: '/groups/[groupId]', params: { groupId } }),
      onError: (e) => setError(e.message),
    });
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Entrar no grupo" onPress={handleJoin} loading={joinGroup.isPending} />
          <Button title="Colar o convite copiado" variant="ghost" onPress={handlePaste} />
        </>
      }
    >
      <AppText muted>
        Copie o código do convite (ou a mensagem inteira) que chegou no WhatsApp e toque em “Colar o convite
        copiado”, ou digite o código.
      </AppText>
      <TextField
        label="Código do convite"
        value={code}
        onChangeText={setCode}
        placeholder="K7MQ-2XPA"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        returnKeyType="go"
        onSubmitEditing={handleJoin}
      />
      <FormMessage message={error} />
    </Screen>
  );
}

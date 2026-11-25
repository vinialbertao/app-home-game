import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, FormMessage, LoadingState, Screen, TextField } from '@/components';
import { checkDisplayName } from '@/lib/authForm';
import { signOut } from '@/services/auth';
import { useMyProfile, useUpdateMyProfile, useUploadAvatar, type MyProfile } from '@/services/profile';
import { colors, spacing } from '@/theme';

/** Meus dados: foto, nome, ID (para copiar), chave Pix e sair. Histórico por grupo entra na versão 2. */
export default function ProfileScreen() {
  const profile = useMyProfile();
  if (!profile.data) {
    return (
      <Screen>
        <LoadingState error={profile.error} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  return <ProfileForm me={profile.data} />;
}

function ProfileForm({ me }: { me: MyProfile }) {
  const updateProfile = useUpdateMyProfile();
  const uploadAvatar = useUploadAvatar();
  const [name, setName] = useState(me.display_name);
  const [pixKey, setPixKey] = useState(me.pix_key ?? '');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setMessage(null);
    uploadAvatar.mutate(
      { uri: asset.uri, mimeType: asset.mimeType },
      {
        onSuccess: () => setMessage({ text: 'Foto atualizada.', tone: 'success' }),
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  async function copyId() {
    await Clipboard.setStringAsync(me.public_id);
    setMessage({ text: `ID ${me.public_id} copiado.`, tone: 'success' });
  }

  function save() {
    const nameError = checkDisplayName(name);
    if (nameError) return setMessage({ text: nameError, tone: 'error' });
    updateProfile.mutate(
      { displayName: name, pixKey },
      {
        onSuccess: () => setMessage({ text: 'Dados salvos.', tone: 'success' }),
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  function confirmSignOut() {
    Alert.alert('Sair da conta?', 'Para voltar, é só entrar de novo com e-mail e senha.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen footer={<Button title="Sair da conta" variant="danger" onPress={confirmSignOut} />}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trocar foto"
          onPress={pickPhoto}
          disabled={uploadAvatar.isPending}
        >
          <Avatar name={me.display_name} photoUrl={me.avatar_url} size={96} />
        </Pressable>
        <Button
          title={uploadAvatar.isPending ? 'Enviando…' : me.avatar_url ? 'Trocar foto' : 'Colocar foto'}
          variant="ghost"
          onPress={pickPhoto}
          loading={uploadAvatar.isPending}
        />
      </View>

      <Card>
        <AppText variant="caption">Seu ID de jogador</AppText>
        <View style={styles.idRow}>
          <AppText variant="number" style={styles.id} selectable>
            {me.public_id}
          </AppText>
          <Button title="Copiar" variant="secondary" compact onPress={copyId} />
        </View>
        <AppText variant="caption">Passe para o admin do grupo ligar sua conta ao seu nome na lista.</AppText>
      </Card>

      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={40}
        hint="É assim que você aparece para os grupos."
      />
      <TextField
        label="Chave Pix"
        value={pixKey}
        onChangeText={setPixKey}
        placeholder="CPF, celular, e-mail ou chave aleatória"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={77}
        hint="Aparece no QR code do acerto quando alguém tiver que te pagar. Só quem é dos seus grupos vê."
      />
      <Button title="Salvar" onPress={save} loading={updateProfile.isPending} />

      <FormMessage message={message?.text} tone={message?.tone} />

      <Card>
        <AppText variant="heading">Meu histórico</AppText>
        <AppText variant="caption">Jogos e saldo em cada grupo chegam na versão 2.</AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xs },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  id: { flex: 1, fontSize: 24, lineHeight: 30, letterSpacing: 1, color: colors.gold },
});

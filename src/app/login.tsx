import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, FormMessage, Screen, ServerStatusBadge, TextField } from '@/components';
import { isValidEmail } from '@/lib/authForm';
import { signIn } from '@/services/auth';
import { colors, spacing } from '@/theme';

/** Entrar com e-mail e senha. Ao entrar, as rotas protegidas levam sozinhas para a tela inicial. */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!isValidEmail(email)) return setError('Digite um e-mail válido.');
    if (!password) return setError('Digite a senha.');
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Entrar" onPress={handleSignIn} loading={loading} />
          <Button
            title="Criar conta"
            variant="ghost"
            disabled={loading}
            onPress={() => router.push('/signup')}
          />
          <ServerStatusBadge />
        </>
      }
    >
      <View style={styles.hero}>
        <AppText variant="caption" style={styles.kicker}>
          HOME GAME DE POKER
        </AppText>
        <AppText variant="title">Mesa Final HG</AppText>
        <AppText muted>Cash e torneio com os amigos, do buy-in ao acerto no Pix.</AppText>
      </View>

      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
      />
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingTop: spacing.xxl * 2, paddingBottom: spacing.lg },
  kicker: { color: colors.gold, letterSpacing: 1.5, fontWeight: '600' },
});

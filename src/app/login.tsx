import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, TextField } from '@/components';
import { colors, spacing } from '@/theme';

/** Login / cadastro. Fase 3: e-mail e senha pelo Supabase Auth; Apple e Google depois do TestFlight. */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen
      footer={
        <>
          <Button title="Entrar" onPress={() => router.replace('/groups')} />
          <Button title="Criar conta" variant="ghost" onPress={() => router.replace('/groups')} />
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
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        hint="Fase 1: os botões só navegam, o login de verdade chega na Fase 3."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingTop: spacing.xxl * 2, paddingBottom: spacing.lg },
  kicker: { color: colors.gold, letterSpacing: 1.5, fontWeight: '600' },
});

import { useState } from 'react';

import { AppText, Button, FormMessage, Screen, TextField } from '@/components';
import { checkDisplayName, checkPassword, isValidEmail } from '@/lib/authForm';
import { checkBirthDate, maskBirthDateInput } from '@/lib/birthDate';
import { signUp } from '@/services/auth';

type Errors = Partial<Record<'name' | 'birthDate' | 'email' | 'password', string>>;

/** Criar conta: nome, data de nascimento (18+), e-mail e senha. Ao criar, já entra. */
export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    const birth = checkBirthDate(birthDate);
    const next: Errors = {
      name: checkDisplayName(name) ?? undefined,
      birthDate: birth.ok ? undefined : birth.error,
      email: isValidEmail(email) ? undefined : 'Digite um e-mail válido.',
      password: checkPassword(password) ?? undefined,
    };
    setErrors(next);
    setServerError(null);
    if (!birth.ok || Object.values(next).some(Boolean)) return;

    setLoading(true);
    const result = await signUp({ displayName: name, birthDateIso: birth.iso, email, password });
    setLoading(false);
    if (!result.ok) setServerError(result.error);
  }

  return (
    <Screen footer={<Button title="Criar conta" onPress={handleSignUp} loading={loading} />}>
      <AppText muted>
        Seu ID de jogador é criado na hora. Ele aparece na tela inicial e serve para os amigos te acharem.
      </AppText>

      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        placeholder="Como os amigos te chamam"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={40}
        error={errors.name}
      />
      <TextField
        label="Data de nascimento"
        value={birthDate}
        onChangeText={(text) => setBirthDate(maskBirthDateInput(text))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        hint="O app é só para maiores de 18 anos. Ninguém do grupo vê essa data."
        error={errors.birthDate}
      />
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
        error={errors.email}
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="Pelo menos 6 caracteres."
        error={errors.password}
      />
      <FormMessage message={serverError} />
    </Screen>
  );
}

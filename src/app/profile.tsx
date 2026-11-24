import { router } from 'expo-router';

import { AppText, Button, Card, Screen } from '@/components';

/** Meu perfil: histórico e saldo em R$ em cada grupo (versão 2). Sair da conta na Fase 3. */
export default function ProfileScreen() {
  return (
    <Screen footer={<Button title="Sair" variant="danger" onPress={() => router.replace('/login')} />}>
      <Card>
        <AppText variant="heading">Vinicius</AppText>
        <AppText variant="caption">Nome e foto vêm da conta na Fase 3.</AppText>
      </Card>
      <Card>
        <AppText variant="heading">Meu histórico</AppText>
        <AppText variant="caption">Saldo em cada grupo, na versão 2.</AppText>
      </Card>
    </Screen>
  );
}

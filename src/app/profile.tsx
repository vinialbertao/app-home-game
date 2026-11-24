import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, Screen } from '@/components';
import { sampleProfile } from '@/services/sampleData';
import { spacing } from '@/theme';

/**
 * Meus dados: foto, nome, ID e chave Pix (Fase 3/4); histórico e saldo por grupo (versão 2).
 */
export default function ProfileScreen() {
  const profile = sampleProfile;

  return (
    <Screen footer={<Button title="Sair" variant="danger" onPress={() => router.replace('/login')} />}>
      <View style={styles.header}>
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={72} />
        <View style={styles.headerText}>
          <AppText variant="heading">{profile.name}</AppText>
          <AppText variant="caption">ID {profile.playerId}</AppText>
        </View>
      </View>

      <Card>
        <AppText variant="heading">Dados da conta</AppText>
        <AppText variant="caption">Nome, foto e e-mail. Editáveis na Fase 3.</AppText>
      </Card>
      <Card>
        <AppText variant="heading">Chave Pix</AppText>
        <AppText variant="caption">Usada no QR code do acerto de contas (Fase 4).</AppText>
      </Card>
      <Card>
        <AppText variant="heading">Meu histórico</AppText>
        <AppText variant="caption">Jogos e saldo em cada grupo, na versão 2.</AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerText: { flex: 1, gap: spacing.xs },
});

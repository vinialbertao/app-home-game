import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText, Button, EmptyState, FormMessage, LoadingState, Screen } from '@/components';
import { formatBRL } from '@/lib/money';
import { buildPixPayload, describePixKey, normalizePixKey } from '@/lib/pix';
import { useCashGame } from '@/services/games';
import { colors, radius, spacing } from '@/theme';

/** QR code do Pix de uma transferência do acerto, já com o valor, e o "copia e cola". */
export default function PixScreen() {
  const { gameId, settlementId } = useLocalSearchParams<{ gameId: string; settlementId: string }>();
  const game = useCashGame(gameId);
  const [copied, setCopied] = useState(false);

  const settlement = game.data?.settlements.find((s) => s.id === settlementId);
  if (!game.data || !settlement) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }

  const receiver = game.data.players.find((p) => p.playerId === settlement.toPlayerId);
  const payer = game.data.players.find((p) => p.playerId === settlement.fromPlayerId);
  const key = receiver?.pixKey ? normalizePixKey(receiver.pixKey) : null;

  if (!receiver || !key) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Pix' }} />
        <EmptyState
          title={receiver?.pixKey ? 'Chave Pix inválida' : 'Sem chave Pix'}
          message={
            receiver?.pixKey
              ? `A chave cadastrada para ${receiver.name} não parece um CPF, celular, e-mail ou chave aleatória válida. Peça para corrigir.`
              : `${receiver?.name ?? 'Quem recebe'} ainda não cadastrou a chave Pix. Ele coloca em Meus dados (ou o admin na lista de jogadores).`
          }
        />
      </Screen>
    );
  }

  const payload = buildPixPayload({
    key,
    receiverName: receiver.name,
    amountCents: settlement.amountCents,
  });

  async function copy() {
    await Clipboard.setStringAsync(payload);
    setCopied(true);
  }

  return (
    <Screen footer={<Button title={copied ? 'Copiado ✓' : 'Copiar Pix copia e cola'} onPress={copy} />}>
      <Stack.Screen options={{ title: `Pix para ${receiver.name}` }} />
      <View style={styles.center}>
        <AppText variant="caption">
          {payer?.name ?? 'Quem paga'} paga para {receiver.name}
        </AppText>
        <AppText variant="number" style={styles.amount}>
          {formatBRL(settlement.amountCents)}
        </AppText>
        <View style={styles.qr} accessibilityLabel={`QR code do Pix de ${formatBRL(settlement.amountCents)} para ${receiver.name}`}>
          <QRCode value={payload} size={240} backgroundColor={colors.qrBackground} color={colors.qrForeground} ecl="M" />
        </View>
        <AppText variant="caption" style={styles.text}>
          Abra o app do banco, escolha Pix → Ler QR code. O valor já vem preenchido.
        </AppText>
        <AppText variant="caption" style={styles.text}>
          {describePixKey(key)}: {key.key}
        </AppText>
      </View>
      <FormMessage message={copied ? 'Código copiado. No app do banco, escolha “Pix copia e cola” e cole.' : null} tone="success" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md },
  amount: { fontSize: 36, lineHeight: 44, color: colors.gold },
  qr: { padding: spacing.lg, backgroundColor: colors.qrBackground, borderRadius: radius.lg },
  text: { textAlign: 'center' },
});

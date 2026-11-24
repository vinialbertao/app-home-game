import { AppText, Card, EmptyState, Screen } from '@/components';
import { formatBRL } from '@/lib/money';

/**
 * Cash game (Fase 4): configurar sessão → mesa ao vivo → contagem final →
 * conferência → acerto de contas com Pix.
 */
export default function CashScreen() {
  return (
    <Screen>
      <Card>
        <AppText variant="caption">Total na mesa</AppText>
        <AppText variant="number">{formatBRL(0)}</AppText>
      </Card>
      <EmptyState
        title="Cash game"
        message="Buy-ins, rebuys, contagem de fichas e acerto no Pix chegam na Fase 4."
      />
    </Screen>
  );
}

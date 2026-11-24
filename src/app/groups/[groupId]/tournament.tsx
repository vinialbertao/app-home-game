import { AppText, Card, EmptyState, Screen } from '@/components';

/**
 * Torneio (Fase 5): configurar → estrutura gerada → sorteio de mesas →
 * torneio ao vivo → mesa final → resultado.
 */
export default function TournamentScreen() {
  return (
    <Screen>
      <Card>
        <AppText variant="caption">Nível 1 · Blinds</AppText>
        <AppText variant="number">25 / 50</AppText>
      </Card>
      <EmptyState
        title="Torneio"
        message="Gerador de estrutura, mesas, timer e premiação chegam na Fase 5."
      />
    </Screen>
  );
}

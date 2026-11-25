import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, DeleteGameButton, FormMessage, LoadingState, Screen } from '@/components';
import { paidIn } from '@/lib/cash';
import { formatBRL } from '@/lib/money';
import { toCashPlayers, useAddBuyin, useCashGame, useSetGameStatus, type CashGame, type GamePlayer } from '@/services/games';
import { colors, spacing } from '@/theme';

/** Jogo de cash: mesa ao vivo. Contando → tela de contagem; encerrado → acerto. */
export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useCashGame(gameId);

  if (!game.data) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }
  if (game.data.status === 'counting') {
    return <Redirect href={{ pathname: '/games/[gameId]/count', params: { gameId } }} />;
  }
  if (game.data.status === 'finished') {
    return <Redirect href={{ pathname: '/games/[gameId]/settlement', params: { gameId } }} />;
  }
  return <LiveTable game={game.data} />;
}

function LiveTable({ game }: { game: CashGame }) {
  const addBuyin = useAddBuyin(game);
  const setStatus = useSetGameStatus(game);
  const cashPlayers = toCashPlayers(game);
  const totalOnTable = cashPlayers.reduce((sum, p) => sum + paidIn(p), 0);
  const buyin = game.settings.buyin_cents;
  const { small_blind_cents: sb, big_blind_cents: bb } = game.settings;

  function quickRebuy(player: GamePlayer) {
    addBuyin.mutate({ gamePlayerId: player.id, kind: 'rebuy', amountCents: buyin });
  }

  function finish() {
    Alert.alert(
      'Encerrar a mesa?',
      'Vamos contar as fichas de cada jogador. Dá para voltar para a mesa se precisar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Contar fichas',
          onPress: () =>
            setStatus.mutate('counting', {
              onSuccess: () => router.replace({ pathname: '/games/[gameId]/count', params: { gameId: game.id } }),
            }),
        },
      ],
    );
  }

  return (
    <Screen
      footer={
        game.isHost ? (
          <>
            <Button
              title="Adicionar jogador"
              variant="secondary"
              onPress={() => router.push({ pathname: '/games/[gameId]/add-player', params: { gameId: game.id } })}
            />
            <Button title="Encerrar e contar fichas" onPress={finish} loading={setStatus.isPending} />
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Cash ao vivo' }} />

      <Card>
        <AppText variant="caption">Total na mesa</AppText>
        <AppText variant="number" style={styles.total}>
          {formatBRL(totalOnTable)}
        </AppText>
        <AppText variant="caption">
          {game.players.length} jogadores · buy-in {formatBRL(buyin)}
          {sb && bb ? ` · blinds ${formatBRL(sb)} / ${formatBRL(bb)}` : ''}
        </AppText>
      </Card>

      {!game.isHost ? (
        <AppText variant="caption" style={styles.center}>
          Só o host lança buy-ins e rebuys. Esta tela atualiza sozinha. Quando o host encerrar a mesa, você
          conta as suas fichas aqui no seu celular.
        </AppText>
      ) : null}

      {game.players.map((player) => {
        const total = player.buyins.reduce((sum, b) => sum + b.amountCents, 0);
        const rebuys = player.buyins.filter((b) => b.kind === 'rebuy').length;
        return (
          <Card
            key={player.id}
            accessibilityLabel={`Detalhes de ${player.name}`}
            onPress={() =>
              router.push({
                pathname: '/games/[gameId]/player/[gamePlayerId]',
                params: { gameId: game.id, gamePlayerId: player.id },
              })
            }
          >
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="label">{player.name}</AppText>
                <AppText variant="caption">
                  {rebuys === 0 ? 'Sem rebuy' : rebuys === 1 ? '1 rebuy' : `${rebuys} rebuys`}
                  {player.isCounted ? ' · fichas contadas' : ''}
                </AppText>
              </View>
              <AppText variant="number">{formatBRL(total)}</AppText>
              {game.isHost ? (
                <Button
                  title={`+ ${formatBRL(buyin).replace('R$ ', '')}`}
                  variant="secondary"
                  compact
                  accessibilityLabel={`Rebuy de ${formatBRL(buyin)} para ${player.name}`}
                  onPress={() => quickRebuy(player)}
                  disabled={addBuyin.isPending}
                />
              ) : null}
            </View>
          </Card>
        );
      })}

      {game.isHost ? (
        <AppText variant="caption" style={styles.center}>
          O botão + lança um rebuy do valor do buy-in. Para outro valor ou para desfazer, toque no jogador.
        </AppText>
      ) : null}
      <FormMessage message={addBuyin.error?.message ?? setStatus.error?.message} />
      <DeleteGameButton game={game} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 40, lineHeight: 48, color: colors.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
});

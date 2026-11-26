import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, DeleteGameButton, FormMessage, LoadingState, Screen } from '@/components';
import { formatBRL } from '@/lib/money';
import {
  applyMoves,
  drawFinalTable,
  drawSeats,
  planBalance,
  planTableChange,
  seatBack,
  seededRandom,
  type SeatedTable,
} from '@/lib/seating';
import { canRebuyMore, rebuyOpen } from '@/lib/tournament';
import {
  spentCents,
  useBeginTournament,
  toSeatedTables,
  usePlayerBusted,
  useSetSeating,
  useTournament,
  useUndoElimination,
  type TournamentGame,
  type TournamentPlayer,
} from '@/services/tournament';
import { colors, minTouchSize, radius, spacing } from '@/theme';

/**
 * Torneio, parte 5b: mesas sorteadas, dealer de cada mesa, botão "Caiu" (rebuy ou eliminação),
 * balanceamento, desfazer mesa e mesa final. O relógio dos níveis entra na 5c.
 */
export default function TournamentGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useTournament(gameId);

  if (!game.data) {
    return (
      <Screen>
        <LoadingState error={game.error} onRetry={() => game.refetch()} />
      </Screen>
    );
  }
  return <TournamentTables game={game.data} />;
}

function TournamentTables({ game }: { game: TournamentGame }) {
  const setSeating = useSetSeating(game);
  const busted = usePlayerBusted(game);
  const undo = useUndoElimination(game);
  const begin = useBeginTournament(game);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  const byId = new Map(game.players.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id ? (byId.get(id)?.name ?? 'Jogador') : '');
  const tables = toSeatedTables(game);
  const alive = game.players.filter((p) => p.eliminatedPosition === null);
  const out = game.players
    .filter((p) => p.eliminatedPosition !== null)
    .sort((a, b) => a.eliminatedPosition! - b.eliminatedPosition!);
  const hostGamePlayerId = game.players.find((p) => p.profileId === game.hostId)?.id ?? null;
  const maxSeats = game.settings.maxSeats;
  const openRebuy = rebuyOpen(game.settings, game.levels, game.currentLevel);

  // Sorteios das sugestões com semente fixa para o estado atual: não mudam a cada atualização da tela.
  const seed = alive.length * 97 + tables.length * 13 + out.length;
  const tableChange = game.isHost
    ? planTableChange(tables, { maxSeats, random: seededRandom(seed) })
    : { kind: 'none' as const };
  const balance =
    game.isHost && tableChange.kind === 'none'
      ? planBalance(tables, { hostPlayerId: hostGamePlayerId, maxSeats, random: seededRandom(seed + 1) })
      : null;

  const started = game.status === 'live';
  const iControl = (table: SeatedTable) =>
    started && (game.isHost || (game.myGamePlayerId !== null && table.dealerId === game.myGamePlayerId));
  const tablesWithoutDealer = tables.filter((t) => t.number > 1 && !t.dealerId).map((t) => t.number);

  function startTournament() {
    if (tablesWithoutDealer.length > 0) {
      return setMessage({
        text: `Escolha o dealer da mesa ${tablesWithoutDealer.join(' e da mesa ')} antes de começar.`,
        tone: 'error',
      });
    }
    Alert.alert('Começar o torneio?', 'As mesas ficam como estão e o nível 1 começa agora.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Começar',
        onPress: () =>
          begin.mutate(undefined, {
            onSuccess: () => setMessage({ text: 'Torneio começou. Boa sorte a todos!', tone: 'success' }),
            onError: fail,
          }),
      },
    ]);
  }

  const fail = (e: Error) => setMessage({ text: e.message, tone: 'error' });

  function save(next: SeatedTable[], success?: string) {
    setMessage(null);
    setSeating.mutate(next, {
      onSuccess: () => success && setMessage({ text: success, tone: 'success' }),
      onError: fail,
    });
  }

  function eliminate(player: TournamentPlayer) {
    busted.mutate(
      { gamePlayerId: player.id, rebuy: false },
      {
        onSuccess: (r) =>
          setMessage({
            text: r.result === 'eliminated' ? `${player.name} caiu em ${r.position}º.` : '',
            tone: 'success',
          }),
        onError: fail,
      },
    );
  }

  function rebuy(player: TournamentPlayer) {
    busted.mutate(
      { gamePlayerId: player.id, rebuy: true },
      {
        onSuccess: () => setMessage({ text: `Rebuy de ${player.name} registrado.`, tone: 'success' }),
        onError: fail,
      },
    );
  }

  function onCaiu(player: TournamentPlayer) {
    const rebuys = player.buyins.filter((b) => b.kind === 'rebuy').length;
    if (openRebuy && canRebuyMore(game.settings, rebuys)) {
      Alert.alert(
        `${player.name} caiu`,
        `Vai dar rebuy? (${formatBRL(game.settings.buyinCents)} e ${game.settings.startingStack} fichas)`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Não, eliminar', style: 'destructive', onPress: () => eliminate(player) },
          { text: 'Sim, rebuy', onPress: () => rebuy(player) },
        ],
      );
      return;
    }
    Alert.alert(
      `${player.name} caiu?`,
      openRebuy ? 'Ele já fez o máximo de rebuys: vai ser eliminado.' : 'O período de rebuy acabou: vai ser eliminado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => eliminate(player) },
      ],
    );
  }

  function confirmRebuy(player: TournamentPlayer) {
    Alert.alert(
      `Rebuy de ${player.name}?`,
      `${formatBRL(game.settings.buyinCents)} e ${game.settings.startingStack} fichas a mais.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Registrar rebuy', onPress: () => rebuy(player) },
      ],
    );
  }

  function chooseDealer(table: SeatedTable) {
    const options = table.seats.map((s) => ({
      text: nameOf(s.playerId),
      onPress: () =>
        save(
          tables.map((t) => (t.number === table.number ? { ...t, dealerId: s.playerId } : t)),
          `${nameOf(s.playerId)} é o dealer da mesa ${table.number}.`,
        ),
    }));
    Alert.alert(`Dealer da mesa ${table.number}`, 'Quem cuida desta mesa?', [
      ...options,
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function redraw() {
    Alert.alert('Sortear de novo?', 'Todos os lugares mudam e os dealers precisam ser escolhidos de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sortear',
        onPress: () =>
          save(
            drawSeats({
              playerIds: alive.map((p) => p.id),
              hostPlayerId: hostGamePlayerId,
              maxSeats,
              random: Math.random,
            }),
            'Mesas sorteadas de novo.',
          ),
      },
    ]);
  }

  function undoLast(player: TournamentPlayer) {
    Alert.alert('Desfazer a eliminação?', `${player.name} volta para o torneio, num lugar livre.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desfazer',
        onPress: () =>
          undo.mutate(
            { gamePlayerId: player.id, tables: seatBack(tables, player.id, maxSeats) },
            { onSuccess: () => setMessage({ text: `${player.name} voltou.`, tone: 'success' }), onError: fail },
          ),
      },
    ]);
  }

  const me = game.myGamePlayerId ? byId.get(game.myGamePlayerId) : undefined;
  const myTable = me ? tables.find((t) => t.seats.some((s) => s.playerId === me.id)) : undefined;
  const mySeat = myTable?.seats.find((s) => s.playerId === me?.id)?.seat;
  const totalIn = game.players.reduce((sum, p) => sum + spentCents(p), 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: alive.length > 1 ? `Torneio · ${alive.length} jogando` : 'Torneio' }} />

      {/* Meu resumo */}
      {me ? (
        <Card>
          {me.eliminatedPosition !== null ? (
            <AppText variant="heading">Você caiu em {me.eliminatedPosition}º</AppText>
          ) : (
            <AppText variant="heading">
              Mesa {myTable?.number ?? '—'} · lugar {mySeat ?? '—'}
            </AppText>
          )}
          <AppText variant="caption">Você gastou (é o que você deve ao host)</AppText>
          <AppText variant="number" style={styles.gold}>
            {formatBRL(spentCents(me))}
          </AppText>
          <AppText variant="caption">
            Buy-in
            {me.buyins.some((b) => b.kind === 'rebuy')
              ? ` + ${me.buyins.filter((b) => b.kind === 'rebuy').length} rebuy(s)`
              : ''}
            {me.buyins.some((b) => b.kind === 'addon') ? ' + add-on' : ''}
          </AppText>
        </Card>
      ) : null}

      {/* Avisos do host: desfazer mesa / mesa final / balanceamento */}
      {tableChange.kind === 'final' ? (
        <Card style={styles.alertCard}>
          <AppText variant="heading">Hora da mesa final!</AppText>
          <AppText>Os {alive.length} que sobraram cabem numa mesa. O app sorteia os lugares de novo na mesa 1.</AppText>
          <Button
            title="Montar a mesa final"
            loading={setSeating.isPending}
            onPress={() =>
              save(
                [
                  drawFinalTable(
                    alive.map((p) => p.id),
                    Math.random,
                  ),
                ],
                'Mesa final montada. Boa sorte!',
              )
            }
          />
        </Card>
      ) : null}
      {tableChange.kind === 'break' ? (
        <Card style={styles.alertCard}>
          <AppText variant="heading">Desfazer a mesa {tableChange.table}</AppText>
          {tableChange.moves.map((m) => (
            <AppText key={m.playerId}>
              {nameOf(m.playerId)} → mesa {m.toTable}, lugar {m.toSeat}
            </AppText>
          ))}
          <Button
            title="Feito"
            loading={setSeating.isPending}
            onPress={() => save(applyMoves(tables, tableChange.moves), `Mesa ${tableChange.table} desfeita.`)}
          />
        </Card>
      ) : null}
      {balance ? (
        <Card style={styles.alertCard}>
          <AppText variant="heading">Balancear as mesas</AppText>
          <AppText>
            Mova {nameOf(balance.playerId)} da mesa {balance.fromTable} para a mesa {balance.toTable}, lugar{' '}
            {balance.toSeat}.
          </AppText>
          <Button
            title="Feito"
            loading={setSeating.isPending}
            onPress={() => save(applyMoves(tables, [balance]), `${nameOf(balance.playerId)} mudou de mesa.`)}
          />
        </Card>
      ) : null}

      <FormMessage message={message?.text} tone={message?.tone} />

      {/* Mesas */}
      {tables.map((table) => {
        const controls = iControl(table);
        const needsDealer = table.number > 1 && !table.dealerId;
        return (
          <Card key={table.number}>
            <View style={styles.row}>
              <AppText variant="heading" style={styles.flex}>
                Mesa {table.number}
              </AppText>
              <AppText variant="caption">{table.seats.length} jogadores</AppText>
            </View>
            {table.number === 1 ? (
              <AppText variant="caption">Dealer: o host</AppText>
            ) : game.isHost ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Escolher o dealer da mesa ${table.number}`}
                onPress={() => chooseDealer(table)}
                style={[styles.dealer, needsDealer && styles.dealerMissing]}
              >
                <AppText variant="label" style={needsDealer ? styles.warning : undefined}>
                  {needsDealer ? 'Escolher o dealer desta mesa' : `Dealer: ${nameOf(table.dealerId)} (trocar)`}
                </AppText>
              </Pressable>
            ) : (
              <AppText variant="caption">
                Dealer: {table.dealerId ? nameOf(table.dealerId) : 'ainda não escolhido'}
              </AppText>
            )}
            {table.seats.map((seat) => {
              const player = byId.get(seat.playerId);
              if (!player) return null;
              const rebuys = player.buyins.filter((b) => b.kind === 'rebuy').length;
              const isMe = player.id === game.myGamePlayerId;
              return (
                <View key={seat.playerId} style={[styles.seat, isMe && styles.seatMe]}>
                  <AppText variant="number" style={styles.seatNumber}>
                    {seat.seat}
                  </AppText>
                  <View style={styles.flex}>
                    <AppText variant="label">
                      {player.name}
                      {table.dealerId === player.id ? ' · dealer' : ''}
                    </AppText>
                    {rebuys > 0 ? <AppText variant="caption">{rebuys} rebuy</AppText> : null}
                  </View>
                  {controls && openRebuy && canRebuyMore(game.settings, rebuys) ? (
                    <Button title="Rebuy" variant="secondary" compact onPress={() => confirmRebuy(player)} />
                  ) : null}
                  {controls ? <Button title="Caiu" variant="danger" compact onPress={() => onCaiu(player)} /> : null}
                </View>
              );
            })}
          </Card>
        );
      })}

      {game.status === 'setup' ? (
        game.isHost ? (
          <>
            <Button title="Começar torneio" onPress={startTournament} loading={begin.isPending} />
            <Button
              title="Sortear as mesas de novo"
              variant="secondary"
              onPress={redraw}
              loading={setSeating.isPending}
            />
          </>
        ) : (
          <AppText variant="caption" style={styles.center}>
            Mesas sorteadas. Esperando o host começar o torneio.
          </AppText>
        )
      ) : null}

      {/* Quem já caiu */}
      {out.length > 0 ? (
        <Card>
          <AppText variant="heading">Já caíram</AppText>
          {out.map((player, i) => (
            <View key={player.id} style={styles.row}>
              <AppText variant="number" style={styles.seatNumber}>
                {player.eliminatedPosition}º
              </AppText>
              <AppText style={styles.flex}>{player.name}</AppText>
              {i === 0 && game.isHost ? (
                <Button title="Desfazer" variant="ghost" compact onPress={() => undoLast(player)} />
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <AppText variant="caption">Arrecadado até agora</AppText>
        <AppText variant="number" style={styles.gold}>
          {formatBRL(totalIn)}
        </AppText>
        <AppText variant="caption">
          {openRebuy ? 'Período de rebuy aberto.' : 'Período de rebuy encerrado: quem cair é eliminado.'}
        </AppText>
      </Card>

      <DeleteGameButton game={{ ...game, settlements: [] }} label="torneio" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gold: { color: colors.gold },
  warning: { color: colors.warning },
  alertCard: { borderColor: colors.gold },
  dealer: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dealerMissing: { borderColor: colors.warning },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  seatMe: { backgroundColor: colors.primarySoft },
  seatNumber: { width: 32, textAlign: 'center', color: colors.textMuted },
});

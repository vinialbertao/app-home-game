import { useMutation, useQuery } from '@tanstack/react-query';

import type { CashDenomination, CashPlayer } from '@/lib/cash';
import type { Cents } from '@/lib/money';
import type { Transfer } from '@/lib/settlement';

import { fetchKit, type StoredDenomination } from './kits';
import { queryClient, queryKeys } from './queryClient';
import { useUserId } from './session';
import { getSupabase } from './supabase';

export type GameStatus = 'setup' | 'live' | 'counting' | 'settling' | 'finished' | 'cancelled';

export type CashSettings = {
  buyin_cents: Cents;
  small_blind_cents?: Cents | null;
  big_blind_cents?: Cents | null;
};

export type BuyinEntry = { id: string; kind: 'buyin' | 'rebuy' | 'addon'; amountCents: Cents; createdAt: string };

export type GamePlayer = {
  /** game_players.id */
  id: string;
  playerId: string;
  name: string;
  profileId: string | null;
  /** chave Pix que vale no acerto: a do perfil de quem tem conta, senão a da lista */
  pixKey: string | null;
  buyins: BuyinEntry[];
  /** denominationId → quantidade; null = ainda não foi contado */
  counts: Record<string, number> | null;
  adjustments: Cents[];
};

export type Adjustment = { id: string; gamePlayerId: string; amountCents: Cents; reason: string; createdAt: string };

export type Settlement = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  amountCents: Cents;
  paidAt: string | null;
  receivedAt: string | null;
};

export type CashGame = {
  id: string;
  groupId: string;
  status: GameStatus;
  hostId: string | null;
  isHost: boolean;
  settings: CashSettings;
  startedAt: string | null;
  finishedAt: string | null;
  denominations: StoredDenomination[];
  players: GamePlayer[];
  adjustments: Adjustment[];
  settlements: Settlement[];
};

/** Para os cálculos de src/lib/cash */
export function toCashPlayers(game: CashGame): CashPlayer[] {
  return game.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    buyins: p.buyins.map((b) => b.amountCents),
    counts: p.counts ?? {},
    adjustments: p.adjustments,
  }));
}

export function toCashDenominations(game: CashGame): CashDenomination[] {
  return game.denominations.map((d) => ({ id: d.id, value: d.value }));
}

function invalidateGame(gameId: string, groupId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
  if (groupId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.groupGames(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.groupSettlements(groupId) });
  }
}

async function fetchCashGame(gameId: string, userId: string): Promise<CashGame> {
  const supabase = getSupabase();
  const { data: game, error } = await supabase
    .from('games')
    .select('id, group_id, type, status, host_id, kit_id, settings, started_at, finished_at')
    .eq('id', gameId)
    .single();
  if (error) throw error;

  const [players, buyins, counts, adjustments, settlements, kit] = await Promise.all([
    supabase
      .from('game_players')
      .select('id, player_id, players(name, profile_id, pix_key, profiles(pix_key))')
      .eq('game_id', gameId)
      .order('created_at'),
    supabase
      .from('buyins')
      .select('id, game_player_id, kind, amount_cents, created_at')
      .eq('game_id', gameId)
      .order('created_at'),
    supabase.from('chip_counts').select('game_player_id, denomination_id, quantity').eq('game_id', gameId),
    supabase
      .from('adjustments')
      .select('id, game_player_id, amount_cents, reason, created_at')
      .eq('game_id', gameId)
      .order('created_at'),
    supabase
      .from('settlements')
      .select('id, from_player_id, to_player_id, amount_cents, paid_at, received_at')
      .eq('game_id', gameId)
      .order('created_at'),
    game.kit_id ? fetchKit(game.kit_id) : Promise.resolve(null),
  ]);
  for (const result of [players, buyins, counts, adjustments, settlements]) {
    if (result.error) throw result.error;
  }

  const gamePlayers: GamePlayer[] = players.data!.map((gp) => {
    const counted = counts.data!.filter((c) => c.game_player_id === gp.id);
    return {
      id: gp.id,
      playerId: gp.player_id,
      name: gp.players?.name ?? 'Jogador',
      profileId: gp.players?.profile_id ?? null,
      pixKey: gp.players?.profiles?.pix_key || gp.players?.pix_key || null,
      buyins: buyins
        .data!.filter((b) => b.game_player_id === gp.id)
        .map((b) => ({
          id: b.id,
          kind: b.kind as BuyinEntry['kind'],
          amountCents: b.amount_cents,
          createdAt: b.created_at,
        })),
      counts: counted.length > 0 ? Object.fromEntries(counted.map((c) => [c.denomination_id, c.quantity])) : null,
      adjustments: adjustments.data!.filter((a) => a.game_player_id === gp.id).map((a) => a.amount_cents),
    };
  });

  return {
    id: game.id,
    groupId: game.group_id,
    status: game.status as GameStatus,
    hostId: game.host_id,
    isHost: game.host_id === userId,
    settings: (game.settings ?? {}) as CashSettings,
    startedAt: game.started_at,
    finishedAt: game.finished_at,
    denominations: kit?.denominations ?? [],
    players: gamePlayers,
    adjustments: adjustments.data!.map((a) => ({
      id: a.id,
      gamePlayerId: a.game_player_id,
      amountCents: a.amount_cents,
      reason: a.reason,
      createdAt: a.created_at,
    })),
    settlements: settlements.data!.map((s) => ({
      id: s.id,
      fromPlayerId: s.from_player_id,
      toPlayerId: s.to_player_id,
      amountCents: s.amount_cents,
      paidAt: s.paid_at,
      receivedAt: s.received_at,
    })),
  };
}

/**
 * Jogo de cash completo. Quem não é o host vê só leitura, atualizando a cada 5 segundos
 * (o "ao vivo" instantâneo entra na Fase 6).
 */
export function useCashGame(gameId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.game(gameId),
    queryFn: () => fetchCashGame(gameId, userId),
    refetchInterval: (query) => {
      const game = query.state.data;
      if (!game || game.status === 'cancelled') return false;
      return game.isHost && game.status !== 'finished' ? false : 5000;
    },
  });
}

type StartCashInput = {
  groupId: string;
  kitId: string;
  playerIds: string[];
  buyinCents: Cents;
  smallBlindCents: Cents | null;
  bigBlindCents: Cents | null;
};

/** Começa o cash: cria o jogo, coloca quem veio e lança o buy-in inicial de cada um. */
export function useStartCashGame() {
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: StartCashInput): Promise<string> => {
      const supabase = getSupabase();
      const settings: CashSettings = {
        buyin_cents: input.buyinCents,
        small_blind_cents: input.smallBlindCents,
        big_blind_cents: input.bigBlindCents,
      };
      const { data: game, error } = await supabase
        .from('games')
        .insert({
          group_id: input.groupId,
          type: 'cash',
          status: 'live',
          host_id: userId,
          kit_id: input.kitId,
          settings,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw new Error('Não foi possível começar o jogo.');

      const { data: gamePlayers, error: playersError } = await supabase
        .from('game_players')
        .insert(input.playerIds.map((playerId) => ({ game_id: game.id, player_id: playerId })))
        .select('id');
      if (playersError) throw new Error('Não foi possível colocar os jogadores na mesa.');

      const { error: buyinError } = await supabase.from('buyins').insert(
        gamePlayers.map((gp) => ({
          game_id: game.id,
          game_player_id: gp.id,
          kind: 'buyin',
          amount_cents: input.buyinCents,
        })),
      );
      if (buyinError) throw new Error('Não foi possível lançar os buy-ins.');
      return game.id;
    },
    onSuccess: (_gameId, input) => queryClient.invalidateQueries({ queryKey: queryKeys.groupGames(input.groupId) }),
  });
}

export function useAddBuyin(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; kind: 'buyin' | 'rebuy'; amountCents: Cents }) => {
      const { error } = await getSupabase().from('buyins').insert({
        game_id: game.id,
        game_player_id: input.gamePlayerId,
        kind: input.kind,
        amount_cents: input.amountCents,
      });
      if (error) throw new Error('Não foi possível lançar. Só o host lança buy-ins e rebuys.');
    },
    onSuccess: () => invalidateGame(game.id),
  });
}

export function useDeleteBuyin(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (buyinId: string) => {
      const { error } = await getSupabase().from('buyins').delete().eq('id', buyinId);
      if (error) throw new Error('Não foi possível desfazer.');
    },
    onSuccess: () => invalidateGame(game.id),
  });
}

/** Coloca na mesa alguém que chegou depois (já com o buy-in). Se for nome novo, entra também na lista do grupo. */
export function useAddPlayerToGame(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (input: { playerId?: string; newName?: string; buyinCents: Cents }) => {
      const supabase = getSupabase();
      let playerId = input.playerId;
      if (!playerId) {
        const { data, error } = await supabase
          .from('players')
          .insert({ group_id: game.groupId, name: (input.newName ?? '').trim() })
          .select('id')
          .single();
        if (error) throw new Error('Não foi possível adicionar o jogador.');
        playerId = data.id;
      }
      const { data: gp, error } = await supabase
        .from('game_players')
        .insert({ game_id: game.id, player_id: playerId })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('Esse jogador já está na mesa.');
        throw new Error('Não foi possível colocar o jogador na mesa.');
      }
      const { error: buyinError } = await supabase
        .from('buyins')
        .insert({ game_id: game.id, game_player_id: gp.id, kind: 'buyin', amount_cents: input.buyinCents });
      if (buyinError) throw new Error('Jogador na mesa, mas o buy-in não foi lançado.');
    },
    onSuccess: () => {
      invalidateGame(game.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.players(game.groupId) });
    },
  });
}

export function useSetGameStatus(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (status: 'live' | 'counting') => {
      const { error } = await getSupabase().from('games').update({ status }).eq('id', game.id);
      if (error) throw new Error('Não foi possível mudar a etapa do jogo.');
    },
    onSuccess: () => invalidateGame(game.id, game.groupId),
  });
}

/** Grava a contagem de um jogador (todas as cores, inclusive as zeradas: assim fica marcado como contado). */
export function useSaveCount(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; counts: Record<string, number> }) => {
      const rows = Object.entries(input.counts).map(([denominationId, quantity]) => ({
        game_id: game.id,
        game_player_id: input.gamePlayerId,
        denomination_id: denominationId,
        quantity,
      }));
      const { error } = await getSupabase()
        .from('chip_counts')
        .upsert(rows, { onConflict: 'game_player_id,denomination_id' });
      if (error) throw new Error('Não foi possível salvar a contagem.');
    },
    onSuccess: () => invalidateGame(game.id),
  });
}

export function useAddAdjustment(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; amountCents: Cents; reason: string }) => {
      const { error } = await getSupabase().from('adjustments').insert({
        game_id: game.id,
        game_player_id: input.gamePlayerId,
        amount_cents: input.amountCents,
        reason: input.reason.trim(),
      });
      if (error) throw new Error('Não foi possível registrar o ajuste.');
    },
    onSuccess: () => invalidateGame(game.id),
  });
}

export function useDeleteAdjustment(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (adjustmentId: string) => {
      const { error } = await getSupabase().from('adjustments').delete().eq('id', adjustmentId);
      if (error) throw new Error('Não foi possível apagar o ajuste.');
    },
    onSuccess: () => invalidateGame(game.id),
  });
}

/** Salva o acerto de uma vez. O banco confere centavo por centavo antes de aceitar. */
export function useSaveSettlement(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async (transfers: Transfer[]) => {
      const { error } = await getSupabase().rpc('save_cash_settlement', {
        p_game_id: game.id,
        p_transfers: transfers.map((t) => ({ from: t.from, to: t.to, amount_cents: t.amountCents })),
      });
      if (error) {
        if (error.message.includes('pagamentos marcados')) {
          throw new Error('Esse acerto já tem pagamentos marcados e não pode ser refeito.');
        }
        if (error.message.includes('não bate')) {
          throw new Error('O acerto não bate com a contagem. Confira as fichas e tente de novo.');
        }
        throw new Error('Não foi possível salvar o acerto.');
      }
    },
    onSuccess: () => invalidateGame(game.id, game.groupId),
  });
}

/** Volta um jogo encerrado para a contagem (só se ninguém marcou pagamento ainda). */
export function useReopenCount(game: Pick<CashGame, 'id' | 'groupId'>) {
  return useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase()
        .from('games')
        .update({ status: 'counting', finished_at: null })
        .eq('id', game.id);
      if (error) throw new Error('Não foi possível reabrir a contagem.');
    },
    onSuccess: () => invalidateGame(game.id, game.groupId),
  });
}

/** "Paguei" (quem paga) e "Recebi" (quem recebe). O host pode marcar pelos dois. */
export function useMarkSettlement(groupId: string, gameId: string) {
  return useMutation({
    mutationFn: async (input: { settlementId: string; field: 'paid' | 'received'; value: boolean }) => {
      const now = input.value ? new Date().toISOString() : null;
      const update = input.field === 'paid' ? { paid_at: now } : { received_at: now };
      const { data, error } = await getSupabase()
        .from('settlements')
        .update(update)
        .eq('id', input.settlementId)
        .select('id');
      if (error || !data || data.length === 0) {
        throw new Error(
          input.field === 'paid'
            ? 'Só quem paga (ou o host) marca "Paguei".'
            : 'Só quem recebe (ou o host) marca "Recebi".',
        );
      }
    },
    onSuccess: () => invalidateGame(gameId, groupId),
  });
}

export type GameSummary = {
  id: string;
  type: 'cash' | 'tournament';
  status: GameStatus;
  startedAt: string | null;
  finishedAt: string | null;
  playerCount: number;
};

/** Jogos do grupo, do mais novo para o mais antigo. */
export function useGroupGames(groupId: string) {
  return useQuery({
    queryKey: queryKeys.groupGames(groupId),
    queryFn: async (): Promise<GameSummary[]> => {
      const { data, error } = await getSupabase()
        .from('games')
        .select('id, type, status, started_at, finished_at, created_at, game_players(count)')
        .eq('group_id', groupId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data.map((g) => ({
        id: g.id,
        type: g.type as GameSummary['type'],
        status: g.status as GameStatus,
        startedAt: g.started_at ?? g.created_at,
        finishedAt: g.finished_at,
        playerCount: g.game_players[0]?.count ?? 0,
      }));
    },
  });
}

export type OpenSettlement = Settlement & {
  gameId: string;
  fromName: string;
  toName: string;
  gameDate: string | null;
};

/** Acertos do grupo que ainda não foram confirmados pelos dois lados ("dívida fica no grupo"). */
export function useGroupOpenSettlements(groupId: string) {
  return useQuery({
    queryKey: queryKeys.groupSettlements(groupId),
    queryFn: async (): Promise<OpenSettlement[]> => {
      const { data, error } = await getSupabase()
        .from('settlements')
        .select(
          'id, game_id, from_player_id, to_player_id, amount_cents, paid_at, received_at, games!inner(group_id, finished_at), from:players!settlements_from_player_id_fkey(name), to:players!settlements_to_player_id_fkey(name)',
        )
        .eq('games.group_id', groupId)
        .or('paid_at.is.null,received_at.is.null')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((s) => ({
        id: s.id,
        gameId: s.game_id,
        fromPlayerId: s.from_player_id,
        toPlayerId: s.to_player_id,
        amountCents: s.amount_cents,
        paidAt: s.paid_at,
        receivedAt: s.received_at,
        fromName: s.from?.name ?? 'Jogador',
        toName: s.to?.name ?? 'Jogador',
        gameDate: s.games?.finished_at ?? null,
      }));
    },
  });
}

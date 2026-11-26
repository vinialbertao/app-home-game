import { useMutation, useQuery } from '@tanstack/react-query';

import type { Cents } from '@/lib/money';
import { drawSeats, type SeatedTable } from '@/lib/seating';
import type { StructureLevel } from '@/lib/structure';
import type { TournamentDraft, TournamentSettings } from '@/lib/tournament';

import type { Json } from './database.types';
import type { BuyinEntry, GameStatus } from './games';
import { queryClient, queryKeys } from './queryClient';
import { useUserId } from './session';
import { fromRows, levelRows, type LevelRow } from './structures';
import { getSupabase } from './supabase';

/** Configurações do torneio guardadas no jogo (as da estrutura + lugares por mesa). */
export type TournamentGameSettings = TournamentSettings & { maxSeats: number };

export type TournamentPlayer = {
  /** id em game_players */
  id: string;
  playerId: string;
  name: string;
  profileId: string | null;
  buyins: BuyinEntry[];
  /** Posição final de quem já caiu (14º, 13º...), ou null se ainda está no torneio. */
  eliminatedPosition: number | null;
};

export type TournamentTable = {
  id: string;
  number: number;
  dealerGamePlayerId: string | null;
  seats: { seat: number; gamePlayerId: string }[];
};

export type TournamentGame = {
  id: string;
  groupId: string;
  status: GameStatus;
  hostId: string | null;
  isHost: boolean;
  myGamePlayerId: string | null;
  settings: TournamentGameSettings;
  levels: StructureLevel[];
  /** Posição na lista de níveis (contando intervalos), 1 = primeiro. null = ainda não começou. */
  currentLevel: number | null;
  levelStartedAt: string | null;
  pausedAt: string | null;
  players: TournamentPlayer[];
  /** Só as mesas em jogo, em ordem. */
  tables: TournamentTable[];
};

async function fetchTournament(gameId: string, userId: string): Promise<TournamentGame> {
  const supabase = getSupabase();
  const { data: game, error } = await supabase
    .from('games')
    .select('id, group_id, type, status, host_id, settings, structure_id, current_level, level_started_at, paused_at')
    .eq('id', gameId)
    .single();
  if (error) throw new Error('Não foi possível abrir o torneio.');

  const [levels, players, buyins, eliminations, tables, seats] = await Promise.all([
    supabase
      .from('levels')
      .select('position, is_break, small_blind, big_blind, ante, duration_minutes, color_up')
      .eq('structure_id', game.structure_id ?? ''),
    supabase
      .from('game_players')
      .select('id, player_id, players(name, profile_id)')
      .eq('game_id', gameId)
      .order('created_at'),
    supabase
      .from('buyins')
      .select('id, game_player_id, kind, amount_cents, created_at')
      .eq('game_id', gameId)
      .order('created_at'),
    supabase.from('eliminations').select('game_player_id, position').eq('game_id', gameId),
    supabase
      .from('tables')
      .select('id, number, dealer_game_player_id')
      .eq('game_id', gameId)
      .eq('active', true)
      .order('number'),
    supabase.from('seats').select('table_id, seat_number, game_player_id').eq('game_id', gameId),
  ]);
  for (const result of [levels, players, buyins, eliminations, tables, seats]) {
    if (result.error) throw new Error('Não foi possível carregar o torneio.');
  }

  const settings = game.settings as unknown as TournamentGameSettings;
  const list: TournamentPlayer[] = players.data!.map((gp) => ({
    id: gp.id,
    playerId: gp.player_id,
    name: gp.players?.name ?? 'Jogador',
    profileId: gp.players?.profile_id ?? null,
    buyins: buyins
      .data!.filter((b) => b.game_player_id === gp.id)
      .map((b) => ({
        id: b.id,
        kind: b.kind as BuyinEntry['kind'],
        amountCents: b.amount_cents,
        createdAt: b.created_at,
      })),
    eliminatedPosition: eliminations.data!.find((e) => e.game_player_id === gp.id)?.position ?? null,
  }));

  return {
    id: game.id,
    groupId: game.group_id,
    status: game.status as GameStatus,
    hostId: game.host_id,
    isHost: game.host_id === userId,
    myGamePlayerId: list.find((p) => p.profileId === userId)?.id ?? null,
    settings: { ...settings, maxSeats: settings.maxSeats ?? 9 },
    levels: fromRows(levels.data as LevelRow[], settings),
    currentLevel: game.current_level,
    levelStartedAt: game.level_started_at,
    pausedAt: game.paused_at,
    players: list,
    tables: tables.data!.map((t) => ({
      id: t.id,
      number: t.number,
      dealerGamePlayerId: t.dealer_game_player_id,
      seats: seats
        .data!.filter((s) => s.table_id === t.id)
        .map((s) => ({ seat: s.seat_number, gamePlayerId: s.game_player_id }))
        .sort((a, b) => a.seat - b.seat),
    })),
  };
}

/** Torneio completo. Atualiza a cada 3 s para todo mundo (host e dealers mexem nas mesas). */
export function useTournament(gameId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.tournament(gameId),
    queryFn: () => fetchTournament(gameId, userId),
    refetchInterval: (query) => (query.state.data?.status === 'finished' ? false : 3000),
  });
}

/** Mesas do torneio no formato das funções de `src/lib/seating` (ids de game_players). */
export function toSeatedTables(game: TournamentGame): SeatedTable[] {
  return game.tables.map((t) => ({
    number: t.number,
    dealerId: t.dealerGamePlayerId,
    seats: t.seats.map((s) => ({ seat: s.seat, playerId: s.gamePlayerId })),
  }));
}

function seatingPayload(tables: SeatedTable[]): Json {
  return tables.map((t) => ({
    number: t.number,
    dealer: t.dealerId,
    seats: t.seats.map((s) => ({ seat: s.seat, game_player_id: s.playerId })),
  }));
}

async function setSeating(gameId: string, tables: SeatedTable[]) {
  const { error } = await getSupabase().rpc('set_seating', { p_game_id: gameId, p_tables: seatingPayload(tables) });
  if (error) throw new Error('Não foi possível salvar as mesas. Só o host mexe nas mesas.');
}

function invalidate(game: { id: string; groupId: string }) {
  queryClient.invalidateQueries({ queryKey: queryKeys.tournament(game.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.groupGames(game.groupId) });
}

type StartInput = {
  groupId: string;
  kitId: string;
  name: string;
  draft: TournamentDraft;
  playerIds: string[];
  maxSeats: number;
  /** Jogador da lista ligado à conta do host (vai para a mesa 1), se ele estiver jogando. */
  hostPlayerId: string | null;
};

/** Cria o torneio (estrutura copiada, buy-ins) e já sorteia as mesas. Devolve o id do jogo. */
export function useStartTournament() {
  return useMutation({
    mutationFn: async (input: StartInput): Promise<string> => {
      const supabase = getSupabase();
      const settings: TournamentGameSettings = {
        ...input.draft.settings,
        players: input.playerIds.length,
        maxSeats: input.maxSeats,
      };
      const { data: gameId, error } = await supabase.rpc('start_tournament', {
        p_group_id: input.groupId,
        p_name: input.name,
        p_settings: settings as unknown as Json,
        p_levels: levelRows(input.draft.levels) as unknown as Json,
        p_kit_id: input.kitId,
        p_player_ids: input.playerIds,
      });
      if (error) throw new Error('Não foi possível criar o torneio.');

      const { data: gamePlayers, error: playersError } = await supabase
        .from('game_players')
        .select('id, player_id')
        .eq('game_id', gameId);
      if (playersError) throw new Error('Torneio criado, mas não foi possível sortear as mesas.');
      const hostGamePlayer = gamePlayers.find((gp) => gp.player_id === input.hostPlayerId)?.id ?? null;
      const tables = drawSeats({
        playerIds: gamePlayers.map((gp) => gp.id),
        hostPlayerId: hostGamePlayer,
        maxSeats: input.maxSeats,
        random: Math.random,
      });
      await setSeating(gameId, tables);
      return gameId;
    },
    onSuccess: (_id, input) => queryClient.invalidateQueries({ queryKey: queryKeys.groupGames(input.groupId) }),
  });
}

/** Troca os lugares de uma vez (sorteio de novo, balanceamento, desfazer mesa, mesa final, dealer). */
export function useSetSeating(game: { id: string; groupId: string }) {
  return useMutation({
    mutationFn: (tables: SeatedTable[]) => setSeating(game.id, tables),
    onSuccess: () => invalidate(game),
  });
}

export type BustedResult = { result: 'rebuy' } | { result: 'eliminated'; position: number };

const BUSTED_ERRORS: [string, string][] = [
  ['Limite de rebuys', 'Esse jogador já fez o máximo de rebuys.'],
  ['período de rebuy', 'O período de rebuy já acabou.'],
  ['já foi eliminado', 'Esse jogador já tinha caído.'],
  ['Só sobrou', 'Só sobrou o campeão.'],
  ['Só o host ou o dealer', 'Só o host ou o dealer da mesa desse jogador.'],
];

/** "Caiu": rebuy (no período de rebuy) ou eliminação. Host ou dealer da mesa do jogador. */
export function usePlayerBusted(game: { id: string; groupId: string }) {
  return useMutation({
    mutationFn: async ({ gamePlayerId, rebuy }: { gamePlayerId: string; rebuy: boolean }): Promise<BustedResult> => {
      const { data, error } = await getSupabase().rpc('player_busted', {
        p_game_player_id: gamePlayerId,
        p_rebuy: rebuy,
      });
      if (error) {
        const known = BUSTED_ERRORS.find(([needle]) => error.message.includes(needle));
        throw new Error(known ? known[1] : 'Não foi possível registrar. Tente de novo.');
      }
      return data as unknown as BustedResult;
    },
    onSuccess: () => invalidate(game),
  });
}

/** Desfaz a última eliminação e senta o jogador de volta (lugares já calculados pela tela). */
export function useUndoElimination(game: { id: string; groupId: string }) {
  return useMutation({
    mutationFn: async ({ gamePlayerId, tables }: { gamePlayerId: string; tables: SeatedTable[] }) => {
      const { error } = await getSupabase().rpc('undo_elimination', { p_game_player_id: gamePlayerId });
      if (error) throw new Error('Só dá para desfazer a última eliminação.');
      await setSeating(game.id, tables);
    },
    onSuccess: () => invalidate(game),
  });
}

/** Quanto o jogador já gastou no torneio (buy-in + rebuys + add-on): é o que ele deve ao host. */
export function spentCents(player: Pick<TournamentPlayer, 'buyins'>): Cents {
  return player.buyins.reduce((sum, b) => sum + b.amountCents, 0);
}

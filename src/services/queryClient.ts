import { QueryClient } from '@tanstack/react-query';

/** Cache dos dados do servidor (TanStack Query). Limpo ao sair da conta. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Chaves do cache, num lugar só, para invalidar sem errar o nome. */
export const queryKeys = {
  myProfile: ['my-profile'] as const,
  myGroups: ['my-groups'] as const,
  group: (groupId: string) => ['group', groupId] as const,
  players: (groupId: string) => ['players', groupId] as const,
  members: (groupId: string) => ['members', groupId] as const,
  kits: (groupId: string) => ['kits', groupId] as const,
  structures: (groupId: string) => ['structures', groupId] as const,
  game: (gameId: string) => ['game', gameId] as const,
  groupGames: (groupId: string) => ['group-games', groupId] as const,
  groupSettlements: (groupId: string) => ['group-settlements', groupId] as const,
};

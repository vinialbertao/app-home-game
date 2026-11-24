/**
 * Dados de mentira para navegar pelas telas antes do Supabase.
 * Substituídos por dados reais na Fase 3: não use isto em nenhuma regra de negócio.
 */
export type SampleProfile = {
  name: string;
  playerId: string;
  photoUrl: string | null;
};

export type SampleGroup = {
  id: string;
  name: string;
  playerCount: number;
  isAdmin: boolean;
  lastGame: string | null;
  liveGame: 'cash' | 'tournament' | null;
};

export const sampleProfile: SampleProfile = {
  name: 'Vinicius',
  playerId: 'MF-7K4Q2X',
  photoUrl: null,
};

export const sampleGroups: SampleGroup[] = [
  {
    id: 'quinta',
    name: 'Poker de quinta',
    playerCount: 9,
    isAdmin: true,
    lastGame: 'Torneio · 20/11',
    liveGame: 'cash',
  },
  {
    id: 'firma',
    name: 'Turma da firma',
    playerCount: 14,
    isAdmin: false,
    lastGame: 'Cash · 08/11',
    liveGame: null,
  },
  {
    id: 'familia',
    name: 'Família',
    playerCount: 6,
    isAdmin: false,
    lastGame: null,
    liveGame: null,
  },
];

export function findSampleGroup(id: string | undefined): SampleGroup | undefined {
  return sampleGroups.find((g) => g.id === id);
}

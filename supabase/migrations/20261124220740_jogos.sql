-- Fase 2.3 — Jogos (cash e torneio), estruturas, mesas, acerto

-- Estrutura de torneio: salva no grupo (is_saved) ou usada só num jogo
create table public.structures (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_saved boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
alter table public.structures enable row level security;
create index structures_group_id_idx on public.structures (group_id);
create index structures_created_by_idx on public.structures (created_by);

create trigger structures_updated_at
  before update on public.structures
  for each row execute function private.set_updated_at();

-- Níveis de blinds (em fichas, não em reais)
create table public.levels (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.structures (id) on delete cascade,
  position smallint not null check (position >= 1),
  is_break boolean not null default false,
  small_blind integer check (small_blind >= 0),
  big_blind integer check (big_blind >= 0),
  ante integer not null default 0 check (ante >= 0),
  duration_minutes smallint not null check (duration_minutes between 1 and 240),
  color_up text check (color_up is null or char_length(color_up) <= 100),
  unique (structure_id, position),
  check (is_break or (small_blind is not null and big_blind is not null and big_blind >= small_blind))
);
alter table public.levels enable row level security;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  type text not null check (type in ('cash', 'tournament')),
  status text not null default 'setup'
    check (status in ('setup', 'live', 'counting', 'settling', 'finished', 'cancelled')),
  host_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kit_id uuid,
  structure_id uuid,
  panel_code text not null unique default private.random_code(6),
  settings jsonb not null default '{}'::jsonb,
  -- Timer: o relógio é calculado a partir de level_started_at (e paused_at), nunca contado no aparelho
  current_level smallint check (current_level >= 1),
  level_started_at timestamptz,
  paused_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (kit_id, group_id) references public.chip_kits (id, group_id),
  foreign key (structure_id, group_id) references public.structures (id, group_id)
);
alter table public.games enable row level security;
create index games_group_id_idx on public.games (group_id, created_at desc);
create index games_host_id_idx on public.games (host_id);
create index games_kit_id_idx on public.games (kit_id, group_id);
create index games_structure_id_idx on public.games (structure_id, group_id);

create trigger games_updated_at
  before update on public.games
  for each row execute function private.set_updated_at();

-- Quem jogou cada jogo
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  finish_position smallint check (finish_position >= 1),
  created_at timestamptz not null default now(),
  unique (game_id, player_id),
  unique (id, game_id)
);
alter table public.game_players enable row level security;
create index game_players_player_id_idx on public.game_players (player_id);

-- O jogador precisa ser do mesmo grupo do jogo
create function private.game_players_check_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.games g
    join public.players p on p.group_id = g.group_id
    where g.id = new.game_id and p.id = new.player_id
  ) then
    raise exception 'O jogador não é deste grupo' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger game_players_check_group
  before insert or update of game_id, player_id on public.game_players
  for each row execute function private.game_players_check_group();

-- Buy-ins, rebuys e add-ons
create table public.buyins (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  game_player_id uuid not null,
  kind text not null check (kind in ('buyin', 'rebuy', 'addon')),
  amount_cents bigint not null check (amount_cents >= 0),
  chips integer check (chips >= 0),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (game_player_id, game_id) references public.game_players (id, game_id) on delete cascade
);
alter table public.buyins enable row level security;
create index buyins_game_id_idx on public.buyins (game_id);
create index buyins_game_player_id_idx on public.buyins (game_player_id, game_id);
create index buyins_created_by_idx on public.buyins (created_by);

-- Contagem final de fichas por cor (cash)
create table public.chip_counts (
  game_id uuid not null,
  game_player_id uuid not null,
  denomination_id uuid not null references public.chip_denominations (id) on delete restrict,
  quantity integer not null check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (game_player_id, denomination_id),
  foreign key (game_player_id, game_id) references public.game_players (id, game_id) on delete cascade
);
alter table public.chip_counts enable row level security;
create index chip_counts_game_id_idx on public.chip_counts (game_id);
create index chip_counts_fk_idx on public.chip_counts (game_player_id, game_id);
create index chip_counts_denomination_id_idx on public.chip_counts (denomination_id);

create trigger chip_counts_updated_at
  before update on public.chip_counts
  for each row execute function private.set_updated_at();

-- Ajuste manual do host quando a conferência não bate (fica registrado)
create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 200),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.adjustments enable row level security;
create index adjustments_game_id_idx on public.adjustments (game_id);
create index adjustments_created_by_idx on public.adjustments (created_by);

-- Transferências do acerto: quem paga marca "Paguei", quem recebe marca "Recebi"
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  from_player_id uuid not null references public.players (id) on delete restrict,
  to_player_id uuid not null references public.players (id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_player_id <> to_player_id)
);
alter table public.settlements enable row level security;
create index settlements_game_id_idx on public.settlements (game_id);
create index settlements_from_player_id_idx on public.settlements (from_player_id);
create index settlements_to_player_id_idx on public.settlements (to_player_id);

-- Mesas e lugares (torneio)
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  number smallint not null check (number >= 1),
  seat_count smallint not null default 9 check (seat_count between 2 and 12),
  active boolean not null default true,
  unique (game_id, number),
  unique (id, game_id)
);
alter table public.tables enable row level security;

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  table_id uuid not null,
  seat_number smallint not null check (seat_number >= 1),
  game_player_id uuid not null,
  unique (table_id, seat_number),
  unique (game_id, game_player_id),
  foreign key (table_id, game_id) references public.tables (id, game_id) on delete cascade,
  foreign key (game_player_id, game_id) references public.game_players (id, game_id) on delete cascade
);
alter table public.seats enable row level security;
create index seats_table_id_idx on public.seats (table_id, game_id);
create index seats_game_player_id_idx on public.seats (game_player_id, game_id);

-- Eliminações (ordem e horário)
create table public.eliminations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  game_player_id uuid not null,
  position smallint not null check (position >= 1),
  eliminated_by uuid,
  created_at timestamptz not null default now(),
  unique (game_id, game_player_id),
  unique (game_id, position),
  foreign key (game_player_id, game_id) references public.game_players (id, game_id) on delete cascade,
  foreign key (eliminated_by, game_id) references public.game_players (id, game_id) on delete set null (eliminated_by)
);
alter table public.eliminations enable row level security;
create index eliminations_game_player_id_idx on public.eliminations (game_player_id, game_id);
create index eliminations_eliminated_by_idx on public.eliminations (eliminated_by, game_id);

-- Fase 2.2 — Grupos, membros, jogadores e kits de fichas

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  invite_code text not null unique default private.random_code(8),
  default_kit_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.groups enable row level security;
create index groups_created_by_idx on public.groups (created_by);

create trigger groups_updated_at
  before update on public.groups
  for each row execute function private.set_updated_at();

-- Quem tem conta e participa do grupo
create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
create index group_members_user_id_idx on public.group_members (user_id);

-- Lista de jogadores do grupo (com ou sem conta)
create table public.players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  profile_id uuid references public.profiles (id) on delete set null,
  pix_key text check (pix_key is null or char_length(pix_key) between 1 and 77),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, profile_id)
);
alter table public.players enable row level security;
create index players_group_id_idx on public.players (group_id);
create index players_profile_id_idx on public.players (profile_id);

create trigger players_updated_at
  before update on public.players
  for each row execute function private.set_updated_at();

-- Kit de fichas. O valor é o de face (25, 100, 500...), sem unidade:
-- no torneio vale pontos; no cash a conversão para reais vem do buy-in de cada jogo.
create table public.chip_kits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
alter table public.chip_kits enable row level security;
create index chip_kits_group_id_idx on public.chip_kits (group_id);
create index chip_kits_created_by_idx on public.chip_kits (created_by);

create trigger chip_kits_updated_at
  before update on public.chip_kits
  for each row execute function private.set_updated_at();

create table public.chip_denominations (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.chip_kits (id) on delete cascade,
  color text not null check (char_length(btrim(color)) between 1 and 30),
  value integer not null check (value > 0),
  quantity integer not null check (quantity >= 0),
  position smallint not null default 0,
  unique (kit_id, color)
);
alter table public.chip_denominations enable row level security;

-- Kit padrão do grupo: precisa ser um kit do próprio grupo
alter table public.groups
  add constraint groups_default_kit_fk
  foreign key (default_kit_id, id) references public.chip_kits (id, group_id)
  on delete set null (default_kit_id);
create index groups_default_kit_id_idx on public.groups (default_kit_id);

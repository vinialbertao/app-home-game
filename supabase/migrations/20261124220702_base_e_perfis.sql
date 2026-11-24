-- Fase 2.1 — Base: esquema privado, utilidades e perfis (com o ID do jogador)

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- updated_at automático
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Código aleatório sem caracteres que confundem (sem 0/O e 1/I): usado no ID do jogador,
-- no convite do grupo e no código do painel.
create function private.random_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 caracteres
  bytes bytea := extensions.gen_random_bytes(p_length);
  result text := '';
begin
  for i in 0 .. p_length - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Perfil de quem tem conta. Criado sozinho no cadastro (trigger em auth.users).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  public_id text not null unique
    check (public_id ~ '^MF-[A-HJ-NP-Z2-9]{6}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  birth_date date,
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  pix_key text check (pix_key is null or char_length(pix_key) between 1 and 77),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

comment on column public.profiles.public_id is 'ID do jogador (MF-XXXXXX): público, único e fixo';
comment on column public.profiles.birth_date is 'Privado: só o dono lê (via public.my_birth_date). Precisa ter 18+';

-- Gera o ID do jogador e valida as regras do perfil
create function private.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate text;
begin
  if tg_op = 'INSERT' then
    if new.public_id is null then
      loop
        candidate := 'MF-' || private.random_code(6);
        exit when not exists (select 1 from public.profiles where public_id = candidate);
      end loop;
      new.public_id := candidate;
    end if;
  elsif new.public_id is distinct from old.public_id then
    raise exception 'O ID do jogador não pode ser alterado' using errcode = 'check_violation';
  end if;

  if new.birth_date is not null then
    if new.birth_date > (current_date - interval '18 years')::date then
      raise exception 'É preciso ter 18 anos ou mais' using errcode = 'check_violation';
    end if;
    if new.birth_date < date '1900-01-01' then
      raise exception 'Data de nascimento inválida' using errcode = 'check_violation';
    end if;
  end if;

  new.display_name := btrim(new.display_name);
  return new;
end;
$$;

create trigger profiles_10_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

create trigger profiles_20_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Cadastro: cria o perfil com nome e data de nascimento enviados no signUp (options.data)
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, birth_date)
  values (
    new.id,
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 40), ''),
      nullif(left(split_part(coalesce(new.email, ''), '@', 1), 40), ''),
      'Jogador'
    ),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

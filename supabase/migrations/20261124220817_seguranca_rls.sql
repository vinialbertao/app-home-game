-- Fase 2.4 — Segurança (RLS): cada um só vê os próprios grupos;
-- admin cuida do grupo; só o host altera o jogo em andamento.

-- Funções auxiliares (security definer para não cair em recursão de RLS).
-- Todas olham para auth.uid(): respondem sempre sobre quem está chamando.
create function private.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid())
  );
$$;

create function private.is_group_admin(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function private.shares_group_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

create function private.is_game_member(p_game_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.games g
    join public.group_members m on m.group_id = g.group_id
    where g.id = p_game_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_game_host(p_game_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.games
    where id = p_game_id and host_id = (select auth.uid())
  );
$$;

create function private.is_player_me(p_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players
    where id = p_player_id and profile_id = (select auth.uid())
  );
$$;

-- Kit e estrutura: qualquer membro vê; edita quem é admin ou quem criou
create function private.can_read_kit(p_kit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chip_kits k
    where k.id = p_kit_id and private.is_group_member(k.group_id)
  );
$$;

create function private.can_edit_kit(p_kit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chip_kits k
    where k.id = p_kit_id
      and (k.created_by = (select auth.uid()) or private.is_group_admin(k.group_id))
  );
$$;

create function private.can_read_structure(p_structure_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.structures s
    where s.id = p_structure_id and private.is_group_member(s.group_id)
  );
$$;

create function private.can_edit_structure(p_structure_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.structures s
    where s.id = p_structure_id
      and (s.created_by = (select auth.uid()) or private.is_group_admin(s.group_id))
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.is_group_member(uuid),
  private.is_group_admin(uuid),
  private.shares_group_with(uuid),
  private.is_game_member(uuid),
  private.is_game_host(uuid),
  private.is_player_me(uuid),
  private.can_read_kit(uuid),
  private.can_edit_kit(uuid),
  private.can_read_structure(uuid),
  private.can_edit_structure(uuid),
  private.random_code(integer) -- default do código do painel quando o host cria o jogo
to authenticated;

-- Ninguém sem login acessa tabela nenhuma (o painel usa public.get_panel).
revoke all on all tables in schema public from anon;
-- TRUNCATE, REFERENCES e TRIGGER passam por cima do RLS: ninguém do app tem.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- ---------- profiles ----------
-- Data de nascimento é privada: o app lê as colunas abaixo (nunca select '*').
revoke select, insert, update, delete on public.profiles from authenticated;
grant select (id, public_id, display_name, avatar_url, pix_key, created_at, updated_at)
  on public.profiles to authenticated;
grant update (display_name, birth_date, avatar_url, pix_key) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_group_with(id)));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- groups ----------
-- Criar e entrar em grupo: só pelas funções create_group e join_group.
create policy groups_select on public.groups
  for select to authenticated
  using ((select private.is_group_member(id)));

create policy groups_update_admin on public.groups
  for update to authenticated
  using ((select private.is_group_admin(id)))
  with check ((select private.is_group_admin(id)));

create policy groups_delete_admin on public.groups
  for delete to authenticated
  using ((select private.is_group_admin(id)));

-- ---------- group_members ----------
create policy group_members_select on public.group_members
  for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy group_members_update_admin on public.group_members
  for update to authenticated
  using ((select private.is_group_admin(group_id)))
  with check ((select private.is_group_admin(group_id)));

create policy group_members_delete on public.group_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_group_admin(group_id)));

-- ---------- players ----------
-- Qualquer membro adiciona (o host pode incluir alguém que chegou no meio da noite);
-- editar (inclusive vincular conta) e remover é do admin.
create policy players_select on public.players
  for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy players_insert_member on public.players
  for insert to authenticated
  with check ((select private.is_group_member(group_id)));

create policy players_update_admin on public.players
  for update to authenticated
  using ((select private.is_group_admin(group_id)))
  with check ((select private.is_group_admin(group_id)));

create policy players_delete_admin on public.players
  for delete to authenticated
  using ((select private.is_group_admin(group_id)));

-- ---------- chip_kits / chip_denominations ----------
create policy chip_kits_select on public.chip_kits
  for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy chip_kits_insert on public.chip_kits
  for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy chip_kits_update on public.chip_kits
  for update to authenticated
  using ((select private.can_edit_kit(id)))
  with check ((select private.is_group_member(group_id)));

create policy chip_kits_delete on public.chip_kits
  for delete to authenticated
  using ((select private.can_edit_kit(id)));

create policy chip_denominations_select on public.chip_denominations
  for select to authenticated
  using ((select private.can_read_kit(kit_id)));

create policy chip_denominations_insert on public.chip_denominations
  for insert to authenticated
  with check ((select private.can_edit_kit(kit_id)));

create policy chip_denominations_update on public.chip_denominations
  for update to authenticated
  using ((select private.can_edit_kit(kit_id)))
  with check ((select private.can_edit_kit(kit_id)));

create policy chip_denominations_delete on public.chip_denominations
  for delete to authenticated
  using ((select private.can_edit_kit(kit_id)));

-- ---------- structures / levels ----------
create policy structures_select on public.structures
  for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy structures_insert on public.structures
  for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy structures_update on public.structures
  for update to authenticated
  using ((select private.can_edit_structure(id)))
  with check ((select private.is_group_member(group_id)));

create policy structures_delete on public.structures
  for delete to authenticated
  using ((select private.can_edit_structure(id)));

create policy levels_select on public.levels
  for select to authenticated
  using ((select private.can_read_structure(structure_id)));

create policy levels_insert on public.levels
  for insert to authenticated
  with check ((select private.can_edit_structure(structure_id)));

create policy levels_update on public.levels
  for update to authenticated
  using ((select private.can_edit_structure(structure_id)))
  with check ((select private.can_edit_structure(structure_id)));

create policy levels_delete on public.levels
  for delete to authenticated
  using ((select private.can_edit_structure(structure_id)));

-- ---------- games ----------
-- Qualquer membro cria um jogo e vira o host do dia. Host ou admin alteram
-- (o admin pode assumir/passar o host). Só o admin apaga.
create policy games_select on public.games
  for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy games_insert on public.games
  for insert to authenticated
  with check ((select private.is_group_member(group_id)) and host_id = (select auth.uid()));

create policy games_update on public.games
  for update to authenticated
  using (host_id = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy games_delete_admin on public.games
  for delete to authenticated
  using ((select private.is_group_admin(group_id)));

-- ---------- dados do jogo: membros leem, só o host escreve ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'game_players', 'buyins', 'chip_counts', 'adjustments', 'tables', 'seats', 'eliminations'
  ] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select private.is_game_member(game_id)))', t);
    execute format(
      'create policy %1$s_insert_host on public.%1$I for insert to authenticated
         with check ((select private.is_game_host(game_id)))', t);
    execute format(
      'create policy %1$s_update_host on public.%1$I for update to authenticated
         using ((select private.is_game_host(game_id)))
         with check ((select private.is_game_host(game_id)))', t);
    execute format(
      'create policy %1$s_delete_host on public.%1$I for delete to authenticated
         using ((select private.is_game_host(game_id)))', t);
  end loop;
end;
$$;

-- ---------- settlements ----------
-- O host cria o acerto. Quem paga marca "Paguei" e quem recebe marca "Recebi"
-- (o trigger abaixo garante que cada um só mexe no seu campo).
create policy settlements_select on public.settlements
  for select to authenticated
  using ((select private.is_game_member(game_id)));

create policy settlements_insert_host on public.settlements
  for insert to authenticated
  with check ((select private.is_game_host(game_id)));

create policy settlements_update on public.settlements
  for update to authenticated
  using (
    (select private.is_game_host(game_id))
    or (select private.is_player_me(from_player_id))
    or (select private.is_player_me(to_player_id))
  )
  with check ((select private.is_game_member(game_id)));

create policy settlements_delete_host on public.settlements
  for delete to authenticated
  using ((select private.is_game_host(game_id)));

create function private.settlements_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sem usuário (painel do Supabase, migrations) ou host do jogo: pode tudo
  if (select auth.uid()) is null or private.is_game_host(old.game_id) then
    return new;
  end if;

  if (new.game_id, new.from_player_id, new.to_player_id, new.amount_cents, new.created_at)
     is distinct from
     (old.game_id, old.from_player_id, old.to_player_id, old.amount_cents, old.created_at) then
    raise exception 'Só o host altera o acerto' using errcode = 'insufficient_privilege';
  end if;

  if new.paid_at is distinct from old.paid_at and not private.is_player_me(old.from_player_id) then
    raise exception 'Só quem paga marca "Paguei"' using errcode = 'insufficient_privilege';
  end if;

  if new.received_at is distinct from old.received_at and not private.is_player_me(old.to_player_id) then
    raise exception 'Só quem recebe marca "Recebi"' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function private.settlements_guard() from public, anon, authenticated;

create trigger settlements_guard
  before update on public.settlements
  for each row execute function private.settlements_guard();

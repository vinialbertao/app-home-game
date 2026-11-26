-- Torneio 5b: dealer de cada mesa, começar o torneio, lugares e eliminações.

alter table public.tables add column dealer_game_player_id uuid;
alter table public.tables
  add constraint tables_dealer_fkey foreign key (dealer_game_player_id, game_id)
  references public.game_players (id, game_id) on delete set null (dealer_game_player_id);
create index tables_dealer_idx on public.tables (dealer_game_player_id, game_id);

-- Começa um torneio: copia a estrutura (escondida, só deste jogo), cria o jogo em "setup",
-- os jogadores e o buy-in de cada um. Roda com as permissões de quem chama (RLS vale).
create function public.start_tournament(
  p_group_id uuid,
  p_name text,
  p_settings jsonb,
  p_levels jsonb,
  p_kit_id uuid,
  p_player_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_structure uuid;
  v_game uuid;
  v_player uuid;
  v_gp uuid;
begin
  if coalesce(array_length(p_player_ids, 1), 0) < 2 then
    raise exception 'O torneio precisa de pelo menos 2 jogadores' using errcode = 'check_violation';
  end if;

  insert into public.structures (group_id, name, settings, is_saved)
  values (p_group_id, p_name, p_settings, false)
  returning id into v_structure;

  insert into public.levels (structure_id, position, is_break, small_blind, big_blind, ante, duration_minutes, color_up)
  select v_structure, (l->>'position')::smallint, (l->>'is_break')::boolean,
         (l->>'small_blind')::integer, (l->>'big_blind')::integer, coalesce((l->>'ante')::integer, 0),
         (l->>'duration_minutes')::smallint, l->>'color_up'
  from jsonb_array_elements(p_levels) l;

  insert into public.games (group_id, type, status, host_id, kit_id, structure_id, settings)
  values (p_group_id, 'tournament', 'setup', (select auth.uid()), p_kit_id, v_structure, p_settings)
  returning id into v_game;

  foreach v_player in array p_player_ids loop
    insert into public.game_players (game_id, player_id) values (v_game, v_player) returning id into v_gp;
    insert into public.buyins (game_id, game_player_id, kind, amount_cents, chips)
    values (v_game, v_gp, 'buyin', (p_settings->>'buyinCents')::bigint, (p_settings->>'startingStack')::integer);
  end loop;

  return v_game;
end;
$$;

-- Troca os lugares do torneio de uma vez (sorteio, balanceamento, desfazer mesa, mesa final).
-- p_tables = [{"number": 1, "dealer": uuid|null, "seats": [{"seat": 1, "game_player_id": uuid}]}]
-- Mesas que não vierem ficam inativas.
create function public.set_seating(p_game_id uuid, p_tables jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t jsonb;
  v_table uuid;
  v_seat_count smallint := coalesce(
    (select (settings->>'maxSeats')::smallint from public.games where id = p_game_id), 9);
begin
  if not private.is_game_host(p_game_id) then
    raise exception 'Só o host mexe nas mesas' using errcode = 'insufficient_privilege';
  end if;

  delete from public.seats where game_id = p_game_id;
  update public.tables set active = false, dealer_game_player_id = null where game_id = p_game_id;

  for t in select * from jsonb_array_elements(p_tables) loop
    insert into public.tables (game_id, number, seat_count, active, dealer_game_player_id)
    values (p_game_id, (t->>'number')::smallint, greatest(v_seat_count, 2), true, (t->>'dealer')::uuid)
    on conflict (game_id, number)
      do update set active = true, dealer_game_player_id = excluded.dealer_game_player_id
    returning id into v_table;

    insert into public.seats (game_id, table_id, seat_number, game_player_id)
    select p_game_id, v_table, (s->>'seat')::smallint, (s->>'game_player_id')::uuid
    from jsonb_array_elements(t->'seats') s;
  end loop;
end;
$$;

-- Elimina um jogador: a posição é quantos ainda estavam no torneio (o último a cair antes do campeão é o 2º).
create function public.eliminate_player(p_game_player_id uuid)
returns smallint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game uuid;
  v_position smallint;
begin
  select game_id into v_game from public.game_players where id = p_game_player_id;
  if v_game is null or not private.is_game_host(v_game) then
    raise exception 'Só o host elimina jogadores' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.eliminations where game_player_id = p_game_player_id) then
    raise exception 'Esse jogador já foi eliminado' using errcode = 'check_violation';
  end if;

  select count(*) into v_position
  from public.game_players gp
  where gp.game_id = v_game
    and not exists (select 1 from public.eliminations e where e.game_player_id = gp.id);

  if v_position <= 1 then
    raise exception 'Só sobrou o campeão' using errcode = 'check_violation';
  end if;

  delete from public.seats where game_player_id = p_game_player_id;
  insert into public.eliminations (game_id, game_player_id, position) values (v_game, p_game_player_id, v_position);
  return v_position;
end;
$$;

-- Desfaz a última eliminação (só a mais recente). O lugar de volta é dado pelo app com set_seating.
create function public.undo_elimination(p_game_player_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game uuid;
  v_position smallint;
begin
  select game_id, position into v_game, v_position from public.eliminations where game_player_id = p_game_player_id;
  if v_game is null or not private.is_game_host(v_game) then
    raise exception 'Só o host desfaz eliminação' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.eliminations where game_id = v_game and position < v_position) then
    raise exception 'Só dá para desfazer a última eliminação' using errcode = 'check_violation';
  end if;
  delete from public.eliminations where game_player_id = p_game_player_id;
end;
$$;

revoke execute on function public.start_tournament(uuid, text, jsonb, jsonb, uuid, uuid[]) from public, anon;
revoke execute on function public.set_seating(uuid, jsonb) from public, anon;
revoke execute on function public.eliminate_player(uuid) from public, anon;
revoke execute on function public.undo_elimination(uuid) from public, anon;
grant execute on function public.start_tournament(uuid, text, jsonb, jsonb, uuid, uuid[]) to authenticated;
grant execute on function public.set_seating(uuid, jsonb) to authenticated;
grant execute on function public.eliminate_player(uuid) to authenticated;
grant execute on function public.undo_elimination(uuid) to authenticated;

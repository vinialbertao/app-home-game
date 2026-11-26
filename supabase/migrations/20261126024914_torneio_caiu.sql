-- Criada por uma conversa paralela (apagada depois). O que ela fez é desfeito em 20261126025219_limpa_caiu_duplicado.
-- "Caiu": o host ou o dealer da mesa do jogador registra o rebuy ou a eliminação.

-- Quem controla a mesa onde o jogador está sentado: o host do jogo ou o dealer daquela mesa.
create function private.can_run_table_of(p_game_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    where gp.id = p_game_player_id
      and (
        g.host_id = (select auth.uid())
        or exists (
          select 1
          from public.seats s
          join public.tables t on t.id = s.table_id
          join public.game_players dealer on dealer.id = t.dealer_game_player_id
          join public.players p on p.id = dealer.player_id
          where s.game_player_id = gp.id and p.profile_id = (select auth.uid())
        )
      )
  );
$$;
revoke execute on function private.can_run_table_of(uuid) from public, anon;
grant execute on function private.can_run_table_of(uuid) to authenticated;

-- Eliminação: agora também pelo dealer da mesa (por isso roda como dono da função, com a checagem acima).
create or replace function public.eliminate_player(p_game_player_id uuid)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game uuid;
  v_position smallint;
begin
  select game_id into v_game from public.game_players where id = p_game_player_id;
  if v_game is null or not private.can_run_table_of(p_game_player_id) then
    raise exception 'Só o host ou o dealer da mesa registra quem caiu' using errcode = 'insufficient_privilege';
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

-- Rebuy do torneio (mesmo valor e fichas do buy-in). Host ou dealer da mesa.
create function public.register_rebuy(p_game_player_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_count integer;
  v_max integer;
  v_until integer;
begin
  select g.* into v_game from public.games g join public.game_players gp on gp.game_id = g.id where gp.id = p_game_player_id;
  if v_game.id is null or not private.can_run_table_of(p_game_player_id) then
    raise exception 'Só o host ou o dealer da mesa registra rebuy' using errcode = 'insufficient_privilege';
  end if;
  if v_game.status in ('finished', 'cancelled') then
    raise exception 'O torneio já acabou' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.eliminations where game_player_id = p_game_player_id) then
    raise exception 'Esse jogador já foi eliminado' using errcode = 'check_violation';
  end if;
  if not coalesce((v_game.settings->'rebuy'->>'enabled')::boolean, false) then
    raise exception 'Este torneio não tem rebuy' using errcode = 'check_violation';
  end if;
  v_until := (v_game.settings->'rebuy'->>'untilLevel')::integer;
  if v_until is not null and v_game.current_level is not null and v_game.current_level > v_until then
    raise exception 'O período de rebuy já acabou' using errcode = 'check_violation';
  end if;
  select count(*) into v_count from public.buyins where game_player_id = p_game_player_id and kind = 'rebuy';
  v_max := (v_game.settings->'rebuy'->>'maxPerPlayer')::integer;
  if v_max is not null and v_count >= v_max then
    raise exception 'Esse jogador já fez o máximo de rebuys' using errcode = 'check_violation';
  end if;

  insert into public.buyins (game_id, game_player_id, kind, amount_cents, chips, created_by)
  values (v_game.id, p_game_player_id, 'rebuy', (v_game.settings->>'buyinCents')::bigint,
          (v_game.settings->>'startingStack')::integer, (select auth.uid()));
  return v_count + 1;
end;
$$;
revoke execute on function public.register_rebuy(uuid) from public, anon;
grant execute on function public.register_rebuy(uuid) to authenticated;

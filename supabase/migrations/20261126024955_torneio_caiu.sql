-- Torneio: botão "Caiu". Host e dealer da mesa do jogador registram rebuy (no período de rebuy) ou eliminação.

-- O período de rebuy está aberto? (até o último nível de rebuy e o intervalo do add-on logo depois)
create function private.rebuy_open(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((g.settings->'rebuy'->>'enabled')::boolean, false)
     and g.status in ('setup', 'live')
     and (g.settings->'rebuy'->>'untilLevel') is not null
     and (
       g.current_level is null
       or (select count(*) from public.levels l
           where l.structure_id = g.structure_id and not l.is_break and l.position <= g.current_level)
          <= (g.settings->'rebuy'->>'untilLevel')::int
     )
  from public.games g
  where g.id = p_game_id;
$$;

-- Quem chama é o dealer da mesa onde o jogador está sentado?
create function private.is_dealer_of(p_game_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.seats s
    join public.tables t on t.id = s.table_id
    join public.game_players dgp on dgp.id = t.dealer_game_player_id
    join public.players dp on dp.id = dgp.player_id
    where s.game_player_id = p_game_player_id
      and dp.profile_id = (select auth.uid())
  );
$$;

revoke execute on function private.rebuy_open(uuid) from public, anon;
revoke execute on function private.is_dealer_of(uuid) from public, anon;
grant execute on function private.rebuy_open(uuid) to authenticated;
grant execute on function private.is_dealer_of(uuid) to authenticated;

-- "Caiu": com p_rebuy = true registra um rebuy (mesmo valor e fichas do buy-in); senão elimina.
-- Devolve {"result": "rebuy"} ou {"result": "eliminated", "position": n}.
create function public.player_busted(p_game_player_id uuid, p_rebuy boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_max integer;
  v_position smallint;
begin
  select g.* into v_game
  from public.games g join public.game_players gp on gp.game_id = g.id
  where gp.id = p_game_player_id;

  if v_game.id is null or v_game.type <> 'tournament' then
    raise exception 'Jogador não encontrado' using errcode = 'no_data_found';
  end if;
  if not (v_game.host_id = (select auth.uid()) or private.is_dealer_of(p_game_player_id)) then
    raise exception 'Só o host ou o dealer da mesa' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.eliminations where game_player_id = p_game_player_id) then
    raise exception 'Esse jogador já foi eliminado' using errcode = 'check_violation';
  end if;

  if p_rebuy then
    if not private.rebuy_open(v_game.id) then
      raise exception 'O período de rebuy acabou' using errcode = 'check_violation';
    end if;
    v_max := (v_game.settings->'rebuy'->>'maxPerPlayer')::integer;
    if v_max is not null and (
      select count(*) from public.buyins where game_player_id = p_game_player_id and kind = 'rebuy'
    ) >= v_max then
      raise exception 'Limite de rebuys atingido' using errcode = 'check_violation';
    end if;
    insert into public.buyins (game_id, game_player_id, kind, amount_cents, chips)
    values (v_game.id, p_game_player_id, 'rebuy',
            (v_game.settings->>'buyinCents')::bigint, (v_game.settings->>'startingStack')::integer);
    return jsonb_build_object('result', 'rebuy');
  end if;

  select count(*) into v_position
  from public.game_players gp
  where gp.game_id = v_game.id
    and not exists (select 1 from public.eliminations e where e.game_player_id = gp.id);
  if v_position <= 1 then
    raise exception 'Só sobrou o campeão' using errcode = 'check_violation';
  end if;

  delete from public.seats where game_player_id = p_game_player_id;
  insert into public.eliminations (game_id, game_player_id, position)
  values (v_game.id, p_game_player_id, v_position);
  return jsonb_build_object('result', 'eliminated', 'position', v_position);
end;
$$;

revoke execute on function public.player_busted(uuid, boolean) from public, anon;
grant execute on function public.player_busted(uuid, boolean) to authenticated;

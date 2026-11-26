-- "Caiu" só depois do host tocar em "Começar torneio" (status live).
-- Devolve {"result": "rebuy"} ou {"result": "eliminated", "position": n}.
create or replace function public.player_busted(p_game_player_id uuid, p_rebuy boolean)
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
  if v_game.status <> 'live' then
    raise exception 'O torneio ainda não começou' using errcode = 'check_violation';
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


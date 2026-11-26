-- Limpa o que uma conversa paralela criou para o "Caiu" (migration 20261126024914): o app usa player_busted.
drop function if exists public.register_rebuy(uuid);

-- eliminate_player volta a ser só do host (o dealer usa player_busted, que confere a mesa dele).
create or replace function public.eliminate_player(p_game_player_id uuid)
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

drop function if exists private.can_run_table_of(uuid);

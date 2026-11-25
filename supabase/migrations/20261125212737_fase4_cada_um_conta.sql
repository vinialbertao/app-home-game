-- Fase 4 — Cada jogador com conta conta as próprias fichas no celular dele.
-- Só a própria linha, e só enquanto o jogo está na contagem (status 'counting').
-- O host continua podendo contar e corrigir todo mundo; fechar o acerto e lançar rebuys seguem só com o host.

-- Esta linha do jogo é minha? (game_players → players.profile_id = quem está logado)
create function private.is_my_game_player(p_game_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.game_players gp
    join public.players p on p.id = gp.player_id
    where gp.id = p_game_player_id and p.profile_id = (select auth.uid())
  );
$$;

create function private.is_game_counting(p_game_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games where id = p_game_id and status = 'counting');
$$;

revoke execute on function private.is_my_game_player(uuid), private.is_game_counting(uuid) from public, anon;
grant execute on function private.is_my_game_player(uuid), private.is_game_counting(uuid) to authenticated;

-- Contagem por cor: o próprio jogador grava, troca e apaga as linhas dele durante a contagem
create policy chip_counts_insert_own on public.chip_counts
  for insert to authenticated
  with check ((select private.is_my_game_player(game_player_id)) and (select private.is_game_counting(game_id)));

create policy chip_counts_update_own on public.chip_counts
  for update to authenticated
  using ((select private.is_my_game_player(game_player_id)) and (select private.is_game_counting(game_id)))
  with check ((select private.is_my_game_player(game_player_id)) and (select private.is_game_counting(game_id)));

create policy chip_counts_delete_own on public.chip_counts
  for delete to authenticated
  using ((select private.is_my_game_player(game_player_id)) and (select private.is_game_counting(game_id)));

-- Valor total digitado: o próprio jogador grava counted_cents na linha dele durante a contagem
create policy game_players_update_own_count on public.game_players
  for update to authenticated
  using ((select private.is_my_game_player(id)) and (select private.is_game_counting(game_id)))
  with check ((select private.is_my_game_player(id)) and (select private.is_game_counting(game_id)));

-- ...e só essa coluna: quem não é host não mexe em mais nada da linha
create function private.game_players_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or private.is_game_host(old.game_id) then
    return new;
  end if;
  if (new.game_id, new.player_id, new.finish_position, new.created_at)
     is distinct from (old.game_id, old.player_id, old.finish_position, old.created_at) then
    raise exception 'Você só pode alterar a sua contagem' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke execute on function private.game_players_guard() from public, anon, authenticated;

create trigger game_players_guard
  before update on public.game_players
  for each row execute function private.game_players_guard();

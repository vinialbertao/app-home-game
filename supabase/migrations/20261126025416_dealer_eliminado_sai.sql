-- Quem é eliminado deixa de ser dealer da mesa (o host escolhe outro).
create function private.eliminations_clear_dealer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tables set dealer_game_player_id = null
  where game_id = new.game_id and dealer_game_player_id = new.game_player_id;
  return new;
end;
$$;

create trigger eliminations_clear_dealer
  after insert on public.eliminations
  for each row execute function private.eliminations_clear_dealer();

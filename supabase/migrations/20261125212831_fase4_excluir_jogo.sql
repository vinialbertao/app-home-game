-- Fase 4 — Excluir jogo (cash ou torneio), durante ou depois: o host daquele jogo ou o admin do grupo.
-- Apaga junto tudo do jogo (jogadores na mesa, buy-ins, contagem, ajustes, acerto, mesas, eliminações).
drop policy games_delete_admin on public.games;

create policy games_delete_host_or_admin on public.games
  for delete to authenticated
  using (host_id = (select auth.uid()) or (select private.is_group_admin(group_id)));

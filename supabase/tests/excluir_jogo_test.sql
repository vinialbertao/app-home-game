-- Teste: excluir jogo (host do jogo ou admin do grupo; apaga tudo do jogo, não mexe na lista de jogadores).
-- Resultado esperado: erro "TESTES_OK: 4 verificações" (tudo é desfeito no fim).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  g uuid; invite text; p_b uuid; p_c uuid; kit uuid; d5 uuid; game_b uuid; game_c uuid; gp1 uuid; gp2 uuid;
  rc integer; checks integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.dev', '{"display_name":"Admin"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.dev', '{"display_name":"Host"}', now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.dev', '{"display_name":"Membro"}', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('Teste excluir');
  select invite_code into invite from public.groups where id = g;
  insert into public.chip_kits (group_id, name, kind) values (g, 'Cash', 'cash') returning id into kit;
  insert into public.chip_denominations (kit_id, color, value, quantity) values (kit, 'Vermelha', 500, 100) returning id into d5;
  insert into public.players (group_id, name, profile_id) values (g, 'Host', b) returning id into p_b;
  insert into public.players (group_id, name, profile_id) values (g, 'Membro', c) returning id into p_c;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);

  -- B (membro, não admin) é host de um cash já encerrado, com tudo dentro
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.games (group_id, type, kit_id, host_id, status) values (g, 'cash', kit, b, 'counting') returning id into game_b;
  insert into public.game_players (game_id, player_id) values (game_b, p_b) returning id into gp1;
  insert into public.game_players (game_id, player_id) values (game_b, p_c) returning id into gp2;
  insert into public.buyins (game_id, game_player_id, kind, amount_cents) values (game_b, gp1, 'buyin', 2000), (game_b, gp2, 'buyin', 2000);
  insert into public.chip_counts (game_id, game_player_id, denomination_id, quantity) values (game_b, gp1, d5, 6), (game_b, gp2, d5, 2);
  perform public.save_cash_settlement(game_b, jsonb_build_array(jsonb_build_object('from', p_c, 'to', p_b, 'amount_cents', 1000)));

  -- C (não é host nem admin) não exclui
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  delete from public.games where id = game_b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: quem não é host nem admin excluiu o jogo'; end if;
  checks := checks + 1;

  -- B (host) exclui o jogo encerrado, e vai tudo junto
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  delete from public.games where id = game_b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: o host não conseguiu excluir o próprio jogo'; end if;
  if exists (select 1 from public.settlements where game_id = game_b)
     or exists (select 1 from public.buyins where game_id = game_b)
     or exists (select 1 from public.chip_counts where game_id = game_b)
     or exists (select 1 from public.game_players where game_id = game_b) then
    raise exception 'FALHA: sobrou coisa do jogo excluído';
  end if;
  checks := checks + 1;

  -- Admin exclui um jogo ao vivo de outro host
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  insert into public.games (group_id, type, kit_id, host_id, status) values (g, 'cash', kit, c, 'live') returning id into game_c;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.games where id = game_c;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: o admin não conseguiu excluir'; end if;
  checks := checks + 1;

  -- A lista de jogadores do grupo continua intacta
  if (select count(*) from public.players where group_id = g) <> 3 then raise exception 'FALHA: excluir jogo apagou jogador da lista'; end if;
  checks := checks + 1;

  raise exception 'TESTES_OK: % verificações', checks;
end;
$$;

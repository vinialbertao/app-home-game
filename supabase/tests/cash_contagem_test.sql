-- Teste: cada jogador conta as próprias fichas no cash (e só as dele, só durante a contagem).
-- Resultado esperado: erro "TESTES_OK: 8 verificações" (tudo é desfeito no fim).
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  g uuid; invite text; p_a uuid; p_b uuid; p_pedro uuid; kit uuid; d5 uuid; game uuid;
  gp_a uuid; gp_b uuid; gp_pedro uuid;
  rc integer; checks integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.dev', '{"display_name":"Alice"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.dev', '{"display_name":"Bruno"}', now(), now());

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('Teste contagem');
  select invite_code into invite from public.groups where id = g;
  select id into p_a from public.players where group_id = g and profile_id = a;
  insert into public.players (group_id, name, profile_id) values (g, 'Bruno', b) returning id into p_b;
  insert into public.players (group_id, name) values (g, 'Pedro') returning id into p_pedro;
  insert into public.chip_kits (group_id, name, kind) values (g, 'Cash', 'cash') returning id into kit;
  insert into public.chip_denominations (kit_id, color, value, quantity) values (kit, 'Vermelha', 500, 100) returning id into d5;
  insert into public.games (group_id, type, kit_id, host_id, status) values (g, 'cash', kit, a, 'live') returning id into game;
  insert into public.game_players (game_id, player_id) values (game, p_a) returning id into gp_a;
  insert into public.game_players (game_id, player_id) values (game, p_b) returning id into gp_b;
  insert into public.game_players (game_id, player_id) values (game, p_pedro) returning id into gp_pedro;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);

  -- Mesa ainda ao vivo: B não conta
  begin
    insert into public.chip_counts (game_id, game_player_id, denomination_id, quantity) values (game, gp_b, d5, 4);
    raise exception 'FALHA: B contou com a mesa ainda ao vivo';
  exception when others then if sqlerrm like 'FALHA%' then raise; end if; end;
  checks := checks + 1;

  -- Host passa para a contagem
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.games set status = 'counting' where id = game;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  -- B conta as próprias fichas por cor e corrige
  insert into public.chip_counts (game_id, game_player_id, denomination_id, quantity) values (game, gp_b, d5, 4);
  update public.chip_counts set quantity = 5 where game_player_id = gp_b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: B não conseguiu corrigir a própria contagem'; end if;
  checks := checks + 1;

  -- B digita o próprio total
  update public.game_players set counted_cents = 2500 where id = gp_b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: B não conseguiu digitar o próprio total'; end if;
  checks := checks + 1;

  -- B não conta as fichas do Pedro
  begin
    insert into public.chip_counts (game_id, game_player_id, denomination_id, quantity) values (game, gp_pedro, d5, 9);
    raise exception 'FALHA: B contou as fichas de outro jogador';
  exception when others then if sqlerrm like 'FALHA%' then raise; end if; end;
  update public.game_players set counted_cents = 99999 where id = gp_pedro;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B digitou o total de outro jogador'; end if;
  checks := checks + 1;

  -- B não mexe em outra coluna da própria linha
  begin
    update public.game_players set finish_position = 1 where id = gp_b;
    raise exception 'FALHA: B mudou outra coluna da própria linha';
  exception when others then if sqlerrm like 'FALHA%' then raise; end if; end;
  checks := checks + 1;

  -- B não lança rebuy
  begin
    insert into public.buyins (game_id, game_player_id, kind, amount_cents) values (game, gp_b, 'rebuy', 2000);
    raise exception 'FALHA: B lançou o próprio rebuy';
  exception when others then if sqlerrm like 'FALHA%' then raise; end if; end;
  checks := checks + 1;

  -- Host corrige a contagem do B
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.game_players set counted_cents = 3000 where id = gp_b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: host não conseguiu corrigir a contagem do B'; end if;
  checks := checks + 1;

  -- Depois do acerto (finished), B não mexe mais
  update public.games set status = 'finished' where id = game;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.game_players set counted_cents = 1 where id = gp_b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B mexeu na contagem depois do acerto'; end if;
  checks := checks + 1;

  raise exception 'TESTES_OK: % verificações', checks;
end;
$$;

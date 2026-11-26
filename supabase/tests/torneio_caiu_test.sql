-- Teste: botão "Caiu" (player_busted). Dealer registra rebuy só na mesa dele; limite por pessoa;
-- jogador comum não registra; depois do intervalo do add-on, rebuy fecha e só elimina.
-- Resultado esperado: erro "TESTES_OK: 5 verificações" (tudo é desfeito no fim).
do $$
declare a uuid := gen_random_uuid(); d uuid := gen_random_uuid(); x uuid := gen_random_uuid(); g uuid; inv text; kit uuid; game uuid;
  p uuid[] := '{}'; gp uuid[]; pid uuid; i int; r jsonb; checks int := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@t.dev', '{"display_name":"A"}', now(), now()),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@t.dev', '{"display_name":"D"}', now(), now()),
    (x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@t.dev', '{"display_name":"X"}', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('T'); select invite_code into inv from public.groups where id = g;
  insert into public.chip_kits (group_id, name, kind) values (g, 'Torneio', 'tournament') returning id into kit;
  for i in 1..5 loop
    insert into public.players (group_id, name, profile_id) values (g, 'J' || i, case i when 3 then d when 5 then x end) returning id into pid;
    p := p || pid;
  end loop;
  game := public.start_tournament(g, 'S', '{"buyinCents":5000,"startingStack":3000,"rebuy":{"enabled":true,"maxPerPlayer":1,"untilLevel":1}}',
    '[{"position":1,"is_break":false,"small_blind":25,"big_blind":50,"duration_minutes":20},
      {"position":2,"is_break":true,"duration_minutes":10},
      {"position":3,"is_break":false,"small_blind":50,"big_blind":100,"duration_minutes":20}]', kit, p);
  select array_agg(id order by created_at, id) into gp from public.game_players where game_id = game;
  perform public.set_seating(game, jsonb_build_array(
    jsonb_build_object('number',1,'dealer',null,'seats',jsonb_build_array(jsonb_build_object('seat',1,'game_player_id',gp[1]),jsonb_build_object('seat',2,'game_player_id',gp[2]))),
    jsonb_build_object('number',2,'dealer',gp[3],'seats',jsonb_build_array(jsonb_build_object('seat',1,'game_player_id',gp[3]),jsonb_build_object('seat',2,'game_player_id',gp[4]),jsonb_build_object('seat',3,'game_player_id',gp[5])))));
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  perform public.join_group(inv);
  r := public.player_busted(gp[4], true);
  if r->>'result' <> 'rebuy' or (select count(*) from public.buyins where game_player_id = gp[4] and kind='rebuy') <> 1 then raise exception 'FALHA rebuy dealer'; end if;
  checks := checks + 1;
  begin perform public.player_busted(gp[4], true); raise exception 'FALHA limite';
  exception when check_violation then null; end;
  checks := checks + 1;
  begin perform public.player_busted(gp[1], false); raise exception 'FALHA outra mesa';
  exception when insufficient_privilege then null; end;
  checks := checks + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  perform public.join_group(inv);
  begin perform public.player_busted(gp[4], false); raise exception 'FALHA jogador comum';
  exception when insufficient_privilege then null; end;
  checks := checks + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.games set status = 'live', current_level = 2 where id = game;
  r := public.player_busted(gp[2], true);
  update public.games set current_level = 3 where id = game;
  begin perform public.player_busted(gp[1], true); raise exception 'FALHA rebuy depois do add-on';
  exception when check_violation then null; end;
  r := public.player_busted(gp[4], false);
  if r->>'result' <> 'eliminated' or (r->>'position')::int <> 5 then raise exception 'FALHA eliminar %', r; end if;
  checks := checks + 1;
  raise exception 'TESTES_OK: % verificações', checks;
end $$;

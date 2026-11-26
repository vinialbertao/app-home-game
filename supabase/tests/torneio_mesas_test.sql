-- Teste: começar torneio, lugares (set_seating), dealer da mesa, eliminar e desfazer.
-- Resultado esperado: erro "TESTES_OK: 6 verificações" (tudo é desfeito no fim).
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); g uuid; inv text; kit uuid; game uuid;
  p uuid[] := '{}'; gp uuid[]; pid uuid; i int; pos smallint; t1 jsonb; t2 jsonb; checks int := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@t.dev', '{"display_name":"A"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@t.dev', '{"display_name":"B"}', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('T'); select invite_code into inv from public.groups where id = g;
  insert into public.chip_kits (group_id, name, kind) values (g, 'Torneio', 'tournament') returning id into kit;
  for i in 1..4 loop
    insert into public.players (group_id, name) values (g, 'J' || i) returning id into pid;
    p := p || pid;
  end loop;
  game := public.start_tournament(g, 'Sexta', '{"buyinCents":5000,"startingStack":3000,"maxSeats":9}',
    '[{"position":1,"is_break":false,"small_blind":25,"big_blind":50,"ante":0,"duration_minutes":20,"color_up":null},
      {"position":2,"is_break":true,"small_blind":null,"big_blind":null,"ante":0,"duration_minutes":10,"color_up":"Trocar"}]',
    kit, p);
  if (select count(*) from public.buyins where game_id = game and amount_cents = 5000 and chips = 3000) <> 4 then raise exception 'FALHA buyins'; end if;
  if (select count(*) from public.levels l join public.games ga on ga.structure_id = l.structure_id where ga.id = game) <> 2 then raise exception 'FALHA níveis'; end if;
  checks := checks + 1;
  select array_agg(gp2.id order by pl.name) into gp from public.game_players gp2 join public.players pl on pl.id = gp2.player_id where gp2.game_id = game;
  t1 := jsonb_build_object('number', 1, 'dealer', null, 'seats', jsonb_build_array(
    jsonb_build_object('seat', 1, 'game_player_id', gp[1]), jsonb_build_object('seat', 2, 'game_player_id', gp[2])));
  t2 := jsonb_build_object('number', 2, 'dealer', gp[3], 'seats', jsonb_build_array(
    jsonb_build_object('seat', 1, 'game_player_id', gp[3]), jsonb_build_object('seat', 2, 'game_player_id', gp[4])));
  perform public.set_seating(game, jsonb_build_array(t1, t2));
  if (select count(*) from public.seats where game_id = game) <> 4 then raise exception 'FALHA seats'; end if;
  if (select dealer_game_player_id from public.tables where game_id = game and number = 2) <> gp[3] then raise exception 'FALHA dealer'; end if;
  checks := checks + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(inv);
  begin perform public.set_seating(game, '[]'); raise exception 'FALHA membro mexeu';
  exception when insufficient_privilege then null; end;
  begin perform public.eliminate_player(gp[1]); raise exception 'FALHA membro eliminou';
  exception when insufficient_privilege then null; end;
  checks := checks + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  pos := public.eliminate_player(gp[4]); if pos <> 4 then raise exception 'FALHA posição 4: %', pos; end if;
  pos := public.eliminate_player(gp[2]); if pos <> 3 then raise exception 'FALHA posição 3'; end if;
  if exists (select 1 from public.seats where game_player_id in (gp[4], gp[2])) then raise exception 'FALHA lugar ficou'; end if;
  checks := checks + 1;
  begin perform public.undo_elimination(gp[4]); raise exception 'FALHA desfez antiga';
  exception when check_violation then null; end;
  perform public.undo_elimination(gp[2]);
  if exists (select 1 from public.eliminations where game_player_id = gp[2]) then raise exception 'FALHA desfazer'; end if;
  checks := checks + 1;
  perform public.set_seating(game, jsonb_build_array(jsonb_build_object('number', 1, 'dealer', null, 'seats',
    jsonb_build_array(jsonb_build_object('seat', 1, 'game_player_id', gp[3]), jsonb_build_object('seat', 2, 'game_player_id', gp[1]),
      jsonb_build_object('seat', 3, 'game_player_id', gp[2])))));
  if (select count(*) from public.tables where game_id = game and active) <> 1 then raise exception 'FALHA mesa final'; end if;
  checks := checks + 1;
  raise exception 'TESTES_OK: % verificações', checks;
end $$;

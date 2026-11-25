-- Teste: remover do grupo (admin tira membro; membro não tira ninguém; o último admin não sai;
-- quem saiu perde o acesso, mas o histórico dos jogos continua).
-- Resultado esperado: erro "TESTES_OK: 5 verificações" (tudo é desfeito no fim).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  g uuid; invite text; p_b uuid; kit uuid; game uuid; rc integer; checks integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.dev', '{"display_name":"Admin"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.dev', '{"display_name":"Bruno"}', now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.dev', '{"display_name":"Caio"}', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('Teste remover');
  select invite_code into invite from public.groups where id = g;
  insert into public.chip_kits (group_id, name, kind) values (g, 'Cash', 'cash') returning id into kit;
  insert into public.players (group_id, name, profile_id) values (g, 'Bruno', b) returning id into p_b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);

  -- Bruno jogou um cash
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.games (group_id, type, kit_id, host_id, status) values (g, 'cash', kit, a, 'live') returning id into game;
  insert into public.game_players (game_id, player_id) values (game, p_b);

  -- C (membro) não tira B
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  delete from public.group_members where group_id = g and user_id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: membro comum tirou outra pessoa do grupo'; end if;
  checks := checks + 1;

  -- O admin (único) não consegue sair
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    delete from public.group_members where group_id = g and user_id = a;
    raise exception 'FALHA: o último admin saiu do grupo';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  -- O admin tira B; o nome dele fica inativo na lista
  delete from public.group_members where group_id = g and user_id = b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: o admin não conseguiu tirar o membro'; end if;
  update public.players set active = false where id = p_b;
  checks := checks + 1;

  -- B não vê mais o grupo nem os jogos
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.groups where id = g) or exists (select 1 from public.games where id = game) then
    raise exception 'FALHA: quem foi removido ainda vê o grupo';
  end if;
  checks := checks + 1;

  -- O histórico continua: Bruno segue no jogo
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.game_players where game_id = game and player_id = p_b) then
    raise exception 'FALHA: remover do grupo apagou a participação no jogo';
  end if;
  checks := checks + 1;

  raise exception 'TESTES_OK: % verificações', checks;
end;
$$;

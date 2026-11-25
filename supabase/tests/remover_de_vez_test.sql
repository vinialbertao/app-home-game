-- Teste: "Remover de vez" (players.archived_at). Só nome inativo; o histórico continua; quem foi removido
-- não volta pelo convite; restore_player desfaz.
-- Resultado esperado: erro "TESTES_OK: 5 verificações" (tudo é desfeito no fim).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  g uuid; invite text; p_b uuid; p_x uuid; kit uuid; game uuid; rc integer; checks integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.dev', '{"display_name":"Admin"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.dev', '{"display_name":"Bruno"}', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('Teste de vez');
  select invite_code into invite from public.groups where id = g;
  insert into public.chip_kits (group_id, name, kind) values (g, 'Cash', 'cash') returning id into kit;
  insert into public.players (group_id, name, profile_id) values (g, 'Bruno', b) returning id into p_b;
  insert into public.players (group_id, name) values (g, 'Xande') returning id into p_x;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.games (group_id, type, kit_id, host_id, status) values (g, 'cash', kit, a, 'live') returning id into game;
  insert into public.game_players (game_id, player_id) values (game, p_b), (game, p_x);

  -- Nome ativo não pode ser removido de vez
  begin
    update public.players set archived_at = now() where id = p_x;
    raise exception 'FALHA: removeu de vez um nome ativo';
  exception when check_violation then null;
  end;
  checks := checks + 1;

  -- Admin tira Bruno do grupo e da lista, depois remove os dois de vez
  delete from public.group_members where group_id = g and user_id = b;
  update public.players set active = false where id in (p_b, p_x);
  update public.players set archived_at = now() where id in (p_b, p_x);
  get diagnostics rc = row_count;
  if rc <> 2 then raise exception 'FALHA: o admin não removeu de vez'; end if;
  checks := checks + 1;

  -- Histórico continua
  if (select count(*) from public.game_players where game_id = game) <> 2 then
    raise exception 'FALHA: remover de vez apagou o histórico';
  end if;
  checks := checks + 1;

  -- Bruno não volta pelo convite; o admin traz de volta e o nome volta ativo, com a conta
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    perform public.join_group(invite);
    raise exception 'FALHA: quem foi removido voltou pelo convite';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.restore_player(p_b);
  if not exists (select 1 from public.players where id = p_b and active and archived_at is null and profile_id = b)
     or not exists (select 1 from public.group_members where group_id = g and user_id = b) then
    raise exception 'FALHA: o admin não trouxe a pessoa de volta';
  end if;
  checks := checks + 1;

  -- restore_player desfaz o remover de vez do Xande
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.restore_player(p_x);
  if not exists (select 1 from public.players where id = p_x and active and archived_at is null) then
    raise exception 'FALHA: restore_player não desfez o remover de vez';
  end if;
  checks := checks + 1;

  raise exception 'TESTES_OK: % verificações', checks;
end;
$$;

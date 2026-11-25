-- Teste: "Voltar para a lista" (restore_player). Quem o admin tirou do grupo volta como membro;
-- quem nunca aceitou o convite ou saiu sozinho não entra; só o admin usa.
-- Resultado esperado: erro "TESTES_OK: 5 verificações" (tudo é desfeito no fim).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  g uuid; invite text; p_b uuid; p_c uuid; p_d uuid; checks integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.dev', '{"display_name":"Admin"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.dev', '{"display_name":"Bruno"}', now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.dev', '{"display_name":"Caio"}', now(), now()),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.dev', '{"display_name":"Dani"}', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('Teste voltar');
  select invite_code into invite from public.groups where id = g;
  insert into public.players (group_id, name, profile_id) values (g, 'Bruno', b) returning id into p_b;
  insert into public.players (group_id, name, profile_id) values (g, 'Caio', c) returning id into p_c;
  insert into public.players (group_id, name, profile_id) values (g, 'Dani', d) returning id into p_d;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);
  -- Dani sai sozinha
  delete from public.group_members where group_id = g and user_id = d;

  -- Admin tira Bruno do grupo e os três nomes da lista
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.group_members where group_id = g and user_id = b;
  update public.players set active = false where id in (p_b, p_c, p_d);

  -- Membro comum não volta ninguém
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    perform public.restore_player(p_b);
    raise exception 'FALHA: quem não é admin voltou um nome';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 1;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.restore_player(p_b);
  perform public.restore_player(p_c);
  perform public.restore_player(p_d);
  if (select count(*) from public.players where id in (p_b, p_c, p_d) and active) <> 3 then
    raise exception 'FALHA: os nomes não voltaram para a lista';
  end if;
  checks := checks + 1;

  -- Bruno (tirado pelo admin) volta ao grupo como membro
  if not exists (select 1 from public.group_members where group_id = g and user_id = b and role = 'member') then
    raise exception 'FALHA: Bruno não voltou para o grupo';
  end if;
  checks := checks + 1;

  -- Caio nunca aceitou o convite e Dani saiu sozinha: nenhum dos dois entra sem aceitar
  if exists (select 1 from public.group_members where group_id = g and user_id in (c, d)) then
    raise exception 'FALHA: o admin pôs no grupo quem não aceitou';
  end if;
  checks := checks + 1;

  -- Tirar de novo e Bruno entrar pelo convite também limpa a anotação
  delete from public.group_members where group_id = g and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_group(invite);
  perform set_config('role', 'postgres', true);
  if exists (select 1 from private.group_removed_members where group_id = g and user_id = b) then
    raise exception 'FALHA: a anotação de removido ficou depois de entrar pelo convite';
  end if;
  checks := checks + 1;

  raise exception 'TESTES_OK: % verificações', checks;
end;
$$;

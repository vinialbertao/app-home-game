-- Teste das regras de segurança (RLS) — rode no SQL Editor do Supabase ou pelo Claude (execute_sql).
-- Simula três pessoas: A (admin do grupo), B (membro) e C (de fora).
-- Tudo roda numa transação que é desfeita no final: o resultado esperado é o erro
--   "TESTES_OK: N verificações"
-- Qualquer outra mensagem começando com "FALHA" mostra a regra que quebrou.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  g uuid;
  invite text;
  a_public_id text;
  kit uuid;
  denom uuid;
  game uuid;
  panel text;
  p_a uuid; p_b uuid; p_pedro uuid;
  gp_a uuid; gp_pedro uuid;
  st uuid;
  n integer;
  rc integer;
  checks integer := 0;
  dummy text;
begin
  -- ---------- cadastro (como o Supabase Auth faria) ----------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.dev',
     '{"display_name":"Alice","birth_date":"1990-05-10"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.dev',
     '{"display_name":"Bruno"}', now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.dev',
     '{}', now(), now());

  select public_id into a_public_id from public.profiles where id = a;
  if a_public_id !~ '^MF-[A-HJ-NP-Z2-9]{6}$' then raise exception 'FALHA: ID do jogador fora do formato (%)', a_public_id; end if;
  checks := checks + 1;

  select count(*) into n from public.profiles where id in (a, b, c);
  if n <> 3 then raise exception 'FALHA: cadastro não criou os 3 perfis'; end if;
  checks := checks + 1;

  if (select display_name from public.profiles where id = c) <> 'c' then
    raise exception 'FALHA: nome padrão pelo e-mail não funcionou';
  end if;
  checks := checks + 1;

  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'menor@teste.dev', '{"birth_date":"2015-01-01"}', now(), now());
    raise exception 'FALHA: menor de 18 conseguiu se cadastrar';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  -- ---------- A: cria o grupo, kit, jogador sem conta e um jogo ----------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  g := public.create_group('Poker de quinta');
  select invite_code into invite from public.groups where id = g;
  if invite is null then raise exception 'FALHA: A não vê o grupo que criou'; end if;
  checks := checks + 1;

  select count(*) into n from public.group_members where group_id = g and user_id = a and role = 'admin';
  if n <> 1 then raise exception 'FALHA: quem criou não virou admin'; end if;
  checks := checks + 1;

  select id into p_a from public.players where group_id = g and profile_id = a;
  if p_a is null then raise exception 'FALHA: quem criou não entrou na lista de jogadores'; end if;
  checks := checks + 1;

  insert into public.chip_kits (group_id, name) values (g, 'Maleta 500') returning id into kit;
  insert into public.chip_denominations (kit_id, color, value, quantity) values (kit, 'Branca', 25, 100) returning id into denom;
  update public.groups set default_tournament_kit_id = kit where id = g;
  insert into public.players (group_id, name) values (g, 'Pedro') returning id into p_pedro;

  insert into public.games (group_id, type, kit_id, host_id) values (g, 'cash', kit, a)
    returning id, panel_code into game, panel;
  insert into public.game_players (game_id, player_id) values (game, p_a) returning id into gp_a;
  insert into public.game_players (game_id, player_id) values (game, p_pedro) returning id into gp_pedro;
  insert into public.buyins (game_id, game_player_id, kind, amount_cents, chips) values (game, gp_pedro, 'buyin', 5000, 1000);
  checks := checks + 1;

  -- ---------- B: entra pelo convite ----------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.groups where id = g;
  if n <> 0 then raise exception 'FALHA: B vê o grupo antes de entrar'; end if;
  checks := checks + 1;

  if public.join_group(lower(invite)) <> g then raise exception 'FALHA: convite não levou ao grupo'; end if;
  checks := checks + 1;

  select count(*) into n from public.buyins where game_id = game;
  if n <> 1 then raise exception 'FALHA: membro B não vê os buy-ins do jogo'; end if;
  checks := checks + 1;

  select count(*) into n from public.profiles where id = a;
  if n <> 1 then raise exception 'FALHA: B não vê o perfil de quem está no mesmo grupo'; end if;
  checks := checks + 1;

  begin
    select birth_date::text into dummy from public.profiles where id = a;
    raise exception 'FALHA: B leu a data de nascimento de A';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  if public.my_birth_date() is not null then raise exception 'FALHA: my_birth_date devolveu dado de outra pessoa'; end if;
  checks := checks + 1;

  begin
    insert into public.buyins (game_id, game_player_id, kind, amount_cents) values (game, gp_pedro, 'rebuy', 5000);
    raise exception 'FALHA: B (não é host) lançou rebuy';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  update public.players set name = 'Pedrão' where id = p_pedro;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B (não é admin) editou a lista de jogadores'; end if;
  checks := checks + 1;

  update public.chip_kits set name = 'Hackeado' where id = kit;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B editou o kit de outra pessoa'; end if;
  checks := checks + 1;

  update public.games set status = 'finished' where id = game;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B (não é host nem admin) alterou o jogo'; end if;
  checks := checks + 1;

  delete from public.groups where id = g;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B (não é admin) apagou o grupo'; end if;
  checks := checks + 1;

  update public.profiles set display_name = 'Hackeado' where id = a;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: B alterou o perfil de A'; end if;
  checks := checks + 1;

  update public.profiles set display_name = 'Bruno B.' where id = b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: B não conseguiu alterar o próprio nome'; end if;
  checks := checks + 1;

  begin
    update public.profiles set birth_date = '2012-01-01' where id = b;
    raise exception 'FALHA: aceitou data de nascimento de menor';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  begin
    update public.profiles set public_id = 'MF-AAAAAA' where id = b;
    raise exception 'FALHA: B trocou o próprio ID do jogador';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  -- ---------- A: vincula B na lista e cria o acerto (B paga A) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if (select id from public.find_profile_by_public_id(
        (select public_id from public.profiles where id = b))) <> b then
    raise exception 'FALHA: busca pelo ID do jogador não achou B';
  end if;
  checks := checks + 1;

  insert into public.players (group_id, name, profile_id) values (g, 'Bruno', b) returning id into p_b;
  insert into public.settlements (game_id, from_player_id, to_player_id, amount_cents)
    values (game, p_b, p_a, 2500) returning id into st;

  -- ---------- B: marca "Paguei", mas não pode marcar "Recebi" nem mudar o valor ----------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.settlements set paid_at = now() where id = st;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FALHA: quem paga não conseguiu marcar Paguei'; end if;
  checks := checks + 1;

  begin
    update public.settlements set received_at = now() where id = st;
    raise exception 'FALHA: quem paga marcou Recebi';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  begin
    update public.settlements set amount_cents = 1 where id = st;
    raise exception 'FALHA: quem paga mudou o valor do acerto';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  -- ---------- C: de fora, não vê nem mexe em nada ----------
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);

  select count(*) into n from public.groups;
  if n <> 0 then raise exception 'FALHA: C vê grupo dos outros'; end if;
  select count(*) into n from public.games;
  if n <> 0 then raise exception 'FALHA: C vê jogo dos outros'; end if;
  select count(*) into n from public.players;
  if n <> 0 then raise exception 'FALHA: C vê jogadores dos outros'; end if;
  select count(*) into n from public.settlements;
  if n <> 0 then raise exception 'FALHA: C vê acerto dos outros'; end if;
  select count(*) into n from public.profiles where id in (a, b);
  if n <> 0 then raise exception 'FALHA: C vê perfil de quem não é do grupo dele'; end if;
  checks := checks + 1;

  begin
    insert into public.games (group_id, type, host_id) values (g, 'tournament', c);
    raise exception 'FALHA: C criou jogo em grupo alheio';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  begin
    insert into public.players (group_id, name) values (g, 'Intruso');
    raise exception 'FALHA: C colocou jogador em grupo alheio';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  update public.settlements set paid_at = now() where id = st;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FALHA: C mexeu no acerto dos outros'; end if;
  checks := checks + 1;

  begin
    perform public.join_group('XXXXXXXX');
    raise exception 'FALHA: convite inválido foi aceito';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  -- ---------- cash: kit certo e acerto conferido no banco ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  begin
    update public.groups set default_cash_kit_id = kit where id = g; -- kit é de torneio
    raise exception 'FALHA: aceitou kit de torneio como kit do cash';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  declare
    cash_kit uuid;
    d5 uuid;
    cash_game uuid;
    cgp_a uuid; cgp_pedro uuid;
  begin
    insert into public.chip_kits (group_id, name, kind) values (g, 'Cash', 'cash') returning id into cash_kit;
    insert into public.chip_denominations (kit_id, color, value, quantity) values (cash_kit, 'Vermelha', 500, 100) returning id into d5;
    update public.groups set default_cash_kit_id = cash_kit where id = g;

    -- A e Pedro colocam R$ 50 cada; no fim A tem R$ 70 e Pedro R$ 30 => Pedro paga R$ 20 para A
    insert into public.games (group_id, type, kit_id, host_id, status) values (g, 'cash', cash_kit, a, 'counting') returning id into cash_game;
    insert into public.game_players (game_id, player_id) values (cash_game, p_a) returning id into cgp_a;
    insert into public.game_players (game_id, player_id) values (cash_game, p_pedro) returning id into cgp_pedro;
    insert into public.buyins (game_id, game_player_id, kind, amount_cents) values
      (cash_game, cgp_a, 'buyin', 5000), (cash_game, cgp_pedro, 'buyin', 5000);
    insert into public.chip_counts (game_id, game_player_id, denomination_id, quantity) values
      (cash_game, cgp_a, d5, 14), (cash_game, cgp_pedro, d5, 6);

    -- B (não é host) não fecha o acerto
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    begin
      perform public.save_cash_settlement(cash_game, jsonb_build_array(jsonb_build_object('from', p_pedro, 'to', p_a, 'amount_cents', 2000)));
      raise exception 'FALHA: quem não é host fechou o acerto';
    exception when others then
      if sqlerrm like 'FALHA%' then raise; end if;
    end;
    checks := checks + 1;

    -- Host com valor errado: recusado
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    begin
      perform public.save_cash_settlement(cash_game, jsonb_build_array(jsonb_build_object('from', p_pedro, 'to', p_a, 'amount_cents', 1999)));
      raise exception 'FALHA: aceitou acerto que não bate por 1 centavo';
    exception when others then
      if sqlerrm like 'FALHA%' then raise; end if;
    end;
    checks := checks + 1;

    -- Host com valor certo: aceito e o jogo termina
    perform public.save_cash_settlement(cash_game, jsonb_build_array(jsonb_build_object('from', p_pedro, 'to', p_a, 'amount_cents', 2000)));
    if (select status from public.games where id = cash_game) <> 'finished'
       or (select count(*) from public.settlements where game_id = cash_game) <> 1 then
      raise exception 'FALHA: acerto certo não foi salvo';
    end if;
    checks := checks + 1;

    -- Ajuste: R$ 5 a mais contados de A; o ajuste de -R$ 5 em A faz o acerto bater de novo
    update public.chip_counts set quantity = 15 where game_player_id = cgp_a;
    insert into public.adjustments (game_id, game_player_id, amount_cents, reason) values (cash_game, cgp_a, -500, 'Ficha a mais');
    perform public.save_cash_settlement(cash_game, jsonb_build_array(jsonb_build_object('from', p_pedro, 'to', p_a, 'amount_cents', 2000)));
    checks := checks + 1;
  end;

  -- ---------- painel: abre pelo código, sem Pix e sem ids ----------
  if public.get_panel(lower(panel)) ->> 'group_name' <> 'Poker de quinta' then
    raise exception 'FALHA: painel não abriu pelo código';
  end if;
  if public.get_panel(lower(panel))::text ~* '(pix|profile_id|@teste)' then
    raise exception 'FALHA: painel expõe dado privado';
  end if;
  if public.get_panel('ZZZZZZ') is not null then raise exception 'FALHA: código de painel inexistente devolveu dados'; end if;
  checks := checks + 1;

  -- ---------- sem login (anon): nenhuma tabela, só o painel ----------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  begin
    select count(*) into n from public.groups;
    raise exception 'FALHA: visitante sem login leu a tabela de grupos';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  begin
    perform public.create_group('Grupo anônimo');
    raise exception 'FALHA: visitante sem login criou grupo';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  checks := checks + 1;

  if public.get_panel(panel) ->> 'type' <> 'cash' then
    raise exception 'FALHA: visitante sem login não abriu o painel';
  end if;
  checks := checks + 1;

  raise exception 'TESTES_OK: % verificações', checks;
end;
$$;

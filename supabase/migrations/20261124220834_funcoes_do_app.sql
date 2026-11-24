-- Fase 2.5 — Funções chamadas pelo app (supabase.rpc) e o painel por link

-- Cria o grupo, coloca quem criou como admin e já na lista de jogadores
create function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado' using errcode = 'insufficient_privilege';
  end if;

  insert into public.groups (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'admin');

  insert into public.players (group_id, name, profile_id)
  select v_group_id, p.display_name, p.id
  from public.profiles p
  where p.id = v_uid;

  return v_group_id;
end;
$$;

-- Entra no grupo pelo código do convite. O admin vincula a conta ao nome na lista depois.
create function public.join_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado' using errcode = 'insufficient_privilege';
  end if;

  select id into v_group_id
  from public.groups
  where invite_code = upper(btrim(p_invite_code));

  if v_group_id is null then
    raise exception 'Convite inválido' using errcode = 'no_data_found';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

-- Acha uma conta pelo ID do jogador (para o admin vincular na lista). Devolve só dados públicos.
create function public.find_profile_by_public_id(p_public_id text)
returns table (id uuid, public_id text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.public_id, p.display_name, p.avatar_url
  from public.profiles p
  where (select auth.uid()) is not null
    and p.public_id = upper(btrim(p_public_id));
$$;

-- Data de nascimento: só o próprio dono lê
create function public.my_birth_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select birth_date from public.profiles where id = (select auth.uid());
$$;

-- Painel por link (TV e celulares, sem login): devolve só o que aparece na tela.
-- Não expõe chave Pix, ID de conta nem nada do grupo além do nome.
create function public.get_panel(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with g as (
    select gm.*, gr.name as group_name
    from public.games gm
    join public.groups gr on gr.id = gm.group_id
    where gm.panel_code = upper(btrim(p_code))
      and gm.status <> 'cancelled'
  )
  select jsonb_build_object(
    'server_time', now(),
    'group_name', g.group_name,
    'type', g.type,
    'status', g.status,
    'settings', g.settings,
    'current_level', g.current_level,
    'level_started_at', g.level_started_at,
    'paused_at', g.paused_at,
    'started_at', g.started_at,
    'finished_at', g.finished_at,
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', l.position, 'is_break', l.is_break,
        'small_blind', l.small_blind, 'big_blind', l.big_blind, 'ante', l.ante,
        'duration_minutes', l.duration_minutes, 'color_up', l.color_up
      ) order by l.position)
      from public.levels l where l.structure_id = g.structure_id
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name,
        'finish_position', gp.finish_position,
        'eliminated', e.id is not null,
        'table', t.number,
        'seat', s.seat_number,
        'paid_in_cents', coalesce((select sum(b.amount_cents) from public.buyins b where b.game_player_id = gp.id), 0),
        'rebuys', (select count(*) from public.buyins b where b.game_player_id = gp.id and b.kind = 'rebuy'),
        'addons', (select count(*) from public.buyins b where b.game_player_id = gp.id and b.kind = 'addon')
      ) order by p.name)
      from public.game_players gp
      join public.players p on p.id = gp.player_id
      left join public.eliminations e on e.game_player_id = gp.id
      left join public.seats s on s.game_player_id = gp.id
      left join public.tables t on t.id = s.table_id
      where gp.game_id = g.id
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', pf.name, 'to', pt.name, 'amount_cents', st.amount_cents,
        'paid', st.paid_at is not null, 'received', st.received_at is not null
      ) order by st.created_at)
      from public.settlements st
      join public.players pf on pf.id = st.from_player_id
      join public.players pt on pt.id = st.to_player_id
      where st.game_id = g.id
    ), '[]'::jsonb)
  )
  from g;
$$;

-- Permissões: tudo só para quem está logado, menos o painel (aberto pelo código)
revoke execute on function
  public.create_group(text),
  public.join_group(text),
  public.find_profile_by_public_id(text),
  public.my_birth_date(),
  public.get_panel(text)
from public, anon, authenticated;

grant execute on function
  public.create_group(text),
  public.join_group(text),
  public.find_profile_by_public_id(text),
  public.my_birth_date()
to authenticated;

grant execute on function public.get_panel(text) to anon, authenticated;

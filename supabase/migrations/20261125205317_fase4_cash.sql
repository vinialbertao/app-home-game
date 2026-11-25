-- Fase 4 — Cash game: kit do cash e do torneio, ajuste por jogador e acerto salvo de uma vez (conferido no banco)

-- 1. Cada kit diz se é de cash (valor de cada cor em centavos) ou de torneio (valor em pontos)
alter table public.chip_kits
  add column kind text not null default 'tournament' check (kind in ('cash', 'tournament'));
comment on column public.chip_kits.kind is 'cash: chip_denominations.value em centavos; tournament: em pontos';
comment on column public.chip_denominations.value is 'Kit do cash: centavos (R$ 0,50 = 50). Kit do torneio: pontos';

-- 2. O grupo tem um kit padrão de cada tipo (o kit que já existia vira o do torneio)
alter table public.groups rename column default_kit_id to default_tournament_kit_id;
alter table public.groups rename constraint groups_default_kit_fk to groups_default_tournament_kit_fk;
alter index public.groups_default_kit_fk_idx rename to groups_default_tournament_kit_fk_idx;

alter table public.groups add column default_cash_kit_id uuid;
alter table public.groups
  add constraint groups_default_cash_kit_fk
  foreign key (default_cash_kit_id, id) references public.chip_kits (id, group_id)
  on delete set null (default_cash_kit_id);
create index groups_default_cash_kit_fk_idx on public.groups (default_cash_kit_id, id);

create function private.groups_check_default_kits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.default_cash_kit_id is not null and not exists (
    select 1 from public.chip_kits where id = new.default_cash_kit_id and kind = 'cash'
  ) then
    raise exception 'O kit do cash precisa ser um kit de cash' using errcode = 'check_violation';
  end if;
  if new.default_tournament_kit_id is not null and not exists (
    select 1 from public.chip_kits where id = new.default_tournament_kit_id and kind = 'tournament'
  ) then
    raise exception 'O kit do torneio precisa ser um kit de torneio' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger groups_check_default_kits
  before insert or update of default_cash_kit_id, default_tournament_kit_id on public.groups
  for each row execute function private.groups_check_default_kits();

-- 3. Ajuste da conferência: o host escolhe em qual jogador ele cai
alter table public.adjustments add column game_player_id uuid not null;
alter table public.adjustments
  add constraint adjustments_game_player_fk
  foreign key (game_player_id, game_id) references public.game_players (id, game_id) on delete cascade;
create index adjustments_game_player_id_idx on public.adjustments (game_player_id, game_id);
comment on column public.adjustments.amount_cents is 'Somado ao resultado do jogador (positivo: ele recebe mais)';

-- 4. Salvar o acerto do cash de uma vez. O banco confere que as transferências batem, centavo por centavo,
--    com fichas contadas + ajustes − o que cada um colocou. Só o host chama (RLS vale: security invoker).
create function public.save_cash_settlement(p_game_id uuid, p_transfers jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mismatch integer;
begin
  if not private.is_game_host(p_game_id) then
    raise exception 'Só o host fecha o acerto' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.settlements
    where game_id = p_game_id and (paid_at is not null or received_at is not null)
  ) then
    raise exception 'Esse acerto já tem pagamentos marcados e não pode ser refeito' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_transfers) t
    where (t ->> 'amount_cents')::bigint <= 0
       or (t ->> 'from')::uuid = (t ->> 'to')::uuid
       or not exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.player_id = (t ->> 'from')::uuid)
       or not exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.player_id = (t ->> 'to')::uuid)
  ) then
    raise exception 'Transferência inválida no acerto' using errcode = 'check_violation';
  end if;

  with result as (
    select
      gp.player_id,
      coalesce((select sum(cc.quantity::bigint * d.value)
                from public.chip_counts cc
                join public.chip_denominations d on d.id = cc.denomination_id
                where cc.game_player_id = gp.id), 0)
      + coalesce((select sum(a.amount_cents) from public.adjustments a where a.game_player_id = gp.id), 0)
      - coalesce((select sum(b.amount_cents) from public.buyins b where b.game_player_id = gp.id), 0) as net
    from public.game_players gp
    where gp.game_id = p_game_id
  ),
  moved as (
    select player_id, sum(amount) as net
    from (
      select (t ->> 'to')::uuid as player_id, (t ->> 'amount_cents')::bigint as amount from jsonb_array_elements(p_transfers) t
      union all
      select (t ->> 'from')::uuid, -(t ->> 'amount_cents')::bigint from jsonb_array_elements(p_transfers) t
    ) x
    group by player_id
  )
  select count(*) into v_mismatch
  from result r
  full join moved m on m.player_id = r.player_id
  where coalesce(r.net, 0) <> coalesce(m.net, 0);

  if v_mismatch > 0 then
    raise exception 'O acerto não bate com as fichas contadas e os buy-ins' using errcode = 'check_violation';
  end if;

  delete from public.settlements where game_id = p_game_id;

  insert into public.settlements (game_id, from_player_id, to_player_id, amount_cents)
  select p_game_id, (t ->> 'from')::uuid, (t ->> 'to')::uuid, (t ->> 'amount_cents')::bigint
  from jsonb_array_elements(p_transfers) t;

  update public.games set status = 'finished', finished_at = now() where id = p_game_id;
end;
$$;

revoke execute on function public.save_cash_settlement(uuid, jsonb) from public, anon;
grant execute on function public.save_cash_settlement(uuid, jsonb) to authenticated;

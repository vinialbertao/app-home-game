-- Fase 4 — Contagem pelo valor total: a pessoa já fez a conta e digita quanto tem em reais.
-- Se counted_cents estiver preenchido, ele vale no lugar da soma das fichas por cor.
alter table public.game_players
  add column counted_cents bigint check (counted_cents >= 0);
comment on column public.game_players.counted_cents is
  'Cash: valor total contado digitado direto (centavos). Quando preenchido, vale no lugar de chip_counts';

-- O acerto passa a usar o valor digitado quando existir
create or replace function public.save_cash_settlement(p_game_id uuid, p_transfers jsonb)
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
      coalesce(
        gp.counted_cents,
        (select sum(cc.quantity::bigint * d.value)
         from public.chip_counts cc
         join public.chip_denominations d on d.id = cc.denomination_id
         where cc.game_player_id = gp.id),
        0)
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

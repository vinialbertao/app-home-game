-- Quem o admin tirou do grupo não volta pelo convite: só o admin traz de volta ("Voltar para a lista").
-- Quem saiu por conta própria pode voltar pelo convite normalmente.
create or replace function public.join_group(p_invite_code text)
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

  if exists (
    select 1 from private.group_removed_members r
    where r.group_id = v_group_id and r.user_id = v_uid
  ) and not exists (
    select 1 from public.group_members m
    where m.group_id = v_group_id and m.user_id = v_uid
  ) then
    raise exception 'Removido do grupo' using errcode = 'insufficient_privilege';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

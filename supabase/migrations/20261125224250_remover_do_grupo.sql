-- Remover alguém do grupo (admin) ou sair do grupo: o grupo nunca fica sem admin.
-- Se o próprio grupo está sendo apagado (cascade), deixa passar.
create function private.group_members_keep_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and exists (select 1 from public.groups g where g.id = old.group_id)
     and not exists (
       select 1 from public.group_members m
       where m.group_id = old.group_id and m.role = 'admin' and m.user_id <> old.user_id
     ) then
    raise exception 'O grupo precisa ter pelo menos um admin.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger group_members_keep_admin
  before delete on public.group_members
  for each row execute function private.group_members_keep_admin();

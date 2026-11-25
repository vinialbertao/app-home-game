-- Quem o admin tirou do grupo fica anotado aqui. "Voltar para a lista" devolve a pessoa ao grupo
-- (como membro) só se ela estiver nesta lista: o admin não consegue pôr no grupo quem nunca aceitou
-- o convite, nem quem saiu por conta própria.
create table private.group_removed_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table private.group_removed_members enable row level security;
create index group_removed_members_user_id_idx on private.group_removed_members (user_id);

create function private.group_members_track_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if (select auth.uid()) is distinct from old.user_id
       and exists (select 1 from public.groups g where g.id = old.group_id) then
      insert into private.group_removed_members (group_id, user_id)
      values (old.group_id, old.user_id)
      on conflict (group_id, user_id) do update set removed_at = now();
    end if;
    return old;
  end if;
  -- Voltou (pelo convite ou pelo admin): sai da lista de removidos
  delete from private.group_removed_members where group_id = new.group_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger group_members_track_removal
  after insert or delete on public.group_members
  for each row execute function private.group_members_track_removal();

-- Voltar um nome para a lista (só admin). Se o nome tem conta e o admin tinha tirado essa conta
-- do grupo, ela volta a ser membro, como antes.
create function public.restore_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_profile_id uuid;
begin
  select group_id, profile_id into v_group_id, v_profile_id
  from public.players where id = p_player_id;

  if v_group_id is null or not (select private.is_group_admin(v_group_id)) then
    raise exception 'Só o admin do grupo pode fazer isso' using errcode = 'insufficient_privilege';
  end if;

  update public.players set active = true where id = p_player_id;

  if v_profile_id is not null and exists (
    select 1 from private.group_removed_members r
    where r.group_id = v_group_id and r.user_id = v_profile_id
  ) then
    insert into public.group_members (group_id, user_id, role)
    values (v_group_id, v_profile_id, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;
end;
$$;

revoke execute on function public.restore_player(uuid) from public, anon, authenticated;
grant execute on function public.restore_player(uuid) to authenticated;

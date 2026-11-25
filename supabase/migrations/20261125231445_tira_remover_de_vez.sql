-- "Remover de vez" saiu: quem está fora da lista fica lá, no histórico do grupo, até o admin voltar com ele.
create or replace function public.restore_player(p_player_id uuid)
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

create or replace function private.group_members_track_removal()
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
  delete from private.group_removed_members where group_id = new.group_id and user_id = new.user_id;
  update public.players set active = true
  where group_id = new.group_id and profile_id = new.user_id and not active;
  return new;
end;
$$;

alter table public.players drop constraint players_archived_only_inactive;
alter table public.players drop column archived_at;

-- Fase 2.6 — Índice que cobre a chave estrangeira composta do kit padrão do grupo
drop index public.groups_default_kit_id_idx;
create index groups_default_kit_fk_idx on public.groups (default_kit_id, id);

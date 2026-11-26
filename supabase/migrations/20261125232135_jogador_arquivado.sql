-- Aplicada direto no banco (fora deste repositório) para o app antigo voltar a funcionar: a coluna tinha sido
-- tirada em tira_remover_de_vez, mas players.ts ainda filtrava por ela. Ela não é mais usada pelo app;
-- pode sair numa migration futura, quando todos os celulares estiverem com o código novo.
alter table public.players add column if not exists archived_at timestamptz;
notify pgrst, 'reload schema';

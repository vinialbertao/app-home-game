-- Fase 2.7 — Tabelas e funções criadas daqui em diante já nascem fechadas para quem não tem login
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

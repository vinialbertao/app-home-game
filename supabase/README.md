# Banco de dados (Supabase)

Projeto `app-home-game` (ref `nwtaxbfngcaetblpknnk`, região `sa-east-1`).

- `migrations/`: cada mudança no banco, em ordem. O nome de cada arquivo é a versão registrada no
  Supabase (`list_migrations`). Nunca edite uma migration já aplicada: crie uma nova.
- `tests/rls_test.sql`: teste das regras de segurança. Rode no SQL Editor do Supabase (ou peça ao
  Claude). O resultado certo é o erro `TESTES_OK: N verificações`; ele desfaz tudo que criou.
- Depois de mudar o banco, gere de novo `src/services/database.types.ts`.

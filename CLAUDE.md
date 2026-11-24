# Mesa Final HG — regras do projeto

App de home game de poker (cash e torneio) para grupos de amigos. Nome provisório: **Mesa Final HG**
(subtítulo na loja: "Home game de poker com amigos").

- Roteiro da versão 1 (fases e critérios de "pronto"): https://claude.ai/artifact/EZtjoTUJSrJ9RAfZi2A5Y8
- Fluxo das telas (Whiteboard): https://claude.ai/artifact/EvvTRqGefdf1BFhYe3UqNG

Leia este arquivo e o roteiro no começo de toda sessão. Atualize este arquivo sempre que uma decisão mudar.

@AGENTS.md

## Stack

| Peça | Tecnologia |
|---|---|
| App (iPhone e Android) | React Native + Expo SDK 58 + Expo Router, TypeScript estrito |
| Backend | Supabase (Postgres, Auth, Realtime), projeto `app-home-game`, ref `nwtaxbfngcaetblpknnk`, região `sa-east-1` |
| Painel por link | Rota web do próprio app (Expo web, `output: static`) na Cloudflare |
| Builds iOS | EAS Build (o dono usa Windows, sem Mac) |
| Testes | Jest (`jest-expo`) |

O desenvolvimento roda no **Expo Go** do iPhone. Não adicione biblioteca com código nativo fora do Expo Go
sem combinar antes: isso exige development build (EAS) e muda o fluxo de teste.

## Estrutura

```
src/app/            telas (Expo Router: cada arquivo é uma rota)
  index.tsx         redireciona (hoje sempre para /login)
  login.tsx         Login / cadastro
  groups/index.tsx  Tela inicial: perfil (foto, nome, ID, botão "Meus dados") + Meus grupos
  groups/[groupId]/index.tsx       Tela do grupo
  groups/[groupId]/cash.tsx        Cash game
  groups/[groupId]/tournament.tsx  Torneio
  profile.tsx       Meus dados (foto, nome, ID, Pix, histórico)
src/components/     componentes visuais reutilizáveis (importe de '@/components')
src/lib/            regras e cálculos puros, sem React e sem Supabase, sempre com testes
src/services/       acesso ao Supabase e a outros serviços externos (sampleData.ts: dados de mentira até a Fase 3)
src/theme/          cores, espaçamentos, raios e tipografia
src/services/supabase.ts          cliente do Supabase (getSupabase) e teste de conexão
src/services/database.types.ts    tipos gerados do banco (não editar à mão)
supabase/migrations/              todas as mudanças do banco, em ordem (ver supabase/README.md)
supabase/tests/rls_test.sql       teste das regras de segurança (resultado certo: TESTES_OK)
```

O roteiro fala em `app/` para as telas; o Expo SDK 58 usa `src/app/`, que é o que vale aqui.
Nada que não seja tela fica dentro de `src/app/`. Import com alias `@/` (= `src/`).

## Regras de código

- **Dinheiro é sempre inteiro em centavos** (`Cents` em `src/lib/money.ts`). Nunca use `number` com casas
  decimais para valores. Formatação e leitura só por `formatBRL` / `parseBRL`. O acerto não pode errar nem por um centavo.
- Todo cálculo (acerto de contas, conferência de fichas, gerador de estrutura, balanceamento de mesas,
  premiação) mora em `src/lib/` como função pura, com testes em `*.test.ts` ao lado. Testes importam de `@jest/globals`.
- Telas só montam a interface e chamam `src/lib` e `src/services`; não colocam regra de negócio no componente.
- Cores, tamanhos e fontes só pelo `@/theme`. Texto sempre com `AppText`; botões com `Button`; campos com
  `TextField`; blocos com `Card`; toda tela dentro de `Screen`; listas vazias com `EmptyState`.
- Tema único escuro: fundo verde quase preto, verde de feltro (`primary`) para ações, dourado (`gold`) para
  dinheiro e destaque. Fonte do sistema. Números (R$, fichas, timer) com `variant="number"` (algarismos fixos).
- Área de toque mínima de 48 pt; todo botão e cartão clicável tem `accessibilityRole`/`accessibilityLabel`.
- Interface em português do Brasil. Código (nomes de arquivos, rotas, variáveis) em inglês. Commits em português.
- **ID do jogador:** toda conta tem um ID público, único e que nunca muda, gerado no cadastro
  (`profiles.public_id`, formato `MF-` + 6 caracteres sem 0/O/1/I, ex.: `MF-7K4Q2X`). Aparece na tela
  inicial e em Meus dados, e serve para o admin achar e vincular a pessoa na lista do grupo. Nunca é o `uuid` interno.
- Timer do torneio é baseado no horário de início do nível salvo no Supabase (nunca um contador local).

## Regras do banco (Supabase)

- Toda mudança no banco é uma migration nova em `supabase/migrations/` (aplicada pelo MCP do Supabase,
  arquivo com a versão que o Supabase registrou). Depois: gerar de novo `database.types.ts` e rodar
  `supabase/tests/rls_test.sql` (precisa dar `TESTES_OK`), acrescentando testes para a regra nova.
- Toda tabela nova: `enable row level security` + políticas na mesma migration. Quem não tem login não
  acessa tabela nenhuma; o único acesso sem login é a função `get_panel(código)`.
- Funções novas em `public` não têm permissão por padrão: dê `grant execute ... to authenticated` explicitamente.
- Quem vê o quê: membro do grupo lê tudo do grupo; admin edita grupo, membros e lista de jogadores;
  qualquer membro cria jogo e vira o host; só o host altera os dados do jogo (host ou admin alteram `games`);
  no acerto, quem paga marca `paid_at` e quem recebe marca `received_at`.
- Criar grupo, entrar por convite e achar alguém pelo ID: funções `create_group`, `join_group`,
  `find_profile_by_public_id` (via `supabase.rpc`).
- `profiles`: selecione colunas explícitas, nunca `select('*')`. A data de nascimento é privada (sem permissão
  de leitura) e só o dono lê, por `my_birth_date()`. O cadastro envia `display_name` e `birth_date` em
  `options.data` do `signUp`; o banco recusa menor de 18.
- Kit de fichas guarda o **valor de face** (25, 100, 500...), sem unidade. No torneio é ponto; no cash a
  conversão para reais vem do buy-in de cada jogo (calculada em `src/lib`, sem arredondar no meio).
- Blinds dos níveis são em fichas, não em reais. Dinheiro no banco é sempre `bigint` em centavos (`*_cents`).

## Segredos

- Chaves ficam em `.env` (fora do GitHub). Modelo em `.env.example`.
- No app só entram `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`). Elas ficam
  visíveis dentro do app: a segurança vem do RLS no banco. A chave secret (`sb_secret_...`, antiga `service_role`) nunca entra no app nem no repositório.

## Comandos

```bash
npm start            # npx expo start — escanear o QR com a câmera do iPhone (Expo Go)
npm run check        # typecheck + lint + testes: rode antes de todo commit
npm test             # só os testes
npx expo export --platform ios   # confere que o bundle do app compila
```

Instale dependências com `npx expo install <pacote>` (escolhe a versão compatível com o SDK).

## Como trabalhar

- Uma fase de cada vez, todas na mesma conversa. Plano antes do código; o dono revisa e aprova.
- Toda decisão vai na hora para este arquivo ou para o roteiro: nada pode depender da memória da conversa.
  Se a conversa ficar pesada, o dono abre uma nova e tudo continua a partir daqui.
- Commits pequenos, com mensagens claras em português, feitos direto na `main` do GitHub.
- Cada fase termina testada no iPhone pelo Expo Go antes de começar a próxima.
- Explique o código quando o dono pedir: ele está aprendendo React Native no caminho.

## Estado

- [x] Fase 0 — Preparação
- [x] Fase 1 — Esqueleto do app: projeto, pastas, telas navegáveis (tela inicial com perfil + grupos), tema e componentes; testada no iPhone em 24/11
- [ ] Fase 2 — Banco de dados: 17 tabelas, RLS testado (36 verificações), cliente no app; falta o dono ver "Conectado ao servidor" no iPhone
- [ ] Fase 3 — Login, grupos, jogadores e kit
- [ ] Fase 4 — Cash game
- [ ] Fase 5 — Torneio com várias mesas
- [ ] Fase 6 — Painel por link (TV e celulares)
- [ ] Fase 7 — Testes e distribuição
- [ ] Fase 8 — Torneio de teste com os amigos

Decisões tomadas: conta da Apple Developer como pessoa física (24/11).
Decisões em aberto: data do torneio de teste, nome definitivo.
Ícone e splash ainda são os do template do Expo.

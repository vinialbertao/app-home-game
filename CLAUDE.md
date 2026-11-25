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
  _layout.tsx       sessão + rotas protegidas (Stack.Protected): sem login só abre login/signup
  index.tsx         redireciona: logado → /groups, sem login → /login
  login.tsx         Entrar (e-mail e senha)
  signup.tsx        Criar conta (nome, nascimento 18+, e-mail, senha)
  groups/index.tsx  Tela inicial: perfil (foto, nome, ID, botão "Meus dados") + Meus grupos
  groups/new.tsx    Criar grupo (modal)
  groups/join.tsx   Entrar com código (modal; cola a mensagem do WhatsApp)
  groups/[groupId]/index.tsx       Tela do grupo (convite, jogadores, kit, novo jogo)
  groups/[groupId]/players/        Lista de jogadores, editar jogador, ligar conta a um nome
  groups/[groupId]/kit.tsx         Kit de fichas (?kind=cash|tournament; admin edita; sugestões de 300 e 500)
  groups/[groupId]/cash.tsx        Novo cash: quem veio, buy-in, blinds
  games/[gameId]/index.tsx         Mesa ao vivo do cash (redireciona para contagem/acerto conforme o status)
  games/[gameId]/player/…          Jogador na mesa: rebuy de valor livre, desfazer, contar quem vai embora
  games/[gameId]/add-player.tsx    Quem chegou depois
  games/[gameId]/count/            Contagem por cor e conferência; adjust.tsx = ajuste do host
  games/[gameId]/settlement.tsx    Acerto: resultado, Pix (pix/[settlementId] = QR), Paguei/Recebi, resumo
  groups/[groupId]/tournament.tsx  Torneio
  profile.tsx       Meus dados (foto, nome, ID, Pix, histórico)
src/components/     componentes visuais reutilizáveis (importe de '@/components')
src/lib/            regras e cálculos puros, sem React e sem Supabase, sempre com testes
src/services/       acesso ao Supabase: um arquivo por assunto (auth, profile, groups, players, kits, games), com hooks do TanStack Query
src/theme/          cores, espaçamentos, raios e tipografia
src/services/supabase.ts          cliente do Supabase (getSupabase) e teste de conexão
src/services/session.tsx          SessionProvider/useSession/useUserId (login guardado no celular)
src/services/queryClient.ts       cache do TanStack Query e as chaves (queryKeys)
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
- Dados do servidor nas telas: sempre por hooks de `src/services` (TanStack Query). Depois de gravar, invalide
  as chaves de `queryKeys`. Erros chegam às telas já em português (`throw new Error('…')`).
- Formulário que edita dados do servidor: um componente filho que recebe os dados prontos e começa o
  `useState` com eles (não preencher em `useEffect`; o lint recusa).
- Chave Pix do acerto: vale a do perfil de quem tem conta; a do jogador na lista é para quem não tem conta.
- Pix: `src/lib/pix.ts` monta o "copia e cola" (BR Code do Banco Central, CRC16 testado com o exemplo do manual);
  o QR é desenhado com `react-native-qrcode-svg` (preto no branco: `colors.qrForeground/qrBackground`).
- Celulares de quem não é host atualizam a cada 5 s (`refetchInterval`); o tempo real fica para a Fase 6.
- Jogador que já jogou não é apagado: `useRemovePlayer` deixa inativo para não quebrar o histórico.

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
- Fotos de perfil: bucket público `avatars`, cada pessoa só grava na pasta `avatars/<id da conta>/`.
- Criar grupo, entrar por convite e achar alguém pelo ID: funções `create_group`, `join_group`,
  `find_profile_by_public_id` (via `supabase.rpc`).
- `profiles`: selecione colunas explícitas, nunca `select('*')`. A data de nascimento é privada (sem permissão
  de leitura) e só o dono lê, por `my_birth_date()`. O cadastro envia `display_name` e `birth_date` em
  `options.data` do `signUp`; o banco recusa menor de 18.
- Kit de fichas: `chip_kits.kind` = `cash` (valor de cada cor em centavos) ou `tournament` (valor em pontos).
  O grupo tem `default_cash_kit_id` e `default_tournament_kit_id` (um trigger confere o tipo).
- Acerto do cash: sempre por `save_cash_settlement(game_id, transfers)`, que confere no banco, centavo por
  centavo, fichas contadas + ajustes − buy-ins, salva as transferências e encerra o jogo. Não dá para refazer
  depois que alguém marcou pagamento.
- Contagem do cash, de um dos dois jeitos: por cor (linhas em `chip_counts`, todas as cores, inclusive as
  zeradas) ou pelo valor total digitado (`game_players.counted_cents`). Quando o total existe, ele vale no lugar
  das fichas (no app e no `save_cash_settlement`); salvar um jeito apaga o outro.
- Status do cash: `live` (mesa) → `counting` (contagem/conferência) → `finished` (acerto salvo).
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
No Windows do dono, depois de `git pull` use `npm ci` (não `npm install`): segue o `package-lock.json` sem alterá-lo.

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
- [x] Fase 2 — Banco de dados: 17 tabelas, RLS testado (36 verificações), cliente no app; "Conectado ao servidor" conferido no iPhone em 24/11
- [x] Fase 3 — Login, grupos, convite por código, jogadores (ligar conta), kit e Meus dados com foto; testada no iPhone com duas contas em 25/11
- [ ] Fase 4 — Cash game: código pronto (config, mesa, contagem, conferência, acerto com Pix); falta o teste no iPhone
- [ ] Fase 5 — Torneio com várias mesas
- [ ] Fase 6 — Painel por link (TV e celulares)
- [ ] Fase 7 — Testes e distribuição
- [ ] Fase 8 — Torneio de teste com os amigos

Decisões tomadas:
- Conta da Apple Developer como pessoa física (24/11).
- Confirmação de e-mail do Supabase desligada na versão 1; religar antes de publicar nas lojas (25/11).
  No painel: Authentication → Sign In / Providers. Em "User Signups", "Confirm email" DESLIGADO;
  no painel "Email" da lista de provedores, "Enable email provider" LIGADO (desligar ele bloqueia o cadastro).
- Convite para grupo por código colado no app até a Fase 6; depois vira link clicável (25/11).
- "Esqueci a senha" fica para a Fase 7; até lá a senha é redefinida pelo painel do Supabase (25/11).
- Cash: ficha é dinheiro. Cada grupo tem um kit do cash (valor de cada cor em centavos) e um kit do torneio
  (valor em pontos). No cash não há conversão: valor contado = soma de quantidade × valor (25/11).
- Cash: todos começam com o mesmo buy-in; o rebuy tem valor livre (vem com o buy-in inicial, editável).
  Torneio: rebuy = buy-in; o add-on é que tem valor próprio (25/11).
- Contagem do cash: além da contagem por cor, a pessoa pode digitar direto o valor total que já calculou (25/11).
- Conferência do cash que não bate: o app não decide. O host reconta ou registra um ajuste com motivo e
  escolhe em qual jogador ele cai (`adjustments.game_player_id`) (25/11).
Decisões em aberto: data do torneio de teste, nome definitivo.
Ícone e splash ainda são os do template do Expo.

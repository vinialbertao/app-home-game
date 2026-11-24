# Mesa Final HG

App de home game de poker (cash e torneio) para grupos de amigos. React Native + Expo + Supabase.

## Rodar no iPhone

1. `npm ci` (na primeira vez e depois de todo `git pull` que mudar o `package.json`)
2. Copie `.env.example` para `.env` (as chaves entram na Fase 2)
3. `npm start`
4. Aponte a câmera do iPhone para o QR code e abra no **Expo Go**

O celular e o computador precisam estar na mesma rede Wi-Fi. Se não conectar, use `npx expo start --tunnel`.

## Antes de cada commit

```bash
npm run check   # tipos + lint + testes
```

Regras e decisões do projeto: [CLAUDE.md](CLAUDE.md).

# AI_CONTEXT — Leia isto primeiro

> Documento-mestre, denso e otimizado para IA. Em ~1 leitura você entende a
> plataforma sem abrir o código. Os demais docs em `docs/` aprofundam temas.
> Atualize este arquivo quando mudar arquitetura, coleções ou rotas.

## 1. O que é

**PickleRush** — plataforma web (PWA) para criar e administrar **torneios
amadores de pickleball no Brasil**, com camada de **comunidade** (atletas,
clubes, eventos, fórum, chat). Domínio em produção: `picklerush.web.app`
(site Firebase `picklerush`). O site legado `pickletour.web.app` redireciona
301 para o oficial. UI e textos em **português (pt-BR)**.

Pilares:
1. **Torneios** — formatos (single, duplas, americana), modalidades por
   nível/categoria, sorteio, agendamento por quadra, ranking ao vivo, visão
   pública sem login e versão para impressão.
2. **Comunidade** — diretório de atletas, clubes (membros, mural, fórum com
   enquetes, eventos/game-days), chat 1:1 e em grupo.
3. **Notificações in-app** (sino) e **auditoria** de ações.

## 2. Stack

- **React 18 + Vite**, JSX (sem TypeScript; há `typecheck` via JSDoc/`types.js`).
- **Tailwind + shadcn/ui** (Radix) — primitivos em `src/components/ui/`.
- **Firebase**: Auth (Google), **Firestore** (database nomeada `pickleball`),
  Hosting (sites `picklerush` ativo + `pickletour` redirect-only),
  Storage e **Cloud Functions** (region `southamerica-east1`, usada apenas
  para recálculo do ranking nacional via gatilho `onDocumentWritten` em
  `tournaments/{id}`). Toda a lógica de UI/Hooks roda no client; a
  segurança é garantida por `firestore.rules`.
- **React Query** (`@tanstack/react-query`) para data fetching/cache.
- **Vitest** (unit, ~408 testes) + **Playwright** (E2E).
- **react-router-dom** (BrowserRouter), **react-hook-form + zod**, `sonner`
  (toasts), `date-fns`, `lucide-react`.

## 3. Arquitetura em uma frase

App **client-only por módulos de domínio** (V1 + V2 coexistem; **V2 é a
experiência oficial e integral**), cada módulo em camadas
`domain → services → hooks → components/pages`. Domínio é **puro e testado**;
services falam com Firestore; hooks expõem React Query; UI consome hooks.
V2 (`src/v2/`) é a camada de apresentação ativa; **reusa integralmente** os
hooks e services dos módulos em `src/modules/`.

```
src/
├── App.jsx              # Roteamento + providers (QueryClient, Auth, Router)
├── main.jsx             # Bootstrap + registro PWA (atrás de flag)
├── V1Routes.jsx         # Tabela de rotas legada (V1) — somente /v1/*, sem uso real
├── pages/               # Páginas V1-style que V2 ainda não substituiu (espectador, impressão)
├── components/          # shadcn/ui primitives + Layout V1 (em desuso)
├── core/
│   ├── config/firebase.js        # init app/auth/db (database 'pickleball')
│   ├── lib/FirebaseAuthContext.jsx  # AuthProvider + useAuth (user, perfil, papéis)
│   ├── lib/profileValidation.js  # perfil obrigatório, cálculo de idade
│   ├── lib/{logger,utils,useClipboard}.js
│   ├── domain/types.js           # typedefs JSDoc compartilhados
│   └── services/                 # auditService, notificationService,
│                                 # baseService, storageService, observabilityService
├── modules/             # ⭐ BASE DE DOMÍNIO (17 módulos — reusado por V1 e V2)
│   ├── tournament/      # núcleo: torneios, modalidades, jogos, ranking, sorteio
│   ├── athletes/        # diretório de atletas (perfis públicos)
│   ├── clubs/           # clubes, membros, eventos, fórum, game-day
│   ├── chat/            # conversas 1:1 e grupo
│   ├── leveling/        # tabela + questionário de nível (CBPE/USAP)
│   ├── notifications/   # hook do sino
│   ├── admin/           # painel da plataforma (métricas, torneios, parceiros)
│   ├── arenas/          # arenas, reservas, fotos, preços e avaliações
│   ├── games/           # jogos abertos e procura-jogo
│   ├── partners/        # espaço de parceiros (admin)
│   ├── performance/     # meu desempenho
│   ├── progression/     # progressão do atleta
│   ├── rating/          # ranking nacional, head-to-head
│   ├── sharing/         # compartilhamento e certificados
│   ├── social/          # feed, follows, players, metas
│   ├── achievements/    # conquistas
│   └── analytics/       # funil e observabilidade
└── v2/                  # ⭐ APP ATIVO — "Athleisure Premium"
    ├── V2App.jsx        # Tabela de rotas (ativo em /*, autenticado)
    ├── components/      # V2Layout + componentes por módulo
    ├── pages/           # V2Dashboard, V2Arenas, V2Tournament, V2Profile, ...
    └── ui/primitives.jsx # V2Button, V2Card, ...
```

Convenção de camadas por módulo (nem todo módulo tem todas):
`domain/` (lógica pura + `.test.js`) · `services/` (Firestore CRUD + auditoria)
· `hooks/` (React Query) · `pages/` (rotas) · `components/` (UI do módulo).

## 4. Autenticação e papéis

- Login **Google** via Firebase Auth. `AuthProvider` cria/lê `users/{uid}` e
  expõe via `useAuth()`: `user`, `userProfile`, `isAuthenticated`,
  `isPlatformAdmin`, `canCreatePools`, `signOut`, `updateProfile`.
- **Papéis** (campo `users/{uid}.role`):
  - `platform_admin` — admin global (definido por e-mail "owner" no primeiro
    login). Acessa `/admin/*`. `isPlatformAdmin === role === 'platform_admin'`.
  - `user` — atleta comum.
- **Admin de torneio** e **admin de clube** são papéis *por recurso* (coleções
  `tournament_admins` / `club_members.role`), independentes do admin global.
- Perfil obrigatório (`isRequiredProfileComplete`): nome de exibição, data de
  nascimento, telefone, tempo de experiência. Nivelamento (`leveling_level`) é
  recomendado, não obrigatório.

## 5. Rotas

A navegação autenticada roda 100% na **V2App** (`src/v2/V2App.jsx`),
montada em `/*` quando o usuário está autenticado. Visitantes em `/` veem a
landing (V2) e nas demais rotas são levados a `/login`. A `V1Routes` (V1
legado) está presente em `App.jsx` mas só atende `/v1/*` — não recebe
navegação nova.

| Rota | Acesso | Tela |
| --- | --- | --- |
| `/` `/login` | público | landing, login (V2) |
| `/regras` `/nivelamento` `/historia` `/conduta` `/politica-uso` | público | conteúdo institucional (V2) |
| `/p/:tournamentId` | público (sem layout) | visão de espectador, auto-refresh |
| `/torneios/:id/imprimir` | público | versão impressão |
| `/inicio` | autenticado (V2) | Dashboard |
| `/perfil` `/perfil/editar` | autenticado (V2) | Profile (dados + nivelamento) |
| `/torneios` `/torneios/criar` `/torneios/ingressar` `/torneios/guia` | autenticado (V2) | lista/criar/ingressar/guia |
| `/torneios/:id` `/torneios/:id/:tab` `/torneios/:id/modalidades/:modId` | autenticado (V2) | Tournament (abas) + página de modalidade |
| `/arenas` `/arenas/criar` `/arenas/:id` `/arenas/:id/gerir` `/minhas-reservas` | autenticado (V2) | arenas + reservas |
| `/atletas` `/atleta/:uid` | autenticado (V2) | diretório + perfil público |
| `/clubes` `/clubes/criar` `/clubes/:id` `/clubes/:id/eventos/:eventId` | autenticado (V2) | clubes + eventos |
| `/chat` `/novidades` | autenticado (V2) | mensagens + feed |
| `/ranking` `/encontrar-jogadores` `/procura-jogo` `/parceiros` | autenticado (V2) | rating + jogos + parceiros |
| `/meu-desempenho` | autenticado (V2) | performance |
| `/admin/torneios` `/admin/metricas` `/admin/parceiros` | platform_admin (V2) | painel |

Guards: `ProtectedRoute` (auth) e `AdminRoute` (platform_admin). Redirects
legados `/dashboard`,`/boloes*` → rotas novas. Páginas via `React.lazy`.
`basename = import.meta.env.BASE_URL`. Em DEV sem Firebase há "local preview"
em `LOCAL_PREVIEW_PROTECTED_PATHS`.

## 6. Modelo de dados (Firestore, database `pickleball`)

Coleções (todas top-level; ids deterministas quando indicado). Detalhe de
campos em `docs/DATA_MODEL.md`.

- **Identidade**: `users/{uid}` (perfil + role) · `athlete_profiles/{uid}`
  (perfil público do diretório; `directory_listed: bool` controla visibilidade).
- **Torneios**: `tournaments` · `tournament_modalities` · `tournament_admins`
  (id `tournamentId_uid`) · `tournament_registrations` · `tournament_matches` ·
  `tournament_groups` · `tournament_rankings` (materializado no client) ·
  `tournament_courts`. O doc `tournaments/{id}` tem um campo booleano
  `archived` (mais `archived_at`/`archived_by`); arquivar exige
  `status === 'cancelled'` (validação cliente+server) e esconde o torneio
  do público (apenas criador + `platform_admin` continuam vendo).
- **Clubes**: `clubs` · `club_members` (id `clubId_uid`, tem `role`) ·
  `club_join_requests` (id `clubId_uid`) · `club_member_invites`
  (id `clubId_uid`) · `club_posts` (mural) · `club_forum_threads` ·
  `club_events` · `club_event_rsvps` · `event_invites` · `dates`/`date_rsvps`
  (game-day) · `poll_votes` (enquetes de fórum) · `comments`.
- **Chat**: `conversations` · `messages`.
- **Transversal**: `notifications` · `audit_logs`.

Princípios: **sem joins** — desnormalização e leitura por coleção; ids
deterministas (`clubId_uid`) evitam duplicidade e simplificam regras;
escritas sempre acompanhadas de `audit_logs` via `auditService`.

## 7. Notificações (sino)

`core/services/notificationService.js`: `createNotification(...)` e
`notifyUsers(ids, ...)` (em lote, ≤400/batch). Coleção `notifications`.
Hook `modules/notifications/hooks/useNotifications.js` alimenta o sino no
`Layout`. Tipos (`NOTIFICATION_TYPE`): `chat_message`, `chat_invite`,
`forum_reply`, `forum_mention`, `event_invite`, `club_join_request`,
`club_join_approved`, `club_join_rejected`, `club_invite`,
`club_invite_accepted`, `club_event_published`, `tournament_open`,
`profile_reminder`, `leveling_reminder`, `generic`.

**Lembretes derivados** (`profile_reminder`/`leveling_reminder`) NÃO são
gravados no banco: o `Layout` os computa do `userProfile` e mostra no sino
enquanto a pendência existir.

## 8. Domínio de torneio (lógica pura testada)

Em `modules/tournament/domain/` — funções puras com `.test.js`:
`scoring` (CBP/USAP, 11/15/21 pts, sets) · `draw`/`seeding` (sorteio com seed
reproduzível) · `progression`/`doubleElimination`/`swiss` (formatos de fase) ·
`schedule`/`scheduling` (quadras, slots, descanso) · `ranking` (por formato) ·
`capacity`/`eligibility`/`participation` · `formatExplain`/`whistTables`.
**Regra de ouro**: lógica de negócio mora aqui (pura, testável), nunca em
componentes ou services.

## 9. Build, testes e deploy

```bash
npm run dev       # Vite dev (http://localhost:5173)
npm run lint      # ESLint (--quiet no CI)
npm run test      # Vitest unit (~408 testes)
npm run e2e       # Playwright
npm run build     # produção → dist/  (VITE_PWA_ENABLED=true ativa PWA)
```

- **Deploy**: push em `main` dispara `.github/workflows/deploy-firebase.yml`
  (workflow "Deploy Firebase Hosting") → Firebase Hosting nos sites
  `picklerush` (ativo) + `pickletour` (redirect-only 301). Regras do
  Firestore (`firestore.rules`) e índices (`firestore.indexes.json`) são
  publicados pelo mesmo fluxo/CLI. Cloud Function
  `recomputeRankingOnTournamentChange` (region `southamerica-east1`) é
  implantada junto.
- **Env**: variáveis `VITE_FIREBASE_*` (ver `.env.example`),
  `VITE_FIRESTORE_DATABASE_ID` (padrão `pickleball`), `VITE_PWA_ENABLED`.
- **PWA**: aditivo, atrás de `VITE_PWA_ENABLED`; ícones via
  `scripts/generate-pwa-icons.mjs`. Sem service worker quando desligado.

## 10. Convenções para quem edita (humano ou IA)

1. **Lógica pura → `domain/` com teste.** Service só I/O; componente só UI.
2. Mudou Firestore? Atualize **`firestore.rules`** (aditivas, sem quebrar
   coleções existentes) e `docs/DATA_MODEL.md`.
3. Toda escrita relevante gera **`audit_logs`** via `auditService`.
4. Alias de import: `@/` → `src/`.
5. Antes de commitar: `npm run lint && npm run build && npm test` verdes.
6. Não quebrar a **visão pública** (`/p/:id`) nem o fluxo sem login.
7. Textos de UI em **pt-BR**.
8. Deploy só com a tríade verde; confira o run do workflow após o push.

## 11. Mapa dos demais docs

- `docs/ARCHITECTURE.md` — camadas, design system, PWA, testes, padrões.
- `docs/DATA_MODEL.md` — coleções, campos, relacionamentos, resumo das regras.
- `docs/MODULES.md` — o que cada módulo faz, arquivos-chave e fluxos.
</content>
</invoke>

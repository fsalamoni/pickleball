# AI_CONTEXT — Leia isto primeiro

> Panorama denso para IA e humanos: em uma leitura você entende a plataforma
> sem abrir o código. **Não há contagens aqui de propósito** (módulos, telas,
> coleções, índices, funções, flags, testes envelhecem em semanas): os números
> e as listas exatas vêm de [`docs/46-INVENTARIO.md`](./46-INVENTARIO.md),
> GERADO do código (`npm run docs:inventario`). Regras de trabalho e armadilhas
> aprendidas: `CLAUDE.md` (raiz). Mapa de todos os docs: `docs/00-INDEX.md`.

## 1. O que é

**PickleRush** — PWA para o pickleball amador brasileiro: **torneios**,
**dias de jogo** (Play, Americano e variantes), **arenas** (reserva, jogo
aberto, aulas, loja, membros), **professores**, **clubes**, **ranking e rating**
(ELO, 2.0–8.0 estilo DUPR, duplas), **Centro de Treino**, **gamificação**,
**Mercado** (marketplace) e comunidade (chat, follows). Produção:
`https://picklerush.web.app` (site Firebase `picklerush`; `pickletour` só
redireciona). UI e textos em **pt-BR**, com inglês e espanhol atrás da flag
`multi_language` (`docs/44-IDIOMAS.md`).

## 2. Stack

- **React 18 + Vite**, JSX com JSDoc (sem TypeScript; `npm run typecheck`).
- **Tailwind + shadcn/ui** (Radix, `src/components/ui/`) e primitivos próprios
  em `src/v2/ui/`. Modo escuro por paleta (`docs/30-MODO-ESCURO.md`).
- **Firebase**: Auth (Google, Apple, e-mail/senha), **Firestore** (banco
  nomeado `pickleball`), Hosting, Storage e **Cloud Functions** (Node 22,
  região `southamerica-east1`, codebase próprio `picklerush`, em `functions/`).
  O cliente fala direto com o banco: **a segurança é `firestore.rules`**
  (e `storage.rules`), provada no emulador em `tests/rules/`.
- **React Query**, `react-router-dom` (BrowserRouter), `react-hook-form` + `zod`.
- **Vitest** (unidade, `*.runtime.test.jsx` para telas críticas, guardas de
  fonte em `src/core/guards/`) e **Playwright** (`tests/e2e/`).
- Versões exatas: `docs/46-INVENTARIO.md` §2.

## 3. Arquitetura

App **client-first por módulos de domínio**. Cada módulo em
`src/modules/<x>/` tem as camadas que precisa: `domain/` (regra pura +
`.test.js`) → `services/` (I/O Firestore, auditoria) → `hooks/` (React Query)
→ `components/`; `i18n/locales/{en,es}.js` quando tem texto. A UI ativa é
`src/v2/` (rotas em `V2App.jsx`, telas `pages/V2*.jsx`, componentes por área
em `components/`, primitivos em `ui/`) e **consome os hooks/services dos
módulos**. Regra de negócio nunca mora em componente.

```
src/
├── main.jsx · App.jsx     # bootstrap, providers e rotas de raiz (públicas, telão, impressão, totem)
├── pages/                 # só 4 telas V1 públicas: PublicTournament, PrintTournament, Telao, PublicClub
├── components/            # shadcn/ui, ErrorBoundary, InstallAppButton
├── core/                  # auth, firebase, featureFlags, i18n, theme, geo, services, guards
├── modules/               # domínio (lista e camadas: docs/06-MODULES.md e 46-INVENTARIO §3)
└── v2/                    # app ativo: V2App.jsx, V2Layout, pages/, components/, ui/
functions/                 # Cloud Functions (ranking, fila, push, gamificação, exclusão, Mercado…)
tests/                     # rules/ (emulador) · e2e/ (Playwright)
firestore.rules · firestore.indexes.json · storage.rules · firebase.json
```

Convenções que sustentam o resto (detalhe em `CLAUDE.md` §2 e `docs/02-STANDARDS.md`):
feature flag default OFF para o novo; campo/regra **aditivos**; `audit_logs`
em escrita relevante; `logger` (não `console.log`) em services; consulta que
falha **não** é lista vazia (`docs/27`); lista de formatos/opções tem **fonte
única** (guardas de fonte reprovam cópia).

## 4. Autenticação, papéis e permissões

- Login por **Google, Apple ou e-mail/senha** (`FirebaseAuthContext`).
  `useAuth()` expõe `user`, `userProfile`, `isAuthenticated`, `isPlatformAdmin`,
  `canCreatePools`, `signOut`, `updateProfile`. Conta suspensa/bloqueada é
  deslogada com o motivo.
- **Papel global** (`users/{uid}.role`): `platform_admin` (define-se pelo
  e-mail do dono no primeiro login; acessa `/admin/*`) ou `user`.
  `isPlatformAdmin` respeita o "ver como usuário" do admin; `can_create_pools`
  libera criar torneio. Quem tem poder e como tirá-lo: `docs/20-SEGURANCA-E-PRIVACIDADE/17-ACESSOS-E-PODERES.md`.
- **Papéis por recurso** (todos checados na regra, não só na tela):
  - **gestor de arena** — `arena_managers` (`isArenaManager`); também decide o
    dia de jogo e os módulos da arena.
  - **professor** — perfil + `coach_arenas`/`coach_students`; reconhecido nas
    aulas da arena pelo `user_id` em `arena_coaches`.
  - **admin de clube** — `club_members` com papel de admin (`isClubAdmin`); vale
    também para o dia de jogo do clube.
  - **admin de torneio** — `tournament_admins` (`isTournamentAdmin`).
  - **organizador do dia de jogo** — criador, `admin_uids` nomeados, gestor da
    arena (dia com `arena_id`) e admin do clube (dia com `club_id`); fonte única
    no cliente: `games/domain/gameDayRoles.js` (`docs/15`).
  - **admin de circuito** — `circuit_admins`.
  - **atleta** — o usuário comum; entra e sai sozinho de dia de jogo/jogo aberto
    por regras de "só a si mesmo".
- **Perfil obrigatório** (`missingRegistrationFields`, `core/lib/profileValidation.js`):
  o cadastro essencial exige nome, nascimento, telefone, experiência, gênero,
  cidade, UF, lado da quadra, interesses, categoria e nível (`docs/33`). O
  onboarding não trava o uso do app.
- **Dado pessoal**: e-mail/telefone/endereço/nascimento nunca em coleção de
  leitura ampla; a privacidade vale na regra e no servidor
  (`docs/20-SEGURANCA-E-PRIVACIDADE/`).

## 5. Rotas

Duas tabelas, e **a lista completa e atual está em `docs/46-INVENTARIO.md` §4**
(gerada de `src/App.jsx` e `src/v2/V2App.jsx`; não copie rotas para cá):

- **Raiz (`src/App.jsx`)**: públicas e sem layout — `/login`, `/p/:id`
  (torneio público), `/torneios/:id/imprimir`, `/torneios/:id/telao`,
  `/dia-de-jogo/:id/telao`, `/arenas/:id/totem`, `/c/:clubId`, `/r/:code`
  (convite); redirecionamentos legados; o resto cai no `MainEntry`.
- **Aplicativo (`V2App.jsx`)**: dentro do `V2Layout`, exige login
  (`ProtectedRoute`); `/admin/*` exige `platform_admin` (`AdminRoute`). Áreas:
  torneios, arenas (Central em `/arenas/:id/gerir?aba=`), dia de jogo, procura-jogo,
  clubes, professores/aulas, ranking, perfil/Minha área, Mercado, Centro de
  Treino, gamificação, ajuda, legal, notificações, busca.
- **Gates**: `useFeatureFlag(key)` (`core/lib/FeatureFlagsContext.jsx`) decide
  na tela se a flag que o admin liga está ativa (não existe `FeatureFlagGuard`); telas novas de dia de jogo/torneio
  entram em `<Isolada>` (`docs/28`); página nova usa `<V2Page>`
  (`docs/45-MOLDURA-DAS-PAGINAS.md`).

## 6. Dados (Firestore `pickleball`)

Lista de coleções, subcoleções, regras e índices: `docs/46-INVENTARIO.md` §5–6
(gerado) e campos/relações em `docs/05-DATA-MODEL.md`. Famílias:

- **Identidade**: `users`, `athlete_profiles` (diretório; `directory_listed`).
- **Torneio**: `tournaments`, `tournament_modalities`, `tournament_registrations`
  (contato em `private/contact`), `tournament_matches`, `tournament_groups`,
  `tournament_admins`, `tournament_courts`, `tournament_rankings`; equipes ficam
  em campos de `tournament_modalities`/`tournament_registrations` (ver
  `docs/12-TEAM-TOURNAMENTS.md`).
- **Dia de jogo/jogos**: `game_days` (+ `participants`, `games`), `open_games`,
  `club_event_games` (espelho para ranking).
- **Arena**: `arenas` e a família `arena_*` (reservas, quadras, horários,
  bloqueios, membros, carteiras, aulas, cupons, estoque, vendas…).
- **Professor**: `coach_*`. **Clube**: `clubs`, `club_*`.
- **Ranking/rating** (escrita só do servidor): `player_ratings`,
  `rating_history`, `player_skill_ratings`, `skill_rating_history`,
  `doubles_rankings`, `club_internal_*`.
- **Treino**: `training_*`. **Mercado**: `market_*`. **Promo**: `promo_*`.
  **Gamificação**: `user_*`, `gamification_*`, `season_rankings`, `hall_of_fame`.
- **Transversal**: `notifications`, `audit_logs`, `admin_access_logs`,
  `legal_consents`, `push_tokens`, `platform_settings`, `follows`,
  `conversations`.

Princípios: sem joins (desnormalização), ids determinísticos
(`clubId_uid`, `arenaId_uid`…), campo novo sempre opcional, datas lidas do
banco por `instanteEmMs` (`Timestamp`, não `Date`), nome do campo que a regra
confere é contrato. Coleção nova que guarda dado da pessoa entra na **exclusão
de conta** e na **exportação** (guarda `exclusaoCobreColecoes.test.js`).

## 7. Notificações

`core/services/notificationService.js` (`createNotification`, `notifyUsers`
em lotes; devolve quantos avisos gravou) escreve em `notifications`. O hook
`modules/notifications/hooks/useNotifications.js` mantém **uma assinatura por
usuário**, usada pelo sino (`NotificationsBell`), pelo menu e pela central
`/notificacoes` (`docs/36`). Preferências por categoria em
`users/{uid}.notification_prefs`; **push** (FCM, `push_tokens`) sai da função
`pushOnNotificationCreate` respeitando as mesmas preferências
(`functions/notificationPrefs.js`, paridade testada; `docs/PUSH-ATIVACAO.md`).
Link de aviso passa por `linkDeAviso` (a regra recusa `#`) e a navegação por
`destinoDeAviso`.

## 8. Domínio que mais se mexe (e onde está a regra)

Cada item tem README no módulo e doc próprio; abra-os antes do código.

| Assunto | Módulo / fonte | Doc |
|---|---|---|
| Sorteio, grupos, chaves, desempate, classificação | `tournament/domain/` (`draw`, `tiebreak`, `groupPlan`, `crossGroup`, `directEntry`) | 26, 37 |
| Dia de jogo (todas as origens) | `games/` + `v2/components/games/GameDayModule.jsx` | 14–17, 22, 25, 35, 39 |
| Nível dos sorteios (régua 2.0–8.0) | `rating/domain/unifiedLevel.js` | 13 |
| Ranking e rating (servidor escreve) | `rating/` + `functions/ranking.js`, `platformRankings.js`, `rankingCatchUp.js` | 18 |
| Reserva e calendário da arena | `arenas/domain/` (`calendar`, `pricing`, `bookingSelection`, `arenaBlocks`) | 23, 24-MODULOS-DE-ARENA |
| Gamificação | `progression/` | 38 |
| Treino e balanço do jogo | `training/` | 40, 42 |
| Mercado | `marketplace/` + `functions/marketplace.js` | `modules/marketplace/README.md` |
| Troféus e cartões | `trophies/` | 43 |

## 9. Feature flags

`src/core/featureFlags.js` tem dois grupos: **`FEATURE_FLAG`** — o que o admin
liga/desliga (lidas de `platform_settings/global.feature_flags`, default OFF;
hoje `dupr_official_sync`, `gameday_mexicano`, `gameday_king_of_court`,
`marketplace`, `multi_language`) — e **`PERMANENT_FEATURE`** — funcionalidades
incorporadas ao código em 2026-10-10, sempre `true`, fora do painel admin. As
constantes antigas permanecem enquanto houver `if` consultando-as; remover
esses `if` tela a tela é dívida declarada. Guarda: `flagsIncorporadas.test.js`.
Agrupamento do painel: `featureFlagGroups.js`. **Nova funcionalidade: flag nova,
default OFF, aditiva.** Contagem atual: `docs/46-INVENTARIO.md` §8.

## 10. Build, testes e deploy

```bash
npm run dev            # Vite (http://localhost:5173)
npm run lint           # ESLint — 0 errors
npm test               # Vitest
npm run typecheck      # JSDoc
npm run build          # produção (VITE_PWA_ENABLED=true liga o PWA)
npm run docs:inventario  # regenera docs/46-INVENTARIO.md
npm run e2e            # Playwright
```

- **Deploy**: push em `main` → `.github/workflows/deploy-firebase.yml` →
  Hosting, regras, índices e Cloud Functions (publicadas **por nome** no
  codebase `picklerush`; nunca deploy amplo — projeto Firebase compartilhado).
  `functions-watchdog.yml` recria função apagada. `ci.yml` roda lint/testes e
  confere se o inventário e os docs acompanham o código. Detalhes e armadilhas:
  `docs/03-WORKFLOW.md`.
- **Env**: `VITE_FIREBASE_*`, `VITE_FIRESTORE_DATABASE_ID` (padrão
  `pickleball`), `VITE_PWA_ENABLED`.
- **PWA**: `public/sw.js` versionado, `manifest.webmanifest`,
  `firebase-messaging-sw.js` (push); bump de versão do SW em deploy de UI.

## 11. "Ver como usuário"

O admin de plataforma pode ligar "Ver como usuário" no console: `isPlatformAdmin`
e `canCreatePools` passam a `false` e o app se comporta como atleta comum.

## 12. Convenções para quem edita

1. Lógica pura em `domain/` com teste; service só I/O; componente só UI.
2. Funcionalidade nova atrás de flag (default OFF); mudança de schema aditiva.
3. Mexeu em Firestore: `firestore.rules` (aditivo, teste em `tests/rules/`),
   `docs/05-DATA-MODEL.md` e, se for coleção de dado pessoal, exclusão e exportação.
4. Escrita relevante gera `audit_logs` (`auditService`).
5. Texto de UI em `t()`/`tk()` com `en` e `es` (`docs/44`); alias `@/` → `src/`.
6. Antes do PR: lint, build e testes verdes; rode `npm run docs:inventario`
   se mexeu em rota/coleção/regra/índice/função/flag/módulo.
7. Não quebre a visão pública (`/p/:id`) nem o fluxo sem login.
8. Ícone `lucide-react` novo: importe (`node scripts/validate-lucide-imports.mjs`).
9. Tela crítica tem `*.runtime.test.jsx`.

## 13. Mapa dos demais docs

`docs/00-INDEX.md` é o mapa completo. Os essenciais: `02-STANDARDS` (como
codar), `03-WORKFLOW` (git/deploy), `04-ARCHITECTURE`, `05-DATA-MODEL`,
`06-MODULES` (cada módulo), `07-DESIGN-STANDARD`, `46-INVENTARIO` (gerado),
`09-UX-ANALYSIS/15-backlog-remanescente.md` (o que falta), `11-REFERENCE/`
(cheatsheet, glossário, FAQ) e `FUTURO/` (desenhado, não implementado).

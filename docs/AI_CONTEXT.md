# AI_CONTEXT — Leia isto primeiro

> Documento-mestre, denso e otimizado para IA. Em ~1 leitura você entende a
> plataforma sem abrir o código. Os demais docs em `docs/` aprofundam temas.
> Atualize este arquivo quando mudar arquitetura, coleções ou rotas.

## 1. O que é

**PickleRush** — plataforma web (PWA) para criar e administrar **torneios
amadores de pickleball no Brasil**, com camada de **comunidade** (atletas,
clubes, eventos, fórum, chat) e ecossistema de **arenas, professores e
aulas**. Domínio em produção: `picklerush.web.app` (site Firebase
`picklerush`). O site legado `pickletour.web.app` redireciona 301 para o
oficial. UI e textos em **português (pt-BR)**.

Pilares:
1. **Torneios** — formatos (single, duplas, americana, Mexicano, Rei da
   Quadra), modalidades por nível/categoria, sorteio, agendamento por
   quadra, ranking ao vivo, visão pública sem login, versão impressão,
   telão e courtside scoring.
2. **Comunidade** — diretório de atletas, clubes (membros, mural, fórum com
   enquetes, eventos/game-days, ranking interno, página pública), chat 1:1
   e em grupo, feed.
3. **Arenas** — perfil público-editável, quadras nomeadas, janelas de
   horário, preços dinâmicos (regras e overrides por quadra), reservas
   simples, recorrentes, compartilhadas e aulas com professor; lista de
   espera, política de cancelamento, no-show tracking; PDV, pacotes,
   membros, ligas, marketing, IoT.
4. **Professores** — perfil público, diretório, residência em arena,
   agenda/aulas, roster de alunos, pacotes/créditos, biblioteca de
   conteúdo, loja, clínicas/workshops, validação de nível.
5. **Notificações in-app** (sino com preferências por categoria) e
   **auditoria** de ações.

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
- **Vitest** (unit, **1334+ testes**) + **Playwright** (E2E).
- **react-router-dom** (BrowserRouter), **react-hook-form + zod**, `sonner`
  (toasts), `date-fns`, `lucide-react`, `ics` (calendar export).

## 3. Arquitetura em uma frase

App **client-only por módulos de domínio** (V1 + V2 coexistem; **V2 é a
experiência oficial e integral**), cada módulo em camadas
`domain → services → hooks → components/pages`. Domínio é **puro e testado**;
services falam com Firestore; hooks expõem React Query; UI consome hooks.
V2 (`src/v2/`) é a camada de apresentação ativa; **reusa integralmente** os
hooks e services dos módulos em `src/modules/`. **Feature flags controlam
toda nova funcionalidade** (`src/core/featureFlags.js` — 124 flags, +94 nas
Ondas 1-10).

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
│   ├── featureFlags.js           # 124 flags (FEATURE_FLAG)
│   ├── featureFlagGroups.js      # agrupamento por assunto (admin)
│   └── services/                 # auditService, notificationService,
│                                 # baseService, storageService, observabilityService
├── modules/             # ⭐ BASE DE DOMÍNIO (19 módulos — reusado por V1 e V2)
│   ├── tournament/      # núcleo: torneios, modalidades, jogos, ranking, sorteio
│   ├── athletes/        # diretório de atletas (perfis públicos)
│   ├── clubs/           # clubes, membros, eventos, fórum, game-day
│   ├── chat/            # conversas 1:1 e grupo
│   ├── leveling/        # tabela + questionário de nível (CBPE/USAP)
│   ├── notifications/   # hook do sino + preferências
│   ├── admin/           # painel da plataforma (métricas, torneios, parceiros)
│   ├── arenas/          # arenas, reservas, PDV, membros, ligas, marketing
│   ├── coaches/         # professores (perfil, agenda, alunos, pacotes, clínicas)
│   ├── games/           # jogos abertos e procura-jogo
│   ├── partners/        # espaço de parceiros (admin)
│   ├── performance/     # meu desempenho
│   ├── progression/     # progressão do atleta
│   ├── rating/          # ranking nacional, head-to-head, duplas
│   ├── sharing/         # compartilhamento, certificados, calendar export
│   ├── social/          # feed, follows, players, metas
│   ├── achievements/    # conquistas
│   ├── circuits/        # circuitos (séries com ranking)
│   └── analytics/       # funil e observabilidade
└── v2/                  # ⭐ APP ATIVO — "Athleisure Premium"
    ├── V2App.jsx        # Tabela de rotas (ativo em /*, autenticado)
    ├── components/      # V2Layout + componentes por módulo
    │                    #   + FeatureFlagGuard (padrão para flag-gating)
    ├── pages/           # 67 páginas V2: V2Dashboard, V2Arenas, V2Tournament,
    │                    #   V2Coaches, V2CoachProfile, V2CoachAgenda,
    │                    #   V2StudentLessons, V2Settings, V2NotFound, V2Search...
    └── ui/primitives.jsx # V2Button, V2Card, V2Badge, V2Dialog, V2Skeleton, ...
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
- **Admin de torneio / clube / arena / circuito** são papéis *por recurso*
  (coleções `tournament_admins` / `club_members` / `arena_managers` /
  `circuit_admins`), independentes do admin global.
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
| `/torneios/:id/telao` | público (Telão) | TV mode fullscreen |
| `/inicio` | autenticado (V2) | Dashboard |
| `/perfil` `/perfil/editar` | autenticado (V2) | Profile (dados + nivelamento) |
| `/configuracoes` | autenticado (V2) | Settings (privacidade, notificações, exportar dados) |
| `/404` | autenticado (V2) | NotFound (page_titles + not_found_page) |
| `/buscar` | autenticado (V2) | GlobalSearch (busca federada) |
| `/torneios` `/torneios/criar` `/torneios/ingressar` `/torneios/guia` | autenticado (V2) | lista/criar/ingressar/guia |
| `/torneios/:id` `/torneios/:id/:tab` `/torneios/:id/modalidades/:modId` `/torneios/:id/courtside` | autenticado (V2) | Tournament (abas) + página de modalidade + courtside scoring |
| `/arenas` `/arenas/criar` `/arenas/:id` `/arenas/:id/gerir` `/arenas/:id/onboarding` `/minhas-reservas` | autenticado (V2) | arenas + reservas (onboarding é o stepper de 4 passos pós-criação) |
| `/atletas` `/atleta/:uid` | autenticado (V2) | diretório + perfil público |
| `/clubes` `/clubes/criar` `/clubes/:id` `/clubes/:id/eventos/:eventId` | autenticado (V2) | clubes + eventos + página pública |
| `/coaches` `/coaches/:id` | autenticado (V2) | diretório + perfil público do professor |
| `/coach/agenda` | autenticado (V2) | Painel do professor (aulas, alunos, pacotes) |
| `/aluno/aulas` | autenticado (V2) | Aulas do aluno (com professor) |
| `/chat` `/novidades` | autenticado (V2) | mensagens + feed |
| `/ranking` `/ranking/duplas` `/encontrar-jogadores` `/procura-jogo` `/parceiros` | autenticado (V2) | rating (simples+duplas) + jogos + parceiros |
| `/meu-desempenho` | autenticado (V2) | performance |
| `/admin/torneios` `/admin/metricas` `/admin/parceiros` `/admin/console` | platform_admin (V2) | painel + console (flags, migrations) |
| `/admin/owner-debug` `/admin/owner-restore` `/admin/profiles` | platform_admin (V2) | admin tools |

> Itens do sidebar são **condicionais**: a flag `ARENAS` liga `/arenas` na
> seção Plataforma; com o user sendo `manager`/`owner` de alguma arena,
> surge "Minhas arenas" (com badge de reservas pendentes) na seção Você;
> `Minhas reservas` só aparece se `ARENAS` estiver ligada. `/coach/agenda`
> surge se o user é professor; `/aluno/aulas` se tem vínculo
> `coach_students`.

**Tabs do /arenas/:id/gerir** (Sprint 1 ARE-02/04/05/07 + Sprint 6/7/8):
Reservas (calendário por quadra com múltiplos responsáveis), Calendário
(visualização mensal 6x7 com filtro por quadra e cores por status + badges
numéricos PENDING/CONFIRMED), Quadras (CRUD com reorder, soft delete, modal
de horários), Preços (com campo "Aplicar à quadra"), Fotos, Informações,
Admins, Retornos, Parceiros (professores parceiros). A página usa
**navegação em 2 níveis** (sticky top-2 + sub-tab-bar).

**FeatureFlagGuard** (`src/v2/components/FeatureFlagGuard.jsx`) é o padrão
para wrappear páginas V2 por flag. Quando a flag está OFF:
- Mostra empty state com Flag icon + título + descrição
- Platform admin vê botão "Ativar {label}" 1-click (chama `setFeatureFlag`)
- Não-admin vê instrução para pedir ao admin

NUNCA redirecionar silenciosamente para `/` quando a flag está off.

Guards: `ProtectedRoute` (auth), `AdminRoute` (platform_admin),
`FeatureFlagGuard` (flag). Redirects legados `/dashboard`, `/boloes*` →
rotas novas. Páginas via `React.lazy`. `basename = import.meta.env.BASE_URL`.
Em DEV sem Firebase há "local preview" em `LOCAL_PREVIEW_PROTECTED_PATHS`.

## 6. Modelo de dados (Firestore, database `pickleball`)

**92 coleções top-level** (39 antes do Arena V3, +53 com as Ondas 1-10).
Ids deterministas quando indicado (`arenaId_uid`, `coachId_arenaId`).
Detalhe de campos em `docs/DATA_MODEL.md`.

- **Identidade**: `users/{uid}` (perfil + role) · `athlete_profiles/{uid}`
  (perfil público do diretório; `directory_listed: bool` controla visibilidade).
- **Torneios**: `tournaments` · `tournament_modalities` · `tournament_admins`
  (id `tournamentId_uid`) · `tournament_registrations` · `tournament_matches` ·
  `tournament_groups` · `tournament_rankings` (materializado no client) ·
  `tournament_courts` · `tournament_announcements/{id}` ·
  `tournament_photos/{id}`. O doc `tournaments/{id}` tem `archived`/`templates`.
- **Arenas**: `arenas` · `arena_managers` (id `arenaId_uid`) ·
  `arena_courts` (quadras nomeadas) · `arena_court_schedules` (janelas) ·
  `arena_unavailabilities` (admin bloqueia slot) · `arena_waitlist` (lista
  de espera) · `arena_bookings` (com `booking_type` aditivo: 'single'/
  'recurring'/'coach_lesson'/'shared' e `court_id` obrigatório via
  `pickAvailableCourt`) · `arena_reviews` · `arena_favorites` ·
  `arena_modules` (PDV/membros/ligas/marketing/IoT — 35+ coleções V3).
- **Professores** (greenfield, Onda 8 + 7b):
  `coaches/{uid}` (perfil) · `coach_arenas/{coachId_arenaId}` (residência) ·
  `coach_availability/{coachId}` (janelas semanais) ·
  `coach_lessons/{lessonId}` (aulas) · `coach_students/{coachId_studentId}` ·
  `coach_packages/{packageId}` · `coach_package_sales/{saleId}` (créditos) ·
  `coach_content/{contentId}` (biblioteca) · `coach_clinics/{clinicId}` ·
  `coach_clinic_signups/{signupId}` · `coach_level_validations/{validationId}` ·
  `coach_products/{productId}` (loja).
- **Clubes**: `clubs` · `club_members` (id `clubId_uid`) · `club_join_requests`
  · `club_member_invites` · `club_posts` (mural) · `club_forum_threads` ·
  `club_events` (com `recurring_rule`) · `club_event_rsvps` · `event_invites` ·
  `dates`/`date_rsvps` (game-day) · `poll_votes` · `comments`.
- **Chat**: `conversations` · `messages`.
- **Social**: `follows` · `player_goals` (metas).
- **Rating**: `player_ratings` · `rating_history`.
- **Transversal**: `notifications` (com `preferences` por categoria) ·
  `audit_logs` · `platform_settings`.

Princípios: **sem joins** — desnormalização e leitura por coleção; ids
deterministas (`clubId_uid`, `arenaId_uid`, `coachId_arenaId`) evitam
duplicidade e simplificam regras; escritas sempre acompanhadas de
`audit_logs` via `auditService`. Toda nova feature **primeiro entra como
flag OFF no Firestore + código**, depois migra (ver `migrateLegacyFlags`).

## 7. Notificações (sino) + Preferências

`core/services/notificationService.js`: `createNotification(...)` e
`notifyUsers(ids, ...)` (em lote, ≤400/batch). Coleção `notifications`.
Hook `modules/notifications/hooks/useNotifications.js` alimenta o sino no
`Layout`. Tipos (`NOTIFICATION_TYPE`): `chat_message`, `chat_invite`,
`forum_reply`, `forum_mention`, `event_invite`, `club_join_request`,
`club_join_approved`, `club_join_rejected`, `club_invite`,
`club_invite_accepted`, `club_event_published`, `tournament_open`,
`profile_reminder`, `leveling_reminder`, `generic`.

**Preferências por categoria** (flag `notification_prefs`): o user pode
silenciar categorias inteiras (`booking_confirmed`, `tournament_*`, etc).
Default: todas ON. Salvo em `users/{uid}.notification_prefs: {category: bool}`.

**Lembretes derivados** (`profile_reminder`/`leveling_reminder`) NÃO são
gravados no banco: o `Layout` os computa do `userProfile` e mostra no sino
enquanto a pendência existir. **Marcar todas como lidas** (flag
`notifications_mark_all`): botão "Marcar todas" no sino.

## 8. Domínio de torneio (lógica pura testada)

Em `modules/tournament/domain/` — funções puras com `.test.js`:
`scoring` (CBP/USAP, 11/15/21 pts, sets) · `draw`/`seeding` (sorteio com seed
reproduzível) · `progression`/`doubleElimination`/`swiss`/`mexicano`/
`reinaQuadra` (formatos de fase) · `schedule`/`scheduling` (quadras, slots,
descanso) · `ranking` (por formato) · `capacity`/`eligibility`/
`participation` · `formatExplain`/`whistTables`.
**Regra de ouro**: lógica de negócio mora aqui (pura, testável), nunca em
componentes ou services.

## 9. Feature flags (catálogo)

`src/core/featureFlags.js` define 124 flags (FEATURE_FLAG). Defaults no
Firestore em `platform_settings/feature_flags/{key}`. Migration em
`migrateLegacyFlags` (sempre bump `FLAGS_MIGRATION_VERSION`). Padrão de
uso:

```jsx
// src/v2/pages/V2Arenas.jsx
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function V2Arenas() {
  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.ARENAS}
      label="Arenas e reservas"
      description="Diretório de arenas com quadras, preços e reservas."
    >
      {/* conteúdo real */}
    </FeatureFlagGuard>
  );
}
```

Grupos (`featureFlagGroups.js`): core, nav, athlete, tournaments, arenas,
coaches, community, arena_v3, other. O admin vê o catálogo completo e pode
ativar/desativar 1-click.

Ondas recentes (PR #71 + #72):
- **Onda 1**: calendar_export, registrations_csv, not_found_page
- **Onda 2**: gameday_formats (Mexicano + Rei da Quadra)
- **Onda 3**: doubles_ranking, athlete_agenda
- **Onda 4**: tournament_tv_mode · **4b**: courtside_scoring, bracket_tree
- **Onda 5**: tournament_templates · **5b**: tournament_wizard
- **Onda 6**: cancellation_policy, no_show_tracking
- **Onda 6b**: arena_crm, booking_waitlist
- **Onda 7**: partnership_mutual · **7b**: coach_leveling, coach_clinics
- **Onda 8**: club_internal_ranking
- **Onda 8b**: club_invite_link, club_recurring_events, club_public_page
- **Onda 9**: settings_page (LGPD data export) · **9b**: notification_prefs,
  public_seo
- **Onda 10**: global_search · **10b**: a11y (skip-link + main landmark)

## 10. Build, testes e deploy

```bash
npm run dev       # Vite dev (http://localhost:5173)
npm run lint      # ESLint (--quiet no CI) — esperado 0 errors
npm run test      # Vitest unit (1334+ testes)
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
  Auto-unregister de SWs stale (`sw-vN.js`) é padrão, sempre. Reload é
  **deferido** se o user está interagindo (5s de janela de idle).

## 11. Convenções para quem edita (humano ou IA)

1. **Lógica pura → `domain/` com teste.** Service só I/O; componente só UI.
2. **Toda nova feature atrás de uma flag** (`FEATURE_FLAG.*`). Default OFF.
   UI usa `FeatureFlagGuard` ou checa via `useFeatureFlag(key)`.
3. Mudou Firestore? Atualize **`firestore.rules`** (aditivas, sem quebrar
   coleções existentes) e `docs/DATA_MODEL.md` + `docs/AI_CONTEXT.md` §6.
4. Toda escrita relevante gera **`audit_logs`** via `auditService`.
5. Alias de import: `@/` → `src/`.
6. Antes de commitar: `npm run lint && npm run build && npm test` verdes.
7. Não quebrar a **visão pública** (`/p/:id`) nem o fluxo sem login.
8. Textos de UI em **pt-BR**.
9. Ao adicionar ícone `lucide-react` no JSX, **SEMPRE** adicionar no
   import. Rodar `node scripts/validate-lucide-imports.mjs`.
10. Componentes críticos DEVEM ter `*.runtime.test.jsx` que renderiza com
    dados mockados (vite-merge pega tree-shaking; static tests não).
11. **PWA**: bump `sw-vN.js` em todo deploy de UI. Auto-unregister sempre.
    Reload deferido se user interagindo (5s janela).
12. Deploy só com a tríade verde; confira o run do workflow após o push.

## 12. Mapa dos demais docs

- `docs/ARCHITECTURE.md` — camadas, design system, PWA, testes, padrões.
- `docs/DATA_MODEL.md` — coleções, campos, relacionamentos, resumo das regras.
- `docs/MODULES.md` — o que cada módulo faz, arquivos-chave e fluxos.
- `docs/arena-roadmap.md` — roadmap das arenas (Sprint 0-10, status).
- `docs/ARENA_V3/00-INDEX.md` → `26-ARENA-V3-COMPLETE-REFERENCE.md` — referência
  completa do Arena V3.
- `docs/ux-analysis/01-15` — UX/UI docs, incluindo backlog remanescente (15).
- `docs/feature-flags-catalog.md` — catálogo detalhado de todas as flags.

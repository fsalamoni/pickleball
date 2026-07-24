# ARCHITECTURE

> Como o código é organizado e por quê. Para o panorama, leia
> `docs/AI_CONTEXT.md` primeiro.

## Camadas (por módulo de domínio)

```
domain/      lógica pura, sem React nem Firebase — sempre com .test.js
services/    I/O com Firestore (CRUD) + auditoria; sem regra de negócio pesada
hooks/       React Query (useQuery/useMutation) sobre os services
pages/       telas mapeadas a rotas
components/   UI específica do módulo (tabs, dialogs, painéis)
```

Regra: a dependência flui só para baixo (`pages → hooks → services → domain`).
Componentes nunca chamam Firestore direto; passam por hooks/services. Lógica de
negócio (pontuação, sorteio, ranking, agendamento) vive em `domain/` e é
coberta por testes — é o que dá confiança sem ambiente de execução.

## Estado e dados

- **Servidor**: React Query é a fonte de verdade do dado remoto. `QueryClient`
  em `App.jsx` (`staleTime: 30s`, `refetchOnWindowFocus: false`). Hooks
  invalidam queries relacionadas após mutações (ex.: criar torneio invalida
  `['tournaments-public']`).
- **Sessão/identidade**: `FirebaseAuthContext` (Context API) — `useAuth()`.
- **UI local**: `useState`/`react-hook-form`. Sem Redux/Zustand.
- **Realtime**: leituras pontuais com `onSnapshot` onde faz sentido (ex.: visão
  pública de torneio, chat); o resto é fetch + invalidação.

## Design system

- **Tailwind** + **shadcn/ui** (componentes Radix em `src/components/ui/`).
  Use os primitivos existentes (`Button`, `Dialog`, `DropdownMenu`, `Badge`,
  `Tabs`, `Select`, `Toast`/`sonner`…) — não reinvente.
- `cn()` (`core/lib/utils`) para compor classes (clsx + tailwind-merge).
- **Layout** (`src/components/Layout.jsx`): shell autenticado — navegação
  lateral/mobile, sino de notificações (`NotificationsMenu`), menu de usuário.
  Páginas públicas "standalone" (ex.: `/p/:id`) renderizam fora do shell.
- Ícones: `lucide-react`. Datas: `date-fns` / `date-fns-tz` (fuso BRT).

## Firebase

- `core/config/firebase.js` inicializa app, Auth e Firestore. **Database
  nomeada** `pickleball` (não a `(default)`), via `getFirestore(app, dbId)`.
- Sem backend próprio / Cloud Functions: **todas as regras de acesso vivem em
  `firestore.rules`**. Qualquer nova coleção precisa de regra correspondente,
  escrita de forma **aditiva** (não relaxar nem quebrar coleções existentes).
- `core/services/baseService.js` concentra helpers comuns de acesso.
- `auditService` grava `audit_logs` com `{ action, actor, details, created_at }`
  — chamado após mutações relevantes. Ações típicas: `tournament_created`,
  `club_member_invited`, `match_result_recorded`, `club_join_approved`,
  `booking_cancelled`, `booking_transferred`, `booking_responsibles_changed`,
  `coach_lesson_created`, `clinic_signup`, `feature_flag_changed`.
- `observabilityService` registra page views (`recordPageView` em `App.jsx`).
- `storageService` para upload (quando aplicável).
- **`platformSettingsService`** (Sprint 6+): gerencia `platform_settings/
  feature_flags/{key}` (defaults de `FEATURE_FLAG`) e migração via
  `migrateLegacyFlags` (bump `FLAGS_MIGRATION_VERSION` ao adicionar
  defaults novos).

## Roteamento

- `react-router-dom` (BrowserRouter), `basename = import.meta.env.BASE_URL`.
- Páginas via `React.lazy` + `Suspense` (code splitting).
- Guards: `ProtectedRoute` (exige auth) e `AdminRoute` (exige `platform_admin`).
- **`FeatureFlagGuard`** (Sprint 6+): wrappear páginas V2 por flag. Flag OFF
  mostra empty state com Flag icon + título + descrição + botão "Ativar
  {label}" 1-click para platform_admin. **NUNCA redirecionar silenciosamente**.
- "Local preview" em DEV sem Firebase libera um conjunto de rotas protegidas
  (`LOCAL_PREVIEW_PROTECTED_PATHS`) para desenvolvimento offline.

## PWA (opcional, aditivo)

- Atrás da flag `VITE_PWA_ENABLED`. Desligada: nenhum service worker é
  registrado e o botão de instalação some — **zero impacto**.
- Ligada (apenas build de produção): registra o SW e mostra "Baixar o app".
- **Auto-unregister de SWs stale** (`sw-vN.js`): sempre, independente de
  `PWA_ENABLED` (Lição sw-v73.2). Lógica em helper separado.
- **Reload deferido** (sw-v73.3): NUNCA `window.location.reload()` durante
  interação do user. Track via sessionStorage + 5s janela de idle.
- Ícones gerados por `scripts/generate-pwa-icons.mjs` (saída em `public/`).
- Headers de cache em `firebase.json`: assets imutáveis (1 ano);
  `index.html`/`sw.js`/manifest com `no-cache`.

## Testes

- **Vitest** (unit) — foco no `domain/` de cada módulo (pontuação, sorteio,
  ranking, agendamento, elegibilidade, enquetes, game-day, arenas…
  ). **1334+ testes** verdes (era 408 antes do Arena V3).
- **Playwright** (E2E) — `npm run e2e` (instalar com `npm run e2e:install`).
- Convenção: cada arquivo puro de domínio tem `*.test.js` ao lado.
- **Componentes críticos DEVEM ter `*.runtime.test.jsx`** que renderiza
  com dados mockados. Tree-shaking do Vite pode eliminar imports
  side-effect-free — static tests não pegam.
- Antes de qualquer push: `npm run lint && npm run build && npm test`.

## CI/CD

- `.github/workflows/deploy-firebase.yml` — em push para `main`: build e deploy
  no Firebase Hosting (sites `picklerush` ativo + `pickletour` redirect-only)
  + publicação das regras e índices do Firestore + deploy da Cloud Function
  `recomputeRankingOnTournamentChange`.
- (Legado) `deploy-pages.yml` para GitHub Pages, descrito no `README.md`.
- Variáveis de build: `VITE_FIREBASE_*`, `VITE_FIRESTORE_DATABASE_ID`,
  flags de analytics/performance/PWA. Ver `.env.example`.

## Convenções de código

- Import alias `@/` → `src/` (Vite + jsconfig).
- JS + JSDoc; typedefs compartilhados em `core/domain/types.js`; `npm run typecheck`.
- `logger` (`core/lib/logger`) em vez de `console` nos services.
- Mensagens e UI em **pt-BR**.
- Commits descritivos (Conventional Commits: `feat(...)`, `fix(...)`, `docs(...)`).
- **Feature flags SEMPRE** para novas funcionalidades (`src/core/featureFlags.js`).
  Default OFF. Ativada pelo admin em `platform_settings/feature_flags/{key}`.
  UI gated com `<FeatureFlagGuard flag=...>` ou `useFeatureFlag(key)`.
- Ao adicionar ícone `lucide-react` no JSX, **SEMPRE** adicionar no import.
  Rodar `node scripts/validate-lucide-imports.mjs`. Lição sw-v72.5 (MessageSquare).
- Ao usar `cn()` em componente lazy, **importar explicitamente** (não confiar
  em hoisting). Lição sw-v73.5 (V2CourtsTab cn is not defined).
</content>

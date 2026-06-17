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
  — chamado após mutações relevantes.
- `observabilityService` registra page views (`recordPageView` em `App.jsx`).
- `storageService` para upload (quando aplicável).

## Roteamento

- `react-router-dom` (BrowserRouter), `basename = import.meta.env.BASE_URL`.
- Páginas via `React.lazy` + `Suspense` (code splitting).
- Guards: `ProtectedRoute` (exige auth) e `AdminRoute` (exige `platform_admin`).
- "Local preview" em DEV sem Firebase libera um conjunto de rotas protegidas
  (`LOCAL_PREVIEW_PROTECTED_PATHS`) para desenvolvimento offline.

## PWA (opcional, aditivo)

- Atrás da flag `VITE_PWA_ENABLED`. Desligada: nenhum service worker é
  registrado e o botão de instalação some — **zero impacto**.
- Ligada (apenas build de produção): registra o SW e mostra "Baixar o app".
- Ícones gerados por `scripts/generate-pwa-icons.mjs` (saída em `public/`).
- Headers de cache em `firebase.json`: assets imutáveis (1 ano);
  `index.html`/`sw.js`/manifest com `no-cache`.

## Testes

- **Vitest** (unit) — foco no `domain/` de cada módulo (pontuação, sorteio,
  ranking, agendamento, elegibilidade, enquetes, game-day…). ~213 testes.
- **Playwright** (E2E) — `npm run e2e` (instalar com `npm run e2e:install`).
- Convenção: cada arquivo puro de domínio tem `*.test.js` ao lado.
- Antes de qualquer push: `npm run lint && npm run build && npm test`.

## CI/CD

- `.github/workflows/deploy-firebase.yml` — em push para `main`: build e deploy
  no Firebase Hosting (site `pickletour`) + publicação das regras do Firestore.
- (Legado) `deploy-pages.yml` para GitHub Pages, descrito no `README.md`.
- Variáveis de build: `VITE_FIREBASE_*`, `VITE_FIRESTORE_DATABASE_ID`,
  flags de analytics/performance/PWA. Ver `.env.example`.

## Convenções de código

- Import alias `@/` → `src/` (Vite + jsconfig).
- JS + JSDoc; typedefs compartilhados em `core/domain/types.js`; `npm run typecheck`.
- `logger` (`core/lib/logger`) em vez de `console` nos services.
- Mensagens e UI em **pt-BR**.
- Commits descritivos (Conventional Commits: `feat(...)`, `fix(...)`, `docs(...)`).
</content>

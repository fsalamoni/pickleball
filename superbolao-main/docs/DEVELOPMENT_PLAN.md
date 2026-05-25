# Plano de Desenvolvimento — Bolão Copa 2026

## Checkpoint Operacional — 05/05/2026

**Status de produção:** plataforma publicada em `https://superbolao.web.app`; Hosting atualizado com dashboard mobile sem overflow, autenticação E2E automática e smoke autenticado aprovado com dados reais.

**Onde estamos no plano atual:**

| Frente | Status | Evidência |
|--------|--------|-----------|
| Fundação Firebase/Firestore | Concluída | Frontend usa `getFirestore(app, 'bolao2026')`; Functions usam database `bolao2026`; Hosting target `superbolao` |
| Modularização frontend | Concluída em nível operacional | Código em `src/core` e `src/modules/{admin,pool,bets,scoring,tournament,notifications}` |
| Scoring e regras | Concluída e validada | `npm test` com 43 testes da engine; pênaltis reais, zebra e desempates cobertos |
| Admin/FIFA | Concluída em produção | `syncFifaResults`, controles de placar, zebra e resultados especiais publicados |
| Redesign Arena Copa — fase 1 | Concluída e publicada | `Regras` e `Política de Uso` com sidebar, layout compartilhado e hosting deployado |
| Redesign Arena Copa — fase 2 | Concluída e publicada | Admins restantes, pool shell, calendário, regras, pontuação, perfil, criar/ingressar e palpites especiais |
| Performance frontend | Concluída e publicada | Code splitting por rota e vendors separados por domínio; build sem chunks acima de 500 kB |
| Validação visual ampla | Concluída no pacote atual | Smoke público Playwright passou em produção: 23 testes desktop/mobile + 3 skips esperados; smoke autenticado passou 6 testes em `/inicio`, `/boloes/:poolId/*` e `/admin/*` com dados reais |
| Testes E2E | Base implementada e validada | Playwright configurado para smoke público, chunks lazy, overflow e rotas autenticadas por `storageState`; `npm run e2e:auth:admin` gera sessão local via Firebase Admin custom token |
| Observabilidade frontend | Concluída e publicada | Firebase Analytics/Performance opt-in por env; page views sanitizados e erros do ErrorBoundary registrados quando habilitado |
| Monitoramento operacional | Base implementada e versionada | `npm run health:production` valida rotas públicas, HTML SPA e cache de assets; workflow `Production Healthcheck` roda a cada 30 minutos |

**Próxima implementação planejada:** ampliar fluxos E2E críticos autenticados além do smoke, adicionar integração com Firebase Emulators para services/regras e revisar canais de notificação dos alertas do GitHub Actions/Firebase Console.

**Comandos de validação obrigatórios antes de novo deploy:**

```bash
npm run lint
npm test
npm run typecheck
npm run build
git diff --check
npm run e2e:public
npm run e2e:auth
npm run health:production
```

**Comandos de deploy relevantes:**

```bash
npm run deploy:hosting
npm run deploy:firebase
```

> As seções abaixo preservam o plano histórico de arquitetura/módulos. Itens já realizados podem aparecer sem marcação porque o documento original era de planejamento inicial e foi mantido como referência.

## Fase 1: Fundação (Core + Isolamento de Banco)

### 1.1 Criar database dedicado `bolao2026`
- [ ] Criar database `bolao2026` no Firebase Console
- [ ] Atualizar `src/core/config/firebase.js` para `getFirestore(app, 'bolao2026')`
- [ ] Atualizar `functions/src/core/firestore.ts` para `getFirestore('bolao2026')`
- [ ] Atualizar `firebase.json` emulators para incluir `databaseName: 'bolao2026'`
- [ ] Atualizar `firestore.rules` linha `service cloud.firestore` para suportar multi-db
- [ ] Testar conexão e isolamento

### 1.2 Reorganizar estrutura de diretórios (Core + Módulos)
- [ ] Criar `src/core/` movendo:
  - `src/config/` → `src/core/config/`
  - `src/domain/` → `src/core/domain/`
  - `src/lib/` → `src/core/lib/`
  - `src/services/` → `src/core/services/` (base apenas)
- [ ] Criar `src/modules/` com diretórios vazios:
  - `modules/auth/`
  - `modules/pool/`
  - `modules/bets/`
  - `modules/scoring/`
  - `modules/tournament/`
  - `modules/admin/`
  - `modules/notifications/`
- [ ] Atualizar aliases no `vite.config.js` e `jsconfig.json`
- [ ] Atualizar TODOS os imports da aplicação para nova estrutura
- [ ] Garantir que build e testes passam

### 1.3 Criar serviços base (CORE)
- [ ] `src/core/services/baseService.js` — CRUD genérico para Firestore
- [ ] `src/core/services/baseService.ts` (funções) — equivalente server-side
- [ ] `src/core/lib/eventBus.js` — sistema de eventos para comunicação entre módulos
- [ ] Atualizar `src/core/lib/logger.js` com níveis (info, warn, error, debug)

---

## Fase 2: Migração dos Módulos Existentes

### 2.1 Módulo `auth`
- [ ] Mover `FirebaseAuthContext.jsx` → `modules/auth/context/AuthContext.jsx`
- [ ] Criar `modules/auth/hooks/useAuth.js` (re-export do contexto)
- [ ] Criar `modules/auth/services/authService.js` (signIn, signOut, updateProfile)
- [ ] Criar `modules/auth/index.js` com interface pública
- [ ] Atualizar imports em toda a aplicação

### 2.2 Módulo `pool`
- [ ] Mover `services/poolsService.js` → `modules/pool/services/poolsService.js`
- [ ] Mover `hooks/usePools.js` → `modules/pool/hooks/`
- [ ] Mover `domain/poolSettings.js` e `domain/types.js` → `modules/pool/domain/`
- [ ] Mover `components/pool/*` → `modules/pool/components/`
- [ ] Mover páginas: `CreatePool`, `JoinPool`, `MyPools`, `Pool`, `Dashboard` → `modules/pool/pages/`
- [ ] Criar `modules/pool/index.js`
- [ ] Atualizar imports

### 2.3 Módulo `bets`
- [ ] Mover `services/betsService.js` → `modules/bets/services/betsService.js`
- [ ] Mover `hooks/useBets.js` → `modules/bets/hooks/`
- [ ] Criar `modules/bets/components/` com `BettingCard`, `MatchBetRow`, `SpecialBetsForm`
- [ ] Criar `modules/bets/index.js`
- [ ] Atualizar imports

### 2.4 Módulo `scoring`
- [ ] Manter `scoringEngine.js` no CORE (`core/domain/scoringEngine.js`)
- [ ] Criar `modules/scoring/services/scoringService.js` — funções de agregação
- [ ] Criar `modules/scoring/domain/ranking.js` — funções de ranking (compareForGeneralRanking, etc.)
- [ ] Criar `modules/scoring/index.js`

### 2.5 Módulo `tournament`
- [ ] Mover `services/tournamentService.js` → `modules/tournament/services/`
- [ ] Mover `hooks/useTournament.js` → `modules/tournament/hooks/`
- [ ] Mover `data/seed*` → `modules/tournament/data/`
- [ ] Mover `admin/buildSeedPayload.js` → `modules/tournament/utils/`
- [ ] Criar `modules/tournament/index.js`

### 2.6 Módulo `admin`
- [ ] Mover `services/adminService.js` → `modules/admin/services/`
- [ ] Mover `hooks/usePoolCreatorAuthorization.js` → `modules/admin/hooks/`
- [ ] Mover `pages/admin/*` → `modules/admin/pages/`
- [ ] Criar `modules/admin/components/` para componentes admin
- [ ] Criar `modules/admin/index.js`

### 2.7 Módulo `notifications`
- [ ] Mover `hooks/useNotifications.js` → `modules/notifications/hooks/`
- [ ] Criar `modules/notifications/services/notificationsService.js`
- [ ] Criar `modules/notifications/components/` para lista de notificações
- [ ] Criar `modules/notifications/index.js`

---

## Fase 3: Cloud Functions (Backend Modular)

### 3.1 Reorganizar `functions/src/`
- [ ] Criar `functions/src/core/`
  - `scoringEngine.ts` (já existe, mover)
  - `firestore.ts` (inicialização com database name)
- [ ] Criar `functions/src/modules/`
  - `seedTournament/`
  - `scoring/` (processMatchScoring)
  - `bets/` (revealBetsForStage)
  - `notifications/` (notifyPendingBets)
  - `specialBets/` (setSpecialBetResults)
- [ ] Atualizar `index.ts` para importar dos módulos
- [ ] Atualizar testes para refletir nova estrutura

### 3.2 Atualizar funções para usar database `bolao2026`
- [ ] Modificar `initializeApp()` para usar database específico
- [ ] Testar cada Cloud Function isoladamente

---

## Fase 4: Painéis de Administração

### 4.1 Painel Admin da Plataforma (existente, refinar)
- [ ] `modules/admin/pages/AdminDashboard.jsx` — Visão geral
- [ ] `modules/admin/pages/AdminCreatorRequests.jsx` — Aprovar/rejeitar criadores
- [ ] `modules/admin/pages/AdminMatches.jsx` — Gerenciar jogos e resultados
- [ ] `modules/admin/pages/AdminMetrics.jsx` — Métricas da plataforma
- [ ] `modules/admin/pages/AdminSeed.jsx` — Seed do torneio

### 4.2 Painel Admin do Bolão (existente, refinar)
- [ ] `modules/pool/components/PoolAdminTab.jsx` — Configurações, membros, permissões
- [ ] Funcionalidades: promover/remover admins, alterar prazos, ver membros

### 4.3 Métricas e Dashboard
- [ ] Dashboard do proprietário com métricas em tempo real
- [ ] Export de dados (CSV) para análise

---

## Fase 5: Robustez e Segurança

### 5.1 Regras do Firestore
- [ ] Atualizar para suportar multi-database
- [ ] Refinar regras por coleção com base na estrutura modular
- [ ] Adicionar validação de dados nas regras

### 5.2 Testes
- [ ] Testes unitários para cada engine de domínio (scoring, validação)
- [ ] Testes de integração para serviços (com Firebase Emulators)
- [ ] Testes E2E para fluxos críticos (futuro)

### 5.3 CI/CD
- [ ] Atualizar GitHub Actions para nova estrutura
- [ ] Adicionar verificação de imports cíclicos
- [ ] Adicionar verificação de dependências entre módulos

---

## Fase 6: Frontend — Páginas e UX (Pós-Core)

### Funcionalidades a implementar após estabilização do core:
- [ ] Landing page aprimorada
- [ ] Onboarding de novos usuários
- [ ] Melhorias de UX (loading states, empty states, error boundaries)
- [ ] Temas (dark mode)
- [ ] Internacionalização (futuro)

---

> **Última atualização:** 05/05/2026
> **Versão:** 1.1.0
> **Status:** Produção ativa; validação visual autenticada concluída
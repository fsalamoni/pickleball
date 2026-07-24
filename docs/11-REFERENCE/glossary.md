# Glossário — Termos e abreviações

> Vocabulário canônico do PickleRush. Use estes termos em código, docs,
> comentários, mensagens e PRs.

---

## A

**arena** — Estabelecimento com quadras de pickleball. Tem dono (manager)
ou múltiplos managers. Pode ativar sub-módulos (PDV, members, leagues,
marketing, IoT) via `ARENA_MODULE_*` flags.

**arena_admin** — Quem gerencia a arena. Pode ser `owner` (criou) ou
`manager` (adicionado). Coleção `arena_managers/{arenaId_uid}`.

**arena_v3** — Conjunto de 51+ sub-módulos opt-in para a arena (PDV,
members, leagues, marketing, IoT, operations, matchmaking). Cada um
controlado por uma flag `ARENA_MODULE_*`.

**athlete_profile** — Perfil público de um atleta (espelho controlado
de `users/{uid}`). `directory_listed: bool` controla visibilidade.

**audit_log** — Trilha de auditoria. Toda mutação relevante grava aqui
via `auditService.createAuditLog`. Coleção `audit_logs/{id}`.

## B

**backlog** — Lista consolidada de melhorias pendentes. Ver
`09-UX-ANALYSIS/15-backlog-remanescente.md`.

**booking** — Reserva de uma quadra de arena. Coleção `arena_bookings`.
Tipos: `single` (1 responsável), `recurring` (semanal), `coach_lesson`
(aula com professor), `shared` (multi-responsáveis com rateio).

**booking_type** — Campo aditivo em `arena_bookings`. Define o tipo
semântico da reserva (single, recurring, coach_lesson, shared).

## C

**CBPE** — Confederação Brasileira de Pickleball. Mantém a tabela oficial
de níveis. Ver `modules/leveling/`.

**circuit** — Série de torneios com ranking acumulado. Coleção `circuits`.
Dono adiciona torneios via `circuit_tournaments`. Ranking agregado em
`circuit_results` por atleta.

**coach_lesson** — Aula de professor em arena parceira. No banco, é uma
`arena_bookings` com `booking_type='coach_lesson'`. Coleção adicional
`coach_lessons` para o lado do professor.

**corte (corte de preço)** — Sobrescrita de preço para data específica.
Campo `price_overrides[]` em `arenas/{id}`.

**court_assignment** — Lógica que escolhe automaticamente uma quadra
quando user não escolhe. `pickAvailableCourt()` em
`src/modules/arenas/domain/court_assignment.js`.

**CTA** — Call To Action. Botão/ação que leva o user a fazer algo.

## D

**DATABASE_ID** — Firestore database nomeada (não `(default)`). Valor:
`pickleball`. Configurado em `core/config/firebase.js` e via env
`VITE_FIRESTORE_DATABASE_ID`.

**D-DIA-X** — Decisão arquitetural (ex.: "D-CALENDAR-MONTHLY-BETTER-UX").
Decisões com sufixo `D-` aparecem nos docs de UX/UI e nas memories
do agente.

**domain/** — Pasta dentro de cada módulo com lógica pura (sem React,
sem Firebase). SEMPRE com `*.test.js` ao lado.

## E

**ELO** — Algoritmo de rating. Usamos para `player_ratings` e
`headToHead`. Domain em `modules/rating/domain/`.

**emerald → green** — Migração de paleta (refino Sprint 8). Classes
Tailwind `emerald-*` → `green-*` em arenas.

## F

**feature_flag** — Toggle runtime de feature. Definido em
`core/featureFlags.js`. Default OFF. Default no Firestore em
`platform_settings/feature_flags/{key}`. Ativado pelo admin em
`/admin/console`. Migração em `migrateLegacyFlags` (bump
`FLAGS_MIGRATION_VERSION`).

**firebase** — Backend da plataforma: Auth, Firestore, Hosting, Storage,
Cloud Functions. Projeto: `pickletour`. Database: `pickleball` (named).

**fluxo happy-path** — Caminho principal sem erros. Testado em smoke test.

## G

**game-day** — Dia de jogo do clube. Coleção `dates`. Sorteio via
`gameDayDraw` em `modules/clubs/domain/`.

**greenfield** — Feature nova, sem base prévia. Ex.: `coach_lessons`,
`club_public_page`.

## H

**hash determinista** — Id formado por concatenação de chaves naturais.
`arenaId_uid`, `clubId_uid`, `coachId_arenaId`, `tournamentId_uid`.
Permite regras simples no Firestore.

**hooks** — Pasta dentro de cada módulo com React Query (`useX`).
Consomem services, expõem dados para UI.

## I

**id determinista** — Mesmo que **hash determinista**.

**instant_booking** — Reserva que pula REQUESTED → CONFIRMED direto.
Opt-in da arena via `arena.allow_instant_booking: bool`. Requer
`payment_method` e `proposed_price > 0`. Flag `is_instant: bool` salva
no booking. Domain: `instant_booking.js`.

## L

**lição sw-vXY** — Lição aprendida de uma versão do service worker.
Exemplos: sw-v72.5 (MessageSquare sem import), sw-v73.2 (PWA unregister
bloqueado), sw-v73.3 (auto-reload interrompe user), sw-v73.4 (Calendar
sem import), sw-v73.5 (cn não importado, V2Select ignorava options).

**linked_clubs** — Clubes vinculados a um professor ou arena. Aparece
no público dos dois lados.

## M

**memory topic** — Memória persistente do agente Mavis. Em
`/workspace/.mavis/topics/{nome}.md`. Tópicos atuais:
`picklerush-agent-context` (geral), `picklerush-ondas-1-10` (Sprints 6-10).

**Mexicano** — Formato de jogo. Rodízio de duplas por rodada.
Implementado em `modules/tournament/domain/mexicano.js`. Flag
`gameday_formats`.

**mockar** — Substituir uma dependência real por um stub em teste.
`vi.mock(...)` no Vitest.

**módulo** — Pasta em `src/modules/X/` com `domain/`, `services/`,
`hooks/`, `pages/`, `components/`. 19 atualmente.

## N

**navigation 2 níveis** — Padrão de UI: tab bar principal (sticky top-2)
+ sub-tab bar (sticky top-[68px]). Usado em `/arenas/:id/gerir`,
`/admin/console`, etc.

**NotFound** — Página 404 interna. Flag `not_found_page` (Onda 1).
Rota `/404`. Substitui catch-all → `/`.

**NOTIFICATION_TYPE** — Tipos canônicos de notificação. Constante em
`01-AI-CONTEXT §7`. Exemplos: `chat_message`, `forum_reply`,
`club_join_approved`, `tournament_open`, `booking_confirmed`.

## O

**Onda X** — Sub-conjunto de features (~3-5) entregue em um PR. Ondas
1-10 (PRs #71 + #72). Cada uma com suas flags.

**open_match** — Funcionalidade do Arena V3. User entra em uma lista
e o sistema combina com outros. Flag `ARENA_MODULE_MATCHMAKING_OPEN_MATCH`.

**OTP** — One-time password. Não usamos (login é Google).

## P

**pages (V2)** — Telas em `src/v2/pages/V2Xxx.jsx`. 67 atualmente.
Lazy-loaded via `React.lazy`.

**partner_invites** — Convite mútuo entre professor ↔ arena. Onda 7
introduziu `partnership_mutual` (antes era unilateral da arena).

**PDV** — Ponto de Venda. Módulo do Arena V3. Coleções
`arena_products`, `arena_sales`, `arena_payments`. Flag
`ARENA_MODULE_PDV_*`.

**PIX** — Sistema de pagamento instantâneo BR. Arenas podem ter chave
+ QR cadastrados. `arenas/{id}.payment.pix_key`,
`arenas/{id}.payment.qr_code_url`. Pagamento é combinado manual (sem
gateway).

**platform_admin** — Papel global. `users/{uid}.role === 'platform_admin'`.
Acessa `/admin/*`. Único papel que pode ativar/desativar flags em
runtime via `/admin/console`.

**pricing rule** — Regra de preço recorrente. `arenas/{id}.price_rules[]`.
Campos: `weekdays[]`, `start`, `end`, `price`, `court_id?` (opcional).

**publicação** — Tornar conteúdo visível. Eventos: `status='published'`.
Torneios: `tournaments/{id}.public = true`. Clubes: `clubs/{id}.is_public = true` (Onda 8b).

## Q

**QW-N** — Quick Win. ID de melhoria rápida em `09-UX-ANALYSIS/11-quick-wins.md`.

## R

**rateio** — Divisão proporcional do valor de uma reserva compartilhada
entre múltiplos responsáveis. Implementado em
`src/modules/arenas/domain/shared_booking.js`.

**Rei da Quadra** — Formato de jogo. Vencedor fica, demais rotacionam.
Implementado em `modules/tournament/domain/reinaQuadra.js`. Flag
`gameday_formats`.

**refino UX/UI** — Conjunto de melhorias visuais/UX depois de cada
sprint. **Sempre aditivo** (não muda dados/rule). Documentado em
`09-UX-ANALYSIS/13-arena-refino.md`.

**request_status** — Status de uma solicitação. `requested`,
`negotiating`, `confirmed`, `declined`, `cancelled`, `completed`.

**reserva compartilhada** — `arena_bookings.booking_type='shared'` com
`responsibles[]` (multi) e rateio.

**rules (Firestore)** — Regras de segurança. `firestore.rules`. Princípio
fundamental: **aditividade** (nova coleção não mexe nas existentes).

## S

**service** — Camada I/O do módulo. CRUD de Firestore. Sem regra de
negócio pesada (vai em `domain/`).

**shared bookings** — Mesmo que **reserva compartilhada**.

**shadcn/ui** — Componentes Radix. Usados em `src/components/ui/`.
V2 tem seus próprios primitivos (`src/v2/ui/primitives.jsx`).

**shell** — Layout base. `V2Shell` (V2) com header, nav, content area.

**smoke test** — Teste manual rápido do fluxo principal. Feito antes de
PR, em dev, com dados mockados ou reais.

**sprint** — Bloco de trabalho (~1-2 semanas). Sprints 0-10 entregues.

**SW** — Service Worker (PWA). Versionado como `sw-vN.js` (bumpar a cada
deploy de UI). Auto-unregister sempre. Reload deferido (lição sw-v73.3).

## T

**template (de torneio)** — Torneio marcado como modelo para duplicar.
`templates: bool` em `tournaments/{id}`. Onda 5.

**Telão** — TV mode fullscreen. Flag `tournament_tv_mode` (Onda 4).
Rota `/torneios/:id/telao`.

**test/runtime** — Teste de renderização de componente. `*.runtime.test.jsx`.
Pega `ReferenceError` e bugs de import (lição sw-v72.5, sw-v73.4).

**test/unit** — Teste de lógica pura. `*.test.js`. Sempre com domain/.

**theme** — Tema visual. `dark mode` (DS-06) ainda pendente.

**token (design)** — Variável de design system. Cores, espaçamentos,
tipografia. Ver `07-DESIGN-STANDARD.md`.

**typecheck** — `npm run typecheck` (JSDoc check). 0 errors esperado.

## U

**USAP** — USA Pickleball. Mantém a tabela de níveis oficial. Tabela em
`modules/leveling/data/levels.js`.

## V

**V1** — Camada legada (`src/pages/`, `src/components/`). Em desuso,
mantida só para `PublicTournament` (`/p/:id`) e `PrintTournament`.

**V2** — Camada ativa (`src/v2/`). "Athleisure Premium". 67 pages.
Padrão visual: ink/acid/paper, Outfit/Inter, V2* primitives.

**vinculado (clube)** — Clube vinculado a professor ou arena. Aparece
no público dos dois lados. `linked_club_ids[]` em `coaches/{uid}` e
`arenas/{id}`.

## W

**waitlist** — Lista de espera. `arena_waitlist` (Onda 6b). User entra
quando slot cheio; arena notificada ao abrir vaga.

**worktree** — Diretório Git isolado. `git worktree add ../X -b branch origin/main`.
Permite features paralelas. **SEMPRE 1 worktree por feature.**

**Wizard (de torneio)** — Assistente de criação em etapas. Flag
`tournament_wizard` (Onda 5b). `V2TournamentWizard`.

---

> **Última atualização**: 2026-07-24. Termo faltando? Adiciona aqui.

# Arena V3 — Progresso

> Tracking de cada sprint, com status, commits, testes, e qualquer issue.

## Sprint 0 — FUNDAÇÃO (CONCLUÍDO ✅)

**Status**: ✅ Completo

**Tarefas**:
- [x] Documentação completa
- [x] Feature flags (master + 50 sub-flags) em `core/featureFlags.js`
- [x] Domínio puro (`modules.js`, `settings.js`) — 52 testes
- [x] Service (`v3SettingsService.js`, `moduleStateService.js`)
- [x] Hooks (`useArenaSettings`, `useArenaModuleStates`, `useCanArenaUseModule`)
- [x] Firestore rules (10 novas coleções)
- [x] Página V2ArenaModules (`/arenas/:id/gerir/modulos`)

**Resultado**: 487 → 539 testes (+52), lint 6 errors pré-existentes, build verde, 0 breaking changes.

**Commits**:
- `d4697a8` — feat(arena-v3): add sprint 0 foundation
- `3375271` — feat(arena-v3): add module catalog + settings domain

## Sprint 1 — MATCHMAKING & OPEN MATCH (EM ANDAMENTO 🚧)

**Status**: 🚧 70% completo

**Tarefas**:
- [x] Documentação (20-SPRINT-1)
- [x] Domínio puro (openMatch.js, waitlist.js, matchmaking.js) — 82 testes
- [x] Services (openMatchService.js, waitlistService.js)
- [x] Hooks (12 hooks em useArenaV3.js)
- [x] Página pública V2ArenaOpenMatch
- [x] Página admin V2ArenaAdminOpenMatch
- [x] Página V2ArenaMatchmaking (partner finder)
- [x] Rotas em V2App.jsx
- [x] Firestore rules (sprint 0 já incluiu)
- [ ] Adicionar link Open Match no V2ArenaDetail
- [ ] Adicionar link Matchmaking no V2ArenaDetail
- [ ] Adicionar link Open Match no V2ArenaManage sidebar
- [ ] Cloud Function para expireStaleNotifications (opcional)
- [ ] Testes de integração (mock Firestore)

**Resultado parcial**: 569 testes (+30 sem contar domain), build verde.

**Commits**:
- `9ee0e1d` — feat(arena-v3): add sprint 1 matchmaking domain
- (próximo) — feat(arena-v3): add sprint 1 services + open match pages
- (próximo) — feat(arena-v3): add matchmaking page

## Sprint 2 — MEMBROS & PACOTES

**Status**: ⏳ Não iniciado

## Sprint 2 — MEMBROS & PACOTES

**Status**: ⏳ Não iniciado

## Sprint 3 — PDV & PAGAMENTOS

**Status**: ⏳ Não iniciado

## Sprint 4 — AULAS & INSTRUTORES

**Status**: ⏳ Não iniciado

## Sprint 5 — TORNEIOS INTERNOS

**Status**: ⏳ Não iniciado

## Sprint 6 — MARKETING & FIDELIDADE

**Status**: ⏳ Não iniciado

## Sprint 7 — OPERAÇÕES & EQUIPE

**Status**: ⏳ Não iniciado

## Sprint 8 — IOT & INTEGRAÇÕES

**Status**: ⏳ Não iniciado

## Sprint 9 — MULTI-UNIDADE

**Status**: ⏳ Não iniciado

## Sprint 10 — WHITE LABEL

**Status**: ⏳ Não iniciado

## Sprint 11 — AI & SMART FEATURES

**Status**: ⏳ Não iniciado

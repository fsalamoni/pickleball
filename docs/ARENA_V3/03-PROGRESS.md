# Arena V3 — Progresso

> Tracking de cada sprint, com status, commits, testes, e qualquer issue.

## Sprint 0 — FUNDAÇÃO (em andamento)

**Status**: 🚧 Em andamento

**Tarefas**:
- [x] Documentação (00-INDEX, 01-PLAN, 10-MODULES, 11-DATA-MODEL, 12-FEATURE-FLAGS, 13-ROUTING-UX, 14-FIRESTORE-RULES, 15-BUSINESS-LOGIC)
- [ ] Feature flags no `core/featureFlags.js` (master + 29 sub-flags)
- [ ] Domínio puro (`modules/arenas/domain/modules.js`, `settings.js`, `pricing.js`)
- [ ] Testes do domínio (10+)
- [ ] Service (`modules/arenas/services/settingsService.js`, `moduleStateService.js`)
- [ ] Hooks (`useArenaSettings`, `useArenaModuleStates`, `useCanArenaUseModule`)
- [ ] Firestore rules (arena_settings, arena_module_states)
- [ ] Página V2ArenaModules (`/arenas/:id/gerir/modulos`)
- [ ] Refatorar V2ArenaManage (sidebar com módulos)
- [ ] Página V2ArenaPublic (gated por módulos)
- [ ] Atualizar Admin Console para mostrar flags V3
- [ ] Testes de integração (3+)
- [ ] Validação: lint, build, todos os testes existentes passam

**Critério de done**:
- Lint verde
- Build verde
- Todos os testes existentes continuam passing
- Novos testes passando (10+)
- Página /arenas/:id/gerir/modulos funciona (off por default = nada aparece)
- Nenhuma rota/regra/comportamento existente alterado

**Commits planejados**:
1. `chore(arena-v3): add feature flags (master + 29 sub-flags)`
2. `feat(arena-v3): add ARENA_MODULE_ID enum and hierarchy`
3. `feat(arena-v3): add canArenaUseModule gate logic + tests`
4. `feat(arena-v3): add normalizeArenaSettings + isVisibleToPublic + tests`
5. `feat(arena-v3): add arena_settings service + hooks`
6. `feat(arena-v3): add arena_module_states service + hooks`
7. `chore(firestore): add rules for arena_settings and arena_module_states`
8. `feat(arena-v3): add V2ArenaModules admin page`
9. `refactor(arena-v3): V2ArenaManage uses new module-aware sidebar`
10. `feat(arena-v3): V2ArenaPublic hides sections not enabled by arena`
11. `chore(arena-v3): update admin console to show new flags`
12. `docs(arena-v3): update progress + add implementation notes`

## Sprint 1 — MATCHMAKING & OPEN MATCH

**Status**: ⏳ Não iniciado

**Pré-requisitos**: Sprint 0 completo.

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

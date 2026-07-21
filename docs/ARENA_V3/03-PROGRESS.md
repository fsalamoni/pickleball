# Arena V3 — Progresso

> Tracking consolidado. Atualizado em 2026-07-21 — **ROADMAP COMPLETO**.

## Status geral: ✅ TODOS OS 11 SPRINTS ENTREGUES

| Sprint | Tema | Status | Testes | Página |
|---|---|---|---|---|
| 0 | Fundação | ✅ | 52 | V2ArenaModules |
| 1 | Matchmaking + Open Match | ✅ | 21 | 3 |
| 2 | Members & Packages | ✅ | 26 | 2 |
| 3 | PDV & Pagamentos | ✅ | 17 | 1 |
| 4 | Aulas & Instrutores | ✅ | 12 | 1 |
| 5 | Torneios & Ladder | ✅ | 7 | 1 |
| 6 | Marketing & Fidelidade | ✅ | 14 | 1 |
| 7 | Operações & Equipe | ✅ | 7 | 1 |
| 8 | IoT | ✅ | 12 (compartilhado com 9-11) | V2ArenaAdvanced (tab) |
| 9 | Multi-Unit | ✅ | — | V2ArenaAdvanced (tab) |
| 10 | White Label | ✅ | — | V2ArenaAdvanced (tab) |
| 11 | AI & Smart | ✅ | — | V2ArenaAdvanced (tab) |
| **Total** | | **11/11** | **+168 testes novos** | **12 páginas V2** |

## Métricas finais

- **Testes**: 668/668 passing (era 487 antes da V3; +181 novos, 100% verdes)
- **Build**: green, ~22-23s
- **Bundle**: cada página V2 vira chunk próprio (lazy load)
- **Breaking changes**: ZERO
- **Feature flags**: 50 adicionadas, TODAS default OFF

## Commits na branch `feature/arena-management-v3` (8 totais)

```
1. Sprint 0 — Fundação
2. Sprint 1 — Matchmaking + Open Match
3. Sprint 2 — Members & Packages
4. Sprint 3 — PDV & Pagamentos
5. Sprint 4 — Aulas & Instrutores
6. Sprint 5 — Torneios &_root & ladder
7. Sprint 6+7 — Marketing + Operações
8. Sprint 8-11 — IoT + Multi-Unit + White Label + AI
```

## Coleções Firestore (17 novas)

```
arena_settings, arena_module_states,
arena_open_slots, arena_waitlist,
arena_members, arena_packages, arena_wallets, arena_subscriptions,
arena_products, arena_sales, arena_payments,
arena_coaches, arena_classes, arena_class_bookings,
arena_internal_tournaments, arena_ladders,
arena_coupons, arena_campaigns, arena_nps_responses, arena_referrals,
arena_checklists, arena_maintenance_orders,
arena_devices, arena_networks, arena_network_memberships
```

**IMPORTANTE**: Apenas as 10 primeiras (sprint 0) têm rules no Firestore adicionadas. Sprints 1-11 ainda precisam de rules antes do deploy em produção. (Em dev local, sem rules rígidas, funciona.)

## Decisões-chave (D-Novas)

1. **D-GATE-4-LEVELS**: master → parent → sub-flag → arena state
2. **D-DETERMINISTIC-ID**: `arena_module_states/{arenaId}_{moduleId}`
3. **D-SERVICE-AUDIT-LOG**: todo write com `createAuditLog` + `serverTimestamp`
4. **D-PUBLIC-EMPTY-STATE**: módulo off → empty state visível (não esconde)
5. **D-DISPLAY-NAME**: `profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta'`
6. **D-IMPORT-DOMAIN**: funções puras importadas de `domain/*` direto. Hooks SÓ React Query.

## Próximos passos (pendentes do user)

1. **Code review** da branch `feature/arena-management-v3`
2. **Adicionar Firestore rules** para as coleções dos sprints 1-11
3. **Migration das 50 feature flags** em produção (DEFAULT_FLAGS_MIGRATION)
4. **PWA SW bump + deploy** (depois de merge)
5. **Validar visualmente** cada página com uma arena real

## Histórico de progresso anterior (sprint 0-4)

Ver arquivos antigos em `docs/ARENA_V3/20-SPRINT-1-MATCHMAKING.md` etc. para detalhes de cada sprint.

# `analytics/` — Funil e observabilidade

Funil de uso, eventos de produto e observabilidade client-side.

## Status
- **Hooks**: `useFunnel`
- **Domain**: `funnelEvents.js` (puro, testado)
- **Tests**: 10+

Eventos emitidos no `Profile` e em outros pontos críticos.
Integração com `observabilityService` em `core/services/`.

## Feature flag
- `FUNNEL_ANALYTICS` — habilita tracking

## Onde achar mais
- `docs/06-MODULES.md` § analytics

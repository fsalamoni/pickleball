# `circuits/` — Séries de torneios com ranking acumulado

> Renomeado/separado de `tournament/` (estava agrupado antes). Circuitos
> vinculam vários torneios e mantêm ranking agregado.

## Status
- **Páginas V2**: `V2Circuits`, `V2CircuitManage`
- **Coleções**: `circuits`, `circuit_admins`, `circuit_tournaments`,
  `circuit_results`
- **Domain**: `ranking.js` (computeCircuitRanking — puro, testado)
- **Tests**: 15+

## Schema
- `circuits/{id}` — `name`, `season`, `categories[]`, `start_date`, `end_date`,
  `points_table: object` (default: 1º=100, 2º=75, 3/4º=50…)
- `circuit_admins/{circuitId_uid}` (id determinista) — `role` 'owner'|'manager'
- `circuit_tournaments/{circuitId_tournamentId}` (id determinista) — link
- `circuit_results/{circuitId_tournamentId_userId}` (id determinista) — resultado

## Hooks
```js
import { useCircuits, useCircuit } from '@/modules/circuits/hooks/useCircuits';
import { useCircuitRanking } from '@/modules/circuits/hooks/useCircuitRanking';
```

## Feature flag
- `CIRCUITS` — master (Sprint 4 ORG-20)

## Onde achar mais
- `docs/06-MODULES.md` § circuits
- `docs/09-UX-ANALYSIS/05-organizador-criacao-gestao.md` (ORG-20)

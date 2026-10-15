# `performance/` — Meu desempenho

Estatísticas e histórico individual do atleta.

## Status
- **Páginas V2**: `V2Performance`, `V2AthleteAgenda` (Onda 3)
- **Coleções**: `player_ratings`, `rating_history`, `player_goals`, `follows`
- **Tests**: 20+

## Hooks
```js
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
```

## Feature flags
- `PLAYER_PERFORMANCE` — performance detalhada
- `ATHLETE_AGENDA` — agenda do atleta (Onda 3)
- `PLAYER_PROGRESSION` — progressão

## Onde achar mais
- `docs/06-MODULES.md` § performance

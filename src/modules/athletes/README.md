# `athletes/` — Diretório de atletas

Perfis públicos pesquisáveis (`athlete_profiles`, `directory_listed`).

## Status
- **Páginas V2**: `V2Athletes`, `V2AthleteProfile`
- **Services**: `athleteService` (syncAthleteProfile, listAthletes, getAthlete, removeAthleteProfile)
- **Domain**: `publicProfile.js` (puro, testado)
- **Tests**: ~30

## Schema
- `athlete_profiles/{uid}` — `directory_listed: bool`, espelho de `users/{uid}`

## Hooks
```js
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useAthlete } from '@/modules/athletes/hooks/useAthlete';
```

## Onde achar mais
- `docs/06-MODULES.md` § athletes
- `docs/05-DATA-MODEL.md` § Identidade
- `docs/09-UX-ANALYSIS/04-atleta.md` (ATL-*)

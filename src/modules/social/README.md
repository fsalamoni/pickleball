# `social/` — Feed, follows, metas, busca global

Feed da comunidade, follows, metas. **Busca global federada** (Onda 10).

## Status
- **Páginas V2**: `V2Community` (`/novidades`), `V2Search` (Onda 10 — busca
  atletas + torneios + arenas + clubes)
- **Domain**: `feed.js` (puro, testado)
- **Tests**: 15+

## Schema
- `follows/{followerId_followedId}` (id determinista)
- `player_goals/{goalId}` — metas pessoais

## Feature flags
- `COMMUNITY_FEED` — feed
- `FOLLOW_ATHLETES` — follows
- `GLOBAL_SEARCH` — busca global (Onda 10)

## Onde achar mais
- `docs/06-MODULES.md` § social

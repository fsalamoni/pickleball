# `rating/` — Ranking nacional + duplas + matchmaking

Ranking nacional, ranking de duplas (Onda 3), head-to-head, matchmaking.

## Status
- **Páginas V2**: `V2Ranking`, `V2DoublesRanking` (Onda 3), `V2FindPlayers`
- **Domain**: `headToHead`, `doublesRanking`, `matchmaking` (puros, testados)
- **Cloud Function**: `recomputeRankingOnTournamentChange` (region SP)
- **Tests**: 50+

## Schema
- `player_ratings/{userId_format}` — `user_id`, `format`, `rating`, `games_played`
- `rating_history/{id}` — mudanças no rating ao longo do tempo

## Feature flags
- `PLAYER_RATING` — rating individual
- `DOUBLES_RANKING` — ranking de duplas (Onda 3)
- `RATING_HISTORY` — histórico
- `HEAD_TO_HEAD` — comparação 1:1
- `MATCHMAKING` — compatibilidade

## Onde achar mais
- `docs/06-MODULES.md` § rating

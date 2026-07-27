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

## Wave C (Sprint 15, 2026-07-27) — dias de jogo no ranking

`recomputeAllRatings` agora lê **duas coleções** em paralelo:

1. **`tournament_matches`** — jogos de torneio. Mantém o filtro de
   "ranking oficial" (público + encerrado) via
   `eligibleTournamentIdsForRanking`.
2. **`club_event_games`** (NOVO) — espelhamento de jogos decididos de
   **dias de jogo** (Wave C). **Sem filtro de torneio** — sempre
   conta. O publicador (criador do evento + admins do clube) é
   responsável por ligar a chave `publish_to_ranking` no dia de jogo.

Jogos de `club_event_game` são processados em 4b com `side_a_ids`/
`side_b_ids` já como uids (não passam por `tournament_registrations`).
O `source` (no payload final do motor) é `club_event_game`, o que
permite rankings derivados distinguirem a origem dos pontos.

O `recomputeAllRatings` é acionado automaticamente (best-effort, com
`force: true`) após publish/unpublish via
`rankingPublishingService`. Falhas são logadas; o estado das
publicações não depende do resultado do recálculo.

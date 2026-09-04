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

## Governança DUPR — exportação de partidas (flag `dupr_match_export`)

Aba **Admin → Governança → Exportar DUPR**
(`src/v2/components/admin/AdminDuprExportTab.jsx`). Duas listas com
papéis distintos:

1. **Partidas do filtro** — busca em todo o histórico de partidas
   decididas (data, torneio, dia de jogo, clube, evento, atleta, tipo,
   origem, situação DUPR). Serve para procurar e para corrigir a
   situação de qualquer partida.
2. **Aptas a exportar para lançar no DUPR** — a *lista de exportação*.
   Monta-se **sozinha**: partida PRONTA (todos os jogadores com
   `dupr_id`) + situação `pending` + não retirada à mão. O botão
   **Baixar CSV do DUPR** fica nesta lista e leva **exatamente** estas
   partidas — os filtros da busca não influenciam o arquivo.

Nas duas listas o admin marca partidas (todas ou algumas) e aplica em
massa: *pendente*, *exportada*, *lançada no DUPR* e *não lançar no
DUPR*. Na lista de exportação há ainda **Excluir da lista** (e, na
busca, **Devolver à lista de exportação**), que mexe só em
`queue_removed` — a situação DUPR da partida NÃO muda.

**A seleção é do admin, não da tabela**: trocar um filtro nunca
desmarca uma partida que saiu da vista, e a ação em massa continua
valendo para ela (a barra de ações mostra quantas estão fora do
recorte).

### Arquivos

| Camada | Arquivo | Papel |
|---|---|---|
| domain | `domain/duprMatchExport.js` | normalização das partidas, linhas e CSV (27 colunas) |
| domain | `domain/duprReconcile.js` | situações, conferência com o DUPR, **lista de exportação** e upserts do ledger |
| domain | `domain/duprSelection.js` | seleção persistente (imutável, sobrevive aos filtros) |
| domain | `domain/duprExportView.js` | ordenação e paginação das tabelas |
| services | `services/duprExportService.js` | I/O: carga da base, ledger `dupr_export_log`, auditoria |
| hooks | `hooks/useDuprExport.js` | React Query (dados, ledger, mutações) |
| UI | `v2/components/admin/dupr/DuprMatchesTable.jsx` | tabela com seleção, ordenação e paginação |
| UI | `v2/components/admin/dupr/DuprBulkActions.jsx` | barra de ações em massa |

Precedência das situações: `excluded` > `confirmed` > `submitted` >
`exported` > `pending`. Só a ação MANUAL do admin (`force`) pode
rebaixar uma situação; o registro automático do download nunca rebaixa.
Nenhuma partida é alterada — as únicas escritas são no ledger
`dupr_export_log` e em `audit_logs`.

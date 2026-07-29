# `games/` — Jogos abertos, procura-jogo e dia de jogo do atleta

## Status
- **Páginas V2**: `V2OpenGames` (Procura-se jogo), `V2GameDays` (Dia de jogo), `V2MyGames` (rota legada → redireciona)
- **Coleções**: `games`, `open_games`, `participants`, `game_days` (+ subcoleções `participants`/`games`)
- **Flags**: `open_games`, `athlete_game_day`
- **Tests**: 36+

## Schema
- `games/{id}` — definição do jogo (data, horário, local, nível)
- `open_games/{id}` — vaga aberta (procurando jogadores). Quando `kind='game_day'`,
  é o convite público de um dia de jogo (`game_day_id`).
- `participants/{id}` — confirmações

### Dia de jogo do atleta (flag `athlete_game_day`)
- `game_days/{id}` — dia de jogo criado por um atleta. Público (publica convite em
  `open_games`) ou privado (só convidados). Campos-chave: `created_by`,
  `visibility` (`public`/`private`), `member_uids[]` (dono + convidados + quem
  entrou pelo convite), `invited_uids[]`, `open_game_id`, `publish_to_ranking`,
  `format`, `status` (`active`/`archived`).
- `game_days/{id}/participants/{pid}` — participantes do dia (`user_id?`, `name`,
  `source`: owner/invited/joined/guest).
- `game_days/{id}/games/{gid}` — jogos sorteados/avulsos (mesmo shape do dia de
  jogo dos clubes: `side_a`/`side_b` = `[{id,name}]`, `score_a`/`score_b`).

### Ranking
Ao publicar, os jogos DECIDIDOS são espelhados na MESMA coleção materializada dos
clubes — `club_event_games` — com `event_id = game_day_id`, `source =
'athlete_game_day'` e `club_id` **resolvido por partida** (o clube comum a TODOS
os atletas da partida, ou `null`). Assim o motor de rating nacional
(`ratingService`) e o ranking interno dos clubes (`functions/clubRanking.js`)
consomem os resultados sem alteração. Domínio puro em `domain/gameDayRanking.js`.

## Onde achar mais
- `docs/06-MODULES.md` § games
- `docs/05-DATA-MODEL.md`

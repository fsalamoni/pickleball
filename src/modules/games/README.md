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

### Formato "Play" (open play por ordem de chegada) — flag `gameday_play`
Formato alternativo do dia de jogo do atleta, escolhido na criação. Sessão de
jogo aberto com N quadras (`game_days/{id}.play_courts`), **sem sorteio de grade
e sem resultados**. Os jogos são criados por ORDEM DE CHEGADA/ESPERA, quadra a
quadra; ao concluir um jogo ("jogo concluído"), o próximo entra automaticamente
na quadra liberada. Domínio puro em `domain/gamePlay.js` (com testes):
- `computePlayOrder` — separa disponíveis (numerados por espera), em quadra e
  pausados; a espera usa `available_since` + `available_tie` (sorteio embutido
  entre empatados);
- `buildPlayNextMatch` — escolhe os 4 do próximo jogo respeitando a ordem e as
  DUPLAS FIXAS (empurra a dupla que furaria a ordem);
- `assignPlayTeams` — forma as duplas equilibrando NÍVEL e SEXO (prioriza mistas);
- `freePlayCourts`/`nextFreePlayCourt` — controle de quadras.

Participantes têm campos aditivos `play_status` (derivado), `available_since`,
`available_tie`, `skip_remaining` (pausar X partidas), `partner_id` (dupla fixa),
`play_level`, `play_gender`. Serviço: `createNextPlayGame`, `createManualPlayGame`,
`finishPlayGame` (auto-cria o próximo), `cancelPlayGame`, `noShowSwapPlayGame`
(substitui ausente pelo próximo da ordem, trocando de lugar; grava o ausente em
`games/{gid}.swapped_out_ids` para que, em novas substituições NA MESMA partida,
um jogador já substituído NÃO retorne ao jogo de onde saiu — via
`pickSwapReplacement`), `setPlayParticipantSkip`,
`setPlayParticipantPartner`. UI dedicada em `v2/components/games/AthletePlayOrganizer.jsx`
(seções Participantes, Quadras e jogos, e "Ordem de participação"). No Play NÃO há
ranking do dia nem publicação no ranking. Regras: `game_days` com `format == 'play'`
permitem que qualquer MEMBRO opere a fila (aditivo em `firestore.rules`).

### Sorteio aditivo de jogos
"Sortear jogos" é **aditivo**: gera novos jogos com a lista ATUAL de
participantes e os ADICIONA aos existentes, sem apagar os que já têm resultado
lançado. Quando há jogos SEM resultado, o diálogo pergunta se devem ser mantidos
ou substituídos pelos novos. As rodadas novas são numeradas após as já
existentes. Domínio puro em `clubs/domain/gameDayDrawMerge.js`
(`planAdditiveDraw`/`offsetRounds`/`splitGamesByResult`); persistência via
`appendGameDayGames` (atleta) / `appendEventGames` (clube), que só removem os ids
indicados e nunca tocam nos jogos com resultado.

#### Americano ciente do histórico (variação + equilíbrio)
Ao re-sortear (formato **Americano**), quando atletas entram/saem ou os jogos
sem resultado são substituídos, o motor leva em conta o que **já aconteceu no
dia** — os jogos MANTIDOS (`planAdditiveDraw().keptGames`: sempre os com
resultado; e também os sem resultado quando não são substituídos). Domínio puro
em `clubs/domain/gameDayDraw.js`:
- `buildDrawHistory(keptGames, currentIds)` — extrai, só dos participantes
  atuais, as **duplas** já formadas, os **adversários** já enfrentados, o nº de
  **partidas** disputadas e o nº de **rodadas presentes** (derivado da rodada de
  entrada de cada um);
- `generateGameDayGames(ids, { rounds, seed, history })` — semeia esses
  contadores para (a) **evitar repetir** parcerias/confrontos e (b) equilibrar a
  **participação por TAXA** (jogos ÷ rodadas presentes): quem está abaixo da sua
  taxa justa entra primeiro; quem entrou tarde recebe participação equilibrada
  **sem** ser forçado a igualar o TOTAL de quem entrou desde o início.

Sem histórico (1º sorteio) o comportamento é idêntico ao anterior — determinismo
por seed preservado. Só o Americano usa o histórico; Mexicano/Rei da Quadra
seguem com sua lógica própria.

### Ranking do dia (classificação interna)
Entre "Jogos" e "Resultados no ranking", o organizador mostra o **Ranking do
dia**: cada participante com jogos, vitórias, derrotas, saldo de pontos e pontos
sofridos. Ordenação: mais vitórias → menos derrotas → melhor saldo → menos
pontos sofridos. Só conta jogos decididos; é independente do ranking geral da
plataforma. Domínio puro em `clubs/domain/gameDayLeaderboard.js`; UI compartilhada
em `clubs/components/GameDayLeaderboard.jsx` (atleta e clube).

### Ranking (opt-in)
Ao publicar, os jogos DECIDIDOS são espelhados na MESMA coleção materializada dos
clubes — `club_event_games` — com `event_id = game_day_id`, `source =
'athlete_game_day'` e `club_id` **resolvido por partida** (o clube comum a TODOS
os atletas da partida, ou `null`). Assim consomem os resultados sem alteração:
- **Ranking individual** (`ratingService.recomputeAllRatings`);
- **Ranking de duplas** (`ratingService.listFinishedEngineMatches` também lê
  `club_event_games`);
- **Ranking interno dos clubes** (`functions/clubRanking.js`, quando `club_id`).
Domínio puro em `domain/gameDayRanking.js`.

**Rodadas sorteadas × partidas avulsas — mesmo tratamento.** Não há filtro por
`round` em nenhum consumidor: uma partida manual (`round: null`) e uma rodada
sorteada entram no espelho pelas MESMAS regras (`buildGameDayMatch` só exige jogo
decidido, lados iguais e `user_id` válido — convidados sem conta são ignorados).
A diferença "Partidas avulsas" × "Rodada N" é apenas rótulo de exibição.

**Propagação de edições (idempotente).** `buildGameDayRankingMatches` recebe
opcionalmente `publishedById` (id → documento já espelhado). Com ele, jogos JÁ
publicados são REAVALIADOS via `mirrorDecisionChanged` (compara placar, vencedor,
lados, modalidade e clube): se o resultado mudou, o espelho é regravado
(preservando `created_at`); se deixou de ser decidido, é removido; se nada mudou,
conta como `already_published`. Sem `publishedById`, mantém o comportamento legado
(já publicado = pula). `applyGameDayMirror` lê os docs completos
(`listRankingDocs`) para habilitar essa propagação — assim uma correção de placar
de qualquer partida (sorteada ou avulsa) reflete em ranking/rating/exportação.

### Meu desempenho (sempre, independente do ranking)
`getMyGameDayGames(uid)` + `useMyGameDayGames` reúnem TODOS os jogos de dia de
jogo do atleta (decididos) — do espelho publicado (`club_event_games` por
`array-contains`) e da fonte `game_days/.../games` (mesmo sem publicação),
deduplicando pelo id determinístico `gd_${gameDayId}_${gameId}`. Isso alimenta:
- **Estatística** (`usePlayerStats` funde via `foldGameDayGamesIntoStats`);
- **Meus jogos** (`MyGamesPanel` mescla no histórico).
Domínio puro em `domain/myGames.js`. A publicação no ranking NÃO afeta o
desempenho pessoal — este mostra sempre todos os jogos do atleta.

**Formato (individual × duplas):** todo jogo de dia de jogo é em DUPLAS
(americano/mexicano/rei da quadra); o formato NÃO muda por um parceiro não
estar cadastrado. `mirrorGameToMyGame`/`sourceGameToMyGame` classificam via
`normalizeStatsFormat` (só `kind === 'singles'` explícito é individual; o resto
é duplas) — a antiga heurística por nº de jogadores foi removida porque contava
como individual uma dupla com convidado avulso. Cada jogo normalizado carrega
também `partner` (parceiro da minha dupla) além de `opponent`, para o histórico
exibir **minha dupla vs dupla adversária**.

## Onde achar mais
- `docs/06-MODULES.md` § games
- `docs/05-DATA-MODEL.md`

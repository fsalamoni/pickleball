# trophies — troféus, pódio e cartões de campeões

O que a pessoa CONQUISTOU, derivado do que já está gravado — **zero coleção,
zero índice, zero regra**:

- **Torneio**: a colocação de cada categoria sai de `tournament/domain/podium.js`
  (`modalityPodium`, a MESMA conta do ranking da casa). Só categoria
  ENCERRADA (final decidida) tem pódio.
- **Dia de jogo**: a colocação no RANKING DO DIA dos dias publicados no
  ranking (`club_event_games`, leitura pública), por tipo de jogo.

`domain/trophies.js` monta a coleção (`tournamentTrophies`, `gameDayTrophies`,
`groupTrophies`); `domain/medalCard.js` escreve o cartão (títulos, dizeres,
texto de compartilhamento, nome do arquivo, link). `services/trophyService.js`
busca; `hooks/useTrophies.js` entrega à tela.

Parabenizar = um **kudo** (`progression/services/kudoService`, tipo `positive`,
`contextId` = `trophyContextId(trofeu)`): entra na gamificação pelo caminho que
já existe (índice de kudos, missões, conquistas, antifarm), e avisa o
medalhista por `notifications` (tipo `gamification`).

Telas em `src/v2/components/trophies/`. Ver `docs/43-TROFEUS-E-CARTOES.md`.

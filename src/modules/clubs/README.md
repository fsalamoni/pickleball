# `clubs/` — Clubes e comunidade

Clubes com associação por papel, mural, fórum (com enquetes), eventos e
game-day (com Mexicano + Rei da Quadra), ranking interno, página pública.

## Status
- **Páginas V2**: `V2Clubs`, `V2ClubDetail`, `V2EventDetail`, `V2CreateClub`,
  `V2ClubPublicPage` (Onda 8b)
- **Componentes**: `V2ClubAdmin`, `V2ClubEvents`, `V2ClubFeed`,
  `V2ClubForums`, `V2ClubMembers`, `V2EventChat`, `V2EventDatesPanel`,
  `V2EventParticipantsPanel`, `V2ForumPoll`, `V2ForumThreadView`,
  `V2GameDayOrganizer` (com Mexicano + Rei da Quadra), `V2ClubInternalRanking`
  (Onda 8), `V2ClubRecurringEvents` (Onda 8b), `V2ClubInviteLink` (Onda 8b)
- **Services**: `clubService`, `forumService`
- **Domain**: `clubRanking`, `forumPoll`, `gameDayDraw`, `mexicano`,
  `reinaQuadra`, `constants`
- **Tests**: 100+

## Schema
- `clubs/{id}` — `is_public` (Onda 8b), `public_slug`, `invite_link`,
  `recurring_rule`, `internal_ranking_config`
- `club_members/{clubId_uid}` (id determinista) — `role` ('admin'|'member')
- `club_join_requests/{clubId_uid}` (id determinista)
- `club_member_invites/{clubId_uid}` (id determinista)
- `club_posts`, `club_forum_threads`, `club_events`, `club_event_rsvps`,
  `event_invites`, `dates`, `date_rsvps`, `poll_votes`, `comments`

## Hooks
```js
import { useClubs, useClub } from '@/modules/clubs/hooks/useClubs';
import { useClubForum } from '@/modules/clubs/hooks/useClubForum';
import { useClubRanking } from '@/modules/clubs/hooks/useClubRanking';
import { useClubPublicPage } from '@/modules/clubs/hooks/useClubPublicPage';
```

## Feature flags
- `LINKED_CLUBS` — clubes vinculados
- `GAMEDAY_FORMATS` — Mexicano + Rei da Quadra
- `CLUB_INTERNAL_RANKING` — ranking interno (Onda 8)
- `CLUB_INVITE_LINK` — link de convite (Onda 8b)
- `CLUB_RECURRING_EVENTS` — eventos recorrentes (Onda 8b)
- `CLUB_PUBLIC_PAGE` — página pública (Onda 8b)


## Wave C (Sprint 15, 2026-07-27) — dias de jogo → ranking nacional

> "Lançar resultados de dias de jogo no ranking" — chave `publish_to_ranking`
> em `club_events/{id}/dates/{dateId}` (default OFF). Apenas o criador do
> evento + admins do clube podem LIGAR/DESLIGAR.

### Como funciona (fluxo)

1. O organizador de um dia de jogo registra os jogos (`score_a`/`score_b`).
2. O criador do evento ou admin do clube abre o dia de jogo e liga o switch
   "Lançar resultados no ranking".
3. `rankingPublishingService.publishEventDateToRanking` espelha os jogos
   **decididos** em `club_event_games/{eventId_dateId_gameId}` e aciona o
   recálculo do rating nacional.
4. A partir daí, os jogos do dia contam no ranking ELO + histórico de
   desempenho dos atletas (já com `source: 'club_event_game'`).
5. Para **despublicar**, basta desligar a chave (remove do ranking, recalcula).

### Garantias

- **OFF por padrão** — chave desligada não publica nada.
- **Apenas jogos decididos** entram no ranking (placar numérico com
  vencedor). Jogos sem placar ou com placar empatado são pulados.
- **Apenas atletas com `user_id` válido** (não guests) entram.
- **Singles (1×1) e doubles (2×2)** suportados; outros tamanhos pulados.
- **Idempotente** — re-rodar a publicação não duplica; "Republicar" é
  seguro e re-sincroniza a partir do estado atual.
- **Auto-cleanup** — `clearGameDayData` (chamado ao excluir o dia de
  jogo) também remove os espelhamentos no ranking.

### Arquivos novos

- `src/modules/clubs/domain/rankingPublishing.js` (19 testes)
- `src/modules/clubs/services/rankingPublishingService.js`
- `src/modules/clubs/components/PublishToRankingToggle.jsx`

### Arquivos modificados

- `firestore.rules` (novo bloco `club_event_games` + helper
  `isClubEventCreator`)
- `src/modules/clubs/domain/constants.js` (`clubEventGames`,
  `GAME_DAY_RANKING_RESULT`, `GAME_DAY_RANKING_SOURCE`)
- `src/modules/clubs/hooks/useClubs.js` (4 hooks novos)
- `src/modules/clubs/services/clubService.js` (clearGameDayData
  também limpa o espelhamento)
- `src/modules/clubs/components/EventDatesPanel.jsx` (integração
  do toggle no DateCard, com `canManage` baseado em criador/admin)
- `src/modules/rating/services/ratingService.js` (recomputeAllRatings
  lê `tournament_matches` + `club_event_games` em paralelo)
- `src/modules/rating/domain/elo.test.js` (3 testes cobrindo
  match de club_event_game)

### Permissões

- **Podem LIGAR/DESLIGAR** a chave e despublicar: criador do evento,
  admin do clube (`club_members/{clubId_uid}.role == 'admin'`),
  platform admin.
- **Podem LER** os jogos espelhados: público (faz parte do ranking).

## Onde achar mais
- `docs/06-MODULES.md` § clubs
- `docs/09-UX-ANALYSIS/09-clubes-comunidade.md` (CLU-*)

### Posicionamento do switch (Wave C.1)

O switch "Lançar resultados no ranking" é renderizado **dentro do
`GameDayOrganizer`**, na mesma seção da organização de jogos — logo
abaixo da lista de jogos do dia. Não fica em uma seção separada nem
numa aba à parte. `canManage` é calculado pelo próprio
`GameDayOrganizer` (criador do evento OU admin do clube).

## Wave C.2 (Sprint 16, 2026-07-28) — ranking interno em duplas

> O `ClubRankingTab` (aba "Ranking" do clube) agora tem sub-abas
> **Individual** | **Duplas**. Acompanham um toggle "Incluir
> resultados externos" (só admins do clube; default OFF) que,
> quando ligado, considera também placares de **torneios da
> plataforma** e de **dias de jogo de outros clubes** em que
> atletas do clube participaram.

### Como funciona (fluxo)

1. O user abre a aba "Ranking" do clube (membro do clube).
2. Por padrão, vê a sub-aba "Individual" com o ranking só dos
   jogos do próprio clube.
3. Se `CLUB_INTERNAL_DOUBLES_RANKING` estiver ON, pode alternar
   para a sub-aba "Duplas" — parcerias que jogaram juntas
   (ordenadas por vitórias/derrotas/saldo).
4. Admin do clube pode LIGAR "Incluir resultados externos" para
   o ranking também refletir torneios + dias de jogo fora do
   clube. Default OFF.

### Fontes coletadas pelo service

- **Jogos do próprio clube** (sempre): `club_events/{id}/.../games`
- **Wave C do próprio clube** (sempre): `club_event_games` onde
  `club_id == clubId`
- **Wave C de outros clubes** (só se `includeExternal`): filtrado
  pelos uids do clube
- **Tournament matches** (só se `includeExternal`): finalizados
  onde uids do clube aparecem

### Arquivos novos

- `src/modules/clubs/domain/clubRankingSources.js` (13 testes)
- `src/modules/clubs/services/clubInternalRankingService.js`
- `src/modules/clubs/hooks/useClubInternalRanking.js`

### Arquivos modificados

- `src/core/featureFlags.js` (nova flag `CLUB_INTERNAL_DOUBLES_RANKING`)
- `src/v2/pages/V2ClubDetail.jsx` (sub-abas + toggle + tabelas
  individual/duplas)

### Quem pode LIGAR "Incluir resultados externos"

- Admin do clube (member role 'admin' em `club_members/{clubId_uid}`)
- Platform admin (não tem UI direta; pelo Firestore)
- Default OFF: cada user vê só os jogos do clube (escopo padrão)

## Wave C.3 (Sprint 17, 2026-07-28) — ranking MATERIALIZADO no Firestore

> **Quebra de arquitetura**: o cálculo de ranking (individual e
> duplas) foi movido do cliente para o **servidor** (Cloud
> Function). O frontend apenas **LÊ** o materializado. Toggle
> "Incluir resultados externos" = trocar coleção. **Zero
> cálculo client-side**.

### Por que materializar?

- **Sem latência**: ranking abre instantaneamente, mesmo com
  10k+ jogos.
- **Múltiplos users**: a leitura é servida do mesmo materializado,
  sem custo de CPU cliente.
- **Coerência**: o ranking nunca está inconsistente com os dados;
  recalcula automaticamente em qualquer mudança.

### Coleções (4) — top-level, materializadas

| Coleção | Conteúdo | Escopo |
|---|---|---|
| `club_internal_ratings/{clubId_userId}` | Individual | Só clube |
| `club_internal_ratings_ext/{clubId_userId}` | Individual | Com externos |
| `club_internal_doubles_ratings/{clubId_pairKey}` | Duplas | Só clube |
| `club_internal_doubles_ratings_ext/{clubId_pairKey}` | Duplas | Com externos |

### Cloud Functions (5 gatilhos + 2 callable)

| Função | Tipo | Origem |
|---|---|---|
| `recomputeClubRankingOnClubGame` | onDocumentWritten | `club_events/{id}/games/{id}` |
| `recomputeClubRankingOnClubEventGame` | onDocumentWritten | `club_event_games/{id}` |
| `recomputeClubRankingOnTournamentMatch` | onDocumentWritten | `tournament_matches/{id}` |
| `recomputeClubRankingOnMemberChange` | onDocumentWritten | `club_members/{id}` |
| `recomputeClubRankingOnAthleteProfileChange` | onDocumentWritten | `athlete_profiles/{id}` |
| `recomputeAllClubInternalRankings` | callable (admin) | backfill total (platform_admin) |
| `recomputeOneClubInternalRanking` | callable (admin) | 1 clube (admin clube ou platform_admin) |

### Bug fix (Wave C.2 → Wave C.3)

- **Wave C.2**: ranking individual mostrava `uid` em vez do nome
  (cálculo client-side construía `name: uid` literal).
- **Wave C.3**: `display_name` e `photo_url` desnormalizados no
  documento materializado, no servidor. **Bug resolvido na
  arquitetura**.

### Arquivos

**Server:**
- `functions/clubRanking.js` (NOVO) — motor completo + helpers
- `functions/index.js` — 5 handlers + 2 callable

**Cliente:**
- `src/modules/clubs/hooks/useClubInternalRanking.js` (reescrito) — só LÊ
- `src/modules/clubs/hooks/useClubRankingAdmin.js` (NOVO) — backfill
- `src/v2/pages/V2ClubDetail.jsx` — lê `r.name` e `r.members` materializados

**Removidos (Wave C.2):**
- `src/modules/clubs/services/clubInternalRankingService.js`
- `src/modules/clubs/domain/clubRankingSources.js`
- `src/modules/clubs/domain/clubRankingSources.test.js`

**Regras:**
- `firestore.rules` — 4 novos blocos (read público, write só
  `isPlatformAdmin()` ou `isClubAdmin(club_id)`)

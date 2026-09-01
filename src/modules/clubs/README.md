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
- **Resolução robusta do `user_id` do slot** — cada slot é resolvido por
  `buildParticipantResolver`/`resolveSlotUid` na ordem: id do documento →
  `user_id` embutido no slot → NOME único do dia (recupera id de participante
  OBSOLETO após remoção + readição) → o próprio `slot.id` quando já é um
  `user_id`. Nomes ambíguos não são adivinhados e guests seguem de fora. Antes,
  a resolução só usava o id do documento, então jogos com id obsoleto sumiam do
  espelho (apareciam no ranking do dia mas não no rating/ranking/DUPR). A
  mudança é aditiva — slots que já resolviam retornam o MESMO uid.
- **Singles (1×1) e doubles (2×2)** suportados; outros tamanhos pulados.
- **Rodadas sorteadas e partidas avulsas contam igualmente** — não há filtro
  por `round`; a distinção "Partidas avulsas" × "Rodada N" é só rótulo.
- **Idempotente** — re-rodar a publicação não duplica; "Republicar" é
  seguro e re-sincroniza a partir do estado atual.
- **Propaga edições** — `buildPublishableMatches` recebe opcionalmente
  `publishedById` (id → doc já espelhado). Com ele, um jogo já publicado
  cujo placar/vencedor/lado foi corrigido é REGRAVADO (via
  `mirrorDecisionChanged`, preservando `created_at`); um jogo que deixou de
  ser decidido é removido. `applyEventDateMirror` lê os docs completos
  (`listPublishedDocsForDate`) para habilitar isso.
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

## Wave C.4 (Sprint 18, 2026-07-28) — filtro + backfill + UX

> "Você fez algo que excluiu o conteúdo do ranking dos clubes."
> 3 problemas corrigidos sem alterar a arquitetura materializada
> da Wave C.3.

### 1. Filtro de clube no ranking nacional

**Antes:** dropdown "Todos os clubes" não listava nenhum clube
porque `clubOptions` era derivado **apenas** de `player_ratings`
(que tem `clubs` denormalizado, e nem todos os atletas têm).

**Depois:** `useClubs()` carrega o diretório oficial de clubes
(sempre completo) + mescla com denormalizados para nomes. Ordenado
por nome.

### 2. "0 atletas do clube" no ranking interno

**Antes:** `clubUids` no hook vinha dos documentos materializados
— vazio para clubes legados → badge "0 atletas do clube" mesmo com
16 membros.

**Depois:** `loadClubUids(clubId)` lê `club_members` +
`athlete_profiles.club_ids` (array-contains) — sempre reflete a
realidade do clube.

### 3. "Sem ranking ainda" sem CTA

**Causa:** Wave C.3 trocou o cálculo client-side por leitura
materializada. Para dados LEGADOS, o materializado nunca foi
populado.

**4 caminhos para garantir que está populado:**

1. **Cloud Function mensal** `recomputeAllClubsMonthly`
   (`0 4 1 * *`, 1º dia às 4h) — auto-cura mensal.
2. **Botão "Recalcular rankings de todos os clubes"** no
   `AdminMetrics` (platform admin) — backfill total via Callable.
3. **Botão "Materializar ranking agora"** no `ClubRankingTab`
   (admin do clube) + CTA no empty state — backfill local.
4. **Workflow de deploy** com passo "Backfill club internal rankings".

### Arquivos modificados

- `src/modules/rating/pages/NationalRanking.jsx` — `useClubs()`
- `src/modules/clubs/hooks/useClubInternalRanking.js` — `loadClubUids()`
- `src/v2/pages/V2ClubDetail.jsx` — botão "Materializar ranking agora"
- `src/modules/admin/pages/AdminMetrics.jsx` — Panel de backfill
- `functions/index.js` — `recomputeAllClubsMonthly` (schedule)
- `.github/workflows/deploy-firebase.yml` — passo backfill

## Wave C.5 (Sprint 19, 2026-07-28) — corrigir materializado + Painel Admin V2

> A Wave C.4 tinha o botão em arquivo órfão (`AdminMetrics.jsx`
> legado) e o "Materializar ranking agora" dava 500. Investigação
> revelou 3 bugs reais do materializado server-side.

### Bug #1 (CRÍTICO) — user_id undefined

`applyToIndividual` no `functions/clubRanking.js` não setava
`user_id` no row. Resultado: o doc era `{clubId}_undefined` com
`user_id: undefined`. O painel "0 atletas do clube" era a ponta
visível.

**Fix:** `user_id: uid` no row default + re-setado após `bucket.get`.

### Bug #2 — torneio do clube não contava

Torneios do clube (Wave B) não tinham como ser identificados como
`is_club=true` no pipeline (o `tournament_match` não tem `club_id`).

**Fix:** novo `loadTournaments()` resolve `tournament.club_id`. Match
de torneio 'do clube' → `is_club=true` → conta no escopo interno.

### Bug #3 — callable rejeitava platform_admin sem custom claim

`req.auth.token.platform_admin` falha para usuários com
`role: 'platform_admin'` apenas no Firestore (caso do Fsa).

**Fix:** `isPlatformAdminUser()` checa custom claim primeiro,
depois `users/{uid}.role`.

### Backfill movido pro Painel Admin V2

Novo `ClubRankingBackfillPanel` (em `src/modules/admin/components/`),
usado em:
- `V2AdminConsole` (Visão geral)
- `V2AdminMetrics` (`/admin/metricas`)

Mostra contagem (clubes/materializados/vazios), botão de backfill
total com confirm, lista de clubes vazios com botão granular
"Recalcular" por clube. O `ClubRankingPanel` legado foi removido.

### Feature flag

`CLUB_INTERNAL_BACKFILL` (default ON quando `CLUB_INTERNAL_RANKING`
está ON). Puramente aditivo.

### Testes

5 testes novos em `clubRankingServer.test.js`:
- `user_id` é setado no row (regressão Wave C.4)
- doc id determinístico a partir de `user_id`
- agregação de múltiplos matches
- match sem winner é ignorado
- duplas (2×2) geram 4 rows com `user_id` correto

**1377 passing** total.

## Wave C.6 (Sprint 20, 2026-07-28) — BUG RAIZ do materializado

> Você tinha razão: o ranking **NÃO** funcionava. Eu não estava
> vendo. O bug era latente desde o `GameDayOrganizer`, ficou
> visível com a materialização (Wave C.3), e eu não identifiquei
> nas Wave C.4/C.5. Desculpa pela demora.

### O bug (encontrado, finalmente)

O `GameDayOrganizer` salva `side_a`/`side_b` em
`club_events/{eventId}/games/{gameId}` como objetos `{ id, name }`,
onde `id` é o **doc_id de `event_participants`**, NÃO o `user_id`
do atleta.

A Cloud Function `sideToUids` recebia esses objetos e retornava
`p.id` (doc_id) — nunca o user_id real.

```js
// ANTES (errado)
function sideToUids(side) {
  return side.map((p) => p.user_id || p.id).filter(Boolean);
  // p.id é doc_id de event_participant, não user_id!
}
```

O materializado ficava com chaves que **NÃO** correspondiam a
`club_members.user_id`, `athlete_profiles.uid` nem `users.uid`.

→ "0 atletas do clube" mesmo com 16 membros.
→ Materializado sempre VAZIO para clubes com game day organizer.

### Por que ficou visível agora (e não antes)

- **Antes da Wave C.3**: cálculo client-side usava o mesmo `p.id`.
  A UI mostrava os nomes do `name` salvo, dando a impressão de
  funcionar — mas as estatísticas estavam atribuídas a chaves
  erradas.
- **Depois da Wave C.3** (materializado): o cálculo server-side
  tentou agregar por `user_id` real, expôs o bug.

### Fix server-side

`sideToUids(side, participantById)` agora aceita um mapa
`eventParticipantDocId → event_participant` (que tem `user_id`).
Resolve `p.id → user_id` quando o game está no schema legado.
Convidados sem `user_id` são pulados silenciosamente.

Nova função `loadEventParticipantsMap(db, events)` carrega os
participants de cada evento do clube e constrói o mapa.

### Fix client-side

`GameDayOrganizer.handleDraw` agora salva `user_id` (além de `id`
e `name`) no `side_a`/`side_b`, quando o participante é um atleta
real. Mantém `id` (doc_id) para retrocompat. Schema novo funciona
no server-side sem precisar do mapa.

### Validação (cenário do Pickleholics)

- 16 membros
- 1 evento com 4 participants (1 convidado)
- 1 jogo decidido (Fsa+João 11×5 Maria+Pedro)
- **Antes**: materializado com 0 atletas
- **Depois**: materializado com 4 atletas + stats corretas

### Testes

10 testes novos em `clubRankingUserIdFix.test.js`:
- `sideToUids` resolve `p.id → user_id` via mapa
- Convidados sem `user_id` são pulados
- Schema novo (com `user_id` direto) também funciona
- Array de strings (uids diretos) é aceito
- `normalizeClubGame` retorna null sem mapa (regressão)
- Pipeline completo popula materializado com user_ids reais
- **REGRESSÃO**: sem mapa, materializado fica VAZIO

**1387 passing** total.

## Wave C.6.1 (Sprint 21, 2026-07-29) — índices compostos no Firestore

> Depois do fix da Wave C.6 (`sideToUids` com doc_id → user_id),
> o ranking **ainda** aparecia vazio. Investigação revelou o
> bug real: faltavam **índices compostos** no Firestore.

### O bug

O hook `useClubInternalRanking` faz:
```js
getDocs(query(
  collection(db, 'club_internal_ratings'),
  where('club_id', '==', clubId),
  orderBy('wins', 'desc')
))
```

Esta query precisa de **índice composto** (`club_id` ASC + `wins` DESC).
Sem o índice, o Firestore lança `FAILED_PRECONDITION` (código 9).
React Query trata como erro, `data = undefined`, UI mostra "0
atletas, sem ranking" mesmo com o materializado já populado no
servidor.

### Por que passou despercebido

A **Wave C.3** introduziu o materializado + queries no frontend mas
**esqueceu de criar os índices compostos**. As Waves C.4, C.5 e C.6
mexeram no backend (Cloud Function, callable, sideToUids) e no
schema (display_name, user_id) — mas ninguém olhou se a **leitura
no cliente** tinha índice.

Os testes do `useClubInternalRanking` nunca existiram.

### Fix

Adicionado em `firestore.indexes.json` (4 índices compostos, ASC
club_id + DESC wins, um por coleção):
- `club_internal_ratings`
- `club_internal_ratings_ext`
- `club_internal_doubles_ratings`
- `club_internal_doubles_ratings_ext`

O workflow `deploy-firebase.yml` deploya índices automaticamente
no push para main.

### Comentário no hook

```js
/**
 * IMPORTANTE: a query `where('club_id', '==', x) + orderBy('wins', 'desc')`
 * exige índice composto em `firestore.indexes.json`. Sem o índice,
 * o Firestore lança `failed-precondition` (código 9).
 */
```

### Validação

- **Bundle live**: `index-CAJhIhEv.js`
- **Firestore rules + indexes**: deployado
- **0 lint errors**
- **1387 testes verdes** (sem mudança)

### Lição registrada (ver §5.3.7 do 02-STANDARDS)

Toda coleção materializada com `where + orderBy` em campos
diferentes PRECISA de índice composto. A Wave C.3 introduziu o
materializado sem criar os índices — erro de design que passou
despercebido por 3 sprints.

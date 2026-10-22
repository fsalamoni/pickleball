# DATA_MODEL

> Coleções Firestore (database **`pickleball`**), seus campos-chave e
> relacionamentos. A maioria é **raiz** (`match /<coleção>/{id}`); as
> **subcoleções** que têm regra própria estão listadas abaixo, com o caminho.
> Sem joins: desnormalização e ids deterministas. Campos comuns: `created_at`,
> `updated_at` (`serverTimestamp`) — mas confira o campo no service: há
> coleções que gravam `createdAt` (gamificação) ou `*_ms` (número). Para o
> panorama, ver `docs/01-AI-CONTEXT.md`.
>
> **Contagens (coleções, subcoleções, índices) não são mantidas à mão aqui**:
> a fonte é o `docs/46-INVENTARIO.md`, GERADO a partir de `firestore.rules`,
> `firestore.indexes.json` e do código. Este documento descreve o *shape* e as
> regras; o inventário diz *quantas* e *quais*.

## Convenções

- **Id determinista** (`clubId_uid`, `tournamentId_uid`): evita duplicidade e
  simplifica regras (1 doc por par recurso+usuário).
- **Desnormalização**: nomes do ator são copiados no doc para evitar leitura
  cruzada (ex.: `user_name` em membros e admins). **E-mail não**: coleção de
  leitura ampla (`isAuthed()`/pública) nunca guarda e-mail, telefone,
  endereço ou nascimento (`CLAUDE.md` §2.10).
- **Auditoria**: mutações relevantes gravam `audit_logs` (ver "Transversal").
- Toda escrita é validada por `firestore.rules` (lógica roda no client). O que
  define **posição, prêmio, reputação, XP concedido e ranking** é escrito só
  pelo servidor (Admin SDK ignora as regras) e a regra recusa o cliente.
- **Campo que a regra confere é contrato**: o nome (`user_id`, `student_id`,
  `athlete_id`…) tem de ser o que a regra usa, senão a escrita é recusada em
  silêncio.
- Consulta tem de filtrar pelo campo que a regra confere, e `where`+`orderBy`
  exige índice composto — ver "Índices" no fim.

### Subcoleções com regra própria

| Caminho | Observação |
|---|---|
| `game_days/{id}/participants/{pid}` · `game_days/{id}/games/{gid}` | dia de jogo (ver `game_days`) |
| `tournament_registrations/{rid}/private/contact` | e-mail/contato da inscrição (nunca no doc público) |
| `club_events/{id}/dates/{dateId}` · `…/date_rsvps/{docId}` · `…/messages/{mid}` · `…/participants/{pid}` · `…/games/{gid}` | evento de clube; `participants`/`games` são o dia de jogo LEGADO |
| `club_forum_threads/{id}/comments/{cid}` · `…/poll_votes/{uid}` | respostas e votos do fórum (o id do voto é o uid de quem votou) |
| `conversations/{id}/messages/{mid}` | mensagens do chat |
| `training_sessions/{id}/comments/{cid}` · `training_questions/{id}/messages/{mid}` | Centro de Treino |
| `market_sellers/{key}/private/data` | Pix e dados da loja |
| `market_coupons/{id}/market_coupon_uses/{uid}` | uso do cupom (só o servidor) |
| `market_orders/{id}/events/{eid}` · `market_orders/{id}/private/shipping` | linha do tempo e endereço de entrega do pedido |

Não existem coleções raiz `comments`, `messages`, `poll_votes`, `dates` nem
`date_rsvps`: são as subcoleções acima.

## Identidade

### `users/{uid}`
Perfil privado/operacional do usuário autenticado.
- `email`, `platform_name` (nome de exibição), `full_name`, `phone`,
  `birth_date`, `pickleball_experience`.
- `role`: `'platform_admin' | 'user'`. `can_create_pools: bool`.
- **`account_status`** (2026-10-11, opcional): `'active' | 'suspended' | 'blocked'`;
  ausente vale `active`. Com `status_reason`, `status_until` (ms, só na
  suspensão — informativo: nada reativa sozinho), `status_set_at`,
  `status_set_by`. Só o servidor escreve (`adminSetAccountStatus`, que também
  desliga o login no Firebase Auth); a regra recusa o titular e o admin pelo
  cliente. Conta suspensa/bloqueada é deslogada ao abrir o app e não recebe
  aviso em massa nem campanha.
- `leveling_level`, `leveling_method` (`'form' | 'manual'`),
  `leveling_manual_level`, `leveling_assessment` (objeto do questionário).
- **`dupr_id`** (PR #90, Sprint 27): ID DUPR (Dynamic Universal
  Pickleball Rating). String trimada, opcional. Espelhado em
  `athlete_profiles/{uid}.dupr_id` via `buildAthletePublicProfile`.
  Backward-compat: users sem o campo continuam funcionando.
  A exportação DUPR (`loadDuprExportData` + `buildExportProfileIndex`)
  lê o `dupr_id` daqui como **fonte de verdade**, com precedência
  sobre o espelho — assim uma carga manual direto no `users` (sem
  re-sync do espelho) já entra no CSV.
- **`court_side`** (PR #91, Sprint 28): lado da quadra preferido.
  Valores: `'any' | 'left' | 'right'` (rótulos: Qualquer lado / Esquerda /
  Direita). Espelhado em `athlete_profiles/{uid}.court_side` via
  `buildAthletePublicProfile` (ajuda parcerias e o smart matchmaking).
  ⚠️ O campo se chama **`court_side`** no código (não `quadrant`); ao carregar
  "lado da quadra" manualmente no `users`, use `court_side`.
- **`interests`** (PR #91, Sprint 28): array de strings
  multi-seleção de funcionalidades (ver
  `athletes/domain/profileMeta.js`). Default `[]`. Drive do
  painel personalizado.
- **`profile_completeness`** (PR #91, Sprint 28): **calculado em
  tempo real** (não armazenado). Score 0-1 com base em
  campos-chave + `interests.length >= 1` + `court_side` preenchido.
- Criado/atualizado pelo `FirebaseAuthContext`.
- **Regra**: lê só o dono e o admin da plataforma. O dono NÃO escreve `role`,
  `can_create_pools`, `hidden*` nem `account_status*` (campos de poder e
  moderação); o dono da plataforma é reconhecido pelo e-mail do token.

### `athlete_profiles/{uid}`
Perfil **público** do diretório de atletas (espelho controlado de `users`).
- `directory_listed: bool` — controla visibilidade no diretório (privacidade
  aplicada na escrita; `listAthletes()` filtra `where('directory_listed','==',true)`).
- Campos públicos: nome de exibição, nível, experiência, cidade etc.
- **`dupr_id`** (PR #90, Sprint 27): espelho de `users/{uid}.dupr_id`
  (null quando vazio). Visível no diretório, perfil público,
  inscrições de torneio e meu perfil.
- **`court_side`** (PR #91, Sprint 28): espelho de `users/{uid}.court_side`.
- **`interests`** (PR #91, Sprint 28): espelho de `users/{uid}.interests`
  (array).
- **Regra**: lê qualquer conta logada; o dono cria/edita/apaga, mas **não** mexe
  em `hidden`/`hidden_at`/`hidden_by` (moderação, só do admin da plataforma).
- **Contato (`phone`, `email`, `address`) só com permissão, imposto pela regra**:
  cada um exige a sua marca (`phone_public`, `email_public`, `address_public`)
  `true` no espelho; para o dono, também no `users/{uid}`. O serviço apaga
  (`deleteField`) o contato desligado em toda escrita — sincronização,
  restauração e re-sincronização em lote.
- Sincronizado por `athleteService.syncAthleteProfile` (login, salvar perfil,
  entrar em clube, inscrição). **Edições feitas direto no `users` (ex.: importação
  manual de `dupr_id`/gênero/lado da quadra) NÃO disparam o sync** e deixam o
  espelho desatualizado. Duas ferramentas de admin corrigem isso, ambas
  read-from-`users`/write-to-mirror com `merge` (preservam `hidden`/`restored_*`):
  - `restoreAthleteProfileFromUserDoc(uid, actor)` — um atleta por vez.
  - `resyncAllAthleteProfilesFromUsers(actor, { dryRun })` — **em lote**, só para
    espelhos existentes (nunca cria entradas novas); domínio puro
    `buildAthleteProfilesResyncPlan`; auditoria `athlete_profiles_resynced`.
    UI: `/admin/console` → Perfis → "Re-sincronizar diretório (em lote)".

### `legal_consents/{uid}_{docKey}` (PR #86 + #94 — resumo)
Registro auditável de aceites legais (LGPD).
- `user_id`: usuário que aceitou (é o campo que a regra confere).
- `doc_key`: `'privacy_policy' | 'terms_of_use' | 'community_guidelines' | ...`
- `accepted_at` (+ `accepted_at_ms`): momento do aceite.
- `version`: versão do documento aceito. Shape completo e regra: seção
  `legal_consents/{uid_docKey}` mais abaixo.
- **PR #94 (Sprint 31)**: cada aceite no onboarding vira doc
  nesta coleção. Versão de Política de Privacidade é bumpada
  e reabre aceite.

## Torneios

### `tournaments/{id}`
- `name`, `description`, `owner_id`, `status`
  (`draft | registrations_open | registrations_closed | in_progress | finished | cancelled`),
- `visibility`: `'public' | 'private'`, `invite_code` (ingresso por código),
- config de regras/scoring (CBP/USAP, pontos, sets), datas, sede.
- **Arquivamento**: `archived: bool` (default `false`), `archived_at: Timestamp`,
  `archived_by: uid`. O flag `archived` é separado do enum `status` —
  arquivar exige `status === 'cancelled'` (validação dupla, cliente em
  `validateArchiveRequest` + server na Firestore rule). Visibilidade: se
  `archived == true`, o doc (e as 6 coleções filhas) só são lidos pelo
  criador e pelo `platform_admin`; público some do `/p/:id` e das listas.
- **Regra**: `creator_uid` (não `owner_id`) é o campo que a regra confere na
  criação. Quem não gere a arena cria o torneio com a sede **pendente**
  (`arena_confirmed: false`) e a arena confirma ou recusa (`arena_id`,
  `arena_confirmed`, `updated_at`). O co-administrador não vira criador.

### `tournament_modalities/{id}`
Modalidade dentro de um torneio: `tournament_id`, formato
(`single | doubles | americana/whist`), nível (iniciante→elite), categoria
(gênero/idade), capacidade (até 500), taxa opcional, e o array `stages[]` com
a configuração de cada FASE.

#### `stages[]` — a configuração de cada fase

A regra de `tournament_modalities` **não tem lista fechada de campos**
(`allow create, update, delete: if isTournamentAdmin(...)`), então cada campo
novo de fase é puramente aditivo — sem regra, sem índice, sem migração.
`normalizePhase` (`domain/phases.js`) preenche os padrões na LEITURA, então
uma modalidade gravada antes de um campo existir se comporta como antes.

Básicos: `type`, `name`, `scoring_override`, `division_mode`, `group_count`,
`max_per_group`, `seed_count`, `qualifiers_per_group`, `qualifier_mode`,
`feed_mode`, `merge_size`, `pairing_mode`, `bracket_seeding`, `third_place`.

Configuração avançada do admin do torneio (**todos opcionais**, Onda AT):

| Campo | Padrão | O que faz |
|---|---|---|
| `round_robin_legs` | 1 | 2 = ida e volta dentro do grupo (a saída para grupo de 3) |
| `custom_group_sizes` | `[]` | tamanhos exatos dos grupos, ajustados ao total real |
| `qualifiers_by_group` | `[]` | classificados grupo a grupo (`[2,2,1]`) |
| `wildcard_slots` | 0 | vagas de repescagem para fechar a chave |
| `wildcard_from_position` | 0 | de qual colocação repescar (0 = a seguinte ao corte) |
| `tiebreak_order` | `[]` | ordem dos critérios de desempate (vazio = a oficial) |
| `cross_group_method` | `rate` | `rate` \| `absolute` \| `drop_last` |
| `direct_entry` | `{mode:'none'}` | quem **entra direto** nesta fase, pulando as anteriores |
| `etapa_count` | 3 | **só** em `type: 'americano_etapas'` (Americano aprimorado em etapas): quantas etapas (1–12). O tamanho do grupo é o `max_per_group` de sempre (4, 5, 8 ou 9) |

Americano aprimorado em etapas (`type: 'americano_etapas'`, flag
`tournament_americano_etapas`): a ETAPA de cada jogo mora no nome do grupo
do jogo (`tournament_matches.group = "Etapa 2 · Grupo A"`), as rodadas seguem
em sequência de uma etapa para a outra, e nenhum `tournament_groups` é gravado
para o formato (a classificação é uma só). Ver
`docs/37-TORNEIO-ETAPAS-TURNOS-E-CHECKIN.md`.

`direct_entry` é `{ mode: 'none'\|'seeds'\|'manual', count, ids[] }`. Quem entra
direto na fase 3 não aparece no sorteio nem na classificação das fases 1 e 2 —
a exclusão acontece na origem (`planPhaseEntries`), não como remendo em cada
tela. Ver `docs/26-TORNEIO-FORMATOS-E-REGRAS.md`.

### `tournament_admins/{tournamentId_uid}`
Admin compartilhado do torneio (não afeta admin da plataforma).
`tournament_id`, `user_id`, `user_name`, `role` (`owner|admin`), `created_at`.
**Sem e-mail** (P1-01: a coleção é legível por qualquer conta logada). O primeiro
admin (`owner`) só é gravado por quem consta como `creator_uid` do torneio.

### `tournament_registrations/{id}`
Inscrição: `tournament_id`, `modality_id`, jogador(es) (`player_a_*`,
`player_b_*` em duplas), `player_a_level`, check-in, status, taxa.
Inscrições provisórias podem ser "reivindicadas" ao completar o perfil
(`claimProvisionalRegistrationsForUser`). **Leitura pública** (o quadro do
torneio mostra nomes), por isso o e-mail NÃO mora aqui: fica em
`tournament_registrations/{rid}/private/contact` (lê/escreve o admin, o
organizador do torneio e as partes da inscrição) e a prova de posse em
`provisional_claims` (abaixo). Equipes: ver "Torneio por equipes".

### `tournament_matches/{id}`
Jogo: modalidade, fase/rodada, duplas/jogadores, placar por set, status
(`scheduled | started | finished`), quadra, horário, duração.

### `tournament_groups/{id}`
Grupos da fase de grupos (composição e classificação por grupo).

### `tournament_rankings/{id}`
Coleção declarada em `tournamentService` e com regra (lê quem vê o torneio —
respeita `archived`; escreve o admin do torneio ou da plataforma), mas **nenhum
service ou função a escreve hoje**: o ranking da modalidade é calculado na
leitura (`computeModalityRankingStructured`) e os rankings da plataforma saem
do servidor. Não dependa dela.

### `tournament_courts/{id}`
Quadras do torneio para agendamento (slots, descanso mínimo).

## Clubes e comunidade

### `clubs/{id}`
`name`, `description`, `owner_id`, `invite_code`, cidade, imagem.

### `club_members/{clubId_uid}`
Vínculo de associação. `club_id`, `user_id`, `user_name`, `role`
(`admin | member`), `created_at`. Fonte de verdade de "quem é membro/admin".
O id é a credencial (`{clubId}_{uid}`). Entrar sozinho exige ser o criador do
clube, ter convite pendente (`club_member_invites`) ou a prova do código
(`club_code_joins`).

### `club_join_requests/{clubId_uid}`
Pedido de ingresso (fluxo "Pedir para ingressar"). `status`
(`pending | approved | rejected`), dados do solicitante. Aprovação cria
`club_members` e notifica o solicitante.

### `club_member_invites/{clubId_uid}`
Convite enviado por admin ("Adicionar membros"). `status`
(`pending | accepted | declined`); aceitar cria `club_members` e notifica admins.

### `club_invite_codes/{CÓDIGO}` (2026-10-10)
O código de convite do clube: `{ code, club_id, created_by, created_at }`. Quem
sabe o código lê (`get`); listar é só do admin do clube. Antes morava em
`clubs.invite_code`, legível por toda conta (o campo legado é migrado e
apagado quando um admin abre a administração).

### `club_code_joins/{clubId_uid}` (2026-10-10)
A prova de entrada pelo código (`{ club_id, user_id, code }`), gravada no mesmo
lote que `club_members` — a regra a lê por `getAfter`. Só o dono e os admins
leem. Entra na exclusão de conta.

### `club_posts/{id}`
Mural do clube (posts dos membros). `club_id`, autor, conteúdo.

### `club_forum_threads/{id}`
Tópicos do fórum. Pin/unpin, autor, título, conteúdo; podem conter enquete.
Respostas e menções geram notificações (`forum_reply`, `forum_mention`).

### `club_forum_threads/{id}/poll_votes/{uid}` (subcoleção)
Votos de enquetes do fórum (lógica pura em `clubs/domain/forumPoll.js`). O id é
o uid de quem votou: cada um só grava e apaga o próprio voto.

### `club_forum_threads/{id}/comments/{cid}` (subcoleção)
Respostas do tópico; `author_id`. Lê/cria quem é membro do clube do tópico; edita
o autor; apaga o autor ou quem modera o tópico.

### `club_events/{id}`
Eventos do clube. `club_id`, `visibility` (público/privado ao clube), datas,
local, status (rascunho/publicado). Publicar evento público notifica membros
(`club_event_published`).

### `club_event_rsvps/{id}` · `event_invites/{id}`
Presença/convites de eventos.

### `club_events/{id}/dates/{dateId}` · `club_events/{id}/date_rsvps/{docId}` (subcoleções)
**Game-day**: datas de jogo e confirmações (`user_id`, uma por pessoa);
sorteio em `clubs/domain/gameDayDraw.js`. Lê/escreve quem é membro do clube do
evento. Campos de publicação no ranking e `game_day_id` em
`club_events/{id}/dates/{dateId}` (mais abaixo).


## Chat

### `conversations/{id}`
Conversa 1:1 ou em grupo: `member_ids[]` (é o que a regra confere), `members`,
`created_by`, `title`, `last_message`, `last_message_at_ms`, `hidden_for[]`.
Conversa direta tem id `dm_<uidA>__<uidB>` (a regra amarra o id aos dois
membros). Quem sai só tira a si mesmo; apagar é do último que sobrou.
Lógica pura em `chat/domain/conversations.js`.

### `conversations/{id}/messages/{mid}` (subcoleção)
Mensagens: `sender_id`, `text`, `created_at`. Lê/cria quem é membro da conversa;
edita (só `text`, `edited`, `edited_at`) e apaga só o remetente.
Mensagens/convites geram `chat_message` / `chat_invite`.

## Arenas

> Sprint 0 + Sprint 1. Coleções top-level, ids autogen (exceto
> `arena_managers` que tem id determinista `arenaId_uid`).

### `arenas/{id}`
Perfil público-editável da arena. Criado pelo próprio dono.
- `name`, `description` (max 2000), `address` (max 240), `neighborhood` (max 120).
- `city`, `state` (UF, max 2), `court_count` (legado, mantido p/ compat).
- `contact_phone`, `contact_whatsapp`, `contact_email`, `instagram` (handle),
  `website` (URL normalizada com `https://`).
- `hours` (max 400, texto livre), `base_price` (number, fallback), `active` (bool).
- `allow_instant_booking: bool` (Sprint 2 ARE-03) — opt-in da arena pra permitir reserva instantânea.
- `price_rules[]` (Sprint 1 ARE-05: cada regra pode ter `court_id` opcional):
  - `id`, `label`, `weekdays[]` (0-6), `start`, `end` ('HH:MM'),
    `price`, `court_id` (opcional: aplica só a essa quadra ou a todas se vazio).
- `price_overrides[]` (Sprint 1 ARE-05: cada override pode ter `court_id`):
  - `id`, `label`, `date` ('YYYY-MM-DD', opcional), `client_id` (opcional),
    `price`, `note`, `court_id` (opcional).
- `photos[]` (até 20): `{url, path, name}`. Primeira foto é a capa.
- `onboarding_complete` (Sprint 0 ARE-20): `{fotos, precos, horarios, compartilhar}` (4 booleans).
- `onboarding_completed_at` (timestamp).
- `created_at`, `updated_at` (serverTimestamp).

### `arena_managers/{arenaId_uid}`
Gestores da arena. Id determinista evita duplicidade.
- `arena_id`, `user_id`, `user_name` (desnormalizado), `user_photo`, `role` (`'owner'|'manager'`).
- `added_by` (uid), `created_at`.

### `arenas/{id}` (campos extras Sprint 2/3)
- `allow_instant_booking: bool` (Sprint 2 ARE-03) — opt-in para reserva
  instantânea (pula REQUESTED → CONFIRMED direto).
- `house_rules_md: string` (Sprint 3 ARE-18) — markdown com regras da casa,
  max 2000. Exibido em /arenas/:id → bloco "Regras da casa" (collapsible).
  Manager edita em /arenas/:id/gerir → tab "Informações".


### `circuits/{id}` (Sprint 4 ORG-20)
Séries de torneios com ranking acumulado.
- `name` (max 80), `description` (max 500), `season` (max 40,
  obrigatório — ex: "2026 Verão"), `categories[]` (max 10,
  cada uma max 30, obrigatório pelo menos 1).
- `start_date`, `end_date` (ISO date strings, end >= start).
- `active: bool` (soft archive).
- `points_table: object` (custom; default = 1º=100, 2º=75, 3/4º=50,
  5-8º=30, 9-16º=20, 17-32º=10, 33-56º=5).
- `created_by`, `created_at`, `updated_at`.

### `circuit_admins/{circuitId_uid}` (Sprint 4 ORG-20)
Id determinístico. `circuit_id`, `user_id`, `role`
(`'owner'|'manager'`), `added_at`, `added_by`.

### `circuit_tournaments/{circuitId_tournamentId}` (Sprint 4 ORG-20)
Link entre circuito e torneio. `added_at`, `added_by`.

### `circuit_results/{circuitId_tournamentId_userId}` (Sprint 4 ORG-20)
Resultado de 1 atleta em 1 torneio do circuito. `user_id`,
`user_name`, `user_photo`, `tournament_id`, `position`
(1-9999), `total_participants`, `points` (calculado da tabela),
`updated_at`, `updated_by`.

### `coaches/{uid}` (Sprint 4 PRO-15)
Perfil público do professor. `uid` = user id.
- `display_name` (max 80, obrigatório), `bio` (max 1000),
  `hourly_rate: number|null`, `regions[]` (max 10),
  `modalities[]` (max 5, obrigatório pelo menos 1),
  `certifications[]` (max 10).
- `accepting_students: bool`, `active: bool`.
- `user_id`, `created_at`, `updated_at`.

### `coach_arenas/{coachId_arenaId}` (Sprint 4 PRO-15)
Residência (vínculo coach ↔ arena).
- `coach_id`, `arena_id`, `status` (`'active'|'paused'`),
  `weekly_schedule` (objeto opcional), `notes` (max 500).
- `added_at`, `added_by`.

### `tournaments/{id}` (Sprint 4 ARE-14)
Campo extra: `arena_id: string|null` (opcional, vincula torneio
a uma arena específica). Default null (torneio independente).

### `arena_courts/{id}` (Sprint 1 ARE-01)
Quadras nomeadas da arena (substitui o `court_count: int` legado).
- `arena_id`, `name` (max 60, obrigatório), `court_type` (`'indoor'|'outdoor'|'covered'`),
  `surface_type` (`'concrete'|'synthetic'|'wood'|'asphalt'`, opcional),
  `is_active` (bool, soft delete), `sort_order` (0-9999, editável).
- `notes` (max 500), `created_at`, `updated_at`.

### `arena_court_schedules/{id}` (Sprint 1 ARE-04)
Janelas de horário recorrentes por quadra.
- `arena_id`, `court_id`, `weekdays[]` (0-6), `start_time`, `end_time` ('HH:MM').
- `label` (max 60, opcional), `is_active` (bool, soft delete).
- `created_at`, `updated_at`.

### `arena_bookings/{id}`
Reservas da arena. `arena_id`, `athlete_id`, `athlete_name`, `athlete_photo`.
- `kind` (`'single'|'recurring'|'multi'`), `slots[]` (`{date, start, end, court_id?}`),
  `recurrence` (objeto, só se kind=recurring), `notes` (max 600).
- **`court_id` é OBRIGATÓRIO** (PR #75) — auto-atribuído via
  `pickAvailableCourt` se user não escolhe. Nunca null.
- **`booking_group_id`** (PR #77, aditivo) — agrupa reservas do mesmo
  pedido multi-quadra (modo "específicas" ou "todas"). Reservas do
  mesmo grupo compartilham `notes`, `athlete_id`, `recurrence` etc.
- `status` (`'requested'|'negotiating'|'confirmed'|'declined'|'cancelled'|'completed'`).
- `is_instant: bool` (Sprint 2 ARE-03) — se true, status inicial = `confirmed`.
- `payment_method` (opcional, se `is_instant=true` é obrigatório):
  `'pix'|'credit_card'|'debit_card'|'cash'|'wallet'|'bank_transfer'`.
- `proposed_price`, `agreed_price`, `payment_status` (`'none'|'pending'|'paid'|'refunded'`).
- `created_by`, `created_at`, `updated_at`, `created_at_ms`.

### `arena_reviews/{id}`
Avaliações/reclamações/sugestões. `arena_id`, `user_id`, `user_name`,
`rating` (1-5, só se `type='review'`), `type` (`'review'|'complaint'|'suggestion'`),
`comment`, `response` (resposta da arena, opcional, max 500),
`responded_at`, `responded_by` (uid), `updated_at`, `created_at`.

### `arena_favorites/{uid_arenaId}`
Favoritos do atleta. Id determinista. `user_id`, `arena_id`, `created_at`.

### `coach_favorites/{uid_coachId}` (Wave B — id determinístico)
Favoritos do professor (curtir). Id determinístico.
- `user_id` (uid do atleta que curtiu)
- `coach_id` (uid do professor)
- `coach_name` (desnormalizado para mostrar no diretório de favoritos)
- `created_at`, `created_at_ms`

Regras Firestore: read/create/delete apenas pelo próprio `user_id`
(mesmo padrão de `arena_favorites`). Ver `firestore.rules`.

### `arena_products/{id}` (V3, do Arena V3 — PDV) — LEGADO
> Desde 2026-09-24 a loja do app vende os produtos do **Mercado**
> (`arena_inventory_products` com `sell_online: true`). Esta coleção só serve às
> vendas antigas (sem `catalog`) e não recebe mais produtos pela tela.

Produtos da loja. `arena_id`, `name` (max 80), `description` (max 500),
`price` (number), `category` (`'bebidas'|'equipamentos'|'vestuario'|'acessorios'|'alimentos'|'outros'`),
`stock` (number, opcional = sem controle), `image_url`, `active: bool`,
`sold_count` (contador). `created_at`, `updated_at`.

### `arena_sales/{id}` (V3, do Arena V3 — PDV)
Vendas / pedidos da loja do app. `arena_id`, `buyer_id`, `buyer_name`, `items[]` (`{product_id, name, quantity, price}`),
`total`, `payment_method`, `status` (`'pending'|'paid'|'cancelled'|'refunded'`),
`split_with[]` (user_ids), `split_details[]` (somas por participante),
`stock_applied` (entregue), `created_at_ms`. `created_at`, `updated_at`.
- (2026-09-24, opcionais) `catalog: 'mercado'` (pedido dos produtos do Mercado —
  preço do BANCO; ausente = venda antiga de `arena_products`), `arena_name`,
  `delivered_at`/`delivered_by`, `cancel_reason`/`cancelled_by`.
- **Regras**: lê o comprador, a arena, o admin e **quem está em `split_with`**
  (consulta `split_with array-contains uid`, sem índice composto). O comprador só
  cria em aberto (`status` pending) e não entregue (`stock_applied` false); e só
  atualiza para DESISTIR (`status: 'cancelled'`, tocando só
  `status`/`cancel_reason`/`cancelled_by`/`updated_at`), com o pedido em aberto,
  não entregue e não dividido. A arena faz o resto.

### `arena_payments/{id}` (V3, do Arena V3 — PDV)
Pagamentos individuais. `sale_id`, `arena_id`, `payer_id`, `amount`,
`payment_method`, `status`. Id = `${saleId}_${userId}`. `created_at`, `updated_at`, `paid_at`.
- (2026-09-24, opcionais) `confirmed_by`, `received_at_counter` (a arena recebeu
  no balcão por quem não registrou pelo app).
- **Regras**: quem paga cria só PENDENTE e só numa venda de que faz parte, da
  mesma arena (`paymentBelongsToSale`); e só troca `payment_method` ou desiste
  (`status` pending → cancelled) enquanto não foi confirmado. "Pago" é a arena.

## Transversal

### `notifications/{id}`
Notificações do sino. `user_id` (destinatário — o campo que a regra confere),
`title`, `message`, `type` (lista fechada na regra, `isKnownNotificationType`;
ver `NOTIFICATION_TYPE` em `01-AI-CONTEXT.md` §7), `link` (só rota interna,
`isInternalLink`; âncora `#` é recusada — use `linkDeAviso`), `read`
(nasce `false`), `actor_id`, `created_at`. Escrita por `createNotification` /
`notifyUsers` (lote ≤400). **Regra**: lê e atualiza (marcar lida) só o
destinatário; qualquer conta logada cria (limite de tamanho; texto livre no
sino de outra pessoa é limitação conhecida); só o admin apaga.
`i18n` (opcional, 2026-10-14): `{ title?: {key, params}, message?: {key, params} }`
— a chave em português e os parâmetros simples de um `tx('…')`; o sino e o push
mostram o aviso no idioma de quem recebe. Ausente ⇒ vale `title`/`message`
(o português, sempre gravado). Ver `docs/44-IDIOMAS.md`.
Campos de ORIGEM (2026-10-16, `external_messaging`, ver `docs/49`):
`origin: 'server'` e `essential: true` só o servidor grava (a regra recusa do
cliente); `sent_by` é sempre a conta que escreve (a regra confere); `broadcast:
{ kind: 'servico'|'novidade', channels: ['email'|'whatsapp'|'sms'] }` só do
admin da plataforma. Depois de criado, o titular só muda `read`/`read_at`.

### `message_outbox/{aviso}_{canal}` (2026-10-16, `external_messaging`)
Registro de cada envio por e-mail/WhatsApp/SMS e fila do que espera.
`notice_id`, `user_id`, `channel`, `area`, `trust`, `sent_by`, `essential`,
`kind` (`notice` | `digest_daily` | `digest_weekly` | envios de sistema),
`status` (`sending`, `queued`, `sent`, `delivered`, `bounced`, `complained`,
`failed`, `suppressed`, `capped`, `skipped`, `digest_daily`, `digest_weekly`),
`reason`, `send_after_ms`, `attempts`, `provider`, `provider_id`,
`to_masked` (nunca o endereço inteiro), `cost_brl`, `segments`, `day`/`month`
(Brasília) e as chaves de contagem `k_user`/`k_sender`/`k_pair`/`k_day`/
`k_month` (tetos e orçamento por igualdade, sem índice composto),
`created_at_ms`, `expire_at_ms`. Regra: a pessoa lê os dela (exportação), o
admin todos; só o servidor escreve. Apagado depois de 90 dias.

### `message_suppressions/{sha256(canal:endereço)}` (2026-10-16)
Bloqueio de envio (devolução definitiva, reclamação, PARAR, descadastro
geral): `channel`, `address`, `masked`, `reason`, `source`, `user_ids[]`,
`created_at_ms`. Na
exclusão de conta o endereço sai e o bloqueio fica. Ninguém lê pelo cliente.

### `message_reports/{id}` (2026-10-16)
Denúncia pelo link do rodapé do e-mail: `reporter_uid`, `sender_uid`,
`notice_id`, `channel`, `status` (`open` | `resolved` | `dismissed`), datas. Só o
admin lê; só o servidor escreve.

### `phone_verifications/{uid}` (2026-10-16)
Código do celular em andamento: `phone`, `phone_masked`, `channel`,
`code_hash` (nunca o código), `attempts`, `expires_ms` (10 min), `sends[]`.
Ninguém pelo cliente; apagado ao confirmar.

### `platform_secrets/{messaging|messaging_runtime}` (2026-10-16)
Chaves dos provedores (SES, Resend, WhatsApp, Twilio, Zenvia), a chave HMAC
dos links assinados e identificadores internos. `allow read, write: if false`
— só o servidor.

### `audit_logs/{id}`
Trilha de auditoria. Campos: `log_number`, `action`, `action_label`, `actor_id`,
`actor_name`, `actor_email`, `tournament_id`, `user_id`, `user_name`,
`user_email`, `details`, `created_at_ms`, `created_at`. **Regra**: lê só o admin
da plataforma; qualquer conta logada cria, mas com `actor_id == uid` (a trilha
não pode ser atribuída a terceiros); ninguém atualiza nem apaga. `action` (ex.:
`tournament_created`,
`club_member_invited`, `match_result_recorded`, `club_join_approved`,
`booking_cancelled`, `booking_transferred`, `booking_responsibles_changed`,
`coach_lesson_created`, `clinic_signup`, `club_recurring_event_added`…).
Escrita por `auditService.createAuditLog` (melhor esforço: erro só vai ao log).

### `admin_access_logs/{id}` (2026-10-11)
Registro de leitura do suporte (`05-ADMIN-SUPORTE.md` §7). Escrito SÓ pela
função `adminSupportReveal`; `admin_uid`, `target_uid`, `action: 'reveal_field'`,
`fields[]`, `value_hashes` (hash, nunca o valor), `reason_category`,
`reason_text`, `ticket_ref`, `ip_hash`, `at`, `at_ms`. Regra: lê SÓ o admin
(registro interno — o titular não é avisado nem lê; decisão de 2026-10-11);
`create/update/delete: false`.

### `platform_settings/{docId}`
Leitura pública; escrita só do admin da plataforma. Singletons:
`global` (`feature_flags.{key}` — valores das flags de `FEATURE_FLAG` — e
`inicio.promocoes`), `arena_modules`, `gamification`, `marketplace`,
`training`, `messaging` (configuração dos avisos por e-mail/celular, sem
segredo: provedores, domínio, remetente, matriz área × canal, horários,
limites, `push.vapid_public_key` — ver `docs/49`), `messaging_status` (estado
do domínio e dos modelos, escrito pelo servidor) e `ranking_worker` (este
escrito pelo servidor). Não há migração de
flags: `normalizeFeatureFlags` lê só as chaves de `FEATURE_FLAG` (ausente ⇒
`false`), ignora as desconhecidas — inclusive as chaves antigas das
funcionalidades incorporadas — e as de `PERMANENT_FEATURE` valem sempre `true`.

## Professores (Sprint 4 PRO-15 + Ondas 8/7b)

> Estende o **Sistema A** (professor = usuário real, uid). NÃO conflita
> com **Arena V3 Sistema C** (aulas operadas por arena) — outro caso.

### `coaches/{uid}` (já existia)
- `display_name`, `bio` (max 1000), `hourly_rate: number|null`,
  `regions[]` (max 10), `modalities[]` (max 5),
  `certifications[]` (max 10), `accepting_students: bool`, `active: bool`.
- `leveling_level` (auto pelo questionário, ou validado por outro professor).
- `photos[]` (até 10), `cover_url`.
- `linked_club_ids[]` (Fase 8a — clubes vinculados ao professor).

### `coach_arenas/{coachId_arenaId}` (já existia)
- Residência (vínculo coach ↔ arena). `coach_id`, `arena_id`,
  `status` ('active'|'paused'), `weekly_schedule`, `notes` (max 500).
- `partnership_status` (Onda 7): 'invited' | 'accepted' | 'declined' |
  'ended' (mútuo — antes era unilateral).

### `coach_availability/{coachId}` (Fase A)
Janelas semanais de disponibilidade do professor.
- `coach_id`, `weekdays[]` (0-6), `start_time`, `end_time` ('HH:MM'),
  `location` (texto livre ou arena_id após Onda 7).
- `is_recurring: bool`, `is_active: bool`.
- `notes` (max 200). `created_at`, `updated_at`.

### `coach_lessons/{lessonId}` (Fase A)
Aulas marcadas (avulsas ou recorrentes).
- `coach_id`, `student_ids[]` (pode ser vazio = aula aberta).
- `scheduled_at` (timestamp), `duration_min`, `arena_id` (opcional),
  `booking_id` (FK → arena_bookings quando for aula em arena parceira).
- `status` ('scheduled'|'in_progress'|'completed'|'cancelled'|'no_show').
- `price`, `payment_status` ('pending'|'paid'|'refunded'|'free').
- `notes` (max 1000). `created_at`, `updated_at`.
- **Regra (endurecida na revisão da Onda CG):** o professor e o admin
  escrevem a aula inteira; o ALUNO (quem é só `student_id`) só **pede** — nasce
  `requested`, sem `price`, com `coupon` só `pending` (e só os cinco campos do
  pedido) — e só **cancela** (`status` → `cancelled` + `updated_at`, a partir
  de `requested`/`negotiating`/`confirmed`); o aluno não apaga. É o que o
  serviço sempre fez. `tests/rules/coachLessons.rules.test.js` (17).

### `coach_waitlist/{coachId}_{uid}` (lista de espera do professor)
Aluno esperando o professor abrir horário. Um por aluno e professor.
- `coach_id`, `user_id`, `student_name`, `coach_name` (≤ 120),
  `format?`, `periods?` (`manha|tarde|noite`, ≤ 3), `weekdays?` (0-6, ≤ 7),
  `note?` (≤ 500), `created_at`, `created_at_ms`, `updated_at`.
- `notified_at`, `notify_count` — só o servidor (`functions/coachWaitlist.js`).
- **Regra:** o aluno cria a própria (id `{coach}_{uid}`, professor existe,
  não é ele mesmo) e edita só as preferências; lê o aluno, o professor e o
  admin; apagam os três. Zero índice composto (consultas de uma igualdade).
  Entra na exclusão de conta pelos dois lados. `tests/rules/coachWaitlist.rules.test.js`.

### `coach_busy_slots/{coachId}` (horários ocupados, público)
- `coach_id`, `slots[]` (`{ date, start, end }` das aulas confirmadas de hoje
  em diante, até 500), `updated_at`. Sem nome de aluno.
- **Regra:** leitura pública, escrita só do servidor (gatilhos de
  `coach_lessons` e `coach_availability`). Professor sem documento = nenhum
  ocupado (até a próxima escrita numa aula ou na agenda dele).

### `coach_students/{coachId_studentId}` (Fase B)
Vínculo professor ↔ aluno. Id determinista.
- `coach_id`, `student_id`, `student_name` (desnormalizado),
  `student_photo`, `leveling_level`, `goals`, `notes` (max 500).
- `status` ('invited'|'active'|'paused'|'ended'), `started_at`, `ended_at`,
  `ended_by` (quem encerrou), `ended_reason` (`'conta_excluida'` quando a
  conta do aluno foi excluída). Com `ended_at`, o professor só convida de novo
  (`ended → invited`); quem reativa é o aluno, e o `ended_at` sai no aceite.

### `coach_packages/{packageId}` (Fase C)
Pacotes de aulas (5 aulas / mês, etc).
- `coach_id`, `name`, `description`, `lesson_count`, `price`,
  `validity_days`, `modality`, `leveling_level`.
- `active: bool`, `created_at`, `updated_at`.

### `coach_package_sales/{saleId}` (Fase C)
Venda de pacote (gera créditos).
- `id`, `package_id`, `package_name`, `coach_id`, `student_id`, `student_name`,
  `credits_total`, `credits_used`, `price`, `paid`, `sold_at`, `sold_by`,
  `expires_at`.
- **Regra**: lê o professor (`coach_id`) ou o aluno (`student_id`).

### `coach_content/{contentId}` (Fase D)
Biblioteca de conteúdo do professor (drills, vídeos, planos de aula).
- `coach_id`, `title`, `description`, `category` ('drill'|'video'|'plan'|
  'article'), `content_url` (opcional), `thumbnail_url`, `leveling_level`.
- `visibility` ('public'|'students_only'), `created_at`.

### `coach_clinics/{clinicId}` (Onda 7b — refinado em PRs #73-#81)
Clínicas/workshops abertos (aula para grupo, não alunos regulares).
- `coach_id`, `coach_name` (desnormalizado), `title`, `description` (max 2000),
  `location`, `level` (em vez de `leveling_min`/`max`),
  `date` (YYYY-MM-DD), `start`, `end` (HH:MM) — em vez de
  `scheduled_at`/`duration_min` (PR #73+).
- `capacity`, `price`, `leveling_min`/`max` (legado, mantido p/ compat).
- `status` ('open'|'cancelled') — simplificado em PR #73+.
- `signup_count`, `created_at_ms` (em vez de `created_at`).

### `coach_clinic_signups/{clinicId_athleteId}` (Onda 7b — refinado)
Inscrição em clínica. **Id determinístico**.
- `clinic_id`, `coach_id`, `athlete_id`, `athlete_name` (desnormalizado).
- `created_at_ms`. Leitura pública (contagem de vagas), auto-inscrição do atleta.

### `coach_level_validations/{coachId_studentId}` (Onda 7b — refinado)
Validação de nível de um atleta por um professor. **Id determinístico**.
- `coach_id`, `coach_name` (desnormalizado), `student_id`, `student_name`,
  `level_id`, `level_name`, `level_badge`, `note`, `created_at_ms`.
- Aparece em `users.leveling_*` quando aplicado.

### `coach_products/{productId}` (Fase A — loja do professor)
Loja: equipamento, roupas, acessórios vendidos pelo professor.
- `coach_id`, `name`, `description` (max 500), `price`, `stock`,
  `image_url`, `active: bool`, `sold_count`, `category`.
- **Regra**: lê qualquer conta se `visible_public == true`; senão só o professor
  e o admin.

## Shared Bookings (PR #68 + #70 — reservas compartilhadas)

Reservas com múltiplos responsáveis, rateio por tempo, e ponte
professor↔alunos. **NÃO é coleção nova** — é o campo aditivo
`booking_type` em `arena_bookings` + `responsibles[]`.

### `arena_bookings.booking_type` (campo aditivo)
- `'single'` — um responsável (legado).
- `'recurring'` — recorrência semanal.
- `'coach_lesson'` — aula do professor em arena parceira.
- `'shared'` — vários responsáveis com rateio por tempo de uso.

### `arena_bookings.responsibles[]` (campo aditivo, multi)
- Cada item: `{user_id, user_name, percent, share_type: 'equal'|'custom'}`
- Substitui o antigo "transferir responsável" — agora é N-ário.
- Avulsos (sem conta): `{name, percent}` sem `user_id`.

### `arena_waitlist/{entryId}` (Onda 6b — lista de espera)
Fila do **jogo aberto** (`arena_open_slots`), não do horário de reserva (essa é
`booking_waitlist`, mais abaixo). Id `{slotId}_{uid}`.
- `arena_id`, `slot_id`, `slot_kind: 'open_match'`, `athlete_id`,
  `athlete_name`, `position`, `window_minutes`, `joined_at`, `created_at`,
  `updated_at`.
- `status`: `waiting | notified | accepted | declined`.
- **Regra**: lê qualquer conta logada; o atleta entra/sai e responde à chamada
  só por si mesmo; quem chama o próximo é o servidor (`functions/openSlotWaitlist.js`).

### `club_event_games/{eventId_dateId_gameId}` (Wave C — id determinístico)
Espelhamento de jogos decididos de dias de jogo para o ranking nacional.
Ativado pela flag `publish_to_ranking` no `club_events/{id}/dates/{dateId}`.
Mesmo schema de `tournament_matches` + campos extras:
- `source: 'club_event_game' | 'athlete_game_day'`, `event_id`, `date_id`,
  `club_id`, `event_title`, `game_id`, `published_by`
- `side_a_ids`/`side_b_ids` são **uids** (não passam por
  `tournament_registrations`).
- `status: 'finished'`, `winner_side: 'a'|'b'`, `score_a`, `score_b`.
- `sets_a`/`sets_b` espelham o placar (helper p/ rankings derivados). Jogo
  de dia de jogo lançado POR SETS (2026-10-10): `score_*` = total de pontos
  (para o rating), `sets_*` = sets vencidos, `winner_side` pelos sets e
  `set_scores?: [{a,b}]` com o placar de cada set (a exportação ao DUPR manda
  um jogo por set). Um set só: tudo como antes, sem `set_scores`.
- `kind: 'singles'|'doubles'`, `result_recorded_at`.

O **Dia de jogo do atleta** (`game_days`, sempre ligado) reaproveita
esta MESMA coleção: `source='athlete_game_day'`, `event_id = game_day_id`,
`date_id = 'main'`, id determinístico `gd_${gameDayId}_${gameId}` e `club_id`
**resolvido por partida** (o clube comum a TODOS os atletas, ou `null`). Assim os
resultados entram no ranking geral e no ranking interno do clube sem alterar o
motor de rating (`ratingService`) nem `functions/clubRanking.js`.

Regras: `firestore.rules` — read público; create/update/delete apenas
criador do evento do clube, dono do dia de jogo do atleta
(`isGameDayOwnerOf`), admin do clube + platform admin.

### `game_days/{id}`
Dia de jogo criado por um atleta (primo do dia de jogo dos clubes, sem clube dono).
- `created_by`, `creator_name`, `creator_photo`
- `title`, `visibility: 'public'|'private'`, `date`, `time`, `location`,
  `city`, `state`, `notes`, `format`
- `member_uids[]` — dono + convidados + quem entrou pelo convite (query de
  visibilidade `array-contains`); `invited_uids[]`
- `open_game_id` — convite público vinculado em `open_games` (`kind='game_day'`)
- `publish_to_ranking`, `published_count`, `published_at`, `published_by`
- `status: 'active'|'archived'`, `created_at_ms`
- `manage_mode: 'owner_only'|'participants'` (**opcional, aditivo**) — quem pode
  operar as partidas (sortear, criar próxima partida, substituir jogador, marcar
  indisponível, vincular dupla, incluir/excluir participante). **Ausente, nulo ou
  desconhecido ⇒ `owner_only`**, então todo dia de jogo já existente continua
  exatamente como estava.
- `admin_uids[]` (**opcional, aditivo**) — uids que o criador nomeou como admin
  do dia de jogo. Quem entra aqui também entra em `member_uids` (para enxergar o
  dia de jogo se ele for privado). Sair de admin **não** remove de `member_uids`.

#### Campos dos GRUPOS DO PLAY (**opcionais, aditivos** — flag `play_groups`)

Só no formato Play. **Ausentes, o Play segue uma fila única** (`play_groups`
está incorporada desde 2026-10-10 — sempre ligada). Zero coleção e
zero índice; uma única cláusula de regra, para o administrador nomeado (abaixo).
Guarda em `src/core/guards/playGrupos.test.js`.
- `play_groups[]` (até 10) — `{ id, name, color, level_min, level_max,
  gender: 'any'|'male'|'female', formation: 'free'|'mixed'|'same_sex',
  max_level_gap, strict, courts[], fill, paused, join: 'open'|'closed' }`.
  O `id` é estável (os participantes o referenciam): nunca renomeie.
  `normalizePlayGroupsConfig` preenche o padrão de cada campo na leitura.
- `play_groups_policy: 'queue'|'rotate'|'priority'` — quem ocupa a quadra
  quando mais de um grupo tem partida pronta (ausente ⇒ `queue`).
- Quem grava: o criador, o gestor da arena, o administrador do clube **e o
  administrador nomeado** (`admin_uids`). Para o nomeado, `firestore.rules`
  tem uma cláusula estreita em `game_days`: só no Play, só as chaves
  `play_groups`, `play_groups_policy` e `updated_at`, lista de até 10 e política
  entre `queue`/`rotate`/`priority`. `play_group_id` de um participante é
  operação de quem conduz o dia.
- Detalhes, motor e experiência: `docs/39-PLAY-GRUPOS.md`.

#### Campos do DIA DE JOGO DA ARENA (**opcionais, aditivos** — flag `arena_game_day`)

Presentes só quando a arena é a dona. **Ausente `arena_id`, nada disso vale** e o
dia de jogo é exatamente o do atleta, como sempre foi.
- `arena_id` — a arena dona; `arena_name`, `arena_city`, `arena_state`
  (desnormalizados, para cartões)
- `arena_slots[]` — `{ court_id, court_name, start_time, end_time, capacity }`.
  As quadras e horários reservados. Horário igual em todos ⇒ "dia todo";
  diferentes ⇒ "por quadra". Duas faixas na mesma quadra podem coexistir desde
  que não se sobreponham (encostar não é sobrepor)
- `signup_mode: 'day'|'court'` — onde o atleta se inscreve
- `capacity` — teto do dia (`null` = sem limite). No modo `'court'` o teto vive
  em cada slot e este fica `null`
- em `participants/{pid}`: `arena_court_id` (**opcional**) — a quadra escolhida
- `open_slot_id` (**opcional**, Onda CA) — o dia de jogo nasceu de um JOGO
  ABERTO (`arena_open_slots/{id}`, que aponta de volta por `game_day_id`).
  Marcar presença nele é entrar no jogo aberto (faixa de nível, fila, vitrine),
  e a arena o edita pelo jogo aberto — a vitrine e o dia mudam juntos

Dia de jogo de arena é sempre `visibility: 'public'` — é assim que o atleta o
enxerga na página da arena, e é o que faz a listagem por `arena_id` passar pela
regra de leitura.

**Fechar a quadra no calendário não usa coleção nova**: grava
`arena_unavailabilities` com `source: 'game_day'` e `game_day_id`. Conflito de
reserva, status de slot e calendário mensal já respeitavam indisponibilidade.
Arquivar apaga esses bloqueios. Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`.

#### Campos do DIA DE JOGO DO CLUBE (**opcionais, aditivos** — Onda AS)

Presentes só quando um evento de clube é a origem. **Ausente `club_id`, nada
disso vale.**
- `club_id` — o clube dono; `club_name` (desnormalizado, para cartões)
- `club_event_id` — o evento de clube de onde a data saiu (é para onde o botão
  "Gerir no clube" leva)
- e, do outro lado, `club_events/{eventId}/dates/{dateId}.game_day_id`
  (**opcional**) — o ponteiro de volta. **É ele que separa o novo do legado**:
  data sem `game_day_id` continua servida pelas subcoleções
  `club_events/{id}/{participants,games}`, exatamente como antes. Nada
  publicado foi migrado.

Dia de jogo de clube nasce `visibility: 'private'` (público significaria
publicar convite em "Procura-se jogo" e deixar qualquer conta se inserir — o
evento de clube nunca funcionou assim) e `manage_mode: 'participants'` (no
evento legado qualquer membro mexia em participantes e jogos).

Quem lê: os membros do CLUBE, por uma condição aditiva na regra
(`isClubGameDayMemberOf`, guardada por `'club_id' in …`). Quem administra: os
administradores do clube (`isClubGameDayManagerOf`). O membro do clube também
se **auto-inscreve** e sai sozinho — era o que a regra do evento legado já
permitia. Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §5.

O criador continua sendo o único que edita, arquiva, muda `manage_mode`,
nomeia/remove admin e publica no ranking da plataforma — **salvo no dia de jogo
de ARENA e no de CLUBE**, em que quem gerencia a arena / administra o clube faz tudo isso (a arena e o
clube são os donos do evento; amarrá-lo a uma pessoa o deixaria órfão quando
ela saísse da equipe). No dia de jogo de clube, EDITAR e ARQUIVAR são pela
DATA do evento, não por `/dia-de-jogo/:id`: arquivar de lá deixaria a data
apontando para um dia de jogo que sumiu. Regras de campo em
`firestore.rules` impedem que um admin altere `admin_uids`, `manage_mode`,
`created_by`, `title`, `status` ou `publish_to_ranking`: a atualização feita por
quem não é o criador só passa se mexer em `member_uids`, `invited_uids` e
`updated_at`. Lógica pura em `src/modules/games/domain/gameDayRoles.js`.

Subcoleções:
- `game_days/{id}/participants/{pid}` — `user_id?`, `name`, `photo_url?`,
  `source: 'owner'|'invited'|'joined'|'guest'`; `play_level?`/`play_gender?`
  (nível e sexo do convidado avulso, usados pelo Play); `play_group_id?`
  (grupo do Play, **opcional** — id que não existe mais vale "sem grupo")
- `game_days/{id}/games/{gid}` — `round`, `court`, `kind`, `side_a`/`side_b`
  (`[{id,name}]`), `score_a`/`score_b`, `order`; `group_id?`/`group_name?`/
  `group_color?` (cópia do grupo do Play em que a partida foi sorteada — o
  telão e a lista sobrevivem à remoção do grupo)
  - **Placar por sets (2026-10-10, opcional):** `sets?: [{a,b}]` (dois ou
    mais), `points_a?`/`points_b?` (total de pontos). Com sets, `score_*` são
    os SETS VENCIDOS — todo leitor que decide o vencedor por `score_a >
    score_b` segue certo; quem precisa de pontos usa `gamePoints`
    (`games/domain/gameSets.js`). Um set: `sets`/`points_*` nulos ou ausentes.
    Vale também em `club_events/{id}/games` (legado do clube). Sem regra nova.
  - **`kind` (2026-09-26, Onda CF):** `'doubles'` (padrão, 2 × 2) ou
    `'singles'` (1 × 1). O campo sempre existiu; passou a receber `singles`
    também no Play, no Americano aprimorado e no sorteio do Americano (o
    organizador legado do clube já gravava). Quem decide o tipo de um jogo é
    o NÚMERO DE ATLETAS por lado (`gameKindOf`) — a mesma regra da publicação
    e do servidor. Jogo antigo sem `kind` é duplas. Nenhum campo novo no dia
    de jogo: o tipo de cada QUADRA é derivado do último jogo dela
    (`courtKindsFromGames`). O espelho em `club_event_games` grava
    `kind: 'singles'` com um uid por lado, formato que a regra já validava.

Regras: read pelo dono/membros (ou qualquer um se público); escrita plena do
dono; um atleta se auto-inclui como membro/participante ao "Participar" de um
dia de jogo público. As subcoleções `participants` e `games` aceitam também
escrita de quem `canManageGameDayOf(gdId)` — o criador, os `admin_uids` e, quando
`manage_mode == 'participants'`, qualquer uid em `member_uids`.

### `legal_consents/{uid_docKey}` (id determinístico)
Registro do aceite de um documento legal por um usuário. 1 doc por usuário ×
documento, guardando a última versão aceita (histórico auditável em `audit_logs`).
- `id = ${uid}_${docKey}`, `user_id`, `doc_key`, `doc_title`
- `version` (inteiro; aceite válido quando ≥ versão vigente do documento)
- `accepted_at`, `accepted_at_ms`, `user_agent`

Documentos em `src/modules/legal/domain/legalDocuments.js` (dado puro,
versionado): essenciais (Termos de Uso, Política de Privacidade, Termo de Riscos
— aceite bloqueante), complementares (Cookies, Diretrizes da Comunidade,
Pagamentos/Reembolsos, Cancelamento) e por papel (Organizador, Arena, Professor).

Regras: cada usuário lê, cria e atualiza apenas o próprio consentimento
(`user_id == uid`; o update confere o dono atual); o platform admin lê
(auditoria) e é o único que apaga.

### `club_events/{id}/dates/{dateId}` (campos Wave C)
- `publish_to_ranking: bool` (default false) — chave de publicação.
- `published_at`, `published_by`, `published_count` — auditoria.
- `unpublished_at`, `unpublished_by` — quando despublicado.
- `last_publish_summary` — `{ published, skipped, already_published, removed }`.

### `club_internal_ratings/{clubId_userId}` (Wave C.3 — id determinístico)
Ranking individual do clube MATERIALIZADO (escopo só clube).
- `id = ${clubId}_${userId}`, `club_id`, `user_id`
- `display_name`, `photo_url` (denormalizados)
- `games, wins, losses, points_for, points_against, points_balance, win_rate`
- `scope: 'internal'`, `updated_at`

### `club_internal_ratings_ext/{clubId_userId}` (Wave C.3)
Ranking individual do clube MATERIALIZADO **com fontes externas**
(torneios + dias de jogo de outros clubes). Mesmo schema, `scope: 'ext'`.

### `club_internal_doubles_ratings/{clubId_pairKey}` (Wave C.3)
Ranking de duplas (parcerias) do clube MATERIALIZADO (escopo só clube).
- `id = ${clubId}_${pairKey}`, `club_id`, `pair_key`
- `player_ids[2]`, `display_names[2]`, `photos[2]`
- mesmos contadores + `win_rate` + `scope: 'internal'` + `updated_at`

### `club_internal_doubles_ratings_ext/{clubId_pairKey}` (Wave C.3)
Ranking de duplas MATERIALIZADO com fontes externas. Mesmo schema,
`scope: 'ext'`.

**Índices compostos (Wave C.6.1)**: cada uma das 4 coleções
acima (`club_internal_ratings`, `club_internal_ratings_ext`,
`club_internal_doubles_ratings`, `club_internal_doubles_ratings_ext`)
exige o índice composto `club_id ASC + wins DESC` em
`firestore.indexes.json` para a query do
`useClubInternalRanking`:
```js
getDocs(query(collection(db, 'club_internal_ratings'),
  where('club_id', '==', clubId), orderBy('wins', 'desc')))
```
Sem o índice, o Firestore lança `FAILED_PRECONDITION` (código 9).
O workflow `deploy-firebase.yml` deploya índices automaticamente.

Regras: `firestore.rules` — read público; write só `isPlatformAdmin()`
OU `isClubAdmin(club_id)`. O Cloud Function escreve com service account
(admin SDK ignora as regras). Ver `functions/clubRanking.js`.

## Torneios (Ondas 1-10)

### `tournament_announcements/{id}` (Onda 9b)
- `tournament_id`, `title`, `body`, `priority` ('info'|'warning'|'urgent'),
  `created_by`, `created_at`, `expires_at`. Aparece em destaque no torneio.

### `tournament_photos/{id}` (Fase 2 — galeria)
- `tournament_id`, `url`, `caption`, `uploaded_by`, `uploaded_at`.

### `tournaments/{id}.templates: bool` (Onda 5)
Marca torneio como "modelo" pra duplicar.

### `tournaments/{id}.wizard_draft: object` (Onda 5b)
Rascunho de wizard de criação em etapas. Limpo ao publicar.

## Clubes (Ondas 8/8b)

### `clubs/{id}` (campos novos)
- `recurring_rule` (opcional): `{frequency: 'weekly'|'monthly', weekdays[],
  end_date}` para eventos recorrentes.
- `is_public: bool` (Onda 8b) — clube com página pública.
- `public_slug` (se público) — `/clubes/p/:slug`.
- `internal_ranking_config` (opcional) — para `club_internal_ranking` (Onda 8).
- `invite_link` (opcional) — token de convite compartilhável (Onda 8b).

## Rating estilo DUPR (Onda G — Sprints 38-43)

### `doubles_rankings/{pair_key}` (NOVO — ranking de duplas materializado)

Uma linha por **parceria** (os dois atletas que jogaram juntos do mesmo lado),
já classificada. `pair_key` são os dois uids ordenados e unidos por `__`, o que
torna a chave estável independentemente de quem foi lado A ou B.

```js
{
  pair_key: 'uidA__uidB',
  player_ids: ['uidA', 'uidB'],
  players: [{ uid, name, photo }, ...],   // desnormalizado: a página não busca perfil
  games, wins, losses,
  win_rate,                                // vitórias ÷ jogos (o critério principal)
  points_for, points_against, points_balance,
  position,                                // a classificação, calculada no servidor
  updated_at
}
```

- **Classificação**: aproveitamento → vitórias → derrotas → saldo de pontos.
- **Escrita**: SÓ a Cloud Function de recálculo (Admin SDK). Regra:
  `allow read: if true; allow write: if false;` — desde 2026-09-24 nem o admin
  escreve pelo navegador (ver `docs/18-RANKINGS.md` §8.1). Mesma política de
  `player_ratings`, `rating_history`, `player_skill_ratings` e
  `skill_rating_history`.
- **Leitura**: a página `/ranking/duplas` lê a coleção inteira ordenada por
  `position` (campo único, **sem índice composto**) e pagina no cliente.
- **Atualização**: a cada resultado publicado, junto com `player_ratings` e
  `player_skill_ratings`. Ver `docs/18-RANKINGS.md`.
- **Migração**: nenhuma — a coleção nasce no primeiro recálculo.

### `player_skill_ratings/{userId_format}` (NOVO Onda G)
Rating estilo DUPR (escala 2.000-8.000), **independente** do
ELO. Sempre ligado (a antiga flag `skill_rating_dupr` virou código). Coleção
**separada** do `player_ratings` (ELO).
- `user_id`, `format` (`'singles' | 'doubles'`).
- `rating: number` (2.0-8.0).
- `games_played: number`.
- `reliability: number` (0-1) — cresce com jogos.
- `provisional: bool` — true enquanto reliability < threshold.
- `seed_level: number` — USAP usado como semente (ex: 2.5 → 2.500).
- `updated_at: timestamp`.
- **Regras**: leitura pública; escrita **só a Cloud Function** (Admin SDK).
  `allow write: if false` para o cliente, inclusive o admin (2026-09-24).
- **Motor** (`duprScale.js`, testado): baseado no placar
  (não só resultado), K de ~0.30 (novato) a ~0.05 (maduro),
  ignora W.O. Replay determinístico.
- **NÃO oficial**: rotulado claramente como aproximação,
  não usa algoritmo proprietário do DUPR.

### `skill_rating_history/{id}` (NOVO Onda G)
Evolução do rating DUPR ao longo do tempo (mesmo formato
do `rating_history` ELO).
- `user_id`, `format`, `rating`, `delta`, `opponent_id`,
  `match_id`, `created_at`.
- **Gravado** pelo servidor na mesma passada de `player_skill_ratings`
  (`functions/platformRankings.js`).
- **Regras**: leitura pública; escrita só da Cloud Function (`if false` no
  cliente).

### `audit_logs` — ações de moderação (PR #120)
Mesma coleção da seção "Transversal" (não há outra): as ações de moderação de
atleta (`athlete_hide`, `athlete_unhide`…) são linhas de `audit_logs` com o
shape de lá. A escrita é do cliente (com `actor_id == uid`), não de service
account.

## Cross-cutting (transversal)

### `users/{uid}.notification_prefs: object` (Onda 9b)
Preferências por categoria: `{booking_confirmed: bool, tournament_*: bool,
chat_*: bool, forum_*: bool, ...}`. Default todas ON.

### `users/{uid}.notification_channels: object` (2026-10-16, `external_messaging`)
Escolhas da pessoa por canal: `{ email|whatsapp|sms|push: { on, areas: {
<área>: 'imediato'|'diario'|'semanal'|'nao' (e-mail) ou bool } }, marketing,
quiet: { on, start, end, push }, blocked_senders: [uid] }`. Ausente ⇒ os
padrões do admin. Escrito pelo dono por caminho com ponto. Ao lado,
`phone_verified_number` (E.164) e `phone_verified_at` — **só o servidor**
grava (código por SMS/WhatsApp; a regra recusa o dono).

### `users/{uid}.language: string` (2026-10-14, flag `multi_language`)
Idioma escolhido pela pessoa (`'pt-BR' | 'en' | 'es'`, os códigos de
`src/core/i18n/languages.js`). Escrito pelo titular ao trocar de idioma (e uma
vez, se ele já tinha escolhido antes); lido no login de outro aparelho e pelo
`pushOnNotificationCreate` para o push sair no idioma dela. Opcional: ausente ⇒
português. A regra de `users` já deixa o dono escrevê-lo (não é campo de poder).

### Exportação de dados (LGPD)
Não há `data_export_request` em `users` nem coleção `user_data_exports`: a
exportação é gerada no cliente (`athletes/domain/dataExport.js`) e entregue como
arquivo. Coleção nova entra na exportação e na exclusão de conta (guarda
`src/core/guards/exclusaoCobreColecoes.test.js`).

### `push_tokens/{uid}_{hash(token)}` (`push_notifications`)
Um documento por aparelho. `user_id`, `token` (FCM), `user_agent`, `updated_at`,
`updated_at_ms`. Cada pessoa lê/escreve só os próprios; a Cloud Function
`pushOnNotificationCreate` lê para enviar e remove os inválidos. O app regrava
o do aparelho ao abrir (`refreshPush`, só para quem ativou ali) e "Desativar"
apaga só o deste aparelho. O teste da aba Push (`messagingAdmin` →
`push_test`) manda para os do próprio admin e também remove os inválidos; o
Resumo conta os documentos ("aparelhos com o push ativo").

### Torneio por equipes (`team_tournaments`)
Não há coleções `tournament_team_*`. As equipes usam as coleções do torneio:
- `tournament_registrations` com `kind: 'team'`, `team_name`, `members[]`,
  `member_uids`.
- `tournament_matches` com `team_confrontation: true`, `etapas[]`,
  `etapa_wins_a/b`, `sets_*`, `points_*`.
- Cada etapa espelha em `club_event_games` com `source: 'team_confrontation'`
  (entra no ELO e no DUPR individual).

## Gamificação V2 (`gamification_v2` — incorporada, sempre ligada desde 2026-10-10)

> Coleções da camada completa (prefs, grants de XP, hall, avaliações, reputação, cartas, desafios, duelos, recompensas, metas, integridade, métricas): ver `docs/38-GAMIFICACAO-V2.md` §3.

> 13 coleções materializadas. O schema V1 (`users/{uid}`
> XP/nível/conquistas) segue intacto.
>
> **Vocabulário**: os nomes de tier e as 5 trilhas vêm do DOMÍNIO
> (`src/modules/progression/domain/tiers.js` e `skillTrees.js`). O schema
> Zod e o `firestore.rules` derivam dessa fonte — o teste
> `gamificationRulesSync.test.js` quebra a CI se um lado divergir do outro.

### `user_progression_v2/{uid}` (Onda R)
> Leitura (vale também para `user_achievements_v2`): o dono e o admin sempre;
> outra conta logada só se `user_gamification_prefs.privacy.showOnPublicProfile`
> não for `false` (`gamificationPublicOk`). Kudo: lê `fromUid`, `toUid` ou admin;
> `user_kudos_index`: dono ou admin; `user_referrals`: indicado, indicador ou
> admin; `user_rivals`: os dois lados; `mentorships`: mentor, aprendiz ou admin;
> `crews`: pública ou criador/membro/admin; `crew_members` e
> `user_referral_codes`: qualquer conta logada.

Snapshot materializado da progressão. Recalculado no cliente a partir dos
stats V1 (`useSyncProgressionV2`).
- `uid`, `schemaVersion: 1`, `xpTotal: int`, `level: int`.
- `tier: string` — um de `Calouro, Aprendiz, Jogador, Regular, Veterano,
  Expert, Elite, Lenda, Imortal`.
- `skillTrees: array(5)` — `{ tree, level, xp }`, com `tree` em
  `tournament | social | arena | coach | club`.
- `achievementsUnlocked`, `achievementsTotal`, `source`, `createdAt`,
  `updatedAt`.
- **Regras**: escrita só do dono (ou admin); **leitura por qualquer
  autenticado** — é o que alimenta o Hall da Fama e o perfil público de
  conquistas. Só carrega números de progresso.
- **Índice**: `tier ASC, xpTotal DESC` (Hall da Fama).

### `user_missions/{uid}_{YYYY-MM-DD}` (Onda R)
Missões do dia. O dia é o dia de **Brasília** (`missionDay.js`), não UTC.
- `uid`, `date`, `scope: daily|weekly|monthly`, `missions[]`,
  `bonusClaimed`, `completedAt`, `createdAt`, `updatedAt`.
- **Regras**: privado — só o dono e o admin.

### `user_achievements_v2/{uid}_{achId}` (Onda R)
Conquista desbloqueada.
- `uid`, `achievementId`, `family` (`career | social | discovery |
  seasonal | community`), `rarity` (`common → legendary`), `unlockedAt`,
  `progress: 0..1`, `shareCount`, `notified`.
- **Regras**: escrita só do dono; `progress` pode avançar mas **nunca
  regredir**. Leitura por qualquer autenticado (perfil `/conquistas/:uid`).

### `user_streak_meta/{uid}` (Onda R, férias na Onda W2)
Férias da sequência (a sequência em si é **derivada** dos jogos, em
`progression/domain/weekStreak.js`; nada dela é gravado).
- `uid`, `schemaVersion: 1`, `lastPlayAt`, `graceDaysRemaining: 0..3`,
  `freezesAvailable: 0..3`, `freezesUsed: int` (**acumulativo, sem teto**),
  `vacationMode`, `vacationStartedAt`, `comebackBonus`, `updatedAt`.
  Os campos de folga/congelamento são do desenho antigo e seguem aceitos pela
  regra, mas **o cálculo não os lê**.
- **`vacations`** (opcional, Onda W2): `[{ from: ms, to: ms|null }]`, até 8
  períodos, o mais novo por último; `to: null` é "em andamento". Quem escreve é
  `streakMetaService.enableVacation/disableVacation`, que **recusa** férias com
  outro período aberto ou a menos de 90 dias do começo das últimas. Documento
  sem `vacations` (anterior) é lido por `vacationPeriodsOf`.
- **Regras**: privado — só o dono e o admin. Nenhum campo novo é restringido;
  quatro casos do emulador (`tests/rules/gamificationV2.rules.test.js`) provam
  que a regra de sempre aceita `vacations`.

### `user_referral_codes/{uid}` · `user_referrals/{refereeUid}` (Onda R)
Programa de indicação.
- Código: `uid`, `schemaVersion: 2`, `code` (8 chars, sem `0/O/1/I/L`),
  `totalSignups`, `totalActivated`, `totalTournaments`, `totalXpEarned`,
  `monthlyCount ≤ 50` (anti-farm), `monthKey` (mês de **Brasília**).
- Vínculo: `refereeUid`, `referrerUid`, `code`, `signedUpAt`,
  `activatedAt`, `tournamentAt`, `xpPaidOut`.
- **Regras**: o vínculo é criado pelo próprio indicado. O indicado pode
  creditar o código do indicador, mas **só +1 por vez** e sem trocar o
  código — é a única escrita cruzada permitida.

### `user_kudos/{kudoId}` · `user_kudos_index/{uid}` (Onda R)
Kudos (👏) entre atletas.
- Kudo: `kudoId`, `fromUid`, `toUid`, `type`, `scope`, `message` (≤280),
  `contextId`, `createdAt`, `expiresAt`. **Imutável** após criado.
- Índice: `uid`, `schemaVersion: 2`, `receivedCount`, `givenCount`,
  `receivedToday ≤ 100`, `givenToday ≤ 50`, `lastKudoDay` (dia de
  **Brasília**).
- **Regras**: só o `fromUid` cria o kudo, e nunca para si mesmo. Quem dá
  pode incrementar o índice de quem recebe em **+1**, sem tocar nos
  contadores de "dados" do outro.
- **Auditoria**: `gamification_kudo_given` em `audit_logs`.

### `user_rivals/{pairKey}` · `crews/{crewId}` · `crew_members/{crewId}_{uid}` · `mentorships/{pairKey}` (Onda R)
Vínculos sociais. **Sem UI ainda** — domínio, service e regras prontos.
- Rivais: `pairKey` (uids ordenados), `userA/B`, `gamesA/B`, `winsA/B`,
  `lastGameAt`. Os dois lados escrevem, sem trocar quem é quem.
- Crew: `crewId`, `schemaVersion: 2`, `name` (≤40), `isPublic`,
  `createdBy`, `membersCount: 1..50`, `totalXp`, `totalWins`.
  Crew privada continua legível por seus membros.
  Entrar/sair mexe **só** no `membersCount`, de 1 em 1.
- Membro: `crewId`, `uid`, `role: owner|captain|member`, `joinedAt`,
  `contributionXp`. Cada um cria a própria adesão.
- Mentoria: `pairKey`, `schemaVersion: 2`, `mentorUid`, `apprenticeUid`,
  `status: active|paused|completed|cancelled`, `lessonsCompleted`.

### `season_rankings/{seasonId}_{uid}` (Onda R)
Ranking mensal. `seasonId` = `YYYY-MM` no fuso de Brasília.
- `seasonId`, `uid`, `schemaVersion: 2`, `xp`, `tier`, `position`,
  `deltaPosition`, `prizeXp`, `updatedAt`.
- **Regras**: leitura por qualquer autenticado (é placar público);
  **escrita só de platform_admin** — posição no ranking não pode ser
  decidida pelo cliente. O cálculo é trabalho de Cloud Function / admin.
- **Índices** (4 em `firestore.indexes.json`): `seasonId ASC, xp DESC`,
  `uid ASC, xp DESC`, `seasonId + public + publicPosition` e
  `seasonId + public + state + publicPosition`.

### `dupr_export_log/{matchId}` (Onda G — `dupr_match_export`)
Situação de cada partida perante o DUPR e presença dela na **lista de
exportação**. Id do doc = id da partida (`tournament_matches` ou
`club_event_games`), o que torna a escrita idempotente.
**Governança sensível: só platform_admin lê e escreve.**

- `match_id`, `source`, `match_type`, `event_name`, `match_date` — cópia
  leve para leitura do ledger sem recarregar a partida.
- `fingerprint`, `identifier` (`pr_<matchId>`) — chaves de conferência
  com o histórico do DUPR (antiduplicação).
- `status`: `pending` | `exported` | `submitted` | `excluded`
  (`confirmed` NÃO é gravado — é derivado da conferência com o DUPR).
  `excluded` = "não lançar no DUPR", decisão explícita do admin, é a
  situação de maior precedência e nenhuma ação automática a rebaixa.
- `exported_at`, `submitted_at`, `excluded_at` — carimbos da atividade.
- `queue_removed` (bool) + `queue_removed_at` — ADITIVOS: tiram a
  partida da lista de exportação **sem** mexer no `status` (é "não
  lançar agora", não "nunca lançar"). Ausentes = na lista.

**Lista de exportação (automática)**: a partida entra sozinha quando
está PRONTA (todos os jogadores com `dupr_id`), com `status` `pending`
e sem `queue_removed`. É exatamente esse conjunto que vira o CSV.

## Coleções Arena V3 (liberadas por módulo — `docs/24-MODULOS-DE-ARENA/00-INDEX.md`)

> 35+ coleções criadas pelos módulos Arena V3 (PDV, members, leagues,
> marketing, IoT, operations, matchmaking). Detalhe completo em
> `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md`. O que está ativo é
> decidido por módulo: a plataforma libera (`platform_settings/arena_modules`)
> e a arena ativa (`arena_module_states`) — não há mais sub-flags.

**PDV**: `arena_sales`, `arena_payments` — os produtos são os do Mercado
(`arena_inventory_products` com `sell_online`); `arena_products` é legado
(vendas antigas). Ver `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §9.
**Members**: `arena_members`, `arena_packages`, `arena_subscriptions`,
`arena_wallets`, `arena_tier_configs`, `arena_network_memberships`,
`arena_networks`.
  - (2026-09-24) `arena_members`, `arena_wallets`, `arena_subscriptions` e
    `arena_referrals` têm id `{arena}_{uid}` e o código lê antes de criar. A
    regra de leitura olha `resource.data`, que num documento inexistente é
    nulo — o `get` dava erro para o atleta e para a arena. Regra aditiva
    `canGetMissingArenaUserDoc`: o `get` de documento **inexistente** é do dono
    do uid, da arena do prefixo e do admin (não abre documento existente, não
    muda consulta). Ver `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §10.
**Leagues**: `arena_ladders`, `arena_internal_tournaments`, `arena_matches`.
  - ⚠️ (2026-09-25, Onda CB) **o torneio interno saiu da tela** — os torneios
    da casa passaram a ser os torneios da PLATAFORMA com `arena_id`, e o
    ranking da casa é DERIVADO (`arenas/domain/houseRanking.js`), sem escrita.
    As duas coleções ficam como estão (nada apagado, regra intacta): o ladder
    `{arena}_geral` é LIDO como "torneios internos (formato antigo)" e os
    torneios internos abertos aparecem na Central para a arena cancelar
    avisando os inscritos. Nenhuma tela nova escreve nelas.
  - `game_days` por arena (Onda CB): a consulta TEM de levar
    `visibility == 'public'` junto de `arena_id` — sem isso a regra recusa a
    lista para todo mundo menos o admin da plataforma. Ver
    `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §15.
  - `arena_internal_tournaments` (2026-09-24): além da arena, o **próprio
    atleta** atualiza o documento para se inscrever ou sair — só a si mesmo em
    `participants`, só com o torneio `scheduled` e sem `game_day_id`, tocando
    apenas `participants`/`roster`/`enrolled`/`updated_at`, sem apagar o
    roster alheio e respeitando `max_participants`. "Meus torneios da casa"
    consulta `participants array-contains uid` (sem índice composto).
**Classes** (Sistema C, Aulas da arena): `arena_classes`, `arena_class_bookings`,
`arena_coaches`.
  - `arena_class_bookings` (2026-09-24): além do aluno e da arena, o
    **professor da aula** lê a matrícula — `arena_coaches/{coach_id}.user_id
    == uid` (consulta por `coach_id`); a arena consulta por `arena_id` +
    `class_id` (só por `class_id` a regra recusa). O aluno cria só em nome próprio, sem
    `paid: true` e com o `arena_id` da aula; e não altera pagamento, valores
    nem a que aula/arena/professor a matrícula pertence. A divisão
    (`arena_amount`/`coach_amount`/`commission_pct`) é calculada pelo serviço
    com o `partner` do cadastro do professor e a comissão do módulo
    `classes_marketplace`. Ver `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §5.
**Marketing**: `arena_campaigns`, `arena_coupons`, `arena_referrals`,
`arena_nps_responses`.
  - `arena_coupons.show_public` (2026-09-24, opcional): `true` = o cupom é
    PROMOÇÃO, oferecido na página da arena e no pedido de reserva. Ausente =
    código entregue a dedo (todo cupom anterior). Não muda leitura nenhuma —
    `arena_coupons` já era legível por conta logada.
  - `arena_coupons.show_home` (2026-09-25, Onda BZ, opcional): `true` = a
    promoção aparece também como BANNER na tela inicial, para quem está na
    cidade/estado da arena (filtro no domínio, `homeBanners.js`). Só é gravado
    `true` junto de `show_public`, e nunca na indicação. A tela inicial lê por
    `where show_home == true` + `where active == true` (só igualdades, sem
    índice composto). Ausente = não é banner (todo cupom anterior).
  - **Tipos de cupom (2026-09-25, Onda BX, todos opcionais):** `kind`
    (`discount` · `free_hours` · `private_lesson` · `group_lesson` · `clinic` ·
    `food` · `drink` · `product` · `rental` · `event` · `other` · `referral`;
    ausente = `discount`, o que todo cupom antigo é), `benefit` (texto do vale),
    `face_value` (valor de referência do vale), `last_used_at`, e as regras da
    indicação — `referrer_reward`, `referred_reward_kind`
    (`credit`/`percent`/`fixed`/`none`), `referred_reward_value`,
    `first_booking_only`, `max_per_referrer`. Campo que não se aplica ao tipo é
    gravado `null`. **O custo interno do vale NÃO fica no cupom** (legível por
    conta logada): fica em `arena_settings.coupon_costs.{couponId}`, que só o
    gestor lê.
  - Regras endurecidas (Onda BX): o cupom e a campanha **não mudam de
    `arena_id`** no update; `arena_referrals` nasce com id `{arena}_{uid}`,
    zerado (sem `redeemed_*` nem `reward_total`), e só a arena atualiza — sem
    trocar arena, dono ou código. `arena_referrals.reward_total` (opcional)
    soma o que cada resgate creditou.
  - **Arte do cupom (2026-09-25, Onda CD, opcional):** `arena_coupons.art` —
    `{ source: 'design', template_id, design: { style, kicker, title,
    subtitle, bg, fg, accent } }` ou `{ source: 'upload', image_url,
    image_path, width, height, alt }` (URL só do Storage do projeto). Ausente
    ou `null` = desenhado como o modelo Clássico. Só é gravado quando o
    formulário o manda (editar um cupom antigo sem mexer na arte não grava
    nada), e nunca na indicação. Modelos da arena em
    `arena_settings.coupon_templates` (até 20, ids `arena:…`). Zero regra
    nova. Ver `docs/24-MODULOS-DE-ARENA/03-MARKETING.md` §13.
  - **Banner de campanha (2026-09-25, Onda CC, todos opcionais):**
    `arena_campaigns.banner` (`{ source: 'design', template_id, design: {
    layout, kicker, title, subtitle, highlight, cta, bg, fg, accent, image_url?,
    image_path? } }` ou `{ source: 'upload', image_url, image_path, width,
    height, alt }` — URL só do Storage do projeto), `destination` (`{ type,
    target_id, target_label }`, lista fechada de destinos), `show_on_arena`,
    `show_home`, `banner_until` ('YYYY-MM-DD', até 120 dias) e `banner_active`
    (pausar/retomar). `channel` passa a aceitar `'banner'` (campanha sem
    aviso). Consultas: página da arena `arena_id` + `show_on_arena`; tela
    inicial `show_home` + `banner_active` — só igualdades, sem índice composto.
    Os modelos da arena ficam em `arena_settings.banner_templates` (até 20,
    ids `arena:…`; só a arena lê e grava). Zero regra nova. Ver
    `docs/24-MODULOS-DE-ARENA/03-MARKETING.md` §12.
  - **`arena_bookings.referral` (2026-09-25, Onda BY, opcional):** o código de
    quem indicou, gravado pelo atleta no pedido — só `{ code, status:
    'pending', created_at_ms }` (regra `bookingReferralOkOnCreate`). A ARENA o
    decide na confirmação: `status` vira `aplicada` (com `referrer_id`,
    `referrer_reward`, `referred_reward`, `discount_value`, `decided_at`) ou
    `recusada` (com `reason`). Só a arena/admin altera `referral` depois do
    pedido (regra de update de `arena_bookings`).
**Operations**: `arena_checklists`, `arena_maintenance_orders`,
`arena_inventory_products`, `arena_inventory_entries`, `arena_inventory_exits`.
**IoT**: `arena_devices`.
**Matchmaking**: `arena_open_slots`.
  - **O jogo aberto que é um DIA DE JOGO (2026-09-25, Onda CA, campos
    opcionais):** `arena_open_slots.game_day_id` ⇄ `game_days.open_slot_id`
    ligam a vitrine ao dia de jogo; `arena_open_slots.court_ids[]` (o jogo pode
    rodar em mais de uma quadra; `court_id` segue com a primeira) e
    `arena_open_slots.game_format` (cópia do formato do dia, para a vitrine).
    Ausentes, a vaga antiga segue como sempre. Entrar/sair grava a vitrine, o
    participante e `member_uids` num LOTE só, cada escrita pela regra de "só a
    si mesmo" que já existia — **nenhuma regra nova**. A vaga ligada não deriva
    bloqueio próprio: quem fecha a quadra é o dia de jogo. Ver
    `docs/24-MODULOS-DE-ARENA/01-MATCHMAKING.md` (atualização 2026-09-25, CA).
  - (2026-09-24) O atleta atualiza `arena_open_slots` só para entrar/sair A SI
    MESMO (`participants`, `filled_spots`, `status`, `updated_at`, coerentes).
    `arena_waitlist` é legível por quem tem conta; criar é em nome próprio,
    `status: waiting`, id `slotId_uid`, na arena da vaga; o atleta só responde
    à própria chamada (`notified` → `accepted`/`declined`). Chamar o próximo é
    do servidor (`functions/openSlotWaitlist.js`). `arena_referrals`: a arena
    lê as indicações dela. `arena_payments`: a arena consulta por `arena_id` +
    `sale_id`.
**Settings**: `arena_settings`, `arena_module_states`.

### `catalog_products/{id}` 

Catálogo PADRÃO de produtos, **compartilhado por toda a plataforma** — as arenas
puxam esses itens para o seu mercado (`arena_inventory_products`) e complementam
com preço de compra/venda, quantidade e validade; também podem contribuir novos
produtos (com verificação de duplicidade).

Campos: `name`, `category`, `subcategory`, `brand`, `packaging`, `size`,
`flavor`, `unit`, `description`, `dedup_key` (chave normalizada p/ dedup),
`search_tokens` (array p/ busca), `source` (`platform`|`arena`), `status`
(`active`|`pending`|`merged`), `contributed_by_arena_id`, `contributed_by_uid`.

Regras: leitura por qualquer autenticado; criação por `platform_admin` ou gestor
da arena que contribui (deve declarar `contributed_by_arena_id`);
atualização/remoção (moderação) só `platform_admin`.

`arena_inventory_products` ganhou campos ADITIVOS opcionais quando o produto vem
do catálogo/mercado: `catalog_id`, `subcategory`, `packaging`, `size`, `flavor`,
`sale_price`, `min_stock`, `expiry_date`.

(2026-09-24) A loja do app é um CANAL do Mercado:
- `arena_inventory_products.sell_online` (só gravado quando marcado) — o produto
  aparece na loja do app com o `sale_price`;
- `arena_inventory_products.stock_qty` — a cópia do estoque que o atleta lê
  (ele não lê entradas e saídas). Escrita só pela arena; refeita a cada
  entrada/saída/entrega/cancelamento. **Vazio = sem controle de estoque**
  (nenhuma entrada registrada: o app vende sem limite);
- `arena_inventory_exits.sale_id` + `channel: 'app'` — a saída gerada pela
  ENTREGA de um pedido. O cancelamento acha o que desfazer por esse campo.

## Modo escuro (Onda CH — `dark_mode`)

**Nenhuma coleção, campo, índice ou regra.** A aparência escolhida é
conveniência de interface e mora no navegador: `v2:view:<uid>:aparencia:tema`
(a escolha, por usuário, via `viewPreference`) e `picklerush:tema` (o espelho
lido pelo script de `index.html` para pintar a primeira tela). `dark_mode` está
incorporada desde 2026-10-10 (`PERMANENT_FEATURE`, sempre ligada). Ver
`docs/30-MODO-ESCURO.md` §3.

## Início sob medida (Onda CI — `home_cards`)

**Nenhuma coleção, campo, índice ou regra.** Os cards que a pessoa escolhe
para o seu início (e a ordem) moram no navegador, por usuário:
`v2:view:<uid>:inicio:cards` = `{"v":1,"cards":[…]}` (via `viewPreference`).
Sem a chave vale o padrão; `cards: []` é uma escolha ("só o resumo do dia").
Com o início sob medida, o "Personalizar" do início **deixa** de gravar
`users.interests` (os interesses seguem editáveis no perfil). Ver
`docs/31-INICIO-SOB-MEDIDA.md` §6.

## Dicas guiadas (Onda CJ — `guided_tips`)

**Nenhuma coleção, campo, índice ou regra.** Tudo é preferência de interface,
no navegador, por usuário: `v2:view:<uid>:dicas:ligadas` (`'1'`/`'0'`; sem a
chave, desligadas), `v2:view:<uid>:dicas:feitos` e `v2:view:<uid>:dicas:vistos`
(listas de ids), e o guia em andamento no `sessionStorage`
(`picklerush:dicas:guia:<uid>` = `{ id, passo }`). A marca antiga de "já vi o
tutorial" (`v2:view:<uid>:tutorial:<id>`) segue valendo com a flag desligada.
Ver `docs/32-DICAS-GUIADAS.md` §5.

## Divulgação da plataforma e dos professores (Onda CG — `platform_marketing` / `coach_marketing`)

Três coleções NOVAS e um campo opcional. Tudo aditivo; nenhuma regra existente
tocada. Detalhes em `docs/29-INICIO-PERSONALIZADO-E-DIVULGACAO.md` §3.

### `promo_coupons/{id}` (NOVO)
O cupom de um EMISSOR que não é arena. `issuer_type` (`platform` | `coach`),
`issuer_id` (`'platform'` ou o uid do professor), `issuer_name`, e os campos
do cupom da arena (`kind`, `code`, `type`, `value`, `benefit`, `face_value`,
`description`, `max_uses`, `once_per_user`, `expires_at`, `active`,
`show_public`, `show_home`, `art`, `used_count`, `used_by[]`) — **sem** os de
indicação e sem `min_amount`. Mais `reach` (`{ mode: brasil|estado|cidade,
state, city }` — até onde aparece na tela inicial) e `visibility`
(`todos` | `alunos`, só professor). Leitura: conta logada. Escrita: só o
emissor (admin para a plataforma; o professor COM `coaches/{uid}`), sem trocar
o emissor; admin pausa/apaga. **O custo do vale nunca mora aqui.**

### `promo_campaigns/{id}` (NOVO)
Emissor + `name`, `message`, `channel`, `target_audience`
(`todos|interesse|estado|cidade|professores` / `alunos_ativos|todos_alunos`),
`audience_detail` (`{ interest, state, city }`), `status`,
`recipients_count` (o público pedido), `sent_count` (os avisos CONFIRMADOS —
nasce 0 e sobe depois do envio; campanha antiga só tem `sent_count`),
`destination` (`{ type, target_id, target_label }`, lista fechada por
emissor), `banner` (o mesmo formato do banner da arena), `show_on_page`,
`show_home`, `banner_until`, `banner_active`, `reach`, `visibility`. Mesmas
regras do cupom.

### `promo_settings/{platform|uid}` (NOVO)
Configurações PRIVADAS do emissor: `coupon_costs` (custo unitário por cupom),
`banner_templates`, `coupon_templates` (ids `arena:…`, o mesmo formato dos
modelos da arena). Só o emissor (e o admin) lê e escreve.

### `coach_lessons.coupon` (campo opcional)
`{ coupon_id, code, benefit, kind, status: pending|applied|rejected,
discount_value?, original_price?, lessons_count?, returned?, returned_at?,
reason? }`. O aluno só grava `pending` (`normalizeLessonCoupon`, e a regra
confere); o professor resolve na confirmação (`resolveLessonCoupon`) —
aplicado, `price` passa a ser o valor já com o desconto. Numa série
(`lessons_count` > 1) o desconto cobre UMA aula. Aula desfeita com o cupom
aplicado: o professor devolve o uso (`returned: true`, `returned_at` em ms).
Ausente = aula sem cupom (todas as antigas).

**Índices**: nenhum. Todas as consultas são só de igualdades.

## Centro de Treino (`training_center` — incorporado, sempre ligado desde 2026-10-10)

Sete coleções NOVAS e um documento de configuração. Tudo aditivo; **zero
índice composto** (todas as consultas são por igualdade ou `array-contains`,
ordenação em memória). Detalhes, quem lê e quem escreve: `docs/40-CENTRO-DE-TREINO.md` §5.

### `training_items/{id}` (NOVO)
O drill, treino, fundamento, jogada, exercício físico ou estudo, de QUALQUER
autor. Autoria (imutável): `author_uid` (uid, ou `'plataforma'`),
`author_role` (`plataforma|professor|atleta`), `created_by`, mais a cópia
`author_name`/`author_photo`. Acesso: `visibility` (`publico|privado|alunos` —
`alunos` só professor), `review` (`nao_se_aplica|pendente|aprovado|recusado`),
`hidden`, `featured`, `shared_uids[]` (≤ 50, quem recebeu por indicação),
`derived_from` (`{ id, title, author_name, locked }` — a regra confere o
`locked`), `ai_assisted`. Moderação só do admin: `review_note`, `reviewed_by`,
`reviewed_at`, `hidden_reason`. Conteúdo (o modelo da pesquisa): `kind`,
`title`, `summary`, `objective`, `skills[]`, `level_min`/`level_max` (2.0–8.0),
`players_*`, `roles[]`, `duration_min`, `intensity`, `place[]`, `equipment[]`,
`setup`, `steps[]`, `cues[]`, `positioning[]` (`certo|errado`),
`common_errors[]`, `variations`, `success_criteria`, `metric`, `safety`,
`motor` (fases + capacidades), `technique` (opcional, fundamento/jogada: `checkpoints[] {part, text}` ≤ 8 + `self_check[]` ≤ 6), `blocks[]` (treino), `sets`/`reps`/`rest_sec`/
`tempo` (físico), `study_type`/`rules_edition`/`rules_section`/`questions[]`/
`link` (estudo), `when_to_use`, `diagrams[]` (≤ 4), `media[]` (≤ 8, com `path`
quando enviado ao Storage). A semente usa ids `pickle_<slug>`.

### `training_shares/{id}` (NOVO)
`from_uid`, `from_name`, `from_role`, `to_uid`, `item_id`, `item_title`,
`item_kind`, `kind` (`indicacao` — qualquer um; `aluno` — só professor, para
aluno ATIVO), `note`, `due_date` (só `aluno`), `created_at`, `read_at`,
`done_at`, `done_note`. Quem recebe só mexe em lido/feito.

### `training_sessions/{id}` + `comments/{cid}` (NOVO)
O diário: `uid`, `date`, `week_key`, `title`, `kind`, `status`
(`feito|parcial|livre`), `item_ids[]`, `plan_id`, `duration_min`, `rpe`,
`notes`, `skills[]`, `shared_coach_id`, `coach_confirmed_at`. **Nenhum campo
de saúde.** Comentários: `uid`, `name`, `text`, `created_at`.

### `training_plans/{id}` (NOVO)
`uid`, `title`, `goal`, `focus[]`, `start_date`, `weeks` (1–16), `days[]`,
`minutes`, `slots[]` (≤ 112), `status` (`ativo|pausado|concluido`), `source`,
`coach_id`, `coach_name`. Só o dono.

### `training_meta/{uid}` (NOVO)
`favorites[]` (≤ 300), `routine`, `onboarding_done`, `mastery` (`{ itemId:
aprendendo|consistente|dominado }`, ≤ 300), `assessments[]` (≤ 24),
`focus_hint`, `debrief` (`{ enabled, since }` — o balanço do jogo ligado
pela pessoa, flag `game_debrief`), `updated_at`. Só o dono.

### `training_debriefs/{uid}_{tipo}_{ref}` (NOVO, flag `game_debrief`)
Balanço depois de um jogo: `uid`, `source { type: dia_de_jogo|torneio|reserva|avulso,
ref_id, title, date, games, wins }`, `status` (`respondido|dispensado`),
`rating` (1–5), `strengths[]`, `weaknesses[]` (≤ 3, ids de `GAME_ASPECTS`),
`evolution`, `body`, `mind`, `note` (≤ 500), `suggestion { focus[], item_ids[],
light }`, `applied { plan_id, mode, dates[], at }`. Só o dono (o admin lê e
apaga); a regra confere o prefixo do id e a forma. Zero índice. Ver
`docs/42-BALANCO-DO-JOGO.md`.

### `training_questions/{id}` + `messages/{mid}` (NOVO)
Dúvida privada aluno ↔ professor: `asker_uid`, `asker_name`, `coach_uid`,
`coach_name`, `subject`, `item_id`, `item_title`, `status`
(`aberta|respondida|encerrada`), `last_from`, `created_at`, `updated_at`.
Abrir exige vínculo ATIVO. Mensagens só se acrescentam.

### `training_reports/{id}` (NOVO)
`reporter_uid`, `item_id`, `item_title`, `item_author_uid`, `reason`, `text`,
`status` (`aberta|resolvida|descartada`), `resolved_by`, `resolved_at`,
`resolution`. Qualquer conta cria; só o admin resolve.

### `platform_settings/training` (documento novo, regra que já existia)
`public_review_atleta`, `public_review_professor` (padrão ligada), `verified_professors[]` (professores que o admin verificou: publicam sem fila), `allow_public_athlete`,
`allow_uploads`, `allow_video_upload`, `max_image_mb`, `max_video_mb`,
`max_video_seconds`, `max_uploads_per_user`, `allow_sharing`,
`max_pending_per_user`, `seed_installed_version`, `seed_installed_at`,
`seed_removed[]`. Campo ausente vale o padrão de `training/domain/settings.js`
(o mesmo da regra).

### Storage: `treino/{uid}/{arquivo}` (NOVO)
Imagem webp/jpeg/png < 3 MB, vídeo mp4/webm/mov < 60 MB; só o dono cria e
apaga; conta logada lê.

### Correções em regras existentes (F0)
`coach_students`: o id tem de ser `{coach_id}_{student_id}`; o aluno só aceita
o convite (`invited → active`) ou encerra o vínculo (`→ ended`); com `ended_at`
o professor só convida de novo e não apaga. As mensagens de uma dúvida exigem
vínculo ativo. `coach_content`: "só alunos" exige vínculo
ATIVO. Campos novos, opcionais: `coach_students.ended_by` e `ended_reason`.

## Mercado (flag `marketplace`, default OFF)

Dez coleções NOVAS `market_*` e um documento de configuração
(`platform_settings/marketplace`, legível por todos, escrito pelo admin). Tudo
aditivo; **zero índice composto**. Regras no bloco "MERCADO" do
`firestore.rules` (escrita de catálogo só com a flag ligada), provadas em
`tests/rules/marketplace.rules.test.js`. Módulo: `src/modules/marketplace/README.md`.

- `market_sellers/{key}` — a ficha pública de quem vende. `key` =
  `athlete_{uid}` | `coach_{uid}` | `arena_{arenaId}` | `store_{uid}`.
  `seller_type`, `entity_id`, `owner_uid`, `status`
  (`active|pending|rejected|suspended`; loja nasce `pending`), `display_name`,
  `slug`, `bio`, `city`, `state`, `logo_url`, `banner_url`, `website`,
  `cnpj_masked`, `policies { return_days, ship_within_hours }`. Só o servidor
  ou o admin: `verified`, `rating_avg`, `rating_count`, `sales_count`,
  `reviewed_by`, `reviewed_at`, `reject_reason`.
  - `private/data` — Pix (`pix_key_type`, `pix_key`, `receiver_name`,
    `instructions`) e, da loja, `legal_name`, `cnpj`, `phone`. Só quem opera o
    vendedor e o admin.
- `market_listings/{id}` — o anúncio: `seller_key`, `seller_name`,
  `seller_type`, `created_by`, `status`
  (`draft|active|paused|sold_out|closed|removed`), `title`, `description`,
  `category_slug`, `category_path[]`, `type` (`new|used`), `condition`,
  `brand`, `attributes`, `price_cents`, `compare_at_cents`, `quantity`,
  `accepts_offers`, `fulfillment[]` (`pickup|meetup|shipping`),
  `shipping_cents`, `shipping_to_agree`, `pickup_note`, `media[]` (≤ 11; cada item pode ter `aspect`, `frame { rotate, zoom, x, y }` e `ai_generated`, todos opcionais),
  `video_link`, `city`, `state`, `search_terms[]`, `published_at`. Só o
  servidor ou o admin: `moderation`, `quantity_sold`, `favorite_count`,
  `seller_rating_avg`, `seller_rating_count`, `seller_verified`, `source`,
  `price_alert_cents` (o menor preço já avisado a quem favoritou).
- `market_questions/{id}` — pergunta pública e resposta (`listing_id`,
  `seller_key`, `asker_uid`, `asker_name`, `text`, `status`
  `open|answered|hidden`, `answer`, `answered_by`).
- `market_favorites/{uid}_{listingId}`, `market_saved_searches/{id}` (`uid`,
  `label`, `params`, `notify`, `last_seen_ms`; o servidor grava `last_alert_ms`
  no aviso diário de novidade), `market_carts/{uid}` (`items[]`, `saved[]`,
  ≤ 50) — só do dono.
- Escritos SÓ pelo servidor: `market_orders/{id}` (`code`, `status`, comprador,
  vendedor, `seller_manager_uids`, `items[]` com a foto e o preço do momento,
  `fulfillment`, totais, `payment` (Pix copiado no aceite), `tracking`,
  prazos `deadline_at_ms`; + `events/{id}` e `private/shipping`, que o
  vendedor só lê com `shipping_visible`), `market_offers/{id}` (rodadas e
  `history[]`), `market_reviews/{orderId}_{buyer|seller}` (cega até
  `visible`), `market_disputes/{orderId}`.
- `market_reports/{listingId}_{uid}`: denúncia de anúncio (`reason` em
  `REPORT_REASON_LABELS`, `text` ≤ 500, `status: open|resolved`, `outcome`).
  Quem denuncia cria e lê a própria; só o admin lista e decide. Na exclusão
  de conta fica (como a denúncia do treino).
- `market_coupons/{seller_key}_{CODE}`: cupom do vendedor (`kind` percent |
  fixed | free_shipping, `value`, mínimo, validade, limite total e por pessoa,
  só para quem nunca comprou, anúncios escolhidos, `public` para divulgar no
  perfil e no anúncio). O vendedor cria e edita; código e `uses_count` são
  imutáveis no cliente. O uso é do SERVIDOR (no pedido, devolvido no
  cancelamento), em `market_coupon_uses/{uid}`.
- `market_gift_cards/{id}`: vale-presente de uma loja, escrito SÓ pelo
  servidor (`marketGiftCardAction`): comprado num pedido `source: 'gift_card'`
  (`fulfillment: 'digital'`) e criado quando o vendedor confirma o pagamento,
  ou emitido pelo vendedor; resgatado pelo código (`holder_uid`), abatido no
  pedido e devolvido no cancelamento. Legível por comprador, titular e loja.
  `expiry_reminded_at_ms` (opcional): a rotina já avisou que o vale com saldo
  vence em até 30 dias (a quem está com ele, ou a quem comprou se ninguém
  resgatou) — avisa uma vez só.
  O pedido ganha `discount_cents`, `shipping_discount_cents`, `gift_card_cents`,
  `coupon{…}` e `gift_cards[]`; o item pode ter `pickup_note`.
- Storage: `mercado/{uid}/{arquivo}` (foto < 3 MB, vídeo < 60 MB, PDF < 3 MB;
  o comprovante `comprovante-*` não pode ser apagado pelo dono).

Na exclusão de conta: carrinho, favoritos, buscas, Pix, endereços e os cupons
da ficha pessoal somem; os vales ficam sem nome e mensagem (o saldo segue);
pedidos, ofertas, perguntas e avaliações ficam sem o nome; a ficha pessoal
fica "Vendedor removido", suspensa, com os anúncios encerrados; pedido em
andamento impede a exclusão.

## Federações (flag `federations`, default OFF) — `docs/50-FEDERACAO.md`

Dezenove coleções com prefixo `federation`, **zero índice composto** (uma ou
duas igualdades por consulta, ordenação em memória); os únicos campos novos em
coleção existente são os dois opcionais de `tournaments` (abaixo). Regras no
bloco "FEDERAÇÕES" do `firestore.rules` (`fedOn()` lê a flag em
`platform_settings/global`; `fedHas(fedId, perm)` lê o papel em
`federation_staff/{fedId}_{uid}` (a cópia `perms`; mandato vencido não conta, salvo admin master) ou o acesso justificado do admin da plataforma (`fedPlat`); `fedModuleOn(fedId, m)` lê o sub-módulo;
`fedMemberOwner(data)` = `user_id` **ou** `guardian_uid` da filiação, PR 3),
provadas em `tests/rules/federation.rules.test.js`, `federationPr2.rules.test.js`,
`federationPr3.rules.test.js`, `federationPr4.rules.test.js` e
`federationRevisao.rules.test.js`. **Storage**: `federacao/{uid}/{arquivo}` —
só o dono lê, lista e apaga; cria imagem (webp/jpeg/png) ou PDF < 5 MB, sem
sobrescrever (`storage.rules`).

### `federations/{id}` (NOVO)
Público quando `status == 'approved'` **e** `published == true` (`fedPublic()`);
fora disso só quem pediu, a equipe, o filiado ativo e o admin (`fedSees()` vale
o mesmo para as coleções filhas). `published` (opcional, booleano, ausente =
oculta; só a permissão `admin` grava e só com a federação aprovada; o pedido
não nasce com ele) + `published_at`/`published_by` e
`unpublished_at`/`unpublished_by` — `docs/50-FEDERACAO.md` §17. O diretório
consulta `status` + `published` (duas igualdades, sem índice).
`name`, `acronym`, `slug` (único, `[a-z0-9-]`, a página `/f/:slug`), `level`
(`state|regional|national`), `state`, `city`, `about`, `site`, `instagram`,
`contact_public { email, phone }`, `branding { color, logo_url }`,
`payment { pix_key_type, pix_key, receiver_name, instructions }`,
`modules { [FED_MODULE]: boolean }`, `rules { ask_cpf, transfer_release_days,
transfer_cooldown_days, member_declarations }` (PR 3, opcional; a equipe
`admin` grava; `member_declarations` — PR 6, ausente ⇒ sim — diz se o
filiado emite a própria declaração de vínculo; `convocation_min_days` — PR 9b,
ausente ⇒ 8, 0–365 — o prazo mínimo de convocação do estatuto, que só avisa), `status`
(`pending|approved|rejected|suspended`), `verified`, `official`,
`member_count`, `member_counter` (sequência do número de filiado),
`cnpj_masked`, `review { action, reason, by, at_ms }`, `created_by`,
`created_by_name`, `created_at`, `updated_at`. Campos travados para a equipe
(`fedLocked()`): status, selos, contadores, `review`, `cnpj_masked`,
`created_*` — só o admin da plataforma ou o servidor.
- `private/data`: `cnpj`, `legal_name`, `phone`, `notes` — quem pediu
  (enquanto pendente), a equipe com `admin`, o admin da plataforma.

### `federation_staff/{fedId}_{uid}` (NOVO)
`federation_id`, `user_id`, `user_name`, `role` (id do cargo; os de modelo:
`president|director|secretary|treasurer|competitions|referees|discipline|communication`),
`added_by`, `created_at`. PR 7 (opcionais): `role_id`, `role_name`, `perms[]`
(cópia das permissões do cargo — é o que a regra lê), `is_master`,
`term_start`, `term_end` (`''` = sem fim), `term_end_ms` (0 = sem fim),
`term_history[]` (até 20), `term_warned[]`, `term_held_notified`. Leem: a
equipe que atende e a própria pessoa. **Só o servidor grava**
(`federationStaff`, `write: if false`).

### `federations.staff_roles` (PR 7, campo opcional, `fedLocked()`)
Até 30 `{ id, name, description, perms[], is_master, term_months }`. Ausente,
valem os 8 cargos de modelo. Só o servidor grava (ação `role_save` de admin master).

### `federation_admin_grants/{fedId}_{adminUid}` (PR 7, NOVO)
Acesso justificado do admin da plataforma a uma Central: `federation_id`,
`federation_name`, `admin_uid`, `admin_email`, `reason_category`,
`reason_text`, `ticket_ref`, `hours`, `granted_at_ms`, `expires_ms`, `log_id`
(o registro em `admin_access_logs`, `action: 'federation_access'`). Só o admin
da plataforma lê; ninguém grava pelo cliente (`federationAdminAccess`).

### `federation_docs/{id}` (PR 8, NOVO — acervo oficial)
Ato oficial da federação (estatuto, resolução, ata, súmula, avaliação de
arena, vídeo…; catálogo em `domain/acervo.js`). `federation_id`, `type`,
`category` (derivada do tipo), `title`, `summary`, `body`, `act_date`
(`AAAA-MM-DD`), `signed_by`, `tags[]`, `visibility`
(`public|members|staff`), `relations[]` (`{ kind:
revokes|amends|errata|regulates|refers, doc_id }`), `media_links[]` (`{ url,
title }`, só YouTube/Vimeo), `files[]` (`{ name, path, size, content_type,
sha256, url? }` — `url` só enquanto público), `status`
(`draft|published|withdrawn`), `version`, `created_by`, `created_by_name`,
`created_at(_ms)`, `updated_at(_ms)`, `updated_by`. Ao publicar: `number`
(por tipo e ano, só nos numerados), `year`, `code` ("Resolução nº 3/2026"),
`published_at(_ms)`, `published_by(_name)`, `versions[]` (até 10: versões
anteriores com `title`, `summary`, `body`, `files`, `media_links`,
`version_reason`, `version_at_ms`), `version_reason`, `version_at_ms`.
Recebidos de outros atos: `related_by[]` (até 50) e `revoked_by`. Retirado:
`withdrawn_reason`, `withdrawn_at_ms`, `withdrawn_by`. Leitura: publicado
público por todos (até sem conta); só filiados por filiado ativo e equipe; só
equipe por qualquer cargo; rascunho e retirado por `docs`/`admin`. **Só o
servidor grava** (`federationAcervo`, `write: if false`). Zero índice (a lista
pública usa três igualdades).

### `federation_followers/{fed}_{uid}` (PR 8b, NOVO — quem segue o acervo e o calendário)
`federation_id`, `user_id`, `created_at` (= `request.time`). Só a própria
pessoa lê, cria (com o acervo **ou** o calendário da federação ligado) e
apaga; o `get` do documento ainda inexistente é permitido (é como o botão
"Seguir" sabe). O servidor lê para avisar de ato publicado ou retificado e de
evento marcado, remarcado, adiado ou cancelado (só quem pode ler o ato ou o
evento). Sai na exclusão de conta e vai na exportação. Zero índice (uma
igualdade).

### `federation_invites/{fed}_{uid}` (2026-10-22, NOVO — convite para filiar)
`federation_id`, `federation_name`, `federation_acronym`, `user_id`,
`user_name`, `photo_url`, `plan_id`, `plan_name`, `note` (≤ 300), `status`
(`pending` | `accepted` | `declined` | `cancelled`, gravados), `invited_by`,
`created_at_ms`, `expires_at_ms` (+30 dias), `decided_by`, `decided_at_ms`,
`member_id` (aceito), `updated_at`. Lê a pessoa convidada e quem tem
`members`/`admin` na federação; **só o servidor grava** (`federationMembership`:
`invite`, `invite_cancel`, `invite_decline`; `write: if false`). O convite não
cria filiação: o pedido no plano do convite entra sem aprovação e marca a
filiação com `invited: true` (campo opcional novo em `federation_members`).
Convite da importação (opcionais): `source: 'import'`, `import_id`,
`member_number`, `valid_until` (+90 dias) — aceito, a filiação entra ativa sem
cobrança, com `imported: true`.
Sai na exclusão de conta (apagado) e vai na exportação. Zero índice (uma
igualdade; ordenação em memória).

### `federation_events/{id}` (PR 9a, NOVO — calendário oficial)
`federation_id`, `kind` (14 tipos, gravados: `competition`, `selection`,
`course`, `sport_other`, `assembly_ordinary`, `assembly_extraordinary`,
`assembly_special`, `board`, `fiscal_council`, `committee`, `deadline`,
`office`, `ceremony`, `event`), `group` (`sport` | `institutional` | `event`),
`title`, `description`, `date`/`end_date` (ISO, horário de Brasília),
`all_day`, `start_time`/`end_time` (`HH:MM`), `starts_at_ms`/`ends_at_ms`
(calculados pela validação), `place` `{ name, address, city, state }`,
`online_url` (`https://`), `organ`, `visibility` (`public` | `members` |
`staff`), `related_docs[]` `{ doc_id, code, title, type, visibility }` (até 10
atos **publicados** do acervo, copiados pelo servidor), `status`
(`scheduled` | `postponed` | `cancelled`), `status_reason`, `history[]` (até
20: `kind` `rescheduled|reopened|postponed|cancelled`, `reason`, `at_ms`,
`by_name`, `from_date`, `from_time`, `to_date`, `to_time`), `ever_visible`
(algum dia foi público ou só filiados — o que proíbe apagar e exige motivo ao
remarcar), `meeting` (PR 9b, opcional, só nos tipos de reunião:
`{ convened_on, convened_at_ms, edital { doc_id, code, title, type,
visibility } | null, quorum_first, second_call_time, quorum_second, items[]
{ id 'p1'…, title, description, kind deliberation|election|information },
record }`; `record` = `{ call first|second, opened_at, quorum_reached,
present, eligible, notes, items[] { id, result
approved|rejected|elected|informed|postponed|withdrawn, votes { yes, no,
abstain } | null, summary, doc }, minutes, attendance, votes (documentos),
recorded_at_ms, recorded_by_name, updated_at_ms }`; o histórico ganha
`agenda_changed` e `record_corrected`), `created_by`, `created_by_name`, `created_at(_ms)`,
`updated_at(_ms)`, `updated_by`. Leitura: público para todos; `members` para
filiado ativo e equipe; `staff` para qualquer cargo; admin da plataforma com
acesso justificado. **Só o servidor grava** (`federationAgenda`,
`write: if false`). Zero índice (a tela consulta `federation_id` +
`visibility`). Na exclusão de conta fica (é da federação; só `created_by`);
fora da exportação. Os torneios chancelados entram na agenda **derivados**,
nada gravado. PR 10: campo opcional `comments` `{ mode open|closed|consultation,
until_date, until_ms, updated_at_ms, updated_by }` (ausente ⇒ aberto) — vale
também em `federation_docs`; só o servidor grava.

### `federation_budgets/{fed}_{ano}`, `federation_ledger/{id}`, `federation_account_reports/{fed}_{período}` (NOVAS — orçamento e prestação de contas, módulo `accounts`)
Orçamento: `federation_id`, `year`, `lines` (centavos por `income.<cat>`/`expense.<cat>`, categorias fixas em `domain/accounts.js`), `notes`, `status` (`draft`|`submitted`|`approved`|`published`), `approved_in { date, event_id, event_title, event_date, note }`, `history[]` (até 30: `kind`, `at_ms`, `by_name`, `reason`, `previous_lines`…), `published { lines, notes, approved_in, at_ms }` — o documento de trabalho nunca leva `pub`; o público lê a cópia `{fed}_{ano}_pub` (`pub: true`, `copy_of`, `year`, `published`), `created_by(_name)`, `created_at(_ms)`, `updated_by`, `updated_at_ms`. Lançamento: `federation_id`, `kind` (`income`|`expense`), `category`, `date`, `amount_cents`, `description`, `counterparty`, `document { name, path, size, content_type, sha256 } | null` (pasta `federacao-contas-oficial/`), `status` (`posted`|`void`), `void_reason`, `voided_by(_name)`, `voided_at_ms`, `created_by(_name)`, `created_at(_ms)`; o importado do extrato bancário leva também `source: 'bank'`, `bank_ref` (FITID do OFX ou a assinatura da linha do CSV, ≤ 160) e `import_batch`, e tem id `{fed}_bk_{sha256(bank_ref)[0..24]}` — importar o mesmo extrato de novo não duplica. Prestação: `federation_id`, `period` (`2026`|`2026-Q1`), `status` (`draft`|`submitted`|`opinion`|`approved`|`rejected`|`published`), `statements[]` (`kind` balance_sheet|income_statement|cash_flow|notes|other + arquivo), `notes`, `snapshot` (congelado no envio: `from`, `to`, `income{}`, `expense{}`, totais, `entries`, `auto_entries`, `budget_lines`, `frozen_at_ms`), `fiscal_opinion { verdict approve|approve_with_reservations|reject, text, by, by_name, at_ms, by_admin }`, `assembly { date, result approved|rejected, event_*, note, by_name, at_ms }`, `acervo { statements_doc_id, statements_code, opinion_doc_id } | null`, `pub`, `history[]`, `opened_by(_name)`, `opened_at_ms`, `submitted_*`, `published_*`. Leitura: `finance`/`fiscal`/`admin`; o publicado (`pub == true`) por quem vê a federação, com o módulo ligado; o lançamento nunca é público. **Só o servidor grava** (`federationAccounts`). Zero índice (`federation_id`, e `pub == true` para o público). Na exclusão de conta ficam (são da federação; só `created_by`/`opened_by`); fora da exportação. Campo novo opcional em `federations.governance.board[]`: `pay_cents` (0 = não remunerado) e `pay_note`.

### `federation_comments/{id}` (PR 10, NOVO — comentários no acervo e na agenda)
`federation_id`, `target_kind` (`doc` | `event`), `target_id`, `target_key`
(`{kind}_{id}`), `target_title`, `user_id`, `user_name` (copiado do cadastro),
`org_name` (na resposta oficial), `text` (3–1.000), `official`, `parent_id`
(resposta oficial a um comentário), `status` (`visible` | `hidden`),
`reports_count`, `hidden_by` (`reports` | `staff`), `hidden_reason`,
`hidden_at_ms`, `moderated_by`, `restored_at_ms`, `created_at_ms`. Leitura:
**só o autor** (a exportação); a página lista pela função
`federationCommentsList`, que confere a leitura do alvo e não entrega uid.
**Só o servidor grava** (`federationComments`). Zero índice. Na exclusão de
conta sai (por `user_id`); na exportação entra.

### `federation_comment_reports/{comentário}_{uid}` (PR 10, NOVO)
`federation_id`, `comment_id`, `reporter_id`, `reason` (`offensive` |
`personal_data` | `spam` | `off_topic` | `other`), `created_at_ms`. Ninguém
lê nem grava pelo navegador. Na exclusão de conta sai (por `reporter_id`);
fora da exportação (é sobre o comentário de outra pessoa). `federations.rules`
ganha `comments` (opcional; `false` desliga os comentários da federação).

### `federation_referees/{fedId}_{uid}` (NOVO — quadro de arbitragem, `docs/50` §22)
`federation_id`, `federation_acronym`, `federation_name`, `user_id`, `name`,
`photo_url`, `city`, `state` (copiados do cadastro), `level` (id de
`federations.referee_rules.levels`, gravado), `functions[]` (`referee` |
`head_referee` | `line_judge` | `technical_delegate` |
`tournament_director`), `status` (`active` | `inactive` | `suspended`),
`credential_ids[]` (credenciais de árbitro dos cursos), `since` (ISO),
`public_listing` (padrão `false`), `unavailable[]` (ISO, até 60 — dias em
que não pode), `stats` `{ acts, no_show, evaluations, avg }`, `added_by`,
`created_at_ms`, `updated_at_ms`. Subcoleção `private/staff` `{ notes }`
(só a equipe lê). Leitura: o próprio árbitro e a equipe com
`courses`/`admin`; **só o servidor grava** (`federationReferees`). Zero
índice. Exclusão de conta: sai (com `private/staff`); exportação: entra.

### `federation_assignments/{id}` (NOVO — escala de arbitragem)
`federation_id`, `federation_acronym`, `federation_name`, `event` `{ kind
tournament|agenda, id, name, date, end_date, city, public }` (copiado),
`event_key` (`{kind}_{id}`), `function`, `referee_uid`, `referee_name`,
`referee_level`, `status` (`invited` | `confirmed` | `declined` |
`replaced` | `done` | `no_show` | `cancelled`), `respond_by` (ISO),
`fee_cents`, `travel_cents`, `warnings[]` (`unavailable` | `same_day` |
`athlete` | `level_below`), `conflict` `{ declared, reason }` | null,
`decline_reason`, `report` `{ text, at_ms, first_at_ms }` | null, `evaluation` `{ scores
{ rules, positioning, communication, punctuality, presentation }, avg,
comment, at_ms, by, by_name }` | null, `paid_at_ms`, `paid_by`, `replaces`,
`replaced_by`, `reminded`, `created_by`, `created_at_ms`, `updated_at_ms`.
Leitura: o árbitro (`referee_uid`) e a equipe com `courses`/`admin`; **só o
servidor grava**. Zero índice. Exclusão de conta: fica pseudonimizada
("Atleta removido", sem conflito nem motivo; a aberta é cancelada) —
histórico do evento e despesa da federação; exportação: entra.

### `federations.referee_rules` (campo opcional, só o servidor grava)
`{ levels[] { id, label } (até 8; ausente ⇒ Trainee, Nível 1, Nível 2,
Certificado), min_level_by_function { [função]: id }, needs { [função]: n },
fee_default_cents { [função]: centavos }, respond_days (1–30, padrão 3),
crew_visible (padrão false) }`. Gravado pela ação `rules` de
`federationReferees` (`fedLocked()`).

### `federations.doc_numbers` (PR 8, campo opcional, `fedLocked()`)
Contador da numeração: `{ "<tipo>_<ano>": n }`. Só o servidor grava, numa
transação ao publicar.

**Storage do acervo** (PR 8): `federacao-acervo/{uid}/{id}.{ext}` — rascunho,
só o dono lê e escreve, tipos e tetos do catálogo, sem sobrescrever;
`federacao-acervo-oficial/{fed}/{doc}/v{n}/{i}.{ext}` — fechada à regra
(cópia feita pelo servidor; o público baixa pelo link com token).

### `federation_plans/{id}` (NOVO, público)
`federation_id`, `name`, `description`, `benefits` (texto, um por linha), `person_type`
(`athlete|coach|referee`), `tier` (`registered|federated`), `billing`
(`monthly|annual`), `validity` (`rolling|calendar`), `rollover_mmdd`,
`calendar_grace_days` (padrão 60), `price_cents` (0 = gratuito, teto
100.000.000), `age_min`, `age_max`, `discounts { minor_pct, senior_pct,
family_pct, family_from }`, `requires_docs[]` (PR 3:
`identidade|atestado|comprovante_residencia|autorizacao_responsavel|outro`),
`other_docs[] { id, label }` (opcional, até 5: o nome de cada "outro
documento"; com ele o `requires_docs` leva `outro`), `auto_approve`, `active`, `sort`, `updated_by`.
Cria/edita `admin` ou `finance`; apaga só o admin da plataforma (desativa).
Etapa 2 (2026-10-22): `person_type` é um código do catálogo da plataforma
(`[a-z][a-z0-9_]{1,23}`: os prontos `athlete|coach|referee|club|arena` ou um tipo
do admin) e o plano grava o tipo resolvido em `entity` (`person|club|arena`),
`person_category` (`athlete|coach|referee|none|club|arena`) e
`person_type_label` (todos opcionais; ausentes = atleta/pessoa). Plano de clube
ou arena não tem idade nem descontos e só pede `outro` com nome.

### `platform_settings/federations` (Etapa 2, 2026-10-22)
`member_types[] { id, label, description, active, entity, category }` — o
catálogo de tipos de filiação (até 30). Ausente ⇒ os cinco prontos. Lê
qualquer pessoa, grava só o admin da plataforma (regra de `platform_settings`).

### `federation_members/{fedId}_{uid}` (NOVO, **nunca público**)
Só o servidor cria e muda o estado (`federationMembership`). `federation_id`,
`federation_name`, `federation_acronym`, `user_id` (**nulo** no dependente),
`guardian_uid`/`guardian_name` (PR 3: o responsável; id do dependente
`{fedId}_dep_{id}`), `user_name`, `photo_url`,
`person_type`, `tier`, `plan_id`, `plan_name`, `billing`, `status`
(`pending|awaiting_payment|active|expired|suspended|cancelled|rejected`),
`member_number` (`SIGLA-ANO-000001`, fixo depois de emitido), `card_code`
(10 caracteres, gira a cada ativação/renovação/suspensão), `valid_from`,
`valid_until` (`YYYY-MM-DD`), `activated_at_ms`, `expiry_notified { 30, 7, 1 }`,
`public_badge`, `show_in_directory`, `public_photo`, `represented_club_id`,
`note`, `reject_reason`, `suspended_reason`, `requested_at`, `updated_at`;
PR 3: `discipline_until_ms`/`discipline_sanction_id` (suspensão em vigor —
lidos por `tournamentMembershipOk`), `excluded_by_sanction_id`,
`status_before_exclusion`, `minor_photo_consent`. O dono (`fedMemberOwner`:
o próprio ou o responsável) só muda `public_badge`, `show_in_directory`,
`public_photo`, `minor_photo_consent`, `prefs_updated_at`. Leem: o dono, a
equipe com `admin`/`members`/`finance`, o admin.
Etapa 2 (2026-10-22, opcionais): `person_type_label`, `person_category`; e a
filiação de CLUBE/ARENA por plano, id `{fedId}_{club|arena}_{orgId}`, com
`user_id` nulo, `org_kind`, `org_id`, `org_name`, `org_city`, `org_state`,
`org_logo`, `representative_uid`, `representative_name`,
`representatives[] { uid, name, role }` e `affiliated_since_ms`. O dono
(`fedMemberOwner`) inclui quem gere a entidade (`fedOrgManager`), que também
lista por `org_kind` + `org_id`.
- `private/data` (PR 3): `cpf` (só dígitos, ≤ 11, só se
  `federations.rules.ask_cpf`), `birth_date`, `guardian_name`,
  `guardian_contact`, `guardian_consent` — **só o servidor grava** (pedido de
  filiação, dependente, importação); leem o dono, `members`, `admin` e o admin da
  plataforma. Entra na exportação de dados (`listMyMembersPrivate`). Na Central o CPF aparece mascarado; revelar grava `audit_logs`
  (`federation_member_private_reveal`).

### `federation_charges/{id}` (NOVO)
Só o servidor cria, confirma e cancela. `federation_id`, `member_id`,
`payer_uid` (a pessoa ou o responsável do dependente), `payer_name`, `origin`
(`membership|renewal|course|fine`), `plan_id`, `plan_name`, `course_id`/
`enrollment_id` ou `sanction_id` (PR 3), `amount_cents`, `status`
(`open|declared|paid|cancelled`),
`due_date` (hoje + 10), `declared_at`, `declared_note` (≤ 300), `paid_at_ms`,
`confirmed_by`, `confirm_note`, `created_at`, `created_at_ms`,
`overdue_notified` (opcional, marcos `[0, 7]` do lembrete de vencida já
enviados — só o servidor). A única escrita
do pagador: `open|declared` → `declared` com `declared_at`/`declared_note`.

### `federation_card_index/{code}` (NOVO)
`{ member_id, federation_id, created_at_ms }` ou, para credencial de curso
(PR 3), `{ kind: 'credential', credential_id, federation_id, created_at_ms }`.
`allow read, write: if false`: só o servidor (a verificação pública é a função
`federationVerify`, que responde pelos dois).

### `federation_affiliations/{fedId}_{kind}_{orgId}` (PR 2)
Clube (`kind: 'club'`) ou arena (`kind: 'arena'`) filiado à federação.
Etapa 2 (2026-10-22): quando a entidade se filia por PLANO, este documento é o
ESPELHO da filiação, gravado só pelo servidor, com `member_id`, `plan_id`,
`plan_name`, `member_number`, `valid_until` (ativa ⇒ `approved`; vencida ou
suspensa ⇒ `suspended`; cancelada ⇒ sai). Com `member_id` a regra recusa
decidir ou apagar pelo navegador.
`federation_id`, `federation_name`, `federation_acronym`, `kind`, `org_id`,
`org_name`, `org_city`, `org_state`, `org_logo` (copiados — a página da
federação não lê `clubs`/`arenas`), `status`
(`pending|invited|approved|rejected|suspended`), `message` (≤ 500), `requested_by`,
`review { by, at_ms, reason }`, `created_at`, `updated_at`; no convite da
federação (2026-10-22, opcionais): `invited_by`, `invited_at`, `accepted_at_ms`.
Leitura: aprovada é pública; o resto só quem pediu, quem gere a organização
(`fedOrgManager`), a equipe `admin`/`members` e o admin. Criação: quem gere a
organização, só `pending` com `requested_by` = si; **ou** a equipe
`admin`/`members` de federação pública, só `invited` com `invited_by` = si e
`requested_by` nulo — sempre com a flag e o módulo `affiliations` ligados
(`fedModuleOn`). Atualização: equipe `admin`/`members`, só
`status`/`review`/`updated_at` e nunca num convite; quem gere a organização
aceita o convite (`invited` → `approved`, `requested_by` = si, só
`status`/`requested_by`/`accepted_at_ms`/`updated_at`). Apagar: quem gere a
organização, equipe `admin` ou admin; equipe `members` só convite ou recusado.

### `federation_results/{fedId}_{tournamentId}_{modalityId}` (PR 2, público)
A colocação de uma categoria de torneio chancelado, enviada pelo organizador.
`federation_id`, `federation_acronym`, `tournament_id`, `tournament_name`,
`modality_id`, `modality_name`, `gender_category`, `age_category`, `format`,
`tier`, `date` (ISO), `season` (ano), `rows[] { uid, name, photo_url, position,
played, won }` (≤ 400, uma por pessoa), `uids[]`, `status` (`sent|rejected`),
`sent_by`, `sent_at`, `review { by, at_ms, reason }`. Criação/reenvio: admin do
torneio com a chancela desta federação aprovada (`fedSanctionedBy`). Revisão:
equipe `competitions`, só `status`/`review`/`updated_at`. Apagar: admin do
torneio, equipe `admin` ou admin da plataforma. **Tudo isso só com a temporada
aberta** (`fedSeasonOpen(season)`: até 01/02 do ano seguinte, 00:00 de
Brasília; `season` inteiro e imutável no reenvio).

### `federation_points/{resultId}_{uid}` (2026-10-22, público, `write: if false`)
O LANÇAMENTO de pontos de um atleta num torneio chancelado — o histórico dele.
Gravado pelo servidor (`federationRankingRecompute` → `onResultWritten`,
`functions/federationRanking.js`). `federation_id`, `result_id`,
`tournament_id`, `tournament_name`, `modality_id`, `modality_name`, `date`,
`season`, `category`, `gender_category`, `age_category`, `format`, `tier`,
`uid`, `name`, `photo_url`, `position`, `played`, `base_points`,
`multiplier`, `points`, `status` (`awarded|cancelled`), `cancel_reason`
(`result_rejected|result_deleted|not_in_result|account_deleted`),
`awarded_at_ms`, `revised_at_ms`, `previous { position, points }`,
`cancelled_at_ms`, `updated_at_ms`. Os pontos ficam como foram lançados: mudar
a tabela ou a filiação depois não os reescreve. Consultas de uma igualdade
(`uid`, `result_id`) ou duas (`federation_id` + `season`), sem índice.

### `federation_rankings/{fedId}_{season}` (PR 2, público, `write: if false`)
A soma do ANO, derivada pelo servidor dos lançamentos `awarded` daquela
temporada (`federationRankingRecompute`/`federationRankingConfig`).
`federation_id`, `season`, `results_count`, `entries_count`, `config` (a tabela
usada), `categories[] { key, gender_category, age_category, format, rows[] }`,
`general[]`, `uids[]` (quem aparece — a exclusão de conta acha o ano por
aqui), `closes_at_ms`, `last_day`, `updated_at_ms`; cada linha `{ uid, name,
photo_url, points, events, titles, position, results[] (≤ 12, cada um com
`entry_id` e `counts`) }`. Ano fechado (a partir de `closes_at_ms`) não é
regravado.

### `federations/{id}.ranking_config` (PR 2, opcional)
`{ points_by_place { 1..8 }, participation, best_n, tier_multipliers
{ regional, state, major }, members_only }`; ausente valem
`DEFAULT_RANKING_CONFIG`. A equipe `competitions` grava só esta chave (cláusula
própria na regra do documento).

### `tournaments/{id}.federation_id` + `.federation_sanction` (PR 2, opcionais)
`federation_id` (string ou `null`) e `federation_sanction { status
(pending|approved|rejected|revoked), federation_name, federation_acronym, tier
(regional|state|major), requires_membership, requested_by, requested_at_ms,
decided_by, decided_at_ms, reason }`. O organizador só grava `pending` (flag e
módulo `tournaments` ligados; `tournamentFederationOk()`) ou apaga os dois
(pendente); a equipe `competitions` decide só em `federation_sanction`. Com
`approved` + `requires_membership`, a **auto-inscrição** em
`tournament_registrations` exige `federation_members/{fed}_{uid}.status ==
'active'` (`tournamentMembershipOk`). Ver `docs/50-FEDERACAO.md` §6.2.

### `federation_documents_submitted/{id}` (PR 3)
Registro de um documento enviado pelo filiado. `federation_id`, `member_id`,
`user_id`, `kind` (os de `requires_docs`), `doc_key` (opcional: o `id` do
`other_docs` quando o documento é um dos próprios do plano) e `label`
(opcional, ≤ 80, o nome dele), `storage_path`
(`federacao/{uid}/{arquivo}.{ext}`, conferido na regra), `file_name`,
`content_type`, `size`, `status` (`pending|approved|rejected`), `review { by,
at_ms, reason }`,
`created_at`, `updated_at`. Cria o dono da filiação (`fedMemberOwner`), só
`pending`; a equipe `members`/`admin` só muda `status`/`review`/`updated_at`;
apaga o dono (pendente), `admin` ou o admin da plataforma. Leem: o dono, a
equipe `members`/`admin`, o admin. Etapa 2: o documento de clube/arena leva
`org_kind`/`org_id` (iguais aos da filiação, a regra confere) e todos os
gestores da entidade o leem.

### `federation_transfers/{id}` (PR 3, só o servidor — `federationTransfer`)
`federation_id`, `member_id`, `user_id`, `guardian_uid`, `user_name`, `kind`
(`club|federation`), `to_club_id`/`to_club_name` ou `to_federation_id`/
`to_federation_name`, `reason`, `status` (`pending|approved|rejected|cancelled`),
`requested_at`, `requested_at_ms`, `deadline` (ISO; só na troca de
federação), `decided_by`, `decided_at_ms`, `auto_released` (liberada pela
varredura), `updated_at_ms`. Leem: o dono, a equipe
`members`/`admin` da federação atual e da de destino, o admin.

### `federation_imports/{id}` (PR 3, só o servidor — `federationImportMembers`)
`federation_id`, `plan_id`, `plan_name`, `by`, `created_at_ms`, `total_rows`,
`imported_count`, `skipped[]`, `pending[]` (nome, e-mail, número e validade de
quem **não tem conta** — só a equipe `members`/`admin` lê); desde 2026-10-22
(opcionais) `pending_emails[]` (os e-mails ainda sem conta, para o gatilho
`federationImportInvite` achar por `array-contains`) e `invited_emails[]`
(quem já recebeu o convite ao criar a conta).

### `federation_courses/{id}` (PR 3; público quando não é `draft`)
`federation_id`, `federation_acronym`, `name` (3–120), `description`, `kind`
(`referee|coach|clinic|workshop`), `level`, `status`
(`draft|open|closed|done|cancelled`), `starts_at`, `ends_at`, `location`,
`seats`, `price_cents` (≥ 0), `member_price_cents`, `requires_membership`,
`issues_credential`, `credential_months`, `hours`, `enrolled_count` (**só o
servidor**), `created_by`, `created_at`, `updated_at`. A equipe `courses`/
`admin` cria e edita pelo cliente (módulo `courses` ligado; `federation_id` e
`enrolled_count` intocáveis); apaga `admin` sem inscritos ou o admin da
plataforma.

### `federation_course_enrollments/{courseId}_{uid}` (PR 3, só o servidor — `federationCourse`)
`federation_id`, `course_id`, `course_name`, `user_id`, `user_name`,
`photo_url`, `is_member`, `price_cents`, `status`
(`awaiting_payment|confirmed|passed|failed|cancelled`), `charge_id`,
`credential_id`, `created_at_ms`, `updated_at_ms`. Leem: a própria pessoa, a
equipe `courses`/`finance`/`admin`, o admin.

### `federation_credentials/{courseId}_{uid}` (PR 3, só o servidor emite)
`federation_id`, `federation_acronym`, `user_id`, `user_name`, `photo_url`,
`kind`, `level`, `course_id`, `course_name`, `hours`, `issued_at`,
`valid_until` ('' = sem validade), `status` (`active|expired|revoked`),
`public` (nasce `false`), `public_photo`, `code` (no `federation_card_index`),
`issued_by`, `review`, `created_at_ms`, `updated_at_ms`. Leitura: pública
quando `public && status == 'active'`; senão a pessoa, a equipe
`courses`/`admin`, o admin. A pessoa muda só `public`/`public_photo`/
`prefs_updated_at`; a equipe só `status` (`active|revoked`)/`review`/`updated_at`.

### `federation_sanctions/{id}` (PR 3, só o servidor — `federationDiscipline`)
`federation_id`, `federation_acronym`, `member_id`, `user_id`, `guardian_uid`,
`user_name`, `kind` (`warning|suspension|fine|exclusion`), `reason`,
`starts_at`, `ends_at`, `fine_cents`, `tournament_id`, `tournament_name`,
`status` (`active|appealed|upheld|overturned|ended`), `appeal { text, by,
at_ms }`, `appeal_decision { upheld, note, by, at_ms }`, `applied_by`,
`created_at_ms`, `updated_at_ms`. **Nunca pública**: leem o dono (`fedMemberOwner`), a equipe
`discipline`/`admin`, o admin.

### `federation_reports/{id}` (PR 3, ouvidoria — o cliente cria)
`federation_id`, `kind` (`conduct|referee|organization|other`),
`tournament_name`, `body` (20–2000), `anonymous` (bool; `true` ⇒
`reporter_uid` **nulo**, imposto na regra), `reporter_uid`, `status`
(`open|in_review|closed`), `notes`, `handled_by` (os dois a pessoa nunca
grava), `created_at`, `updated_at`. `get`: quem abriu, qualquer conta se
anônima (consulta pelo protocolo — `reportProtocol(id)`), a equipe
`discipline`/`admin`, o admin; `list`: quem abriu, a equipe, o admin. A equipe
só muda `status`/`notes`/`handled_by`/`updated_at`; apaga só o admin da
plataforma.

### `federation_elections`, `federation_candidacies`, `federation_election_voters`, `federation_election_endorsements`, `federation_ballots` (módulo `elections`, só o servidor — `federationElections`)

- `federation_elections/{id}`: `federation_id`, `title`, `description`, `positions[]` (`id` `c1…`, `label`, `kind` slate|individual, `organ`, `seats`, `gender_min`), `calendar` (notice_on, candidacy_from/to, challenge_to, defense_to, voting_from/to + voting_opens/closes, result_on, inauguration_on), `college` (`min_months`, `weights` por categoria), `mode` online|presential|mixed, `tie_rule`, `endorsement_pct`, `commission[]` + `commission_uids`, `status` draft|published|voting|counting|closed|cancelled, `public`, `notice_text`/`notice_doc_id`/`notice_code`, `endorsements_needed`, `college_frozen`, `voted_count`/`voted_weight`, `presential`, `results[]` (só pesos), `minutes_*`, `governance_applied`, `history[]`. Lê: publicada (`public`) quem vê a federação; a comissão; o admin.
- `federation_candidacies/{id}`: `election_id`, `federation_id`, `position_id`, `name`, `platform`, `members[]` (uid, name, role, gender) + `member_uids`, `status` submitted|accepted|challenged|rejected|withdrawn, `public` (aceita), `endorsement_count`, `challenges[]` (by_uid, by_name, reason, defense, decision), `alerts[]`, `review`. Lê: aceita, quem vê a federação; quem está nela; quem conduz (`fedElRun`); o admin.
- `federation_election_voters/{eid}_{uid}` (ou `{eid}_{club|arena}_{org}`): o colégio CONGELADO na abertura — `user_id`, `name`, `category`, `weight`, `kind`, `org_id`, `voted_at_ms`, `receipt`, `channel`. Nunca em quem votou. Lê: o próprio e quem conduz.
- `federation_election_endorsements/{eid}_{cargo}_{uid}`: um apoio por cargo. Lê: só quem apoiou.
- `federation_ballots/{aleatório}`: `election_id`, `choices` (cargo → chapa|blank|null), `weight` — **sem uid**, gravada na mesma transação que marca o eleitor. Ninguém lê pelo cliente.

Zero índice composto. Exportação e exclusão: ver `docs/50-FEDERACAO.md` §22.5.

### `federation_news/{id}` (PR 4, módulo `news` — o cliente escreve)
`federation_id`, `title`, `summary`, `body`, `image_url`, `link`, `pinned`,
`audience` (`public|members`), `status` (`draft|scheduled|published|archived`), `published_at`,
`created_by`, `created_at`, `updated_at`; `notified_at`/`notified_count`/
`notified_by` **só o servidor** (`federationNews`; a regra recusa o cliente).
Agendada (2026-10-22, opcionais): `publish_at_ms` (número, exigido pela regra
quando `scheduled`), `notify_on_publish`; a varredura `federationNewsPublish`
grava `status: 'published'`, `published_at` (data de Brasília da hora marcada)
e `scheduled_published_at`.
Leitura: publicada e pública, qualquer um (até sem conta); `members`, filiação
**ativa** (`fedMemberActive`); rascunho e a lista inteira, equipe
`comms`/`admin` e o admin da plataforma. Escrita: `comms`/`admin` com o módulo
`news` ligado, sem trocar `federation_id`. Consultas de igualdade, zero índice.

### Campos do PR 4 em `federations/{id}` (opcionais)
`sponsors` (lista ≤ 12 de `{ name, tier, logo_url, url }`, só `admin`, módulo
`sponsors`) e `governance` (`statute_url`, `bylaws`, `mandate { start, end }`,
`board` ≤ 12, `minutes` ≤ 24, `women_count` — PR 10, opcional: QUANTAS pessoas
da diretoria são mulheres, nunca quem, para o aviso da cota de 30% do art. 36,
IX; inteiro de 0 ao tamanho de `board`, ou `null`; a página pública não mostra;
só `admin`; públicos como o resto da federação).
A federação também é **emissora** em `promo_coupons`/`promo_campaigns`/
`promo_settings` (`issuer_type: 'federation'`, `issuer_id` = id da federação;
equipe `comms`/`admin` com o módulo `promos`) e **vendedora** em
`market_sellers/federation_{id}` (`seller_type: 'federation'`; `admin`/`finance`
com o módulo `store`).

### Avisos e auditoria
Avisos são `notifications` com `type: 'federation'` (área `federacoes`,
categoria "Federações" em Configurações → Notificações), `origin: 'server'`,
`essential: true`. Auditoria em `audit_logs` com `action` `federation_*`
(`apply`, `update`, `payment_update`, `modules_update`, `plan_save`,
`staff_set`, `staff_remove`, `membership_request|approve|reject|cancel`,
`charge_confirm|cancel`, revisão; PR 2: `affiliation_request|withdraw|approve|
reject|suspend`, `sanction_request|withdraw|approve|reject|revoke`,
`result_send|reject|readmit`, `ranking_config`; PR 3: `rules_update`,
`member_private_reveal`, `document_upload|view`, `transfer_request|approve|
reject`, `members_import`, `course_save|delete|enroll|pass|fail`,
`discipline_warning|suspension|fine|exclusion|uphold|overturn|end`,
`report_update`; PR 4: `news_save|delete|notify`, `sponsors_update`,
`governance_update`).

### Exclusão de conta e exportação
Filiações e cobranças **ficam sem o nome** (`coletarFederacoes`), os códigos
em `federation_card_index` são apagados, `federation_staff` da pessoa sai, a
federação que ela pediu fica com "Usuário removido", a linha dela em
`federation_results` vira "Atleta removido" sem `uid` (o ranking refeito a
tira) e o pedido em `federation_affiliations` fica sem `requested_by`; PR 3:
`private/data` da filiação some, dependentes ficam sem o responsável (nome do
menor fica; código deixa de verificar), transferências, sanções, inscrições e
credenciais ficam sem o nome (credencial sai do diretório e do índice),
manifestação identificada vira anônima, documentos enviados são apagados
(pasta `federacao/{uid}/` em `STORAGE_PREFIXES`); PR 4: `federation_news`
fica como está (é da federação, guarda só o `created_by` — `RETAINED_AS_IS`); **presidente** bloqueia a
exclusão (nomeia outra presidência antes). Exportação: bloco `federations`
(`federationExportService.js`: filiações, dependentes, cobranças, papéis,
federações que pediu, pedidos de clube/arena, resultados, documentos
[registro], transferências, inscrições em cursos, credenciais, sanções,
manifestações identificadas). Guarda: `exclusaoCobreColecoes.test.js`.

## Coleções conferidas na regra (complemento)

> Coleções que faltavam neste documento. Cada item foi conferido em
> `firestore.rules` e nos services/funções citados; campo que não foi possível
> confirmar não está listado. "Servidor" = Admin SDK (ignora a regra; o cliente
> é `write: false`).

### Social e perfil

#### `player_goals/{uid}_{goalId}`
Meta pessoal (`goalService`). `id`, `uid`, `metric`, `target`, `created_at`.
Só o dono lê, cria, atualiza e apaga (confere `uid`).

#### `follows/{followerUid}_{targetUid}`
Quem segue quem. `id`, `follower_uid`, `target_uid`, `follower_name`,
`created_at`. Lê qualquer conta logada; só o seguidor cria e apaga; não há
update. Seguir notifica o seguido (`new_follower`).

#### `affiliate_links/{autoId}`
Links de parceiros. `title` (≤100), `description` (≤300), `url`, `image_url`,
`category` (`equipment|store|sponsor|academy|other`), `active`, `sort_order`,
`created_by`, `created_at`, `updated_at`. Leitura pública; escrita só do admin
da plataforma (auditoria `affiliate_link_*`).

#### `rating_history/{id}` · `open_games/{id}` · `arena_unavailabilities/{id}`
- `rating_history`: leitura pública; cliente não escreve.
- `open_games` (convites do "Procura-se jogo"): lê conta logada; cria quem
  assina em `created_by`; atualiza/apaga o autor ou admin; `status` `open|closed`.
- `arena_unavailabilities`: leitura pública; cria/edita/apaga gestor da arena
  ou admin (`source: 'game_day'` quando vem do dia de jogo).

### Arenas

#### `booking_waitlist/{arena_id}_{user_id}_{date}_{start}`
Espera por um **horário de reserva** (distinta de `arena_waitlist`, que é a fila
do jogo aberto). `id`, `arena_id`, `user_id`, `date`, `start`, `end`,
`court_id|null`, `user_name`, `user_photo`, `notes` (≤300), `created_at`,
`created_at_ms`. Lê o dono, o gestor da arena ou o admin; cria o dono; apaga
dono, gestor ou admin; não há update. Entrar avisa os gestores.

#### `arena_market_reports/{arenaId}_{periodType}_{periodKey}`
Fechamento financeiro do Mercado (sempre ligado). `arena_id`,
`period_type`, `period_key`, `period_start`, `period_end`, `label`, `lines[]`,
`totals`, `status`, `edited`, `generated_at`, `generated_by`, `updated_at`.
Lê e escreve só gestor da arena ou admin.

### Torneios

#### `provisional_claims/{rid}_a|b`
Prova de posse de uma inscrição provisória. `email_lc`, `registration_id`,
`tournament_id`, `modality_id`, `slot` (`a|b`), `claimed`, `claimed_by`
(+ `claimed_at`, `updated_at` ao reivindicar). Id = `registration_id + '_' + slot`.
Lê o admin ou quem tem no token o e-mail igual a `email_lc` (consulta sempre
`where email_lc == meu`). Cria o organizador, uma das partes ou o admin; quem
reivindica só toca `claimed`, `claimed_by`, `claimed_at`, `updated_at`. Apagada
pelo servidor ao vincular a conta (`functions/registrationLink.js`).

### Professores

#### `coach_student_notes/{coachId}_{studentId}`
Anotações privadas do professor sobre o aluno (saíram de
`coach_students.private_notes`). `coach_id`, `student_id`, `text`, `updated_at`.
Só o professor e o admin leem e escrevem (consulta por `coach_id == uid`).

### Gamificação V2 — preferências, XP e integridade

#### `user_gamification_prefs/{uid}`
Chaves permitidas (`hasOnly`): `uid`, `schemaVersion` (1),
`privacy{showInHallOfFame, showOnPublicProfile}`,
`social{acceptDuels, acceptReviews, acceptLetters}`,
`notifications{weeklyReview, duels, challengeResults}`,
`display{title, celebrations}`, `onboarding{dismissed, done{}}` (≤24 passos),
`celebrated{}` (≤120). O dono lê, cria, atualiza e apaga; o admin lê e apaga.
O servidor a lê para respeitar as escolhas.

#### `user_xp_grants/{uid}_{kind}_{ref}`
Crédito de XP. `uid`, `kind`, `xp`, `label`, `refId`, `at`, `serverAt`,
`schemaVersion`. Só o servidor escreve (com `create`, para nunca creditar duas
vezes). Lê o dono ou o admin.

#### `gamification_moderation/{uid}`
`excluded`, `hiddenFromPublic`, `reason`, `by`, `at`. Só o admin lê e escreve;
o documento é apagado quando nenhuma das marcas está ligada.

#### `gamification_flags/{id}`
Alertas antifarm. `type`, `severity`, `subjectUid`, `otherUid`, `detail`,
`status` (`open|reviewed|dismissed|actioned`), `createdAt`, `schemaVersion`;
revisão: `reviewNote`, `reviewedBy`, `reviewedAt`. O servidor abre (cliente
não cria). O admin lê e só altera `status`, `reviewNote`, `reviewedBy`,
`reviewedAt`.

#### `gamification_metrics/{day}`
Retrato diário (dia de Brasília): `day`, `at`, `athletes`, `active7`,
`active30`, `referrals`, `referralsActivated`, `kudos7`, `reviews7`, `letters7`,
`challengesActive`, `duelsActive`, `rewardClaimsOpen`, `flagsOpen`, `prefsDocs`,
`onboarding{dismissed, steps}`, `schemaVersion`. Lê o admin; escreve o servidor.

#### `gamification_integrity/{uid}`
`{ xp, at }`. Só o servidor; a regra bloqueia leitura **e** escrita do cliente.

#### `gamification_goals/{ownerType}_{ownerId}_{month}`
Metas mensais de painel. `ownerType` (`coach|arena|club`), `ownerId`, `month`,
`goals[]` (≤6, cada `{metric, target}`), `updatedAt`. Lê e escreve só o dono do
painel (professor = ele mesmo, gestor da arena, admin do clube); o admin da
plataforma lê e apaga.

### Gamificação V2 — social

#### `hall_of_fame/{uid}`
Quadro de honra. `uid`, `xp`, `tier`, `level`, `achievements`, `position`,
`displayName`, `photoUrl`, `state`, `city`, `updatedAt`, `schemaVersion`. Só
entra quem consentiu (`showInHallOfFame`). Lê qualquer conta logada; só o
servidor escreve (quem retira o consentimento sai).

#### `match_reviews/{matchKey}__{fromUid}__{toUid}`
Avaliação de parceiro de jogo. `fromUid`, `toUid`, `matchKey` (≤120), `rating`
(inteiro 1–5), `tags` (≤4), `issues` (≤4), `relation`, `createdAt` (número).
Nota 1–2 exige ao menos um `issues`. Não há update. Lê e apaga o autor ou o
admin; **quem foi avaliado não vê quem deu o quê**, só o agregado.

#### `user_reputation/{uid}`
Agregado público. `uid`, `count`, `average`, `publicScore`, `fiveStarCount`,
`topTags`, `updatedAt`, `schemaVersion`. Lê conta logada; só o servidor escreve.

#### `user_reputation_private/{uid}`
`uid`, `issues{}`, `count`, `updatedAt`, `schemaVersion`. Lê o dono ou o admin;
só o servidor escreve.

#### `partner_letters/{matchKey}__{fromUid}__{toUid}`
Cartinha ao parceiro. `toUid`, `fromUid` (`null` se anônima), `fromName`, `text`
(3–280), `showName`, `matchKey`, `createdAt`, `readAt`, `reported`. Lê o
destinatário ou o admin. O autor cria, e `partner_letter_authors` precisa ser
criado no mesmo lote (`getAfter`). O destinatário só atualiza `readAt` e
`reported`; apaga o destinatário ou o admin.

#### `partner_letter_authors/{mesmo id da carta}`
Quem escreveu (a carta pode ser anônima). `fromUid`, `toUid`, `matchKey`,
`createdAt`. Lê o autor ou o admin; o autor cria; só o admin atualiza/apaga.

#### `duels/{week}_{uidA}_{uidB}`
Duelo semanal. `week`, `uidA`, `uidB`, `nameA`, `nameB`, `levelA`, `levelB`,
`status` (`active|finished|declined`), `startsAt`, `endsAt`, `createdAt`,
`schemaVersion`; no fechamento: `outcome`, `winner`, `resultA{games,wins}`,
`resultB`, `finishedAt`. O servidor cria e fecha. Lê os dois lados ou o admin;
o cliente só muda `active → declined` (grava `declinedBy`, `declinedAt`).

### Gamificação V2 — desafios e recompensas

#### `gamification_challenges/{autoId}`
Desafio de um emissor. `issuerType` (`platform|arena|club|coach`), `issuerId`,
`issuerName`, `title` (4–80), `description`, `rules`, `emoji`, `metric`,
`subject` (`athlete|club`), `startsAt`, `endsAt` (≤92 dias), `regionState`,
`prizes[]` (≤5), `status` (`draft|active|cancelled|finished`), `createdBy`,
`schemaVersion`, `createdAt`. Lê conta logada, exceto rascunho (só emissor e
admin). O emissor cria/edita sem trocar `issuerType`, `issuerId`, `createdBy`;
desafio clube × clube é só da plataforma; só o servidor marca `finished`.
Apaga o emissor (rascunho ou cancelado) ou o admin.

#### `challenge_entries/{challengeId}_{uid}` ou `{challengeId}_club_{clubId}`
Adesão. Na criação: `challengeId`, `subjectType`, `subjectId`, `uid`,
`joinedAt`, `value` = 0, `position` = null, `finalized` = false, `prizeXp` = 0;
o servidor depois acrescenta `eligible`, `updatedAt`. Exige desafio ativo e
antes de `endsAt`. Lê conta logada; cliente não atualiza. Sai o dono (ou o
admin do clube) enquanto `finalized != true`; o admin sempre.

#### `gamification_rewards/{autoId}`
Recompensa de um emissor. `issuerType`, `issuerId`, `issuerName`, `title`
(4–80), `description`, `instructions`, `kind`, `eligibility`, `quantity`,
`approvedCount`, `validUntil`, `status` (`active|paused|ended`), `createdBy`,
`schemaVersion`, `createdAt`. Lê conta logada; o emissor cria/edita
(`approvedCount` só sobe, de 1 em 1); apaga o emissor ou o admin.

#### `reward_claims/{rewardId}_{uid}`
Pedido de resgate. `uid`, `userName`, `rewardId`, `rewardTitle`, `issuerType`,
`issuerId`, `status` (`requested → approved|rejected → redeemed`; a pessoa pode
marcar `cancelled`), `code` (6–20), `snapshot{tier, level, games, streakWeeks}`,
`createdAt`. Lê a pessoa, o emissor ou o admin; apaga só o admin.

### Mercado

#### `market_addresses/{uid}`
Endereços de entrega. `addresses[]` (≤5), `updated_at`. Só o dono lê, cria,
atualiza e apaga. Guarda dado pessoal: nunca em coleção de leitura ampla.

#### `market_follows/{uid}_{seller_key}`
Seguir vendedor. `uid`, `seller_key`, `created_at`. Só o dono lê, cria e apaga.
O servidor mantém `market_sellers.follower_count` (`marketFollowCount`) e avisa
os seguidores de anúncio novo (`marketFollowersNotify`).

## Storage (`storage.rules`)

Seis blocos; o resto é negado (`/{allPaths=**}`: sem leitura nem escrita).

| Caminho | Quem lê | Quem escreve | Limite |
|---|---|---|---|
| `uploads/{uid}/private/**` | só o dono | só o dono (grava e apaga) | < 25 MB |
| `uploads/{uid}/{pasta}/**` (exceto `private`) | `get`: conta logada; `list`: o dono | o dono | < 25 MB |
| `uploads/{uid}/{arquivo}` (legado, solto) | `get`: conta logada; `list`: o dono | o dono | < 25 MB |
| `treino/{uid}/{arquivo}` | `get`: conta logada; `list`: o dono | o dono, só cria (sem sobrescrever) | imagem webp/jpeg/png < 3 MB; vídeo mp4/webm/quicktime < 60 MB |
| `mercado/{uid}/{arquivo}` | `get`: conta logada; `list`: o dono | o dono, só cria; apaga, exceto `comprovante-*` | como `treino`, mais PDF < 3 MB |
| `/{allPaths=**}` | ninguém | ninguém | — |

## Índices

Os índices compostos estão em `firestore.indexes.json` (38 hoje; `fieldOverrides`
vazio). Números e a lista atual: `docs/46-INVENTARIO.md` §6. A regra do projeto:
um `where` só, ordenação em memória. Quando `where` + `orderBy` for
inevitável, o guarda `src/core/guards/indicesCompostos.test.js` exige índice
**exato** (igualdades primeiro, depois só os campos do `orderBy`; o Firestore
desempata por `__name__`, então um campo a mais não serve). Sem índice a
consulta **falha** e a tela vê lista vazia.

## Relacionamentos (resumo)

```
users (1) ──< tournaments (owner) ──< tournament_modalities ──< tournament_registrations
                         │                                  └──< tournament_matches >── tournament_courts
                         ├──< tournament_admins
                         ├──< tournament_groups
                         ├──< tournament_announcements · tournament_photos
users (1) ──< athlete_profiles (perfil público, directory_listed)
clubs (1) ──< club_members ──> users
       ├──< club_join_requests / club_member_invites  (ingresso)
       ├──< club_posts (mural) · club_forum_threads ──< poll_votes / comments (subcoleções)
       ├──< club_events (com recurring_rule) ──< club_event_rsvps / event_invites
       ├──< club_events/{id}/dates (game-day) ──< date_rsvps (subcoleção)
       ├──< (ranking interno — Onda 8)
       └──< (página pública /clubes/p/:slug — Onda 8b)
arenas (1) ──< arena_managers ──> users
       ├──< arena_courts ──< arena_court_schedules
       ├──< arena_bookings (com court_id obrigatório) · booking_waitlist
       │              └── responsibles[] (multi, com rateio) · booking_type
       │                            (single|recurring|coach_lesson|shared)
       ├──< arena_unavailabilities · arena_reviews · arena_favorites
       ├──< (V3) arena_products · arena_sales · arena_payments · arena_members
       │      · arena_packages · arena_subscriptions · arena_ladders · arena_matches
       │      · arena_classes · arena_class_bookings · arena_campaigns
       │      · arena_coupons · arena_referrals · arena_inventory_*
       │      · arena_maintenance_orders · arena_devices · arena_open_slots
       │      · arena_settings · arena_module_states
       └──< (V3) linked_clubs (clubes vinculados)
coaches/{uid} (1) ──< coach_arenas/{coachId_arenaId} (residência) ──> arenas
       ├──< coach_availability (janelas semanais)
       ├──< coach_lessons ──< (FK) arena_bookings.booking_type='coach_lesson'
       │              └──< student_ids[] (pode ingressar em aula aberta)
       ├──< coach_students (vínculo) ──> users
       ├──< coach_packages ──< coach_package_sales (créditos)
       ├──< coach_content (biblioteca) · coach_clinics ──< coach_clinic_signups
       ├──< coach_level_validations (validação de nível)
       └──< coach_products (loja)
users (1) ──< follows (social) · player_goals · conversations ──< messages (subcoleção)
tournaments (1) ──< circuits (via circuit_tournaments) ──< circuit_results
(qualquer ação) ──> audit_logs ;  (qualquer usuário) ──> notifications
                                          └─ preferences: {category: bool}
platform_settings/global (campo feature_flags.{key}) — valores de FEATURE_FLAG
```

## Regras de segurança (`firestore.rules`) — princípios

- Coberta toda coleção listada (`match /<col>/{id}`). Banco nomeado: bloco
  `match /databases/{database}/documents`.
- **Aditividade**: ao adicionar coleção, adicione regra sem afetar as demais.
- Acesso por **papel-de-recurso**: membros/admins de clube via `club_members`;
  admins de torneio via `tournament_admins`; admin global via
  `users/{uid}.role == 'platform_admin'`.
- Ids deterministas permitem regras simples do tipo "dono do par recurso+uid".
- Visão pública de torneio (`/p/:id`) depende de leitura permitida a torneios
  `public` e seus dados de jogo/ranking — não quebrar.
</content>

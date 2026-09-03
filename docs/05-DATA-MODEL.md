# DATA_MODEL

> Coleções Firestore (database **`pickleball`**), seus campos-chave e
> relacionamentos. Tudo top-level (sem subcoleções aninhadas). Sem joins:
> desnormalização e ids deterministas. Campos comuns: `created_at`,
> `updated_at` (`serverTimestamp`). Para o panorama, ver `docs/01-AI-CONTEXT.md`.

## Convenções

- **Id determinista** (`clubId_uid`, `tournamentId_uid`): evita duplicidade e
  simplifica regras (1 doc por par recurso+usuário).
- **Desnormalização**: nomes/e-mails do ator são copiados no doc para evitar
  leitura cruzada (ex.: `user_name` em membros e admins).
- **Auditoria**: mutações relevantes gravam `audit_logs` (ver fim do doc).
- Toda escrita é validada por `firestore.rules` (lógica roda no client).

## Identidade

### `users/{uid}`
Perfil privado/operacional do usuário autenticado.
- `email`, `platform_name` (nome de exibição), `full_name`, `phone`,
  `birth_date`, `pickleball_experience`.
- `role`: `'platform_admin' | 'user'`. `can_create_pools: bool`.
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

### `legal_consents/{uid}_{docKey}` (PR #86 + #94)
Registro auditável de aceites legais (LGPD).
- `uid`: usuário que aceitou.
- `docKey`: `'privacy_policy' | 'terms_of_use' | 'community_guidelines' | ...`
- `accepted_at`: timestamp do aceite.
- `version`: versão do documento aceito.
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

### `tournament_modalities/{id}`
Modalidade dentro de um torneio: `tournament_id`, formato
(`single | doubles | americana/whist`), nível (iniciante→elite), categoria
(gênero/idade), capacidade (até 500), taxa opcional, config de fase
(pontos corridos, grupos, mata-mata, dupla eliminação, suíço).

### `tournament_admins/{tournamentId_uid}`
Admin compartilhado do torneio (não afeta admin da plataforma).
`tournament_id`, `user_id`, `user_email`, `user_name`, `role`, `created_at`.

### `tournament_registrations/{id}`
Inscrição: `tournament_id`, `modality_id`, jogador(es) (`player_a_*`,
`player_b_*` em duplas), `player_a_level`, check-in, status, taxa.
Inscrições provisórias podem ser "reivindicadas" ao completar o perfil
(`claimProvisionalRegistrationsForUser`).

### `tournament_matches/{id}`
Jogo: modalidade, fase/rodada, duplas/jogadores, placar por set, status
(`scheduled | started | finished`), quadra, horário, duração.

### `tournament_groups/{id}`
Grupos da fase de grupos (composição e classificação por grupo).

### `tournament_rankings/{id}`
Ranking **materializado pelo client** após cada resultado, por formato.

### `tournament_courts/{id}`
Quadras do torneio para agendamento (slots, descanso mínimo).

## Clubes e comunidade

### `clubs/{id}`
`name`, `description`, `owner_id`, `invite_code`, cidade, imagem.

### `club_members/{clubId_uid}`
Vínculo de associação. `club_id`, `user_id`, `user_name`, `role`
(`admin | member`), `created_at`. Fonte de verdade de "quem é membro/admin".

### `club_join_requests/{clubId_uid}`
Pedido de ingresso (fluxo "Pedir para ingressar"). `status`
(`pending | approved | rejected`), dados do solicitante. Aprovação cria
`club_members` e notifica o solicitante.

### `club_member_invites/{clubId_uid}`
Convite enviado por admin ("Adicionar membros"). `status`
(`pending | accepted | declined`); aceitar cria `club_members` e notifica admins.

### `club_posts/{id}`
Mural do clube (posts dos membros). `club_id`, autor, conteúdo.

### `club_forum_threads/{id}`
Tópicos do fórum. Pin/unpin, autor, título, conteúdo; podem conter enquete.
Respostas e menções geram notificações (`forum_reply`, `forum_mention`).

### `poll_votes/{id}`
Votos de enquetes do fórum (lógica pura em `clubs/domain/forumPoll.js`).

### `club_events/{id}`
Eventos do clube. `club_id`, `visibility` (público/privado ao clube), datas,
local, status (rascunho/publicado). Publicar evento público notifica membros
(`club_event_published`).

### `club_event_rsvps/{id}` · `event_invites/{id}`
Presença/convites de eventos.

### `dates/{id}` · `date_rsvps/{id}`
**Game-day**: datas de jogo e confirmações; sorteio em
`clubs/domain/gameDayDraw.js`.

### `comments/{id}`
Comentários genéricos (mural/fórum/eventos), com `parent` referenciado.

## Chat

### `conversations/{id}`
Conversa 1:1 ou em grupo: `participants[]`, último texto/horário, tipo.
Lógica pura em `chat/domain/conversations.js`.

### `messages/{id}`
Mensagens: `conversation_id`, `sender_id`, `text`, `created_at`.
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

### `arena_products/{id}` (V3, do Arena V3 — PDV)
Produtos da loja. `arena_id`, `name` (max 80), `description` (max 500),
`price` (number), `category` (`'bebidas'|'equipamentos'|'vestuario'|'acessorios'|'alimentos'|'outros'`),
`stock` (number, opcional = sem controle), `image_url`, `active: bool`,
`sold_count` (contador). `created_at`, `updated_at`.

### `arena_sales/{id}` (V3, do Arena V3 — PDV)
Vendas. `arena_id`, `buyer_id`, `buyer_name`, `items[]` (`{product_id, quantity, price}`),
`total`, `payment_method`, `status` (`'pending'|'paid'|'cancelled'|'refunded'`),
`split_with[]` (user_ids), `split_details[]` (somas por participante).
`created_at`, `updated_at`.

### `arena_payments/{id}` (V3, do Arena V3 — PDV)
Pagamentos individuais. `sale_id`, `arena_id`, `payer_id`, `amount`,
`payment_method`, `status`. Id = `${saleId}_${userId}`. `created_at`, `updated_at`, `paid_at`.

## Transversal

### `notifications/{id}`
Notificações do sino. `userId`, `title`, `message`, `type`
(ver `NOTIFICATION_TYPE` em `01-AI-CONTEXT.md` §7), `link`, `read`, `actor`,
`created_at`. Escrita por `createNotification` / `notifyUsers` (lote ≤400).

### `audit_logs/{id}`
Trilha de auditoria. `action` (ex.: `tournament_created`,
`club_member_invited`, `match_result_recorded`, `club_join_approved`,
`booking_cancelled`, `booking_transferred`, `booking_responsibles_changed`,
`coach_lesson_created`, `clinic_signup`, `club_recurring_event_added`…),
`actor`, `details`, `created_at`. Escrita por `auditService.createAuditLog`.

### `platform_settings/{docId}`
Singletons: `feature_flags/{key}` (defaults de `FEATURE_FLAG`),
`app_version`, `flags_migration_version`, etc. Migração em
`migrateLegacyFlags` (bump `FLAGS_MIGRATION_VERSION` ao adicionar
defaults novos).

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

### `coach_students/{coachId_studentId}` (Fase B)
Vínculo professor ↔ aluno. Id determinista.
- `coach_id`, `student_id`, `student_name` (desnormalizado),
  `student_photo`, `leveling_level`, `goals`, `notes` (max 500).
- `status` ('active'|'paused'|'ended'), `started_at`, `ended_at`.

### `coach_packages/{packageId}` (Fase C)
Pacotes de aulas (5 aulas / mês, etc).
- `coach_id`, `name`, `description`, `lesson_count`, `price`,
  `validity_days`, `modality`, `leveling_level`.
- `active: bool`, `created_at`, `updated_at`.

### `coach_package_sales/{saleId}` (Fase C)
Venda de pacote (gera créditos).
- `package_id`, `coach_id`, `buyer_id`, `buyer_name`, `price_paid`,
  `payment_method`, `lessons_remaining` (decrementa ao consumir).
- `status` ('active'|'expired'|'cancelled'), `purchased_at`, `expires_at`.

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
- `arena_id`, `court_id` (opcional), `date` ('YYYY-MM-DD'),
  `user_id`, `user_name`, `time_window` (`{start, end}`), `notes`.
- `status` ('waiting'|'notified'|'converted'|'expired'),
  `created_at`, `notified_at`.

### `club_event_games/{eventId_dateId_gameId}` (Wave C — id determinístico)
Espelhamento de jogos decididos de dias de jogo para o ranking nacional.
Ativado pela flag `publish_to_ranking` no `club_events/{id}/dates/{dateId}`.
Mesmo schema de `tournament_matches` + campos extras:
- `source: 'club_event_game' | 'athlete_game_day'`, `event_id`, `date_id`,
  `club_id`, `event_title`, `game_id`, `published_by`
- `side_a_ids`/`side_b_ids` são **uids** (não passam por
  `tournament_registrations`).
- `status: 'finished'`, `winner_side: 'a'|'b'`, `score_a`, `score_b`.
- `sets_a`/`sets_b` espelham o placar (helper p/ rankings derivados).
- `kind: 'singles'|'doubles'`, `result_recorded_at`.

O **Dia de jogo do atleta** (`game_days`, flag `athlete_game_day`) reaproveita
esta MESMA coleção: `source='athlete_game_day'`, `event_id = game_day_id`,
`date_id = 'main'`, id determinístico `gd_${gameDayId}_${gameId}` e `club_id`
**resolvido por partida** (o clube comum a TODOS os atletas, ou `null`). Assim os
resultados entram no ranking geral e no ranking interno do clube sem alterar o
motor de rating (`ratingService`) nem `functions/clubRanking.js`.

Regras: `firestore.rules` — read público; create/update/delete apenas
criador do evento do clube, dono do dia de jogo do atleta
(`isGameDayOwnerOf`), admin do clube + platform admin.

### `game_days/{id}` (flag `athlete_game_day`)
Dia de jogo criado por um atleta (primo do dia de jogo dos clubes, sem clube dono).
- `created_by`, `creator_name`, `creator_photo`
- `title`, `visibility: 'public'|'private'`, `date`, `time`, `location`,
  `city`, `state`, `notes`, `format`
- `member_uids[]` — dono + convidados + quem entrou pelo convite (query de
  visibilidade `array-contains`); `invited_uids[]`
- `open_game_id` — convite público vinculado em `open_games` (`kind='game_day'`)
- `publish_to_ranking`, `published_count`, `published_at`, `published_by`
- `status: 'active'|'archived'`, `created_at_ms`

Subcoleções:
- `game_days/{id}/participants/{pid}` — `user_id?`, `name`, `photo_url?`,
  `source: 'owner'|'invited'|'joined'|'guest'`
- `game_days/{id}/games/{gid}` — `round`, `court`, `kind`, `side_a`/`side_b`
  (`[{id,name}]`), `score_a`/`score_b`, `order`

Regras: read pelo dono/membros (ou qualquer um se público); escrita plena do
dono; um atleta se auto-inclui como membro/participante ao "Participar" de um
dia de jogo público.

### `legal_consents/{uid_docKey}` (flag `legal_center` — id determinístico)
Registro do aceite de um documento legal por um usuário. 1 doc por usuário ×
documento, guardando a última versão aceita (histórico auditável em `audit_logs`).
- `id = ${uid}_${docKey}`, `user_id`, `doc_key`, `doc_title`
- `version` (inteiro; aceite válido quando ≥ versão vigente do documento)
- `accepted_at`, `accepted_at_ms`, `user_agent`

Documentos em `src/modules/legal/domain/legalDocuments.js` (dado puro,
versionado): essenciais (Termos de Uso, Política de Privacidade, Termo de Riscos
— aceite bloqueante), complementares (Cookies, Diretrizes da Comunidade,
Pagamentos/Reembolsos, Cancelamento) e por papel (Organizador, Arena, Professor).

Regras: cada usuário lê/grava apenas o próprio consentimento; platform admin
pode ler (auditoria) e excluir.

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

### `player_skill_ratings/{userId_format}` (NOVO Onda G)
Rating estilo DUPR (escala 2.000-8.000), **independente** do
ELO. Flag `skill_rating_dupr` (default OFF). Coleção
**separada** do `player_ratings` (ELO).
- `user_id`, `format` (`'singles' | 'doubles'`).
- `rating: number` (2.0-8.0).
- `games_played: number`.
- `reliability: number` (0-1) — cresce com jogos.
- `provisional: bool` — true enquanto reliability < threshold.
- `seed_level: number` — USAP usado como semente (ex: 2.5 → 2.500).
- `updated_at: timestamp`.
- **Regras**: leitura pública; escrita só `isPlatformAdmin()` ou
  Cloud Function com service account.
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
- **Espelhado** do `player_skill_ratings` a cada
  `recomputeDuprRatings`.
- **Regras**: leitura pública; escrita admin.

### Coleção: `audit_logs/{id}` (NOVO PR #120)
Registro de ações admin (moderação, etc.).
- `actor_id`, `action` (`'athlete_hide' | 'athlete_unhide' | ...`),
  `target_id`, `payload`, `created_at`.
- **Regras**: leitura só `isPlatformAdmin()`; escrita
  via service account.

## Cross-cutting (transversal)

### `users/{uid}.notification_prefs: object` (Onda 9b)
Preferências por categoria: `{booking_confirmed: bool, tournament_*: bool,
chat_*: bool, forum_*: bool, ...}`. Default todas ON.

### `users/{uid}.data_export_request: object` (Onda 9)
LGPD: request de export de dados (`{requested_at, status}`).

### `user_data_exports/{id}` (Onda 9)
Histórico de exports gerados. `user_id`, `data_url`, `expires_at`.

### `push_tokens/{uid}` (NOVO Onda H — `push_notifications`)
Tokens FCM por usuário. Cada user gerencia os próprios.
- `token: string` (FCM token).
- `created_at`, `updated_at`, `platform`, `user_agent`.
- **Regras**: cada user lê/escreve **só os próprios**
  (`request.auth.uid == uid`). Cloud Function
  `pushOnNotificationCreate` lê para enviar push.
- **Limpeza**: tokens inválidos são removidos pela CF.

### `tournament_team_registrations/{id}` (NOVO Onda I — `team_tournaments`)
Inscrição de equipe em torneio.
- `tournament_id`, `modality_id`, `team_name`,
  `captain_id`, `created_at`.
- `lineup: array` (referência a `tournament_team_lineups`).

### `tournament_team_lineups/{id}` (NOVO Onda I)
Elenco de uma equipe.
- `team_id`, `athlete_ids[]` (com `user_id`, `gender`),
  `created_at`, `updated_at`.

### `tournament_team_confrontations/{id}` (NOVO Onda I)
Confronto equipe × equipe.
- `tournament_id`, `modality_id`, `phase_id`, `round`,
  `team_a_id`, `team_b_id`, `winner_team_id`, `score_a`,
  `score_b`, `status`, `stages[]` (cada etapa decidida).
- Cada `stage` espelha em `club_event_games` com
  `kind=singles/doubles` e `source='team_confrontation'`
  (entra no ELO + DUPR individual).

## Gamificação V2 (flag `gamification_v2`, default OFF)

> 13 coleções materializadas. Com a flag desligada nenhuma delas recebe
> request — o schema V1 (`users/{uid}` XP/nível/conquistas) segue intacto.
>
> **Vocabulário**: os nomes de tier e as 5 trilhas vêm do DOMÍNIO
> (`src/modules/progression/domain/tiers.js` e `skillTrees.js`). O schema
> Zod e o `firestore.rules` derivam dessa fonte — o teste
> `gamificationRulesSync.test.js` quebra a CI se um lado divergir do outro.

### `user_progression_v2/{uid}` (Onda R)
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

### `user_streak_meta/{uid}` (Onda R)
Proteção da sequência.
- `uid`, `schemaVersion: 1`, `lastPlayAt`, `graceDaysRemaining: 0..3`,
  `freezesAvailable: 0..3`, `freezesUsed: int` (**acumulativo, sem teto**),
  `vacationMode`, `vacationStartedAt`, `comebackBonus`, `updatedAt`.
- **Regras**: privado — só o dono e o admin.

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
- **Índices**: `seasonId ASC, xp DESC` e `uid ASC, xp DESC`.

### `dupr_export_log/{matchId}` (Onda G — `dupr_match_export`)
Situação de cada partida perante o DUPR (`exported`/`submitted`) e
carimbos de data. **Governança sensível: só platform_admin lê e escreve.**

## Coleções Arena V3 (sempre atrás de sub-flags `ARENA_MODULE_*`)

> 35+ coleções criadas pelos módulos Arena V3 (PDV, members, leagues,
> marketing, IoT, operations, matchmaking). Detalhe completo em
> `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md`. Cada módulo
> controla o que está ativo via sub-flag.

**PDV**: `arena_products`, `arena_sales`, `arena_payments`.
**Members**: `arena_members`, `arena_packages`, `arena_subscriptions`,
`arena_wallets`, `arena_tier_configs`, `arena_network_memberships`,
`arena_networks`.
**Leagues**: `arena_ladders`, `arena_internal_tournaments`, `arena_matches`.
**Classes** (Sistema C, Aulas da arena): `arena_classes`, `arena_class_bookings`,
`arena_coaches`.
**Marketing**: `arena_campaigns`, `arena_coupons`, `arena_referrals`,
`arena_nps_responses`.
**Operations**: `arena_checklists`, `arena_maintenance_orders`,
`arena_inventory_products`, `arena_inventory_entries`, `arena_inventory_exits`.
**IoT**: `arena_devices`.
**Matchmaking**: `arena_open_slots`.
**Settings**: `arena_settings`, `arena_module_states`.

### `catalog_products/{id}` (flag `arena_product_catalog`)

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

## Relacionamentos (resumo)

```
users (1) ──< tournaments (owner) ──< tournament_modalities ──< tournament_registrations
                         │                                  └──< tournament_matches >── tournament_courts
                         ├──< tournament_admins                    │
                         ├──< tournament_groups                    └──> tournament_rankings (materializado)
                         ├──< tournament_announcements · tournament_photos
users (1) ──< athlete_profiles (perfil público, directory_listed)
clubs (1) ──< club_members ──> users
       ├──< club_join_requests / club_member_invites  (ingresso)
       ├──< club_posts (mural) · club_forum_threads ──< poll_votes / comments
       ├──< club_events (com recurring_rule) ──< club_event_rsvps / event_invites
       ├──< dates (game-day) ──< date_rsvps
       ├──< (ranking interno — Onda 8)
       └──< (página pública /clubes/p/:slug — Onda 8b)
arenas (1) ──< arena_managers ──> users
       ├──< arena_courts ──< arena_court_schedules
       ├──< arena_bookings (com court_id obrigatório) · arena_waitlist
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
users (1) ──< follows (social) · player_goals · conversations ──< messages
tournaments (1) ──< circuits (via circuit_tournaments) ──< circuit_results
(qualquer ação) ──> audit_logs ;  (qualquer usuário) ──> notifications
                                          └─ preferences: {category: bool}
platform_settings/feature_flags/{key} — defaults de FEATURE_FLAG
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

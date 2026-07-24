# DATA_MODEL

> Coleções Firestore (database **`pickleball`**), seus campos-chave e
> relacionamentos. Tudo top-level (sem subcoleções aninhadas). Sem joins:
> desnormalização e ids deterministas. Campos comuns: `created_at`,
> `updated_at` (`serverTimestamp`). Para o panorama, ver `docs/AI_CONTEXT.md`.

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
- Criado/atualizado pelo `FirebaseAuthContext`.

### `athlete_profiles/{uid}`
Perfil **público** do diretório de atletas (espelho controlado de `users`).
- `directory_listed: bool` — controla visibilidade no diretório (privacidade
  aplicada na escrita; `listAthletes()` filtra `where('directory_listed','==',true)`).
- Campos públicos: nome de exibição, nível, experiência, cidade etc.
- Sincronizado por `athleteService.syncAthleteProfile`.

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
- `kind` (`'single'|'recurring'`), `slots[]` (`{date, start, end, court_id?}`),
  `recurrence` (objeto, só se kind=recurring), `notes` (max 600).
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
(ver `NOTIFICATION_TYPE` em `AI_CONTEXT.md` §7), `link`, `read`, `actor`,
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

### `coach_clinics/{clinicId}` (Onda 7b)
Clínicas/workshops abertos (aula para grupo, não alunos regulares).
- `coach_id`, `title`, `description` (max 2000), `scheduled_at`,
  `duration_min`, `location`, `capacity`, `price`, `leveling_min`/`max`.
- `status` ('draft'|'open'|'full'|'closed'|'cancelled'),
  `signup_count`, `created_at`.

### `coach_clinic_signups/{signupId}` (Onda 7b)
Inscrição em clínica. `clinic_id`, `user_id`, `user_name`,
`payment_status`, `created_at`.

### `coach_level_validations/{validationId}` (Onda 7b)
Validação de nível de um atleta por um professor.
- `coach_id`, `athlete_id`, `validated_level`, `notes`,
  `validated_at`. Aparece em `users.leveling_*` quando aplicado.

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

## Cross-cutting (transversal)

### `users/{uid}.notification_prefs: object` (Onda 9b)
Preferências por categoria: `{booking_confirmed: bool, tournament_*: bool,
chat_*: bool, forum_*: bool, ...}`. Default todas ON.

### `users/{uid}.data_export_request: object` (Onda 9)
LGPD: request de export de dados (`{requested_at, status}`).

### `user_data_exports/{id}` (Onda 9)
Histórico de exports gerados. `user_id`, `data_url`, `expires_at`.

## Coleções Arena V3 (sempre atrás de sub-flags `ARENA_MODULE_*`)

> 35+ coleções criadas pelos módulos Arena V3 (PDV, members, leagues,
> marketing, IoT, operations, matchmaking). Detalhe completo em
> `docs/ARENA_V3/26-ARENA-V3-COMPLETE-REFERENCE.md`. Cada módulo
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

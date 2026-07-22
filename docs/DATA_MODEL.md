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
- `proposed_price`, `agreed_price`, `payment_status` (`'none'|'pending'|'paid'|'refunded'`).
- `created_by`, `created_at`, `updated_at`, `created_at_ms`.

### `arena_reviews/{id}`
Avaliações/reclamações/sugestões. `arena_id`, `user_id`, `user_name`,
`rating` (1-5, só se `type='review'`), `type` (`'review'|'complaint'|'suggestion'`),
`comment`, `response` (resposta da arena, opcional), `responded_at`,
`created_at`.

### `arena_favorites/{uid_arenaId}`
Favoritos do atleta. Id determinista. `user_id`, `arena_id`, `created_at`.

## Transversal

### `notifications/{id}`
Notificações do sino. `userId`, `title`, `message`, `type`
(ver `NOTIFICATION_TYPE` em `AI_CONTEXT.md` §7), `link`, `read`, `actor`,
`created_at`. Escrita por `createNotification` / `notifyUsers` (lote ≤400).

### `audit_logs/{id}`
Trilha de auditoria. `action` (ex.: `tournament_created`,
`club_member_invited`, `match_result_recorded`, `club_join_approved`…),
`actor`, `details`, `created_at`. Escrita por `auditService.createAuditLog`.

## Relacionamentos (resumo)

```
users (1) ──< tournaments (owner) ──< tournament_modalities ──< tournament_registrations
                         │                                  └──< tournament_matches >── tournament_courts
                         ├──< tournament_admins                    │
                         ├──< tournament_groups                    └──> tournament_rankings (materializado)
users (1) ──< athlete_profiles (perfil público, directory_listed)
clubs (1) ──< club_members ──> users
       ├──< club_join_requests / club_member_invites  (ingresso)
       ├──< club_posts (mural) · club_forum_threads ──< poll_votes / comments
       └──< club_events ──< club_event_rsvps / event_invites · dates ──< date_rsvps
conversations ──< messages
(qualquer ação) ──> audit_logs ;  (qualquer usuário) ──> notifications
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

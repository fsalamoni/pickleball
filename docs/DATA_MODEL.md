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

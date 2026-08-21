# `notifications/` — Sino + preferências por categoria

Notificações in-app com **preferências por categoria** (Onda 9b).

## Status
- **Services**: compartilhado em `core/services/notificationService.js`
- **Hooks**: `useNotifications` (lê + `unreadCount` + `markAsRead` +
  `markAllAsRead` Onda 1), `useNotificationPreferences` (Onda 9b)
- **Domain**: `preferences.js` (puro, testado)
- **Renderizado por**: `NotificationsMenu` no `V2Layout`
- **Tests**: 15+

## Schema
- `notifications/{id}` — `user_id`, `title`, `message`, `type`, `link`,
  `data`, `read`, `actor_id`/`actor_name`, `created_at`/`created_at_ms`
- `data` (opcional, aditivo) — mapa RASO de valores simples com um payload de
  AÇÃO para a notificação. Sanitizado em `notificationService` (só
  string/number/boolean/null; sem aninhados). Ex.: convite de dupla grava
  `{ kind: 'partner_invite', registration_id, tournament_id, modality_id }`.
  Notificações sem payload gravam `data: null` (comportamento anterior).
- `users/{uid}.notification_prefs: object` — `{category: bool}` (Onda 9b)
- Categorias silenciáveis: `booking_*`, `tournament_*`, `chat_*`, `forum_*`,
  `club_*`, `event_*`

## Tipos de notificação
`chat_message`, `chat_invite`, `forum_reply`, `forum_mention`,
`event_invite`, `club_join_request`, `club_join_approved`,
`club_join_rejected`, `club_invite`, `club_invite_accepted`,
`club_event_published`, `tournament_open`, `profile_reminder`,
`leveling_reminder`, `generic`

Ver `01-AI-CONTEXT.md §7` para lista canônica.

## Ações inline (na própria notificação)
Uma notificação pode oferecer uma ação DIRETO no sino, lida do seu `data`.
Hoje: **convite de dupla** (flag `partner_invite_quick_confirm`, requer
`partner_invites`). Quando ligada, a notificação `partner_invite` mostra
"Confirmar dupla"/"Recusar" — o componente
`v2/components/tournament/PartnerInviteNotificationAction.jsx` valida via
domínio puro (`partnerInviteNotificationRegistrationId`) e chama o MESMO serviço
da página do torneio (`respondPartnerInvite`). Desligada, a notificação apenas
leva ao torneio pelo `link` (comportamento anterior). Os botões param a
propagação para não fechar/navegar o item do menu.

## Lembretes derivados
`profile_reminder` e `leveling_reminder` NÃO são gravados no banco —
o `Layout` computa do `userProfile` enquanto a pendência existir.

## Onde achar mais
- `docs/06-MODULES.md` § notifications
- `docs/01-AI-CONTEXT.md` §7
- `docs/05-DATA-MODEL.md` § Transversal

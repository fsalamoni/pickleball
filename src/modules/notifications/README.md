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
- `notifications/{id}` — `userId`, `title`, `message`, `type`, `link`,
  `read`, `actor`, `created_at`
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

## Lembretes derivados
`profile_reminder` e `leveling_reminder` NÃO são gravados no banco —
o `Layout` computa do `userProfile` enquanto a pendência existir.

## Onde achar mais
- `docs/06-MODULES.md` § notifications
- `docs/01-AI-CONTEXT.md` §7
- `docs/05-DATA-MODEL.md` § Transversal

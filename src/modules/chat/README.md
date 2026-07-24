# `chat/` — Mensagens 1:1 e em grupo

Conversas 1:1 e em grupo. Gera notificações `chat_message` e `chat_invite`.

## Status
- **Páginas V2**: `V2Chat`
- **Componentes**: `V2ConversationList`, `V2ChatWindow`, `V2MessageBubble`,
  `V2ChatComposer`, `V2ChatLauncherButton`
- **Services**: `chatService`
- **Hooks**: `useChat`
- **Domain**: `conversations.js` (resolução/ordenação)
- **Tests**: 20+

## Schema
- `conversations/{id}` — `participants[]`, `lastMessage`, `type`
- `messages/{id}` — `conversation_id`, `sender_id`, `text`, `created_at`

## Hooks
```js
import { useChat } from '@/modules/chat/hooks/useChat';
import { useConversations } from '@/modules/chat/hooks/useConversations';
```

## Onde achar mais
- `docs/06-MODULES.md` § chat
- `docs/05-DATA-MODEL.md` § Chat

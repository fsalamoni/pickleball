/**
 * Constantes do domínio de Chat (mensagens diretas e em grupo).
 *
 * Coleções Firestore:
 *  - conversations              (uma conversa direta ou em grupo)
 *  - conversations/{id}/messages (subcoleção de mensagens; o acesso é validado
 *                     pelo documento-pai — membros da conversa — sem denormalizar
 *                     membros em cada mensagem nem exigir índices compostos)
 *
 * Decisão de modelagem: as consultas de conversas usam apenas `where`
 * (array-contains) e as de mensagens leem a subcoleção inteira, ordenando no
 * cliente — evitando índices compostos e erros de runtime por "índice ausente".
 */

export const CHAT_COLLECTIONS = Object.freeze({
  conversations: 'conversations',
  messages: 'messages',
});

export const CONVERSATION_TYPE = Object.freeze({
  DIRECT: 'direct',
  GROUP: 'group',
});

/** Limites de robustez. */
export const CHAT_LIMITS = Object.freeze({
  MESSAGE_MAX_CHARS: 4000,
  GROUP_TITLE_MAX: 80,
  MAX_ATTACHMENTS: 10,
  MAX_GROUP_MEMBERS: 50,
});

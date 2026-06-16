import { CONVERSATION_TYPE } from './constants.js';

/**
 * Funções puras do domínio de chat — fáceis de testar e sem dependências do
 * Firebase. Cuidam de identidade determinística de conversas diretas, título
 * de exibição, normalização de membros e resumo da última mensagem.
 */

/** Normaliza um membro para o formato denormalizado da conversa. */
export function toMember(person) {
  if (!person) return null;
  const uid = person.uid || person.id || person.user_id;
  if (!uid) return null;
  return {
    uid,
    name: person.name || person.platform_name || person.full_name || person.displayName || 'Atleta',
    photo_url: person.photo_url || person.photoURL || '',
  };
}

/** Lista de membros sem duplicados e sem entradas inválidas. */
export function dedupeMembers(people) {
  const map = new Map();
  (people || []).forEach((p) => {
    const m = toMember(p);
    if (m && !map.has(m.uid)) map.set(m.uid, m);
  });
  return Array.from(map.values());
}

/**
 * Id determinístico de uma conversa direta entre dois usuários. Garante que
 * A→B e B→A apontem para o MESMO documento (sem duplicar conversas).
 */
export function directConversationId(uidA, uidB) {
  const a = String(uidA || '').trim();
  const b = String(uidB || '').trim();
  if (!a || !b) return null;
  return `dm_${[a, b].sort().join('__')}`;
}

/** Decide o tipo de conversa a partir da contagem de membros. */
export function conversationTypeFor(memberIds) {
  return (memberIds || []).length > 2 ? CONVERSATION_TYPE.GROUP : CONVERSATION_TYPE.DIRECT;
}

/**
 * Título de exibição da conversa para um usuário específico (`viewerId`).
 *  - Grupo: usa o título salvo ou a lista de nomes dos outros membros.
 *  - Direta: nome do outro participante.
 */
export function conversationTitle(conversation, viewerId) {
  if (!conversation) return 'Conversa';
  const others = (conversation.members || []).filter((m) => m.uid !== viewerId);
  if (conversation.type === CONVERSATION_TYPE.GROUP) {
    if (conversation.title && conversation.title.trim()) return conversation.title.trim();
    const names = others.map((m) => firstName(m.name)).filter(Boolean);
    if (names.length === 0) return 'Grupo';
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
  }
  return others[0]?.name || conversation.title || 'Conversa';
}

/** Outro participante de uma conversa direta (para avatar/cabeçalho). */
export function directCounterpart(conversation, viewerId) {
  if (!conversation || conversation.type === CONVERSATION_TYPE.GROUP) return null;
  return (conversation.members || []).find((m) => m.uid !== viewerId) || null;
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** Resumo curto da última mensagem para a lista de conversas. */
export function lastMessagePreview(conversation) {
  const last = conversation?.last_message;
  if (!last) return 'Conversa iniciada';
  if (last.text && last.text.trim()) return last.text.trim();
  if (last.has_attachments) return '📎 Anexo';
  return 'Mensagem';
}

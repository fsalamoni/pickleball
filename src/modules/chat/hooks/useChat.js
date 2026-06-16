import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  subscribeToConversations,
  subscribeToMessages,
  getOrCreateDirectConversation,
  createGroupConversation,
  startGroupFromConversation,
  renameConversation,
  leaveConversation,
  hideConversation,
  sendMessage,
  editMessage,
  deleteMessage,
} from '../services/chatService';

/** Assina, em tempo real, as conversas do usuário autenticado. */
export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      setIsLoading(false);
      return undefined;
    }
    setIsLoading(true);
    const unsubscribe = subscribeToConversations(user.uid, (list) => {
      setConversations(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  return { conversations, isLoading };
}

/** Assina, em tempo real, as mensagens de uma conversa. */
export function useMessages(conversationId) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setIsLoading(false);
      return undefined;
    }
    setIsLoading(true);
    const unsubscribe = subscribeToMessages(conversationId, (list) => {
      setMessages(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [conversationId]);

  return { messages, isLoading };
}

/**
 * Ações de chat já vinculadas ao usuário/perfil atual. Todas retornam Promise
 * e propagam erros para que a UI exiba toasts apropriados.
 */
export function useChatActions() {
  const { user, userProfile } = useAuth();

  return useMemo(
    () => ({
      startDirect: (other) => getOrCreateDirectConversation(user, userProfile, other),
      createGroup: (people, title) => createGroupConversation(user, userProfile, people, title),
      startGroupFrom: (conversation, newPeople) => startGroupFromConversation(conversation, newPeople, user, userProfile),
      rename: (conversationId, title) => renameConversation(conversationId, title),
      leave: (conversation) => leaveConversation(conversation, user),
      hide: (conversation) => hideConversation(conversation, user),
      send: (conversation, payload) => sendMessage(conversation, payload, user, userProfile),
      edit: (message, text) => editMessage(message.conversation_id, message.id, text, user),
      remove: (message) => deleteMessage(message, user),
    }),
    [user, userProfile],
  );
}

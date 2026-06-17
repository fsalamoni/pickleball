import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, 'notifications'), where('user_id', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const aTime = a.created_at?.toMillis?.() ?? a.created_at_ms ?? 0;
              const bTime = b.created_at?.toMillis?.() ?? b.created_at_ms ?? 0;
              return bTime - aTime;
            }),
        );
        setIsLoading(false);
      },
      (err) => {
        // Falha (ex.: regra de leitura) não pode quebrar a aplicação; loga e
        // mantém o sino vazio em vez de travar em "carregando".
        logger.error('Falha ao escutar notificações:', err);
        setNotifications([]);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = async (notifId) => {
    await updateDoc(doc(db, 'notifications', notifId), {
      read: true,
      read_at: serverTimestamp(),
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, isLoading, markAsRead };
}

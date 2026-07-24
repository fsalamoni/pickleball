import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { isNotificationMuted } from '@/modules/notifications/domain/preferences';

export function useNotifications() {
  const { user, userProfile } = useAuth();
  const prefsOn = useFeatureFlag(FEATURE_FLAG.NOTIFICATION_PREFS);
  const [allNotifications, setAllNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Imposição das preferências na leitura: quando a flag está ligada, esconde
  // do sino as notificações de categorias que o usuário silenciou. Desligada,
  // mostra tudo (comportamento anterior).
  const notifications = useMemo(() => {
    if (!prefsOn) return allNotifications;
    const prefs = userProfile?.notification_prefs;
    return allNotifications.filter((n) => !isNotificationMuted(prefs, n.type));
  }, [allNotifications, prefsOn, userProfile?.notification_prefs]);

  useEffect(() => {
    if (!user) {
      setAllNotifications([]);
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, 'notifications'), where('user_id', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setAllNotifications(
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
        setAllNotifications([]);
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

  // Marca todas as não lidas de uma vez, em lotes (limite do Firestore é
  // 500 operações por batch; 450 deixa folga).
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    for (let i = 0; i < unread.length; i += 450) {
      const batch = writeBatch(db);
      unread.slice(i, i + 450).forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), {
          read: true,
          read_at: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}

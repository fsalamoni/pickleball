import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
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
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aTime = a.created_at?.toMillis?.() ?? 0;
            const bTime = b.created_at?.toMillis?.() ?? 0;
            return bTime - aTime;
          }),
      );
      setIsLoading(false);
    });
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

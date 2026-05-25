import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

/**
 * Stream de TODOS os palpites do usuário em um bolão. Indexado por match_id.
 */
export function useMyBets(poolId) {
  const { user } = useAuth();
  const [betsByMatch, setBetsByMatch] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !poolId) {
      setBetsByMatch({});
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'bets'),
      where('user_id', '==', user.uid),
      where('pool_id', '==', poolId),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[data.match_id] = { id: d.id, ...data };
      });
      setBetsByMatch(map);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid, poolId]);

  return { betsByMatch, isLoading };
}

export function useMySpecialBets(poolId) {
  const { user } = useAuth();
  const [specialByType, setSpecialByType] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !poolId) {
      setSpecialByType({});
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'special_bets'),
      where('user_id', '==', user.uid),
      where('pool_id', '==', poolId),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[data.type] = { id: d.id, ...data };
      });
      setSpecialByType(map);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid, poolId]);

  return { specialByType, isLoading };
}

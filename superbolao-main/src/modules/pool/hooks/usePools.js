import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { logger } from '@/core/lib/logger';
import { ensureOwnerMembership } from '@/modules/pool/services/poolsService';

function sortPoolsByActivity(poolList) {
  return [...poolList].sort((firstPool, secondPool) => {
    const firstTime = firstPool.joined_at?.toMillis?.() ?? firstPool.created_at?.toMillis?.() ?? 0;
    const secondTime = secondPool.joined_at?.toMillis?.() ?? secondPool.created_at?.toMillis?.() ?? 0;
    return secondTime - firstTime;
  });
}

function mergePoolLists(membershipPools, ownedPools) {
  const byId = new Map();

  ownedPools.forEach((pool) => {
    byId.set(pool.id, {
      ...pool,
      userRole: 'owner',
      userPoints: 0,
      userBuchas: 0,
      userSuperBuchas: 0,
      joined_at: pool.joined_at || pool.created_at,
    });
  });

  membershipPools.forEach((pool) => {
    const existing = byId.get(pool.id) || {};
    byId.set(pool.id, {
      ...existing,
      ...pool,
      userRole: pool.userRole || existing.userRole,
    });
  });

  return sortPoolsByActivity(Array.from(byId.values()));
}

/**
 * Lista os bolões do usuário logado, com sua role (`owner|admin|participant`).
 */
export function useMyPools() {
  const { user } = useAuth();
  const [pools, setPools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setPools([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let active = true;
    let membershipPools = null;
    let ownedPools = null;
    const repairedPoolIds = new Set();

  const publish = () => {
      if (!active || membershipPools === null || ownedPools === null) return;

      const membershipPoolIds = new Set(membershipPools.map((pool) => pool.id));
      ownedPools.forEach((pool) => {
        if (membershipPoolIds.has(pool.id) || repairedPoolIds.has(pool.id)) return;
        repairedPoolIds.add(pool.id);
        ensureOwnerMembership(pool.id, user).catch((e) => logger.error('ensureOwnerMembership error:', e));
      });

      const merged = mergePoolLists(membershipPools, ownedPools);
      // Filtra pools soft-deletados (usuários comuns não devem vê-los; admins da plataforma só veem via /admin/boloes)
      const visible = merged.filter((p) => !p.deleted);
      setPools(visible);
      setIsLoading(false);
    };

    const membershipQuery = query(collection(db, 'pool_memberships'), where('user_id', '==', user.uid));
    const ownedPoolsQuery = query(collection(db, 'pools'), where('owner_user_id', '==', user.uid));

    const handleError = (e) => {
      logger.error('useMyPools listener error:', e);
      setError(e.message);
      setIsLoading(false);
    };

    const unsubscribeMemberships = onSnapshot(
      membershipQuery,
      async (snapshot) => {
        try {
          const promises = snapshot.docs.map(async (memDoc) => {
            const membership = memDoc.data();
            const poolDoc = await getDoc(doc(db, 'pools', membership.pool_id));
            if (!poolDoc.exists()) return null;
            return {
              id: poolDoc.id,
              ...poolDoc.data(),
              userRole: membership.role,
              userPoints: membership.points || 0,
              userBuchas: membership.buchas || 0,
              userSuperBuchas: membership.super_buchas || 0,
              joined_at: membership.joined_at,
            };
          });
          membershipPools = (await Promise.all(promises)).filter(Boolean);
          publish();
        } catch (e) {
          logger.error('useMyPools error:', e);
          setError(e.message);
          setIsLoading(false);
        }
      },
      handleError,
    );

    const unsubscribeOwnedPools = onSnapshot(
      ownedPoolsQuery,
      (snapshot) => {
        ownedPools = snapshot.docs.map((poolDoc) => ({
          id: poolDoc.id,
          ...poolDoc.data(),
          userRole: 'owner',
        }));
        publish();
      },
      handleError,
    );

    return () => {
      active = false;
      unsubscribeMemberships();
      unsubscribeOwnedPools();
    };
  }, [user?.uid]);

  return { pools, isLoading, error };
}

/**
 * Stream de um bolão específico.
 */
export function usePool(poolId) {
  const { isPlatformAdmin } = useAuth();
  const [pool, setPool] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!poolId) {
      setPool(null);
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'pools', poolId),
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          // Pool soft-deletado: apenas platform admin pode acessar
          if (data.deleted && !isPlatformAdmin) {
            setPool(null);
          } else {
            setPool(data);
          }
        } else {
          setPool(null);
        }
        setIsLoading(false);
      },
      (e) => {
        setError(e.message);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [poolId, isPlatformAdmin]);

  return { pool, isLoading, error };
}

/**
 * Stream da membership do usuário atual em um bolão.
 */
export function useMyMembership(poolId) {
  const { user } = useAuth();
  const [membership, setMembership] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !poolId) {
      setMembership(null);
      setIsLoading(false);
      return;
    }
    const id = `${user.uid}_${poolId}`;
    const unsubscribe = onSnapshot(doc(db, 'pool_memberships', id), (snap) => {
      setMembership(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid, poolId]);

  return { membership, isLoading };
}

/**
 * Stream da classificação (leaderboard) de um bolão.
 */
export function usePoolLeaderboard(poolId) {
  const [memberships, setMemberships] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!poolId) {
      setMemberships([]);
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'pool_memberships'),
      where('pool_id', '==', poolId),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMemberships(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.points || 0) - (a.points || 0)),
      );
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [poolId]);

  return { memberships, isLoading };
}

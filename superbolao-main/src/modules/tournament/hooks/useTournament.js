import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';

/**
 * Busca uma vez (não-realtime) toda a estrutura estática do torneio:
 * tournaments, stages, groups, teams, scoring_tiers.
 * Matches são consumidos separadamente porque atualizam (placar oficial, kickoff).
 */
export function useTournamentStaticData(tournamentId = null) {
  const [data, setData] = useState({
    tournament: null,
    stages: [],
    groups: [],
    teams: [],
    scoringTiers: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tournament = tournamentId === false ? null : await loadTournament(tournamentId);

        const [stages, groups, teams, tiers] = await Promise.all([
          tournament
            ? getDocs(
                query(
                  collection(db, 'stages'),
                  where('tournament_id', '==', tournament.id),
                  orderBy('sort_order', 'asc'),
                ),
              )
            : Promise.resolve({ docs: [] }),
          tournament
            ? getDocs(query(collection(db, 'groups'), where('tournament_id', '==', tournament.id)))
            : Promise.resolve({ docs: [] }),
          getDocs(collection(db, 'teams')),
          getDocs(collection(db, 'scoring_tiers')),
        ]);

        if (cancelled) return;
        setData({
          tournament,
          stages: stages.docs.map((d) => ({ id: d.id, ...d.data() })),
          groups: groups.docs.map((d) => ({ id: d.id, ...d.data() })),
          teams: teams.docs.map((d) => ({ id: d.id, ...d.data() })),
          scoringTiers: tiers.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return { ...data, isLoading, error };
}

async function loadTournament(tournamentId) {
  if (tournamentId) {
    const snap = await getDoc(doc(db, 'tournaments', tournamentId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  const tournSnap = await getDocs(collection(db, 'tournaments'));
  return tournSnap.docs[0] ? { id: tournSnap.docs[0].id, ...tournSnap.docs[0].data() } : null;
}

/**
 * Stream das matches de uma fase (kickoff_at, status, placar oficial podem mudar).
 */
export function useMatchesByStage(tournamentId, stageCode) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId || !stageCode) {
      setMatches([]);
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'matches'),
      where('tournament_id', '==', tournamentId),
      where('stage_code', '==', stageCode),
      orderBy('sequence_in_stage', 'asc'),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [tournamentId, stageCode]);

  return { matches, isLoading };
}

/**
 * Stream de TODAS as matches de um torneio, ordenadas por kickoff_at.
 */
export function useAllTournamentMatches(tournamentId) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) {
      setMatches([]);
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'matches'),
      where('tournament_id', '==', tournamentId),
      orderBy('kickoff_at', 'asc'),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [tournamentId]);

  return { matches, isLoading };
}

export function usePoolCompetitors(poolId) {
  const [competitors, setCompetitors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!poolId) {
      setCompetitors([]);
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, 'pool_competitors'), where('pool_id', '==', poolId), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCompetitors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [poolId]);

  return { competitors, isLoading };
}

export function usePoolMatchesByStage(poolId, stageCode) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!poolId || !stageCode) {
      setMatches([]);
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'pool_matches'),
      where('pool_id', '==', poolId),
      where('stage_code', '==', stageCode),
      orderBy('sequence_in_stage', 'asc'),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [poolId, stageCode]);

  return { matches, isLoading };
}

export function useAllPoolMatches(poolId) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!poolId) {
      setMatches([]);
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, 'pool_matches'), where('pool_id', '==', poolId), orderBy('kickoff_at', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [poolId]);

  return { matches, isLoading };
}

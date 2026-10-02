/**
 * Hooks de desafios, entradas e duelos.
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelChallenge, createChallenge, declineDuel, deleteChallenge, joinChallenge, joinChallengeAsClub,
  leaveChallenge, listActiveChallenges, listChallengesByIssuer, listEntries, listFinishedChallenges,
  listMyDuels, listMyEntries, updateChallenge,
} from '@/modules/progression/services/challengeService';
import { ACTIVITY_FACTS_KEY } from './useActivityFacts';

const ACTIVE_KEY = ['gamification-challenges', 'active'];
const FINISHED_KEY = ['gamification-challenges', 'finished'];
const MINE_KEY = (uid) => ['gamification-entries', uid];
const ENTRIES_KEY = (id) => ['gamification-entries-of', id];
const DUELS_KEY = (uid) => ['gamification-duels', uid];
const ISSUER_KEY = (t, id) => ['gamification-challenges', 'issuer', t, id];

export function useActiveChallenges(enabled = true) {
  const q = useQuery({ queryKey: ACTIVE_KEY, queryFn: listActiveChallenges, enabled, staleTime: 60_000 });
  return { challenges: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useFinishedChallenges(enabled = true) {
  const q = useQuery({ queryKey: FINISHED_KEY, queryFn: () => listFinishedChallenges(), enabled, staleTime: 5 * 60_000 });
  return { challenges: q.data || [], isLoading: q.isLoading, isError: q.isError };
}

export function useMyEntries(uid, enabled = true) {
  const q = useQuery({ queryKey: MINE_KEY(uid), queryFn: () => listMyEntries(uid), enabled: !!uid && enabled, staleTime: 60_000 });
  const entries = useMemo(() => q.data || [], [q.data]);
  const byChallenge = useMemo(() => new Map(entries.map((e) => [e.challengeId, e])), [entries]);
  return { entries, byChallenge, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

/** O placar de um desafio (todas as entradas). */
export function useChallengeEntries(challengeId, enabled = true) {
  const q = useQuery({ queryKey: ENTRIES_KEY(challengeId), queryFn: () => listEntries(challengeId), enabled: !!challengeId && enabled, staleTime: 60_000 });
  return { entries: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useChallengeActions(uid) {
  const qc = useQueryClient();
  const refresh = (challengeId) => {
    qc.invalidateQueries({ queryKey: MINE_KEY(uid) });
    if (challengeId) qc.invalidateQueries({ queryKey: ENTRIES_KEY(challengeId) });
    qc.invalidateQueries({ queryKey: ACTIVITY_FACTS_KEY(uid) });
  };
  const join = useMutation({ mutationFn: (challengeId) => joinChallenge(challengeId, uid), onSuccess: (_, id) => refresh(id) });
  const joinClub = useMutation({
    mutationFn: ({ challengeId, clubId }) => joinChallengeAsClub(challengeId, clubId, uid),
    onSuccess: (_, v) => refresh(v.challengeId),
  });
  const leave = useMutation({ mutationFn: ({ entryId }) => leaveChallenge(entryId), onSuccess: (_, v) => refresh(v.challengeId) });
  return { join, joinClub, leave };
}

/** Os desafios que um emissor criou (rascunhos inclusos) e como mexer neles. */
export function useIssuerChallenges(issuer, actor, enabled = true) {
  const qc = useQueryClient();
  const key = ISSUER_KEY(issuer?.type, issuer?.id);
  const q = useQuery({
    queryKey: key,
    queryFn: () => listChallengesByIssuer(issuer.type, issuer.id),
    enabled: !!issuer?.type && !!issuer?.id && enabled,
    staleTime: 30_000,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ACTIVE_KEY });
  };
  const create = useMutation({ mutationFn: (input) => createChallenge(input, issuer, actor), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, atual, patch }) => updateChallenge(id, atual, patch, issuer, actor), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: (id) => cancelChallenge(id, actor), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => deleteChallenge(id), onSuccess: refresh });
  return { challenges: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, create, update, cancel, remove };
}

export function useMyDuels(uid, enabled = true) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: DUELS_KEY(uid), queryFn: () => listMyDuels(uid), enabled: !!uid && enabled, staleTime: 60_000 });
  const decline = useMutation({ mutationFn: (duelId) => declineDuel(duelId, uid), onSuccess: () => qc.invalidateQueries({ queryKey: DUELS_KEY(uid) }) });
  return { duels: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, decline };
}

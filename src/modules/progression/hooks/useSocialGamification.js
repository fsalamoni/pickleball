/**
 * Hooks da camada social da gamificação: avaliações pós-jogo, cartas ao
 * companheiro e reputação. Finos de propósito — a regra está nos domínios.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyPrivateReputation, getReputation, listMyReviews, listReceivedLetters, listSentLetters,
  markLetterRead, reportLetter, deleteLetter, retractReview, sendPartnerLetter, submitMatchReviews,
} from '@/modules/progression/services/socialGamificationService';
import { ACTIVITY_FACTS_KEY } from './useActivityFacts';

const REVIEWS_KEY = (uid) => ['gamification-my-reviews', uid];
const LETTERS_KEY = (uid) => ['gamification-letters-received', uid];
const SENT_KEY = (uid) => ['gamification-letters-sent', uid];

export function useMyReviews(uid, enabled = true) {
  const q = useQuery({ queryKey: REVIEWS_KEY(uid), queryFn: () => listMyReviews(uid), enabled: !!uid && enabled, staleTime: 60_000 });
  return { reviews: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useSubmitReviews(uid) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p) => submitMatchReviews({ fromUid: uid, ...p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REVIEWS_KEY(uid) });
      qc.invalidateQueries({ queryKey: ACTIVITY_FACTS_KEY(uid) });
    },
  });
}

export function useRetractReview(uid) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => retractReview(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: REVIEWS_KEY(uid) }),
  });
}

/** A reputação PÚBLICA de alguém (agregado do servidor). */
export function useReputation(uid, enabled = true) {
  const q = useQuery({ queryKey: ['gamification-reputation', uid], queryFn: () => getReputation(uid), enabled: !!uid && enabled, staleTime: 5 * 60_000 });
  return { reputation: q.data || null, isLoading: q.isLoading, isError: q.isError };
}

/** O que só a própria pessoa vê (categorias de problema). */
export function useMyPrivateReputation(uid, enabled = true) {
  const q = useQuery({ queryKey: ['gamification-reputation-private', uid], queryFn: () => getMyPrivateReputation(uid), enabled: !!uid && enabled, staleTime: 5 * 60_000 });
  return { privateReputation: q.data || null, isLoading: q.isLoading };
}

export function useReceivedLetters(uid, enabled = true) {
  const q = useQuery({ queryKey: LETTERS_KEY(uid), queryFn: () => listReceivedLetters(uid), enabled: !!uid && enabled, staleTime: 60_000 });
  const letters = [...(q.data || [])].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  return { letters, unread: letters.filter((l) => !l.readAt).length, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useSentLetters(uid, enabled = true) {
  const q = useQuery({ queryKey: SENT_KEY(uid), queryFn: () => listSentLetters(uid), enabled: !!uid && enabled, staleTime: 60_000 });
  return { sent: q.data || [], isLoading: q.isLoading, isError: q.isError };
}

export function useLetterActions(uid) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: LETTERS_KEY(uid) });
  const send = useMutation({
    mutationFn: (p) => sendPartnerLetter({ fromUid: uid, ...p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SENT_KEY(uid) });
      qc.invalidateQueries({ queryKey: ACTIVITY_FACTS_KEY(uid) });
    },
  });
  const read = useMutation({ mutationFn: markLetterRead, onSuccess: refresh });
  const report = useMutation({ mutationFn: reportLetter, onSuccess: refresh });
  const remove = useMutation({ mutationFn: deleteLetter, onSuccess: refresh });
  return { send, read, report, remove };
}

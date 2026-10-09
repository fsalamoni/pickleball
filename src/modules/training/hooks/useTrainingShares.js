import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteShare, listInbox, listSent, markShareRead, setShareDone, shareItem } from '../services/shareService';
import { trainingKeys } from './trainingKeys';

export function useTrainingInbox(uid) {
  return useQuery({ queryKey: trainingKeys.inbox(uid), queryFn: () => listInbox(uid), enabled: !!uid });
}

export function useTrainingSent(uid, { enabled = true } = {}) {
  return useQuery({ queryKey: trainingKeys.sent(uid), queryFn: () => listSent(uid), enabled: !!uid && enabled });
}

/**
 * `mutate({ item, toUids, kind, note, dueDate, activeStudentIds })`
 * → `{ sent, skipped, notified }`.
 */
export function useShareTrainingItem(identity, settings) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p) => shareItem({ ...p, identity, settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trainingKeys.shares });
      qc.invalidateQueries({ queryKey: trainingKeys.items });
    },
  });
}

/** Marcar lido / feito / desfazer / apagar. */
export function useShareActions() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: trainingKeys.shares });
  return {
    markRead: useMutation({ mutationFn: markShareRead, onSuccess: inv }),
    setDone: useMutation({ mutationFn: ({ share, done, note }) => setShareDone(share, done, note), onSuccess: inv }),
    remove: useMutation({ mutationFn: deleteShare, onSuccess: inv }),
  };
}

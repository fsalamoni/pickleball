import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listThreads,
  getThread,
  createThread,
  updateThread,
  deleteThread,
  setThreadPinned,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  listPollVotes,
  getMyPollVote,
  setPollVote,
} from '../services/forumService';

/* -------------------------------- Threads ------------------------------- */

export function useForumThreads(clubId) {
  return useQuery({
    queryKey: ['forum-threads', clubId],
    queryFn: () => listThreads(clubId),
    enabled: !!clubId,
  });
}

export function useForumThread(threadId) {
  return useQuery({
    queryKey: ['forum-thread', threadId],
    queryFn: () => getThread(threadId),
    enabled: !!threadId,
  });
}

export function useCreateThread(clubId) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createThread(clubId, input, user, userProfile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-threads', clubId] }),
  });
}

export function useUpdateThread(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, updates }) => updateThread(threadId, updates, user),
    onSuccess: (_data, { threadId }) => {
      qc.invalidateQueries({ queryKey: ['forum-threads', clubId] });
      qc.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}

export function useDeleteThread(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thread) => deleteThread(thread, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-threads', clubId] }),
  });
}

export function useSetThreadPinned(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, pinned }) => setThreadPinned(threadId, pinned, user),
    onSuccess: (_data, { threadId }) => {
      qc.invalidateQueries({ queryKey: ['forum-threads', clubId] });
      qc.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}

/* ------------------------------- Comments ------------------------------- */

export function useForumComments(threadId) {
  return useQuery({
    queryKey: ['forum-comments', threadId],
    queryFn: () => listComments(threadId),
    enabled: !!threadId,
  });
}

export function useAddComment(clubId, threadId) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thread, input }) => addComment(thread, input, user, userProfile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum-comments', threadId] });
      qc.invalidateQueries({ queryKey: ['forum-threads', clubId] });
      qc.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}

export function useUpdateComment(threadId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }) => updateComment(threadId, commentId, body, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-comments', threadId] }),
  });
}

export function useDeleteComment(clubId, threadId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment) => deleteComment(comment, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum-comments', threadId] });
      qc.invalidateQueries({ queryKey: ['forum-threads', clubId] });
    },
  });
}

/* -------------------------------- Polls --------------------------------- */

export function usePollVotes(threadId) {
  return useQuery({
    queryKey: ['forum-votes', threadId],
    queryFn: () => listPollVotes(threadId),
    enabled: !!threadId,
  });
}

export function useMyPollVote(threadId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['forum-my-vote', threadId, user?.uid],
    queryFn: () => getMyPollVote(threadId, user?.uid),
    enabled: !!threadId && !!user?.uid,
  });
}

export function useSetPollVote(threadId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thread, optionIds }) => setPollVote(thread, optionIds, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum-votes', threadId] });
      qc.invalidateQueries({ queryKey: ['forum-my-vote', threadId] });
    },
  });
}

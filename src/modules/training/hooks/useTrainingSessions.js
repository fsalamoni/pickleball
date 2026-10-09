import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComment, confirmSession, createSession, deleteComment, deleteSession, listComments, listMySessions,
  listStudentSessions, updateSession,
} from '../services/sessionService';
import { trainingKeys } from './trainingKeys';

export function useMyTrainingSessions(uid) {
  return useQuery({ queryKey: trainingKeys.mySessions(uid), queryFn: () => listMySessions(uid), enabled: !!uid });
}

/** Sessões compartilhadas pelos alunos ativos. `data` = `{ items, incompleto }`. */
export function useStudentTrainingSessions(coachUid, studentIds = []) {
  return useQuery({
    queryKey: trainingKeys.studentSessions(coachUid, studentIds),
    queryFn: () => listStudentSessions(coachUid, studentIds),
    enabled: !!coachUid && studentIds.length > 0,
  });
}

export function useSessionComments(sessionId, { enabled = true } = {}) {
  return useQuery({ queryKey: trainingKeys.comments(sessionId), queryFn: () => listComments(sessionId), enabled: !!sessionId && enabled });
}

/** Registrar, editar, apagar, confirmar (professor), comentar. */
export function useSessionActions(identity) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: trainingKeys.sessions });
  return {
    create: useMutation({ mutationFn: (input) => createSession(input, { identity }), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ session, input }) => updateSession(session, input, { identity }), onSuccess: inv }),
    remove: useMutation({ mutationFn: deleteSession, onSuccess: inv }),
    confirm: useMutation({ mutationFn: (session) => confirmSession(session, { identity }), onSuccess: inv }),
    comment: useMutation({
      mutationFn: ({ session, text }) => addComment(session, text, { identity }),
      onSuccess: (_, v) => qc.invalidateQueries({ queryKey: trainingKeys.comments(v.session.id) }),
    }),
    deleteComment: useMutation({
      mutationFn: ({ sessionId, commentId }) => deleteComment(sessionId, commentId),
      onSuccess: (_, v) => qc.invalidateQueries({ queryKey: trainingKeys.comments(v.sessionId) }),
    }),
  };
}

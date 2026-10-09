import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createQuestion, deleteQuestion, listCoachQuestions, listMessages, listMyQuestions, sendMessage, setQuestionClosed,
} from '../services/questionService';
import { trainingKeys } from './trainingKeys';

export function useMyTrainingQuestions(uid) {
  return useQuery({ queryKey: trainingKeys.myQuestions(uid), queryFn: () => listMyQuestions(uid), enabled: !!uid });
}

export function useCoachTrainingQuestions(uid, { enabled = true } = {}) {
  return useQuery({ queryKey: trainingKeys.coachQuestions(uid), queryFn: () => listCoachQuestions(uid), enabled: !!uid && enabled });
}

export function useQuestionMessages(questionId) {
  return useQuery({ queryKey: trainingKeys.messages(questionId), queryFn: () => listMessages(questionId), enabled: !!questionId });
}

export function useQuestionActions(identity) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: trainingKeys.questions });
  return {
    create: useMutation({ mutationFn: (input) => createQuestion(input, { identity }), onSuccess: inv }),
    send: useMutation({ mutationFn: ({ question, text }) => sendMessage(question, text, { identity }), onSuccess: inv }),
    close: useMutation({ mutationFn: ({ question, closed }) => setQuestionClosed(question, closed), onSuccess: inv }),
    remove: useMutation({ mutationFn: deleteQuestion, onSuccess: inv }),
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listDuprSubmissions, submissionAction } from '@/modules/rating/services/duprOfficial';

const KEY = ['dupr', 'submissions'];

/** O livro de envios ao DUPR e a última passada (só o admin lê tudo). */
export function useDuprSubmissions() {
  return useQuery({ queryKey: KEY, queryFn: listDuprSubmissions });
}

/** Uma ação do admin nos envios (`run`, `approve`, `retry`, `remove`, `unblock`); recarrega o livro. */
export function useDuprSubmissionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ acao, ...payload }) => submissionAction(acao, payload),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

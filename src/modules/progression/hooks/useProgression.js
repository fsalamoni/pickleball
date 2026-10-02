import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { getPlayerH2HRecords } from '@/modules/rating/services/headToHeadService';
import { createGoal, listGoals, deleteGoal } from '../services/goalService.js';

/**
 * Os registros de confronto de torneio do atleta (`{ opponent, won, at, ... }`).
 * Uma consulta só, com chave própria: as datas (streak, missões), o confronto
 * direto e a avaliação pós-jogo leem a MESMA — antes cada um varria as
 * inscrições e os jogos de todas as modalidades por conta própria.
 */
export const PLAYER_RECORDS_KEY = (uid) => ['player-h2h-records', uid];

/** Datas (ms) dos jogos do atleta — usadas para o streak de semanas ativas. */
export function usePlayerMatchDates(uid, enabled = true) {
  return useQuery({
    queryKey: PLAYER_RECORDS_KEY(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
    queryFn: () => getPlayerH2HRecords(uid),
    select: (records) => records.map((r) => r.at).filter(Boolean),
  });
}

/** Metas do usuário. */
export function useGoals(uid, enabled = true) {
  return useQuery({
    queryKey: ['player-goals', uid],
    queryFn: () => listGoals(uid),
    enabled: !!uid && enabled,
  });
}

export function useCreateGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createGoal(input, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['player-goals', user?.uid] }),
  });
}

export function useDeleteGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteGoal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['player-goals', user?.uid] }),
  });
}

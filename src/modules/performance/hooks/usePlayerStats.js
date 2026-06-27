import { useMemo } from 'react';
import { useMyTournamentHistory } from '@/modules/tournament/hooks/useTournament';
import { buildPlayerStats } from '../domain/playerStats.js';

/**
 * Desempenho pessoal consolidado do usuário autenticado.
 *
 * Reaproveita o histórico de participações (`useMyTournamentHistory`) e aplica a
 * agregação pura `buildPlayerStats`. Não faz I/O adicional.
 *
 * @returns {{ stats: ReturnType<typeof buildPlayerStats>, history: Array<object>, isLoading: boolean }}
 */
export function usePlayerStats() {
  const { data: history = [], isLoading } = useMyTournamentHistory();
  const stats = useMemo(() => buildPlayerStats(history), [history]);
  return { stats, history, isLoading };
}

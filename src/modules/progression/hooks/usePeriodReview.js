/**
 * usePeriodReview — a revisão de UM período (semana ou mês) da pessoa logada.
 *
 * Tudo é derivado de registros datados que já existem; nada é gravado. A fonte
 * que falhar entra em `incomplete` e a tela avisa — número afirmado sobre dado
 * que não carregou seria mentira.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listUserMissions } from '@/modules/progression/services/missionService';
import { buildPeriodReview, periodWindow } from '@/modules/progression/domain/periodReview';
import { useGameRecords } from './useGameRecords';

const MISSIONS_KEY = (uid) => ['gamification-review-missions', uid];

/**
 * @param {object} engine saída de `useGamificationEngine`
 * @param {'week'|'month'} kind
 * @param {number} [offset] 0 = corrente, -1 = anterior...
 */
export function usePeriodReview(engine, kind = 'week', offset = 0) {
  const uid = engine?.uid;
  const gameRecords = useGameRecords(uid, !!uid);
  const missionsQ = useQuery({
    queryKey: MISSIONS_KEY(uid),
    queryFn: () => listUserMissions(uid, 120),
    enabled: !!uid,
    staleTime: 5 * 60_000,
  });
  const ratingPoints = engine?.ratingPoints;

  const review = useMemo(() => {
    if (!uid || !engine) return null;
    const incompleteSources = [...gameRecords.incomplete];
    if (missionsQ.isError) incompleteSources.push('missões');
    if (engine.facts?.unknown?.length) incompleteSources.push('dados de atividade');
    const janela = periodWindow(kind, offset, new Date());
    // Totais ATÉ o fim do período: os marcos ("seu 50º jogo") se medem sobre a
    // carreira naquele momento, não sobre hoje.
    const ate = gameRecords.records.filter((r) => r.at < janela.endMs);
    const nextAchievement = (engine.achievements?.locked || [])
      .filter((a) => a.progress > 0)
      .sort((a, b) => b.progress - a.progress)[0] || null;
    return buildPeriodReview({
      kind, offset, records: gameRecords.records,
      tournamentDates: engine.dates?.tournamentDates || [],
      facts: engine.facts,
      achievements: engine.persistedAchievements || [],
      missionDocs: missionsQ.data || [],
      ratingPoints: ratingPoints || [],
      totals: { games: ate.length, wins: ate.filter((r) => r.won === true).length },
      streakWeeks: engine.streak?.weeks || 0,
      nextAchievement: nextAchievement ? { id: nextAchievement.id, name: nextAchievement.name, progress: nextAchievement.progress } : null,
      incompleteSources,
    });
  }, [uid, engine, kind, offset, gameRecords.records, gameRecords.incomplete, missionsQ.data, missionsQ.isError, ratingPoints]);

  return {
    review,
    isLoading: gameRecords.isLoading || missionsQ.isLoading || !engine?.facts,
    isError: gameRecords.isError,
    refetch: () => { gameRecords.refetch(); missionsQ.refetch(); },
  };
}

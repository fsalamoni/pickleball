import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { STAGE_ORDER } from '@/modules/pool/domain/poolSettings';
import { HIT_TYPE_LABELS } from '@/modules/pool/hooks/useDashboardSummaries';

const HIT_TYPES = Object.keys(HIT_TYPE_LABELS);

export const RANKING_SCORE_COLUMNS = [
  { key: 'exact_score', label: 'Bucha' },
  { key: 'winner_plus_diff', label: 'Dif.' },
  { key: 'winner_plus_team_goals', label: 'Gols+' },
  { key: 'winner_only', label: 'Venc.' },
  { key: 'team_goals_only', label: 'Gols' },
  { key: 'none', label: 'Erros' },
  { key: 'penalties', label: 'Pen.' },
  { key: 'zebras', label: 'Zebra' },
  { key: 'points', label: 'Subtotal' },
];

export function usePoolScoreBreakdown(poolId, { matches = [], stages = [] } = {}) {
  const [scores, setScores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!poolId) {
      setScores([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, 'processed_scores'), where('pool_id', '==', poolId)),
      (snapshot) => {
        setScores(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setIsLoading(false);
      },
      (error) => {
        logger.error('pool score breakdown listener error:', error);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [poolId]);

  const stageDefinitions = useMemo(() => buildStageDefinitions(stages), [stages]);

  const breakdownByUser = useMemo(() => {
    const matchesById = new Map(matches.map((match) => [match.id, match]));
    const result = {};

    scores.forEach((score) => {
      const userId = score.user_id;
      const stageCode = score.stage_code || matchesById.get(score.match_id)?.stage_code || 'unknown';
      const hitType = HIT_TYPES.includes(score.hit_type) ? score.hit_type : 'none';

      if (!result[userId]) result[userId] = {};
      if (!result[userId][stageCode]) result[userId][stageCode] = createStageStats();

      const stats = result[userId][stageCode];
      stats.points += Number(score.points || 0);
      stats.basePoints += Number(score.base_points || 0);
      stats.penaltyPoints += Number(score.penalty_points || 0);
      stats.counts[hitType] += 1;
      if (score.penalty_hit_type && HIT_TYPES.includes(score.penalty_hit_type)) {
        stats.counts[score.penalty_hit_type] += 1;
      }
      stats.penalties += Number(score.penalty_points || 0) > 0 ? 1 : 0;
      stats.zebras += score.zebra_applied ? 1 : 0;
      stats.buchas += score.bucha_count ?? (score.is_bucha ? 1 : 0);
      stats.superBuchas += score.super_bucha_count ?? (score.is_super_bucha ? 1 : 0);
    });

    return result;
  }, [scores, matches]);

  return { breakdownByUser, stageDefinitions, isLoading };
}

function buildStageDefinitions(stages) {
  const byCode = new Map(stages.map((stage) => [stage.code, stage]));
  const ordered = STAGE_ORDER.map((stageCode) => byCode.get(stageCode)).filter(Boolean);
  const extra = stages.filter((stage) => !STAGE_ORDER.includes(stage.code));
  return [...ordered, ...extra].map((stage) => ({
    code: stage.code,
    label: stage.label || stage.name || stage.code,
  }));
}

function createStageStats() {
  return {
    points: 0,
    basePoints: 0,
    penaltyPoints: 0,
    penalties: 0,
    zebras: 0,
    buchas: 0,
    superBuchas: 0,
    counts: Object.fromEntries(HIT_TYPES.map((hitType) => [hitType, 0])),
  };
}

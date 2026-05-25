import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { logger } from '@/core/lib/logger';
import { applyPoolDeadlineOverrides, STAGE_ORDER } from '@/modules/pool/domain/poolSettings';

export const HIT_TYPE_LABELS = {
  exact_score: 'Bucha',
  winner_plus_diff: 'Venc. + dif.',
  winner_plus_team_goals: 'Venc. + gols',
  winner_only: 'Vencedor',
  team_goals_only: 'Gols time',
  none: 'Erro',
};

const HIT_TYPES = Object.keys(HIT_TYPE_LABELS);

export function useDashboardSummaries({ pools, matches, stages }) {
  const { user } = useAuth();
  const [rawData, setRawData] = useState({ memberships: {}, bets: {}, specialBets: {}, scores: {} });

  useEffect(() => {
    if (!user?.uid || !pools.length) {
      setRawData({ memberships: {}, bets: {}, specialBets: {}, scores: {} });
      return;
    }

    let active = true;
    const data = { memberships: {}, bets: {}, specialBets: {}, scores: {} };
    const publish = () => {
      if (active) {
        setRawData({
          memberships: { ...data.memberships },
          bets: { ...data.bets },
          specialBets: { ...data.specialBets },
          scores: { ...data.scores },
        });
      }
    };

    const unsubscribers = [];

    pools.forEach((pool) => {
      const poolId = pool.id;

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'pool_memberships'), where('pool_id', '==', poolId)),
          (snapshot) => {
            data.memberships[poolId] = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            publish();
          },
          (error) => logger.error('dashboard memberships listener error:', error),
        ),
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'bets'), where('user_id', '==', user.uid), where('pool_id', '==', poolId)),
          (snapshot) => {
            data.bets[poolId] = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            publish();
          },
          (error) => logger.error('dashboard bets listener error:', error),
        ),
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'special_bets'), where('user_id', '==', user.uid), where('pool_id', '==', poolId)),
          (snapshot) => {
            data.specialBets[poolId] = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            publish();
          },
          (error) => logger.error('dashboard special bets listener error:', error),
        ),
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'processed_scores'), where('user_id', '==', user.uid), where('pool_id', '==', poolId)),
          (snapshot) => {
            data.scores[poolId] = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            publish();
          },
          (error) => logger.error('dashboard processed scores listener error:', error),
        ),
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.uid, pools.map((pool) => pool.id).join('|')]);

  return useMemo(() => {
    const matchesById = new Map(matches.map((match) => [match.id, match]));
    const stageLabels = buildStageLabels(stages);
    const summariesByPool = {};

    pools.forEach((pool) => {
      const memberships = rawData.memberships[pool.id] || [];
      const bets = rawData.bets[pool.id] || [];
      const specialBets = rawData.specialBets[pool.id] || [];
      const scores = rawData.scores[pool.id] || [];
      const rankedMemberships = rankMemberships(memberships);
      const rankIndex = rankedMemberships.findIndex((membership) => membership.user_id === user?.uid);

      summariesByPool[pool.id] = {
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        participants: memberships.length || pool.stats?.members_count || 1,
        missing: countMissingPredictions({ pool, bets, specialBets, matches, stages }),
        stages: aggregateScoresByStage({ scores, matchesById, stageLabels, stages }),
      };
    });

    return summariesByPool;
  }, [pools, rawData, matches, stages, user?.uid]);
}

function rankMemberships(memberships) {
  return [...memberships].sort((first, second) => {
    const pointsDiff = (second.points || 0) - (first.points || 0);
    if (pointsDiff !== 0) return pointsDiff;
    const buchaDiff = (second.buchas || 0) - (first.buchas || 0);
    if (buchaDiff !== 0) return buchaDiff;
    const superDiff = (second.super_buchas || 0) - (first.super_buchas || 0);
    if (superDiff !== 0) return superDiff;
    return String(first.display_name || first.user_name || first.user_id).localeCompare(
      String(second.display_name || second.user_name || second.user_id),
      'pt-BR',
    );
  });
}

function countMissingPredictions({ pool, bets, specialBets, matches, stages }) {
  const betMatchIds = new Set(bets.map((bet) => bet.match_id));
  const stagesWithDeadlines = applyPoolDeadlineOverrides(stages, pool);
  const stageByCode = Object.fromEntries(stagesWithDeadlines.map((stage) => [stage.code, stage]));
  const now = Date.now();

  const missingMatches = matches.filter((match) => {
    if (!match.home_team_id || !match.away_team_id) return false;
    const deadline = toDate(stageByCode[match.stage_code]?.bet_lock_at || match.bet_lock_at);
    return deadline && deadline.getTime() > now && !betMatchIds.has(match.id);
  }).length;

  const groupDeadline = toDate(stageByCode.group?.bet_lock_at);
  const specialTypes = new Set(specialBets.map((bet) => bet.type));
  const missingSpecials = groupDeadline && groupDeadline.getTime() > now
    ? Number(!specialTypes.has('champion')) + Number(!specialTypes.has('top_scorer'))
    : 0;

  return { matches: missingMatches, specials: missingSpecials, total: missingMatches + missingSpecials };
}

function aggregateScoresByStage({ scores, matchesById, stageLabels, stages }) {
  const byStage = {};
  const stageOrder = Array.isArray(stages) && stages.length
    ? stages.map((stage) => stage.code)
    : STAGE_ORDER;

  stageOrder.forEach((stageCode) => {
    byStage[stageCode] = createStageSummary(stageCode, stageLabels[stageCode] || stageCode);
  });

  scores.forEach((score) => {
    const stageCode = score.stage_code || matchesById.get(score.match_id)?.stage_code || 'unknown';
    if (!byStage[stageCode]) byStage[stageCode] = createStageSummary(stageCode, stageLabels[stageCode] || 'Sem fase');

    const summary = byStage[stageCode];
    const hitType = HIT_TYPES.includes(score.hit_type) ? score.hit_type : 'none';
    summary.points += Number(score.points || 0);
    summary.counts[hitType] += 1;
    summary.errors += hitType === 'none' ? 1 : 0;
    summary.buchas += score.is_bucha ? 1 : 0;
    summary.superBuchas += score.is_super_bucha ? 1 : 0;
    summary.zebras += score.zebra_applied ? 1 : 0;
    summary.penalties += Number(score.penalty_points || 0) > 0 ? 1 : 0;
  });

  return stageOrder.map((stageCode) => byStage[stageCode]).filter(Boolean);
}

function createStageSummary(stageCode, label) {
  return {
    stageCode,
    label,
    points: 0,
    errors: 0,
    buchas: 0,
    superBuchas: 0,
    zebras: 0,
    penalties: 0,
    counts: Object.fromEntries(HIT_TYPES.map((hitType) => [hitType, 0])),
  };
}

function buildStageLabels(stages) {
  return Object.fromEntries(stages.map((stage) => [stage.code, stage.label || stage.name || stage.code]));
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

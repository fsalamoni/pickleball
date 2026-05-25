import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { computeMatchPoints, defaultBet, ScoringTier, Match, Bet } from './scoringEngine';
import { FUNCTION_SERVICE_ACCOUNT } from './runtimeOptions';
import { FIRESTORE_DATABASE_ID, getAppFirestore } from './firestore';

type ExistingBet = Bet & { id: string; user_id: string; pool_id: string; revealed?: boolean };
type PoolSettings = {
  scoring_overrides?: Record<string, ScoringTier>;
  zebras_enabled?: boolean;
};

export const processPoolMatchScoring = onDocumentUpdated(
  {
    database: FIRESTORE_DATABASE_ID,
    document: 'pool_matches/{matchId}',
    region: 'southamerica-east1',
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || !after.pool_id) return;

    const justFinished = before.status !== 'finished' && after.status === 'finished';
    const scoreChanged =
      before.official_home_score !== after.official_home_score ||
      before.official_away_score !== after.official_away_score ||
      before.official_home_penalties !== after.official_home_penalties ||
      before.official_away_penalties !== after.official_away_penalties ||
      before.penalty_winner_team_id !== after.penalty_winner_team_id ||
      before.zebra_team_id !== after.zebra_team_id ||
      before.zebra_multiplier !== after.zebra_multiplier;
    if (!justFinished && !(after.status === 'finished' && scoreChanged)) return;

    const matchId = event.params.matchId;
    const poolId = after.pool_id as string;
    const db = getAppFirestore();
    const poolSnap = await db.collection('pools').doc(poolId).get();
    const poolSettings = (poolSnap.data()?.settings || {}) as PoolSettings;
    const tier = resolvePoolTier(after.stage_code, poolSettings);
    if (!tier) {
      console.warn('Custom pool match without scoring tier; skipping', matchId);
      return;
    }

    const matchData = applyPoolMatchSettings(after as Match & { home_team_id: string; away_team_id: string }, poolSettings);
    const betsSnap = await db.collection('bets').where('pool_id', '==', poolId).where('match_id', '==', matchId).get();
    const betsByUser = new Map<string, ExistingBet>();
    for (const d of betsSnap.docs) {
      const data = d.data() as any;
      betsByUser.set(data.user_id, { ...data, id: d.id });
    }

    const memSnap = await db.collection('pool_memberships').where('pool_id', '==', poolId).get();
    const writer = db.batch();
    let writes = 0;

    for (const memDoc of memSnap.docs) {
      const membership = memDoc.data() as any;
      const userId = membership.user_id;
      const bet = betsByUser.get(userId) || (defaultBet() as any);
      const result = computeMatchPoints(bet as Bet, matchData, tier);
      const psId = `${userId}_${poolId}_${matchId}`;
      const prevSnap = await db.collection('processed_scores').doc(psId).get();
      const prev = prevSnap.exists ? (prevSnap.data() as any) : null;
      const deltaPoints = result.total_points - (prev?.points || 0);
      const deltaBuchas = (result.bucha_count || (result.is_bucha ? 1 : 0)) - (prev?.bucha_count ?? (prev?.is_bucha ? 1 : 0));
      const deltaSuper = (result.super_bucha_count || (result.is_super_bucha ? 1 : 0)) - (prev?.super_bucha_count ?? (prev?.is_super_bucha ? 1 : 0));

      writer.set(
        db.collection('processed_scores').doc(psId),
        {
          user_id: userId,
          pool_id: poolId,
          match_id: matchId,
          tournament_id: null,
          stage_id: null,
          stage_code: after.stage_code || null,
          sequence_in_stage: after.sequence_in_stage || null,
          points: result.total_points,
          base_points: result.base_points,
          penalty_points: result.penalty_points,
          penalty_hit_type: result.penalty_hit_type,
          multiplier: result.multiplier,
          hit_type: result.hit_type,
          is_bucha: result.is_bucha,
          is_super_bucha: result.is_super_bucha,
          bucha_count: result.bucha_count,
          super_bucha_count: result.super_bucha_count,
          zebra_applied: result.zebra_applied,
          computed_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      writes += 1;

      if (deltaPoints || deltaBuchas || deltaSuper) {
        writer.update(memDoc.ref, {
          points: FieldValue.increment(deltaPoints),
          buchas: FieldValue.increment(deltaBuchas),
          super_buchas: FieldValue.increment(deltaSuper),
          updated_at: FieldValue.serverTimestamp(),
        });
        writes += 1;
      }

      const existingBet = betsByUser.get(userId);
      if (existingBet && !existingBet.revealed) {
        writer.update(db.collection('bets').doc(existingBet.id), {
          revealed: true,
          updated_at: FieldValue.serverTimestamp(),
        });
        writes += 1;
      }
    }

    if (writes > 0) await writer.commit();
    console.log(`Custom pool scoring processed for pool match ${matchId} in pool ${poolId}.`);
  },
);

function resolvePoolTier(stageCode: string, settings: PoolSettings): ScoringTier | null {
  return settings.scoring_overrides?.[stageCode] || null;
}

function applyPoolMatchSettings(
  match: Match & { home_team_id: string; away_team_id: string },
  settings: PoolSettings,
): Match & { home_team_id: string; away_team_id: string } {
  if (settings.zebras_enabled !== false) return match;
  return {
    ...match,
    zebra_team_id: null,
    zebra_multiplier: null,
  };
}

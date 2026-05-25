/**
 * Trigger Firestore: quando uma `match` muda para status='finished',
 * recalcula a pontuação de TODOS os palpites existentes naquela partida,
 * para todos os bolões. Atualiza:
 *   - bets[id].revealed = true (libera leitura para participantes do bolão)
 *   - processed_scores (cria/atualiza um doc por user × pool × match)
 *   - pool_memberships (incrementa points/buchas/super_buchas, denormalizado)
 *
 * Usuários sem palpite para a partida pontuam como `defaultBet()` (0×0)
 * — calculado on-the-fly e persistido em processed_scores.
 */
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

const DEFAULT_ZEBRAS_ENABLED = true;

export const processMatchScoring = onDocumentUpdated(
  {
    database: FIRESTORE_DATABASE_ID,
    document: 'matches/{matchId}',
    region: 'southamerica-east1',
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Dispara apenas na transição para 'finished' (ou re-processa se score mudou)
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
    const db = getAppFirestore();

    // Carrega tier
    if (!after.stage_id) {
      console.warn('Match without stage_id; skipping scoring', matchId);
      return;
    }
    const stageSnap = await db.collection('stages').doc(after.stage_id).get();
    const stageData = stageSnap.data();
    const tierId = stageData?.scoring_tier_id;
    if (!tierId) {
      console.warn('Stage without scoring tier; skipping', stageSnap.id);
      return;
    }
    const tierSnap = await db.collection('scoring_tiers').doc(tierId).get();
    const tier = tierSnap.data() as ScoringTier;

    const matchData = after as Match & { home_team_id: string; away_team_id: string };

    // Palpites existentes neste match, agrupados por pool.
    const betsSnap = await db.collection('bets').where('match_id', '==', matchId).get();
    const betsByPool: Record<string, Map<string, ExistingBet>> = {};
    for (const d of betsSnap.docs) {
      const data = d.data() as any;
      const map = (betsByPool[data.pool_id] ||= new Map());
      map.set(data.user_id, { ...data, id: d.id });
    }

    const poolIds = new Set(Object.keys(betsByPool));
    if (after.tournament_id) {
      const poolsSnap = await db.collection('pools').where('tournament_id', '==', after.tournament_id).get();
      for (const poolDoc of poolsSnap.docs) poolIds.add(poolDoc.id);
    }

    // Para cada pool do torneio, processar todos os membros (incluindo quem não palpitou).
    for (const poolId of poolIds) {
      const poolSnap = await db.collection('pools').doc(poolId).get();
      const poolSettings = (poolSnap.data()?.settings || {}) as PoolSettings;
      const poolTier = resolvePoolTier(tier, after.stage_code, poolSettings);
      const poolMatchData = applyPoolMatchSettings(matchData, poolSettings);
      const poolBets = betsByPool[poolId] || new Map<string, ExistingBet>();
      const memSnap = await db.collection('pool_memberships').where('pool_id', '==', poolId).get();
      const writer = db.batch();
      let writes = 0;

      for (const memDoc of memSnap.docs) {
        const m = memDoc.data() as any;
        const userId = m.user_id;
        const bet = poolBets.get(userId) || (defaultBet() as any);

        const result = computeMatchPoints(bet as Bet, poolMatchData, poolTier);

        // Carrega processed_scores anterior (se existir, para cálculo delta)
        const psId = `${userId}_${poolId}_${matchId}`;
        const prevSnap = await db.collection('processed_scores').doc(psId).get();
        const prev = prevSnap.exists ? (prevSnap.data() as any) : null;
        const prevPoints = prev?.points || 0;
        const prevBucha = prev?.bucha_count ?? (prev?.is_bucha ? 1 : 0);
        const prevSuper = prev?.super_bucha_count ?? (prev?.is_super_bucha ? 1 : 0);

        const deltaPoints = result.total_points - prevPoints;
        const deltaBuchas = (result.bucha_count || (result.is_bucha ? 1 : 0)) - prevBucha;
        const deltaSuper = (result.super_bucha_count || (result.is_super_bucha ? 1 : 0)) - prevSuper;

        // Atualiza processed_scores
        writer.set(
          db.collection('processed_scores').doc(psId),
          {
            user_id: userId,
            pool_id: poolId,
            match_id: matchId,
            tournament_id: after.tournament_id || null,
            stage_id: after.stage_id || null,
            stage_code: after.stage_code || stageData?.code || null,
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

        // Atualiza pool_memberships com deltas
        if (deltaPoints || deltaBuchas || deltaSuper) {
          writer.update(memDoc.ref, {
            points: FieldValue.increment(deltaPoints),
            buchas: FieldValue.increment(deltaBuchas),
            super_buchas: FieldValue.increment(deltaSuper),
            updated_at: FieldValue.serverTimestamp(),
          });
          writes += 1;
        }

        // Marca o palpite como "revealed" (caso ainda não estivesse)
        const existingBet = poolBets.get(userId);
        if (existingBet && !existingBet.revealed) {
          writer.update(db.collection('bets').doc(existingBet.id), {
            revealed: true,
            updated_at: FieldValue.serverTimestamp(),
          });
          writes += 1;
        }
      }

      if (writes > 0) await writer.commit();
    }

    console.log(`Scoring processed for match ${matchId} across ${poolIds.size} pools.`);
  },
);

function resolvePoolTier(baseTier: ScoringTier, stageCode: string, settings: PoolSettings): ScoringTier {
  return {
    ...baseTier,
    ...(settings.scoring_overrides?.[stageCode] || {}),
  };
}

function applyPoolMatchSettings(
  match: Match & { home_team_id: string; away_team_id: string },
  settings: PoolSettings,
): Match & { home_team_id: string; away_team_id: string } {
  if (settings.zebras_enabled ?? DEFAULT_ZEBRAS_ENABLED) return match;
  return {
    ...match,
    zebra_team_id: null,
    zebra_multiplier: null,
  };
}

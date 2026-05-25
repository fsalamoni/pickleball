import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertPoolAdmin } from './auth';
import { fetchOfficialCompetition, type ImportedCompetition } from './competitionImportProviders';
import { getAppFirestore } from './firestore';
import { FUNCTION_SERVICE_ACCOUNT } from './runtimeOptions';

type ImportPayload = {
  pool_id?: string;
  provider?: string;
  competition_id?: string;
  from?: string | null;
  to?: string | null;
  dry_run?: boolean;
};

type PoolDoc = {
  name?: string;
  template_code?: string;
  settings?: Record<string, any>;
};

type PoolCompetitorDoc = {
  id: string;
  name?: string;
  code?: string | null;
  source_provider?: string | null;
  source_competition_id?: string | null;
  source_competitor_id?: string | null;
};

type PoolMatchDoc = {
  id: string;
  source_provider?: string | null;
  source_competition_id?: string | null;
  source_match_id?: string | null;
  stage_code?: string | null;
  kickoff_at?: unknown;
};

export const importOfficialCompetitionToPool = onCall(
  {
    region: 'southamerica-east1',
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    const payload = (request.data || {}) as ImportPayload;
    const poolId = String(payload.pool_id || '').trim();
    const competitionId = String(payload.competition_id || '').trim();
    if (!poolId || !competitionId) {
      throw new HttpsError('invalid-argument', 'Informe o bolão e o identificador oficial da competição.');
    }

    await assertPoolAdmin(request.auth?.uid, poolId);
    const db = getAppFirestore();
    const poolSnap = await db.collection('pools').doc(poolId).get();
    if (!poolSnap.exists) throw new HttpsError('not-found', 'Bolão não encontrado.');
    const pool = { id: poolSnap.id, ...(poolSnap.data() as PoolDoc) };
    if (pool.template_code !== 'custom') {
      throw new HttpsError('failed-precondition', 'A importação oficial está disponível apenas para bolões de criação livre.');
    }

    const importedCompetition = await fetchOfficialCompetition({
      provider: payload.provider,
      competition_id: competitionId,
      from: payload.from,
      to: payload.to,
    });

    const settings = normalizeImportedSettings(pool.settings || {}, importedCompetition);
    const summary = {
      ok: true,
      dry_run: payload.dry_run === true,
      provider: importedCompetition.provider,
      competition_name: importedCompetition.competition_name,
      competitors: importedCompetition.competitors.length,
      stages: settings.custom_stages.length,
      matches: importedCompetition.matches.length,
      matches_created: 0,
      matches_updated: 0,
      competitors_created: 0,
      competitors_updated: 0,
    };

    if (payload.dry_run === true) {
      return summary;
    }

    const [competitorsSnap, matchesSnap] = await Promise.all([
      db.collection('pool_competitors').where('pool_id', '==', poolId).get(),
      db.collection('pool_matches').where('pool_id', '==', poolId).get(),
    ]);

    const competitorDocs = competitorsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<PoolCompetitorDoc, 'id'>) }));
    const matchDocs = matchesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<PoolMatchDoc, 'id'>) }));
    const competitorMap = buildCompetitorLookup(competitorDocs);
    const matchMap = buildMatchLookup(matchDocs);

    let batch = db.batch();
    let writes = 0;
    const flushIfNeeded = async () => {
      if (writes < 400) return;
      await batch.commit();
      batch = db.batch();
      writes = 0;
    };

    for (const competitor of importedCompetition.competitors) {
      const existing = findExistingCompetitor(competitorDocs, competitorMap, importedCompetition, competitor);
      if (existing) {
        batch.update(db.collection('pool_competitors').doc(existing.id), {
          name: competitor.name,
          code: competitor.code,
          source_provider: importedCompetition.provider,
          source_competition_id: importedCompetition.competition_id,
          source_competitor_id: competitor.source_competitor_id,
          updated_at: FieldValue.serverTimestamp(),
        });
        competitorMap.set(competitorKey(importedCompetition, competitor.source_competitor_id), existing.id);
        summary.competitors_updated += 1;
      } else {
        const ref = db.collection('pool_competitors').doc();
        batch.set(ref, {
          pool_id: poolId,
          name: competitor.name,
          code: competitor.code,
          source_provider: importedCompetition.provider,
          source_competition_id: importedCompetition.competition_id,
          source_competitor_id: competitor.source_competitor_id,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        competitorMap.set(competitorKey(importedCompetition, competitor.source_competitor_id), ref.id);
        summary.competitors_created += 1;
      }
      writes += 1;
      await flushIfNeeded();
    }

    for (const match of importedCompetition.matches) {
      const stage = settings.custom_stages.find((item) => item.source_stage_key === match.source_stage_key);
      const homeTeamId = match.home_competitor_id ? competitorMap.get(competitorKey(importedCompetition, match.home_competitor_id)) || null : null;
      const awayTeamId = match.away_competitor_id ? competitorMap.get(competitorKey(importedCompetition, match.away_competitor_id)) || null : null;
      const penaltyWinnerTeamId = match.penalty_winner_competitor_id
        ? competitorMap.get(competitorKey(importedCompetition, match.penalty_winner_competitor_id)) || null
        : null;

      const payloadMatch = {
        pool_id: poolId,
        stage_code: stage?.code || 'fase_importada',
        stage_label: stage?.label || match.stage_label,
        group_code: match.group_code || '',
        sequence_in_stage: match.sequence_in_stage,
        kickoff_at: match.kickoff_at ? new Date(match.kickoff_at) : null,
        bet_lock_at: match.bet_lock_at ? new Date(match.bet_lock_at) : (match.kickoff_at ? new Date(match.kickoff_at) : null),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_placeholder: homeTeamId ? '' : match.home_name || '',
        away_placeholder: awayTeamId ? '' : match.away_name || '',
        official_home_score: match.official_home_score,
        official_away_score: match.official_away_score,
        official_home_penalties: match.official_home_penalties,
        official_away_penalties: match.official_away_penalties,
        penalty_winner_team_id: penaltyWinnerTeamId,
        zebra_team_id: null,
        zebra_multiplier: null,
        status: match.status,
        source_provider: importedCompetition.provider,
        source_competition_id: importedCompetition.competition_id,
        source_match_id: match.source_match_id,
        result_source: `${importedCompetition.provider}_official_import`,
        imported_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      const existing = findExistingMatch(matchDocs, matchMap, importedCompetition, match.source_match_id, match.kickoff_at);
      if (existing) {
        batch.update(db.collection('pool_matches').doc(existing.id), payloadMatch);
        summary.matches_updated += 1;
      } else {
        const ref = db.collection('pool_matches').doc();
        batch.set(ref, {
          ...payloadMatch,
          created_at: FieldValue.serverTimestamp(),
        });
        summary.matches_created += 1;
      }
      writes += 1;
      await flushIfNeeded();
    }

    batch.update(db.collection('pools').doc(poolId), {
      name: pool.name || importedCompetition.competition_name,
      settings,
      tournament_import: {
        provider: importedCompetition.provider,
        competition_id: importedCompetition.competition_id,
        competition_name: importedCompetition.competition_name,
        source_url: importedCompetition.source_url,
        synced_at: FieldValue.serverTimestamp(),
      },
      updated_at: FieldValue.serverTimestamp(),
    });
    writes += 1;

    if (writes > 0) await batch.commit();
    return summary;
  },
);

export function normalizeImportedSettings(currentSettings: Record<string, any>, importedCompetition: ImportedCompetition) {
  const currentStages = Array.isArray(currentSettings.custom_stages) ? currentSettings.custom_stages : [];
  const currentScoring = { ...(currentSettings.scoring_overrides || {}) };
  const currentDeadlines = { ...(currentSettings.deadline_overrides || {}) };
  const stageCodesInUse = new Set(currentStages.map((stage) => stage.code));
  const importedStages = importedCompetition.stages.map((stage, index) => {
    const existing = currentStages.find((item) => item.source_stage_key === stage.source_stage_key);
    const code = existing?.code || buildUniqueStageCode(stage.label, stageCodesInUse, index + 1);
    stageCodesInUse.add(code);
    if (!currentScoring[code]) {
      currentScoring[code] = {
        label: stage.label,
        exact_score: stage.phase_type === 'knockout' ? 12 : 10,
        winner_plus_diff: stage.phase_type === 'knockout' ? 8 : 7,
        winner_plus_team_goals: stage.phase_type === 'knockout' ? 6 : 5,
        winner_only: stage.phase_type === 'knockout' ? 5 : 4,
        team_goals_only: stage.phase_type === 'knockout' ? 3 : 2,
        penalty_winner: stage.allows_tiebreaker ? 2 : 0,
      };
    } else {
      currentScoring[code] = {
        ...currentScoring[code],
        label: stage.label,
      };
    }
    if (!(code in currentDeadlines)) currentDeadlines[code] = null;
    return {
      code,
      label: stage.label,
      phase_type: stage.phase_type,
      section_label: stage.section_label,
      allows_tiebreaker: stage.allows_tiebreaker,
      source_stage_key: stage.source_stage_key,
    };
  });

  return {
    ...currentSettings,
    sport_config: {
      ...(currentSettings.sport_config || {}),
      code: importedCompetition.sport_code,
      label: importedCompetition.sport_code === 'soccer' ? 'Futebol' : currentSettings.sport_config?.label || 'Competição oficial',
      supports_penalties: true,
    },
    custom_stages: importedStages,
    scoring_overrides: currentScoring,
    deadline_overrides: currentDeadlines,
  };
}

function buildCompetitorLookup(competitors: PoolCompetitorDoc[]) {
  const map = new Map<string, string>();
  competitors.forEach((competitor) => {
    if (competitor.source_provider && competitor.source_competition_id && competitor.source_competitor_id) {
      map.set(
        `${competitor.source_provider}:${competitor.source_competition_id}:${competitor.source_competitor_id}`,
        competitor.id,
      );
    }
  });
  return map;
}

function buildMatchLookup(matches: PoolMatchDoc[]) {
  const map = new Map<string, string>();
  matches.forEach((match) => {
    if (match.source_provider && match.source_competition_id && match.source_match_id) {
      map.set(`${match.source_provider}:${match.source_competition_id}:${match.source_match_id}`, match.id);
    }
  });
  return map;
}

function findExistingCompetitor(
  competitors: PoolCompetitorDoc[],
  competitorMap: Map<string, string>,
  importedCompetition: ImportedCompetition,
  competitor: ImportedCompetition['competitors'][number],
) {
  const bySource = competitorMap.get(competitorKey(importedCompetition, competitor.source_competitor_id));
  if (bySource) return competitors.find((item) => item.id === bySource) || null;
  return competitors.find((item) => item.code === competitor.code || item.name === competitor.name) || null;
}

function findExistingMatch(
  matches: PoolMatchDoc[],
  matchMap: Map<string, string>,
  importedCompetition: ImportedCompetition,
  sourceMatchId: string,
  kickoffAt: string | null,
) {
  const bySource = matchMap.get(`${importedCompetition.provider}:${importedCompetition.competition_id}:${sourceMatchId}`);
  if (bySource) return matches.find((item) => item.id === bySource) || null;
  if (!kickoffAt) return null;
  const importedMillis = new Date(kickoffAt).getTime();
  if (!Number.isFinite(importedMillis)) return null;
  return matches.find((match) => toMillis(match.kickoff_at) === importedMillis) || null;
}

function competitorKey(importedCompetition: ImportedCompetition, competitorId: string) {
  return `${importedCompetition.provider}:${importedCompetition.competition_id}:${competitorId}`;
}

function buildUniqueStageCode(label: string, existingCodes: Set<string>, fallbackIndex: number) {
  const base = String(label || `fase_${fallbackIndex}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `fase_${fallbackIndex}`;
  let candidate = base;
  let attempt = 2;
  while (existingCodes.has(candidate)) {
    candidate = `${base}_${attempt}`;
    attempt += 1;
  }
  return candidate;
}

function toMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const numeric = new Date(value).getTime();
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof maybeTimestamp.toMillis === 'function') return maybeTimestamp.toMillis();
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate().getTime();
  }
  return null;
}

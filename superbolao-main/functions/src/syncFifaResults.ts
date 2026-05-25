import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertPlatformAdmin } from './auth';
import { getAppFirestore } from './firestore';
import { FUNCTION_SERVICE_ACCOUNT } from './runtimeOptions';

const FIFA_WORLD_CUP_2026_URL = 'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&from=2026-06-01&to=2026-07-31';
const KICKOFF_TOLERANCE_MS = 30 * 60 * 1000;

type CallablePayload = {
  tournament_id?: string;
  dry_run?: boolean;
};

type TeamDoc = {
  id: string;
  code?: string | null;
};

type MatchDoc = {
  id: string;
  tournament_id?: string;
  stage_code?: string;
  group_code?: string | null;
  sequence_in_stage?: number | null;
  kickoff_at?: unknown;
  home_team_id?: string | null;
  away_team_id?: string | null;
  fifa_match_id?: string | null;
  official_home_score?: number | null;
  official_away_score?: number | null;
  official_home_penalties?: number | null;
  official_away_penalties?: number | null;
  penalty_winner_team_id?: string | null;
  status?: string | null;
};

type FifaTeam = {
  IdTeam?: string | number | null;
  Abbreviation?: string | null;
  Score?: number | string | null;
};

type FifaText = {
  Description?: string | null;
};

type FifaMatch = {
  IdMatch?: string | number | null;
  Date?: string | null;
  Home?: FifaTeam | null;
  Away?: FifaTeam | null;
  HomeTeamScore?: number | string | null;
  AwayTeamScore?: number | string | null;
  HomeTeamPenaltyScore?: number | string | null;
  AwayTeamPenaltyScore?: number | string | null;
  MatchStatus?: number | string | null;
  ResultType?: number | string | null;
  Winner?: string | number | null;
  StageName?: FifaText[] | null;
  GroupName?: FifaText[] | null;
};

type ResolvedMatch = {
  match: MatchDoc;
  reason: string;
};

type LocalIndexes = {
  teamsById: Map<string, TeamDoc>;
  matches: MatchDoc[];
  byFifaId: Map<string, MatchDoc>;
  byGroupTeams: Map<string, MatchDoc>;
};

export const syncFifaResults = onCall(
  {
    region: 'southamerica-east1',
    serviceAccount: FUNCTION_SERVICE_ACCOUNT,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    await assertPlatformAdmin(request.auth?.uid);

    const payload = (request.data || {}) as CallablePayload;
    const dryRun = payload.dry_run === true;
    const db = getAppFirestore();
    const tournamentId = payload.tournament_id || await findTournamentId();
    if (!tournamentId) throw new HttpsError('failed-precondition', 'Tournament not found.');

    const [fifaMatches, indexes] = await Promise.all([
      fetchFifaMatches(),
      loadLocalIndexes(tournamentId),
    ]);

    const summary = {
      ok: true,
      dry_run: dryRun,
      fetched: fifaMatches.length,
      matched: 0,
      linked: 0,
      updated: 0,
      no_result_yet: 0,
      unchanged: 0,
      unmatched: 0,
      penalties_unresolved: 0,
      unmatched_samples: [] as string[],
      source_url: FIFA_WORLD_CUP_2026_URL,
    };

    let batch = db.batch();
    let batchWrites = 0;

    for (const fifaMatch of fifaMatches) {
      const resolved = resolveLocalMatch(fifaMatch, indexes);
      if (!resolved) {
        summary.unmatched += 1;
        if (summary.unmatched_samples.length < 8) {
          summary.unmatched_samples.push(fifaLabel(fifaMatch));
        }
        continue;
      }

      summary.matched += 1;
      const update = buildUpdate(fifaMatch, resolved.match, indexes.teamsById);
      const hasResult = update.official_home_score !== undefined && update.official_away_score !== undefined;
      if (!hasResult) summary.no_result_yet += 1;
      if (update.penalty_winner_team_id === undefined && isFinalDrawRequiringPenalty(fifaMatch, resolved.match)) {
        summary.penalties_unresolved += 1;
      }

      const linked = !resolved.match.fifa_match_id && update.fifa_match_id;
      const changed = hasMeaningfulChange(resolved.match, update);
      if (linked) summary.linked += 1;
      if (hasResult && changed) summary.updated += 1;
      if (!linked && !changed) summary.unchanged += 1;

      if (dryRun || (!linked && !changed)) continue;

      batch.update(db.collection('matches').doc(resolved.match.id), update);
      batchWrites += 1;
      if (batchWrites >= 450) {
        await batch.commit();
        batch = db.batch();
        batchWrites = 0;
      }
    }

    if (!dryRun && batchWrites > 0) await batch.commit();

    return summary;
  },
);

async function findTournamentId(): Promise<string | null> {
  const snap = await getAppFirestore().collection('tournaments').limit(1).get();
  return snap.docs[0]?.id || null;
}

async function fetchFifaMatches(): Promise<FifaMatch[]> {
  const response = await fetch(FIFA_WORLD_CUP_2026_URL, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; SuperBolao/1.0)',
    },
  });
  if (!response.ok) throw new HttpsError('unavailable', `FIFA API returned HTTP ${response.status}.`);
  const data = await response.json() as { Results?: FifaMatch[] };
  if (!Array.isArray(data.Results)) throw new HttpsError('data-loss', 'Unexpected FIFA API response.');
  return data.Results;
}

async function loadLocalIndexes(tournamentId: string): Promise<LocalIndexes> {
  const db = getAppFirestore();
  const [teamsSnap, matchesSnap] = await Promise.all([
    db.collection('teams').get(),
    db.collection('matches').where('tournament_id', '==', tournamentId).get(),
  ]);

  const teamsById = new Map<string, TeamDoc>();
  for (const docSnap of teamsSnap.docs) {
    const data = docSnap.data() as { code?: string };
    teamsById.set(docSnap.id, { id: docSnap.id, code: normalizeCode(data.code) });
  }

  const matches: MatchDoc[] = matchesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<MatchDoc, 'id'>) }));
  const byFifaId = new Map<string, MatchDoc>();
  const byGroupTeams = new Map<string, MatchDoc>();

  for (const match of matches) {
    if (match.fifa_match_id) byFifaId.set(String(match.fifa_match_id), match);
    const homeCode = match.home_team_id ? teamsById.get(match.home_team_id)?.code : null;
    const awayCode = match.away_team_id ? teamsById.get(match.away_team_id)?.code : null;
    if (match.stage_code === 'group' && match.group_code && homeCode && awayCode) {
      byGroupTeams.set(groupTeamsKey(match.group_code, homeCode, awayCode), match);
    }
  }

  return { teamsById, matches, byFifaId, byGroupTeams };
}

function resolveLocalMatch(fifaMatch: FifaMatch, indexes: LocalIndexes): ResolvedMatch | null {
  const fifaId = fifaMatch.IdMatch == null ? null : String(fifaMatch.IdMatch);
  if (fifaId && indexes.byFifaId.has(fifaId)) return { match: indexes.byFifaId.get(fifaId)!, reason: 'fifa_match_id' };

  const homeCode = normalizeCode(fifaMatch.Home?.Abbreviation);
  const awayCode = normalizeCode(fifaMatch.Away?.Abbreviation);
  const groupCode = fifaGroupCode(fifaMatch.GroupName);
  if (groupCode && homeCode && awayCode) {
    const byGroupTeams = indexes.byGroupTeams.get(groupTeamsKey(groupCode, homeCode, awayCode));
    if (byGroupTeams) return { match: byGroupTeams, reason: 'group_teams' };
  }

  const fifaKickoff = fifaMatch.Date ? Date.parse(fifaMatch.Date) : Number.NaN;
  if (!Number.isFinite(fifaKickoff) || !homeCode || !awayCode) return null;

  const candidates = indexes.matches.filter((match) => {
    const home = match.home_team_id ? indexes.teamsById.get(match.home_team_id)?.code : null;
    const away = match.away_team_id ? indexes.teamsById.get(match.away_team_id)?.code : null;
    const localKickoff = toMillis(match.kickoff_at);
    return home === homeCode && away === awayCode && localKickoff !== null && Math.abs(localKickoff - fifaKickoff) <= KICKOFF_TOLERANCE_MS;
  });

  if (candidates.length === 1) return { match: candidates[0], reason: 'kickoff_teams' };
  return null;
}

function buildUpdate(fifaMatch: FifaMatch, localMatch: MatchDoc, teamsById: Map<string, TeamDoc>): Record<string, unknown> {
  const update: Record<string, unknown> = {
    fifa_match_id: fifaMatch.IdMatch == null ? null : String(fifaMatch.IdMatch),
    fifa_match_status: fifaMatch.MatchStatus ?? null,
    fifa_result_type: fifaMatch.ResultType ?? null,
    fifa_synced_at: FieldValue.serverTimestamp(),
    fifa_sync_source: 'fifa_calendar_api',
    updated_at: FieldValue.serverTimestamp(),
  };

  const kickoffMs = fifaMatch.Date ? Date.parse(fifaMatch.Date) : Number.NaN;
  if (Number.isFinite(kickoffMs)) update.kickoff_at = new Date(kickoffMs);

  const homeScore = numberOrNull(fifaMatch.HomeTeamScore ?? fifaMatch.Home?.Score);
  const awayScore = numberOrNull(fifaMatch.AwayTeamScore ?? fifaMatch.Away?.Score);
  if (!isFinalFifaMatch(fifaMatch) || homeScore === null || awayScore === null) return update;

  update.official_home_score = homeScore;
  update.official_away_score = awayScore;
  update.status = 'finished';
  update.result_source = 'fifa_calendar_api';

  const homePenaltyScore = numberOrNull(fifaMatch.HomeTeamPenaltyScore);
  const awayPenaltyScore = numberOrNull(fifaMatch.AwayTeamPenaltyScore);
  if (homePenaltyScore !== null && awayPenaltyScore !== null && homePenaltyScore !== awayPenaltyScore) {
    update.official_home_penalties = homePenaltyScore;
    update.official_away_penalties = awayPenaltyScore;
    update.penalty_winner_team_id = homePenaltyScore > awayPenaltyScore ? localMatch.home_team_id || null : localMatch.away_team_id || null;
  } else if (homeScore !== awayScore || localMatch.stage_code === 'group') {
    update.official_home_penalties = null;
    update.official_away_penalties = null;
    update.penalty_winner_team_id = null;
  } else if (fifaMatch.Winner != null) {
    update.penalty_winner_team_id = resolveWinnerTeamId(fifaMatch, localMatch, teamsById);
  }

  return update;
}

function isFinalFifaMatch(fifaMatch: FifaMatch): boolean {
  const resultType = numberOrNull(fifaMatch.ResultType);
  const matchStatus = numberOrNull(fifaMatch.MatchStatus);
  return resultType !== null && resultType > 0 && matchStatus === 0;
}

function hasMeaningfulChange(match: MatchDoc, update: Record<string, unknown>): boolean {
  const comparableFields: Array<keyof MatchDoc> = [
    'fifa_match_id',
    'official_home_score',
    'official_away_score',
    'official_home_penalties',
    'official_away_penalties',
    'penalty_winner_team_id',
    'status',
  ];

  for (const field of comparableFields) {
    if (update[field] !== undefined && (match[field] ?? null) !== (update[field] ?? null)) return true;
  }

  const kickoff = toMillis(update.kickoff_at);
  return kickoff !== null && toMillis(match.kickoff_at) !== kickoff;
}

function resolveWinnerTeamId(fifaMatch: FifaMatch, localMatch: MatchDoc, teamsById: Map<string, TeamDoc>): string | null {
  const winner = String(fifaMatch.Winner);
  if (fifaMatch.Home?.IdTeam != null && winner === String(fifaMatch.Home.IdTeam)) return localMatch.home_team_id || null;
  if (fifaMatch.Away?.IdTeam != null && winner === String(fifaMatch.Away.IdTeam)) return localMatch.away_team_id || null;

  const homeCode = localMatch.home_team_id ? teamsById.get(localMatch.home_team_id)?.code : null;
  const awayCode = localMatch.away_team_id ? teamsById.get(localMatch.away_team_id)?.code : null;
  if (winner === homeCode) return localMatch.home_team_id || null;
  if (winner === awayCode) return localMatch.away_team_id || null;
  return null;
}

function isFinalDrawRequiringPenalty(fifaMatch: FifaMatch, localMatch: MatchDoc): boolean {
  const homeScore = numberOrNull(fifaMatch.HomeTeamScore ?? fifaMatch.Home?.Score);
  const awayScore = numberOrNull(fifaMatch.AwayTeamScore ?? fifaMatch.Away?.Score);
  return localMatch.stage_code !== 'group' && isFinalFifaMatch(fifaMatch) && homeScore !== null && awayScore !== null && homeScore === awayScore;
}

function groupTeamsKey(groupCode: string, homeCode: string, awayCode: string): string {
  return `${normalizeCode(groupCode)}:${normalizeCode(homeCode)}:${normalizeCode(awayCode)}`;
}

function fifaGroupCode(groupName: FifaText[] | null | undefined): string | null {
  const description = groupName?.[0]?.Description || '';
  const match = description.match(/Group\s+([A-L])/i);
  return match?.[1]?.toUpperCase() || null;
}

function fifaLabel(fifaMatch: FifaMatch): string {
  return `${fifaMatch.IdMatch || '?'} ${fifaMatch.Date || '?'} ${fifaMatch.Home?.Abbreviation || '?'} x ${fifaMatch.Away?.Abbreviation || '?'}`;
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof maybeTimestamp.toMillis === 'function') return maybeTimestamp.toMillis();
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate().getTime();
  }
  return null;
}

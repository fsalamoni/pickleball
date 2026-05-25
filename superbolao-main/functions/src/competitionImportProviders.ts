export const OFFICIAL_PROVIDER_CODES = {
  fifa: 'fifa',
} as const;

export type OfficialProviderCode = typeof OFFICIAL_PROVIDER_CODES[keyof typeof OFFICIAL_PROVIDER_CODES];

export type ImportedCompetition = {
  provider: OfficialProviderCode;
  provider_label: string;
  competition_id: string;
  competition_name: string;
  sport_code: string;
  stages: ImportedStage[];
  competitors: ImportedCompetitor[];
  matches: ImportedMatch[];
  source_url: string;
};

export type ImportedStage = {
  source_stage_key: string;
  label: string;
  phase_type: 'league' | 'groups' | 'knockout' | 'custom';
  section_label: string;
  allows_tiebreaker: boolean;
  sort_order: number;
};

export type ImportedCompetitor = {
  source_competitor_id: string;
  name: string;
  code: string | null;
};

export type ImportedMatch = {
  source_match_id: string;
  source_stage_key: string;
  stage_label: string;
  group_code: string | null;
  sequence_in_stage: number;
  kickoff_at: string | null;
  bet_lock_at: string | null;
  home_competitor_id: string | null;
  away_competitor_id: string | null;
  home_name: string | null;
  away_name: string | null;
  official_home_score: number | null;
  official_away_score: number | null;
  official_home_penalties: number | null;
  official_away_penalties: number | null;
  penalty_winner_competitor_id: string | null;
  status: 'scheduled' | 'finished';
};

type ProviderContext = {
  provider?: string;
  competition_id: string;
  from?: string | null;
  to?: string | null;
};

type FifaTeam = {
  IdTeam?: string | number | null;
  Abbreviation?: string | null;
  Description?: FifaText[] | null;
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
  Winner?: string | number | null;
  MatchStatus?: number | string | null;
  ResultType?: number | string | null;
  StageName?: FifaText[] | null;
  GroupName?: FifaText[] | null;
  CompetitionName?: FifaText[] | null;
};

const FIFA_DEFAULT_FROM = '2026-01-01';
const FIFA_DEFAULT_TO = '2026-12-31';

export async function fetchOfficialCompetition(context: ProviderContext): Promise<ImportedCompetition> {
  if ((context.provider || OFFICIAL_PROVIDER_CODES.fifa) !== OFFICIAL_PROVIDER_CODES.fifa) {
    throw new Error('Provedor oficial ainda não suportado nesta versão.');
  }
  return fetchFifaCompetition(context);
}

async function fetchFifaCompetition(context: ProviderContext): Promise<ImportedCompetition> {
  const sourceUrl = buildFifaUrl(context);
  const response = await fetch(sourceUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; SuperBolao/1.0)',
    },
  });
  if (!response.ok) throw new Error(`FIFA API returned HTTP ${response.status}.`);
  const payload = await response.json() as { Results?: FifaMatch[] };
  const rows = Array.isArray(payload.Results) ? payload.Results : [];
  if (!rows.length) throw new Error('Nenhuma partida oficial encontrada para os parâmetros informados.');

  const competitionName = rows.find((row) => row.CompetitionName?.[0]?.Description)?.CompetitionName?.[0]?.Description
    || `Competição FIFA ${context.competition_id}`;
  const competitorsById = new Map<string, ImportedCompetitor>();
  const stagesByKey = new Map<string, ImportedStage>();
  const sequencesByStage = new Map<string, number>();
  const matches: ImportedMatch[] = [];

  rows
    .slice()
    .sort((first, second) => Date.parse(first.Date || '') - Date.parse(second.Date || ''))
    .forEach((match, index) => {
      const stageLabel = fifaDescription(match.StageName) || 'Fase principal';
      const sourceStageKey = buildSourceStageKey(stageLabel);
      if (!stagesByKey.has(sourceStageKey)) {
        stagesByKey.set(sourceStageKey, {
          source_stage_key: sourceStageKey,
          label: stageLabel,
          phase_type: inferStageType(stageLabel, fifaDescription(match.GroupName)),
          section_label: inferSectionLabel(stageLabel, fifaDescription(match.GroupName)),
          allows_tiebreaker: inferStageType(stageLabel, fifaDescription(match.GroupName)) === 'knockout',
          sort_order: stagesByKey.size + 1,
        });
      }

      [match.Home, match.Away].forEach((team) => {
        const competitor = mapFifaCompetitor(team);
        if (competitor && !competitorsById.has(competitor.source_competitor_id)) {
          competitorsById.set(competitor.source_competitor_id, competitor);
        }
      });

      const sequence = (sequencesByStage.get(sourceStageKey) || 0) + 1;
      sequencesByStage.set(sourceStageKey, sequence);

      matches.push({
        source_match_id: String(match.IdMatch || `${sourceStageKey}_${index + 1}`),
        source_stage_key: sourceStageKey,
        stage_label: stageLabel,
        group_code: extractGroupCode(fifaDescription(match.GroupName)),
        sequence_in_stage: sequence,
        kickoff_at: match.Date || null,
        bet_lock_at: match.Date || null,
        home_competitor_id: normalizeIdentifier(match.Home?.IdTeam ?? match.Home?.Abbreviation),
        away_competitor_id: normalizeIdentifier(match.Away?.IdTeam ?? match.Away?.Abbreviation),
        home_name: fifaDescription(match.Home?.Description) || match.Home?.Abbreviation || null,
        away_name: fifaDescription(match.Away?.Description) || match.Away?.Abbreviation || null,
        official_home_score: numberOrNull(match.HomeTeamScore),
        official_away_score: numberOrNull(match.AwayTeamScore),
        official_home_penalties: numberOrNull(match.HomeTeamPenaltyScore),
        official_away_penalties: numberOrNull(match.AwayTeamPenaltyScore),
        penalty_winner_competitor_id: resolvePenaltyWinnerId(match),
        status: isFinishedMatch(match) ? 'finished' : 'scheduled',
      });
    });

  return {
    provider: OFFICIAL_PROVIDER_CODES.fifa,
    provider_label: 'FIFA',
    competition_id: context.competition_id,
    competition_name: competitionName,
    sport_code: 'soccer',
    stages: [...stagesByKey.values()],
    competitors: [...competitorsById.values()],
    matches,
    source_url: sourceUrl,
  };
}

function buildFifaUrl(context: ProviderContext) {
  const params = new URLSearchParams({
    language: 'en',
    count: '500',
    idCompetition: context.competition_id,
    from: context.from || FIFA_DEFAULT_FROM,
    to: context.to || FIFA_DEFAULT_TO,
  });
  return `https://api.fifa.com/api/v3/calendar/matches?${params.toString()}`;
}

function mapFifaCompetitor(team: FifaTeam | null | undefined): ImportedCompetitor | null {
  const sourceCompetitorId = normalizeIdentifier(team?.IdTeam ?? team?.Abbreviation);
  const code = normalizeCode(team?.Abbreviation);
  const name = fifaDescription(team?.Description) || code;
  if (!sourceCompetitorId || !name) return null;
  return {
    source_competitor_id: sourceCompetitorId,
    name,
    code,
  };
}

function fifaDescription(texts: FifaText[] | null | undefined): string | null {
  const description = texts?.[0]?.Description;
  if (typeof description !== 'string') return null;
  const normalized = description.trim();
  return normalized || null;
}

function inferStageType(stageLabel: string, groupName: string | null): ImportedStage['phase_type'] {
  const normalized = `${stageLabel} ${groupName || ''}`.toLowerCase();
  if (normalized.includes('group')) return 'groups';
  if (/(round of|quarter|semi|final|playoff|knockout|third place|bronze)/i.test(normalized)) return 'knockout';
  if (/(league|season|regular|round|rodada|turno)/i.test(normalized)) return 'league';
  return 'custom';
}

function inferSectionLabel(stageLabel: string, groupName: string | null) {
  const stageType = inferStageType(stageLabel, groupName);
  if (stageType === 'groups') return 'Grupo';
  if (stageType === 'knockout') return 'Chave';
  if (stageType === 'league') return 'Rodada';
  return 'Seção';
}

function extractGroupCode(groupName: string | null): string | null {
  if (!groupName) return null;
  const match = groupName.match(/group\s+(.+)$/i);
  if (match?.[1]) return match[1].trim().toUpperCase();
  return groupName.trim();
}

function resolvePenaltyWinnerId(match: FifaMatch): string | null {
  const homePenalty = numberOrNull(match.HomeTeamPenaltyScore);
  const awayPenalty = numberOrNull(match.AwayTeamPenaltyScore);
  if (homePenalty !== null && awayPenalty !== null && homePenalty !== awayPenalty) {
    return normalizeIdentifier(homePenalty > awayPenalty ? match.Home?.IdTeam ?? match.Home?.Abbreviation : match.Away?.IdTeam ?? match.Away?.Abbreviation);
  }
  const homeScore = numberOrNull(match.HomeTeamScore);
  const awayScore = numberOrNull(match.AwayTeamScore);
  if (homeScore !== null && awayScore !== null && homeScore === awayScore && match.Winner != null) {
    return normalizeIdentifier(match.Winner);
  }
  return null;
}

function isFinishedMatch(match: FifaMatch) {
  const resultType = numberOrNull(match.ResultType);
  const matchStatus = numberOrNull(match.MatchStatus);
  return resultType !== null && resultType > 0 && matchStatus === 0;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function normalizeIdentifier(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

export function buildSourceStageKey(label: string) {
  return String(label || 'fase')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

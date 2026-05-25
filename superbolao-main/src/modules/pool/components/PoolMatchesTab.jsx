import { useMemo, useState } from 'react';
import {
  useTournamentStaticData,
  useMatchesByStage,
  usePoolCompetitors,
  usePoolMatchesByStage,
} from '@/modules/tournament/hooks/useTournament';
import { getPoolStages, getStageSectionTitle, POOL_TEMPLATE_CODES } from '@/modules/pool/domain/poolSettings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TournamentNotInitialized } from './TournamentNotInitialized';
import { cn } from '@/core/lib/utils';
import { hasPenaltyScore } from '@/modules/pool/domain/penaltyShootout';

const STAGE_TABS = [
  { code: 'group', label: 'Grupos' },
  { code: 'r16', label: '16-avos' },
  { code: 'qf', label: 'Oitavas' },
  { code: 'sf', label: 'Quartas' },
  { code: 'semi', label: 'Semis' },
  { code: 'third', label: '3º Lugar' },
  { code: 'final', label: 'Final' },
];

export function PoolMatchesTab({ pool }) {
  if (pool?.template_code === POOL_TEMPLATE_CODES.custom && !pool?.tournament_id) return <CustomPoolMatchesTab pool={pool} />;
  return <TournamentPoolMatchesTab pool={pool} />;
}

function TournamentPoolMatchesTab({ pool }) {
  const { tournament, teams, isLoading } = useTournamentStaticData(pool?.tournament_id);
  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const [activeStage, setActiveStage] = useState('group');

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!tournament) {
    return <TournamentNotInitialized />;
  }

  return (
    <Tabs value={activeStage} onValueChange={setActiveStage}>
      <TabsList className="flex h-auto flex-wrap border border-emerald-950/10 bg-white/70 p-1 shadow-sm shadow-emerald-950/5">
        {STAGE_TABS.map((s) => (
          <TabsTrigger key={s.code} value={s.code}>{s.label}</TabsTrigger>
        ))}
      </TabsList>
      {STAGE_TABS.map((s) => (
        <TabsContent key={s.code} value={s.code} className="mt-3">
          <StageMatchList tournamentId={tournament.id} stage={s} teamsById={teamsById} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CustomPoolMatchesTab({ pool }) {
  const stages = getPoolStages(pool);
  const { competitors, isLoading } = usePoolCompetitors(pool.id);
  const competitorsById = useMemo(() => Object.fromEntries(competitors.map((c) => [c.id, c])), [competitors]);
  const [activeStage, setActiveStage] = useState(stages[0]?.code || 'regular');

  if (isLoading) return <Skeleton className="h-32" />;
  return (
    <Tabs value={activeStage} onValueChange={setActiveStage}>
      <TabsList className="flex h-auto flex-wrap border border-emerald-950/10 bg-white/70 p-1 shadow-sm shadow-emerald-950/5">
        {stages.map((s) => <TabsTrigger key={s.code} value={s.code}>{s.label}</TabsTrigger>)}
      </TabsList>
      {stages.map((s) => (
        <TabsContent key={s.code} value={s.code} className="mt-3">
          <CustomStageMatchList poolId={pool.id} stage={s} competitorsById={competitorsById} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CustomStageMatchList({ poolId, stage, competitorsById }) {
  const { matches, isLoading } = usePoolMatchesByStage(poolId, stage.code);
  if (isLoading) return <Skeleton className="h-32" />;
  return <StageMatchListContent matches={matches} stage={stage} teamsById={competitorsById} />;
}

function StageMatchList({ tournamentId, stage, teamsById }) {
  const stageCode = stage.code;
  const { matches, isLoading } = useMatchesByStage(tournamentId, stageCode);

  if (isLoading) return <Skeleton className="h-32" />;
  return <StageMatchListContent matches={matches} stage={stage} teamsById={teamsById} />;
}

function StageMatchListContent({ matches, stage, teamsById }) {
  if (!matches.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-600">
          Os jogos desta fase ainda não foram cadastrados.
        </CardContent>
      </Card>
    );
  }

  const grouped = groupMatchesBySection(matches);

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([groupCode, list]) => (
        <Card key={groupCode} className="overflow-hidden">
          <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4">
            <CardTitle className="text-base">
              {getStageSectionTitle(stage, groupCode)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-4">
            {list.map((m) => (
              <MatchResultRow key={m.id} match={m} teamsById={teamsById} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MatchResultRow({ match, teamsById }) {
  const home = teamsById[match.home_team_id]?.name || match.home_placeholder || '—';
  const away = teamsById[match.away_team_id]?.name || match.away_placeholder || '—';
  const finished = match.status === 'finished';
  const hs = match.official_home_score;
  const as = match.official_away_score;
  const penWin = match.penalty_winner_team_id;
  const penLabel = penWin ? (teamsById[penWin]?.name || '') : '';
  const hasPenScore = hasPenaltyScore(match.official_home_penalties, match.official_away_penalties);
  const penaltyText = hasPenScore
    ? `Pênaltis: ${match.official_home_penalties} × ${match.official_away_penalties}${penLabel ? ` · ${penLabel}` : ''}`
    : penLabel ? `Pênaltis: ${penLabel}` : '';

  return (
    <div className="match-surface p-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
      <TeamCell name={home} code={teamsById[match.home_team_id]?.code} align="right" />
      <div className="mx-auto flex min-w-[6.5rem] items-center justify-center gap-2 rounded-md border border-emerald-950/10 bg-white/75 px-3 py-2 font-mono text-base shadow-inner shadow-emerald-950/5">
        {finished ? (
          <>
            <span className="font-bold text-slate-950">{hs ?? '-'}</span>
            <span className="text-emerald-900/45">x</span>
            <span className="font-bold text-slate-950">{as ?? '-'}</span>
          </>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">vs</span>
        )}
      </div>
      <TeamCell name={away} code={teamsById[match.away_team_id]?.code} />
      <div className="text-xs text-center sm:text-right">
        {finished ? (
          <Badge variant="success">Finalizado</Badge>
        ) : (
          <span className="arena-chip bg-white/75 text-slate-700">{formatKickoff(match.kickoff_at)}</span>
        )}
        {hasPenScore && (
          <div className="text-[10px] text-slate-500 mt-1">
            {penaltyText}
          </div>
        )}
        {!hasPenScore && penLabel && <div className="text-[10px] text-slate-500 mt-1">{penaltyText}</div>}
      </div>
    </div>
  );
}

function TeamCell({ name, code, align = 'left' }) {
  return (
    <div className={cn('min-w-0 text-center sm:text-left', align === 'right' && 'sm:text-right')}>
      {code && <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">{code}</div>}
      <div className="truncate text-sm font-semibold text-slate-900" title={name}>{name}</div>
    </div>
  );
}

function groupMatchesBySection(matches) {
  const hasSections = matches.some((match) => String(match.group_code || '').trim());
  if (!hasSections) return { __flat: matches };
  return matches.reduce((acc, match) => {
    const key = String(match.group_code || '').trim() || 'Sem seção';
    (acc[key] = acc[key] || []).push(match);
    return acc;
  }, {});
}

function formatKickoff(d) {
  const date = toDate(d);
  if (!date) return '';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  if (typeof d.toDate === 'function') return d.toDate();
  return new Date(d);
}

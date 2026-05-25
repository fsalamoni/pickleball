import { useMemo } from 'react';
import { useTournamentStaticData, useAllTournamentMatches, usePoolCompetitors, useAllPoolMatches } from '@/modules/tournament/hooks/useTournament';
import { getPoolStages, POOL_TEMPLATE_CODES } from '@/modules/pool/domain/poolSettings';
import { hasPenaltyScore } from '@/modules/pool/domain/penaltyShootout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TournamentNotInitialized } from './TournamentNotInitialized';

const STAGE_LABELS = {
  group: 'Grupos',
  r16: '16-avos',
  qf: 'Oitavas',
  sf: 'Quartas',
  semi: 'Semis',
  third: '3º Lugar',
  final: 'Final',
};

export function PoolCalendarTab({ pool }) {
  if (pool?.template_code === POOL_TEMPLATE_CODES.custom && !pool?.tournament_id) return <CustomPoolCalendarTab pool={pool} />;
  return <TournamentPoolCalendarTab pool={pool} />;
}

function TournamentPoolCalendarTab({ pool }) {
  const { tournament, teams, isLoading: staticLoading } = useTournamentStaticData(pool?.tournament_id);
  const { matches, isLoading: matchesLoading } = useAllTournamentMatches(tournament?.id);
  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  if (staticLoading || matchesLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!tournament) {
    return <TournamentNotInitialized />;
  }

  if (!matches.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-600">
          Nenhum jogo cadastrado ainda.
        </CardContent>
      </Card>
    );
  }

  return <CalendarList matches={matches} teamsById={teamsById} />;
}

function CustomPoolCalendarTab({ pool }) {
  const { competitors, isLoading: competitorsLoading } = usePoolCompetitors(pool.id);
  const { matches, isLoading: matchesLoading } = useAllPoolMatches(pool.id);
  const competitorsById = useMemo(() => Object.fromEntries(competitors.map((c) => [c.id, c])), [competitors]);
  const stageLabels = useMemo(
    () => Object.fromEntries(getPoolStages(pool).map((stage) => [stage.code, stage.label])),
    [pool],
  );

  if (competitorsLoading || matchesLoading) return <Skeleton className="h-64" />;
  if (!matches.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-600">Nenhum jogo cadastrado ainda.</CardContent>
      </Card>
    );
  }
  return <CalendarList matches={matches} teamsById={competitorsById} stageLabels={stageLabels} />;
}

function CalendarList({ matches, teamsById, stageLabels = STAGE_LABELS }) {
  const byDate = groupByDate(matches);
  return (
    <div className="space-y-3">
      {Object.entries(byDate).map(([dateKey, list]) => (
        <Card key={dateKey} className="overflow-hidden">
          <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4">
            <CardTitle className="text-base capitalize text-slate-950">{formatDateHeader(dateKey)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-4">
             {list.map((m) => <CalendarRow key={m.id} match={m} teamsById={teamsById} stageLabels={stageLabels} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CalendarRow({ match, teamsById, stageLabels }) {
  const home = teamsById[match.home_team_id]?.name || match.home_placeholder || '—';
  const away = teamsById[match.away_team_id]?.name || match.away_placeholder || '—';
  const finished = match.status === 'finished';
  const time = formatTime(match.kickoff_at);
  const stageLabel = stageLabels[match.stage_code] || STAGE_LABELS[match.stage_code] || match.stage_code;
  const hasPenScore = hasPenaltyScore(match.official_home_penalties, match.official_away_penalties);

  return (
    <div className="match-surface grid gap-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <div className="arena-chip justify-center bg-white/75 font-mono text-slate-700 sm:w-16">{time || '-'}</div>
      <div className="text-center text-sm font-semibold text-slate-900 sm:text-right truncate">{home}</div>
      <div className="mx-auto flex min-w-[5.5rem] items-center justify-center gap-2 rounded-md border border-emerald-950/10 bg-white/75 px-3 py-2 font-mono shadow-inner shadow-emerald-950/5">
        {finished ? (
          <>
            <span className="font-bold text-slate-950">{match.official_home_score ?? '-'}</span>
            <span className="text-emerald-900/45">x</span>
            <span className="font-bold text-slate-950">{match.official_away_score ?? '-'}</span>
          </>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">vs</span>
        )}
      </div>
      <div className="text-center text-sm font-semibold text-slate-900 sm:text-left truncate">{away}</div>
      <Badge variant="outline" className="justify-center bg-white/70 text-[10px]">
        {stageLabel}{match.group_code ? ` ${match.group_code}` : ''}
      </Badge>
      {hasPenScore && (
        <div className="text-center text-[10px] text-slate-500 sm:col-start-3">
          Pen. {match.official_home_penalties} × {match.official_away_penalties}
        </div>
      )}
    </div>
  );
}

function groupByDate(matches) {
  return matches.reduce((acc, m) => {
    const d = toDate(m.kickoff_at);
    const key = d ? d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : 'sem-data';
    (acc[key] = acc[key] || []).push(m);
    return acc;
  }, {});
}

function formatDateHeader(key) {
  if (key === 'sem-data') return 'Sem data definida';
  const [y, mo, d] = key.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function formatTime(d) {
  const date = toDate(d);
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  if (typeof d.toDate === 'function') return d.toDate();
  return new Date(d);
}

import React, { useMemo } from 'react';
import { Trophy, Swords } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  useModalities,
  useAllModalityMatches,
  useRegistrations,
} from '@/modules/tournament/hooks/useTournament';
import {
  MATCH_STATUS,
  MATCH_STATUS_LABELS,
  TOURNAMENT_STAGE_TYPE_LABELS,
} from '@/modules/tournament/domain/constants';
import { formatScoringSummary, resolveStageScoringConfig } from '@/modules/tournament/domain/scoring';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import V2Collapsible from './V2Collapsible';
import { cn } from '@/core/lib/utils';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return '3º lugar';
  if (m.bracket === 'gf') return m.round === 2 ? 'Final (reset)' : 'Grande final';
  if (m.bracket === 'wb') return `Venc. R${m.round}`;
  if (m.bracket === 'lb') return `Repesc. R${m.round}`;
  return m.round;
}

function statusTone(status) {
  if (status === MATCH_STATUS.FINISHED || status === MATCH_STATUS.WALKOVER) return 'green';
  if (status === MATCH_STATUS.IN_PROGRESS) return 'amber';
  return 'neutral';
}

function MatchSide({ people = [], fallback, win }) {
  const list = (people || []).filter(Boolean);
  if (list.length === 0) return <span className="text-gray-400">{fallback || '—'}</span>;
  return (
    <div className={cn('space-y-1', win ? 'font-bold text-green-700' : 'font-medium text-ink')}>
      {list.map((person, index) => (
        <div key={`${person.name || 'p'}-${index}`} className="flex items-center gap-1.5">
          {win && index === 0 && <Trophy className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label="Vencedor" />}
          <UserAvatar name={person.name} photoUrl={person.photoUrl} size="xs" />
          <span className="leading-tight">{person.name}</span>
        </div>
      ))}
    </div>
  );
}

function MatchesTable({ matches, labelById, peopleById }) {
  const hasGroups = matches.some((m) => m.group);
  const hasSchedule = matches.some((m) => m.court || m.scheduled_at);

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-paper text-gray-500">
            <tr className="text-left">
              {hasGroups && <th className="px-3 py-2 font-semibold">Grupo</th>}
              <th className="px-3 py-2 font-semibold">Rod.</th>
              {hasSchedule && <th className="px-3 py-2 font-semibold">Quadra</th>}
              {hasSchedule && <th className="px-3 py-2 font-semibold">Horário</th>}
              <th className="px-3 py-2 font-semibold">Lado A</th>
              <th className="px-3 py-2 text-center font-semibold">vs</th>
              <th className="px-3 py-2 font-semibold">Lado B</th>
              <th className="px-3 py-2 font-semibold">Placar</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const sideA = m.side_a_ids?.map((id) => labelById.get(id) || id).join(' + ') || m.side_a;
              const sideB = m.side_b_ids?.map((id) => labelById.get(id) || id).join(' + ') || m.side_b;
              const sideAPeople = (m.side_a_ids || []).flatMap((id) => peopleById.get(id) || []);
              const sideBPeople = (m.side_b_ids || []).flatMap((id) => peopleById.get(id) || []);
              const finished = m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER;
              const inProgress = m.status === MATCH_STATUS.IN_PROGRESS;
              const winA = finished && m.winner_side === 'a';
              const winB = finished && m.winner_side === 'b';
              return (
                <tr key={m.id} className={cn('border-t border-gray-100', inProgress && 'bg-amber-50/60')}>
                  {hasGroups && <td className="px-3 py-2">{m.group || '—'}</td>}
                  <td className="px-3 py-2">{roundLabel(m)}</td>
                  {hasSchedule && <td className="px-3 py-2">{m.court || '—'}</td>}
                  {hasSchedule && <td className="px-3 py-2 tabular-nums">{formatMatchTime(m.scheduled_at)}</td>}
                  <td className="px-3 py-2 align-middle"><MatchSide people={sideAPeople} fallback={sideA} win={winA} /></td>
                  <td className="px-3 py-2 text-center align-middle text-xs font-medium text-gray-400">vs</td>
                  <td className="px-3 py-2 align-middle"><MatchSide people={sideBPeople} fallback={sideB} win={winB} /></td>
                  <td className="px-3 py-2 tabular-nums text-ink">
                    {(m.games || []).length === 0 ? '—' : m.games.map((g, i) => <span key={i} className="mr-2">{g.a}-{g.b}</span>)}
                  </td>
                  <td className="px-3 py-2"><V2Badge tone={statusTone(m.status)}>{MATCH_STATUS_LABELS[m.status] || m.status}</V2Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2.5 sm:hidden">
        {matches.map((m) => {
          const sideA = m.side_a_ids?.map((id) => labelById.get(id) || id).join(' + ') || m.side_a;
          const sideB = m.side_b_ids?.map((id) => labelById.get(id) || id).join(' + ') || m.side_b;
          const sideAPeople = (m.side_a_ids || []).flatMap((id) => peopleById.get(id) || []);
          const sideBPeople = (m.side_b_ids || []).flatMap((id) => peopleById.get(id) || []);
          const finished = m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER;
          const inProgress = m.status === MATCH_STATUS.IN_PROGRESS;
          const winA = finished && m.winner_side === 'a';
          const winB = finished && m.winner_side === 'b';
          const hasScore = (m.games || []).length > 0;
          return (
            <div key={m.id} className={cn('rounded-2xl border p-3', inProgress ? 'border-amber-200 bg-amber-50/70' : 'border-gray-100 bg-white')}>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {hasGroups && m.group && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-gray-600">{m.group}</span>}
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-gray-600">Rod. {roundLabel(m)}</span>
                {hasSchedule && m.court && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-gray-600">{m.court}</span>}
                {hasSchedule && m.scheduled_at && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600">{formatMatchTime(m.scheduled_at)}</span>}
                <V2Badge tone={statusTone(m.status)} className="ml-auto">{MATCH_STATUS_LABELS[m.status] || m.status}</V2Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <MatchSide people={sideAPeople} fallback={sideA} win={winA} />
                  {hasScore && <span className="shrink-0 tabular-nums text-sm font-semibold text-ink">{m.games.map((g) => g.a).join('  ')}</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                  <span className="h-px flex-1 bg-gray-100" />vs<span className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <MatchSide people={sideBPeople} fallback={sideB} win={winB} />
                  {hasScore && <span className="shrink-0 tabular-nums text-sm font-semibold text-ink">{m.games.map((g) => g.b).join('  ')}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function V2ModalityMatches({ tournament, modality }) {
  const { data: matches = [] } = useAllModalityMatches(modality.id);
  const { data: registrations = [] } = useRegistrations(modality.id);

  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, r.label || r.player_a_name));
    return map;
  }, [registrations]);
  const peopleById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, [
      { name: r.player_a_name, photoUrl: r.player_a_photo },
      ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : []),
    ]));
    return map;
  }, [registrations]);

  const phases = useMemo(() => normalizePhases(modality.stages), [modality.stages]);
  const byStage = useMemo(() => {
    const map = new Map();
    matches.forEach((m) => {
      const s = m.stage_index ?? 0;
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(m);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);
  const showPhaseHeaders = phases.length > 1;

  const doneCount = matches.filter((m) => m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER).length;
  const subtitle = matches.length === 0 ? 'Nenhum jogo gerado ainda' : `${doneCount}/${matches.length} jogos concluídos`;

  return (
    <V2Collapsible title={<span className="inline-flex items-center gap-2"><Swords className="h-4 w-4 text-ink" /> {modality.name}</span>} subtitle={subtitle}>
      {matches.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum jogo gerado ainda.</p>
      ) : (
        <div className="space-y-3">
          {byStage.map(([stageIndex, stageMatches]) => {
            const phaseScoring = resolveStageScoringConfig(modality, tournament, stageIndex);
            const done = stageMatches.filter((m) => m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER).length;
            if (!showPhaseHeaders) return <MatchesTable key={stageIndex} matches={stageMatches} labelById={labelById} peopleById={peopleById} />;
            return (
              <V2Collapsible
                key={stageIndex}
                tone="nested"
                title={`Fase ${stageIndex + 1} · ${TOURNAMENT_STAGE_TYPE_LABELS[phases[stageIndex]?.type] || ''}`}
                badges={(
                  <>
                    <V2Badge tone="neutral">{formatScoringSummary(phaseScoring)}</V2Badge>
                    <V2Badge tone="neutral">{done}/{stageMatches.length}</V2Badge>
                  </>
                )}
              >
                <MatchesTable matches={stageMatches} labelById={labelById} peopleById={peopleById} />
              </V2Collapsible>
            );
          })}
        </div>
      )}
    </V2Collapsible>
  );
}

export function V2TournamentMatches({ tournament }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  if (modalities.length === 0) {
    return <V2Surface className="text-center"><p className="py-6 text-sm text-gray-500">Sem modalidades.</p></V2Surface>;
  }
  return (
    <div className="space-y-4">
      {modalities.map((m) => <V2ModalityMatches key={m.id} tournament={tournament} modality={m} />)}
    </div>
  );
}

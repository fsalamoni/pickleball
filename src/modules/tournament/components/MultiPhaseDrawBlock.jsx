import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shuffle, ChevronsRight, AlertTriangle, Users, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  useMatches,
  useRegistrations,
  usePhaseGroups,
  useRunPhaseDraw,
  useAdvanceToNextPhase,
  useAdvanceStage,
} from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STAGE_TYPE_LABELS,
  MATCH_STATUS,
} from '@/modules/tournament/domain/constants';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { stageSupportsAdvance } from '@/modules/tournament/domain/progression';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.bracket === 'gf') return m.round === 2 ? 'Final (reset)' : 'Grande final';
  if (m.bracket === 'wb') return `Vencedores R${m.round}`;
  if (m.bracket === 'lb') return `Repescagem R${m.round}`;
  return `R${m.round}`;
}

export default function MultiPhaseDrawBlock({ tournament, modality, isAdmin }) {
  const phases = useMemo(() => normalizePhases(modality.stages), [modality.stages]);
  const { data: registrations = [] } = useRegistrations(modality.id);

  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, r.label || r.player_a_name || r.id));
    return map;
  }, [registrations]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h4 className="font-semibold">{modality.name}</h4>
          <p className="text-xs text-slate-500">
            {phases.length} fases · inscrição em lista única ·{' '}
            {registrations.length} inscrito(s)
          </p>
        </div>

        {phases.map((phase, index) => (
          <PhaseSection
            key={index}
            tournament={tournament}
            modality={modality}
            phase={phase}
            stageIndex={index}
            isFirst={index === 0}
            isLast={index === phases.length - 1}
            isAdmin={isAdmin}
            labelById={labelById}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PhaseSection({ tournament, modality, phase, stageIndex, isFirst, isLast, isAdmin, labelById }) {
  const { data: matches = [] } = useMatches(modality.id, stageIndex);
  const { data: groups = [] } = usePhaseGroups(modality.id, stageIndex);
  const runPhaseDraw = useRunPhaseDraw();
  const advanceToNext = useAdvanceToNextPhase();
  const advanceStage = useAdvanceStage(modality.id);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const doneStatuses = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);
  const playedCount = matches.filter((m) => doneStatuses.has(m.status)).length;
  const allDone = matches.length > 0 && playedCount === matches.length;
  const withinAdvance = stageSupportsAdvance(phase.type);

  function renderSide(ids, raw) {
    if (!ids || ids.length === 0) return <span className="text-slate-400">{raw || '—'}</span>;
    return ids.map((id) => labelById.get(id) || id).join(' + ');
  }

  async function doDraw() {
    setError(null);
    setRunning(true);
    try {
      const res = await runPhaseDraw.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex,
      });
      toast.success(`Fase ${stageIndex + 1} sorteada (${res.groups.length} grupo(s)).`);
      (res.scheduleWarnings || []).length > 0
        && toast.warning(`${res.scheduleWarnings.length} jogo(s) sem horário — ajuste quadras/horário.`);
    } catch (err) {
      setError(err?.message || 'Falha ao sortear.');
      toast.error(err?.message || 'Falha ao sortear.');
    } finally {
      setRunning(false);
    }
  }

  async function doWithinAdvance() {
    setRunning(true);
    try {
      const res = await advanceStage.mutateAsync({
        tournamentId: tournament.id,
        stageIndex,
        modality,
        tournament,
      });
      if (res.complete) toast.success('Fase concluída — definido! 🏆');
      else toast.success(`Próxima rodada gerada (${res.created} jogo(s)).`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível avançar a rodada.');
    } finally {
      setRunning(false);
    }
  }

  async function doAdvanceToNext() {
    setRunning(true);
    try {
      const res = await advanceToNext.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex,
      });
      toast.success(`Fase ${res.nextStageIndex + 1} gerada com ${res.groups.length} grupo(s)/chave.`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível gerar a próxima fase.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200">
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 px-3 py-2 rounded-t-md">
        <div className="flex items-center gap-2">
          <Badge>Fase {stageIndex + 1}</Badge>
          <span className="text-sm font-medium">{TOURNAMENT_STAGE_TYPE_LABELS[phase.type]}</span>
          <span className="text-xs text-slate-500">
            {matches.length > 0 ? `${playedCount}/${matches.length} jogos` : 'não sorteada'}
          </span>
        </div>
        {isAdmin && (
          <div className="flex gap-1 flex-wrap">
            {isFirst && (
              <Button size="sm" onClick={doDraw} disabled={running}>
                <Shuffle className="w-4 h-4 mr-1" />
                {matches.length > 0 ? 'Re-sortear' : 'Sortear grupos e jogos'}
              </Button>
            )}
            {withinAdvance && matches.length > 0 && (
              <Button size="sm" variant="outline" onClick={doWithinAdvance} disabled={running}>
                <ChevronsRight className="w-4 h-4 mr-1" /> Avançar rodada
              </Button>
            )}
            {!isLast && (
              <Button
                size="sm"
                variant="outline"
                onClick={doAdvanceToNext}
                disabled={running || !allDone}
                title={allDone ? 'Classificar e gerar a próxima fase' : 'Conclua todos os jogos desta fase'}
              >
                <ArrowDownToLine className="w-4 h-4 mr-1" /> Gerar próxima fase
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {groups.map((g) => (
              <div key={g.id || g.name} className="rounded border border-slate-200 p-2">
                <div className="text-xs font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-emerald-600" /> {g.name}
                  <span className="text-slate-400 font-normal">({(g.entrants || []).length})</span>
                </div>
                <ul className="mt-1 text-xs text-slate-600 space-y-0.5">
                  {(g.entrants || []).map((e) => (
                    <li key={e.id}>
                      {(e.members || [e.id]).map((m) => labelById.get(m) || m).join(' + ')}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {matches.length > 0 && (
          <div className="arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-2 py-1">#</th>
                  {matches.some((m) => m.group) && <th className="px-2 py-1">Grupo</th>}
                  <th className="px-2 py-1">Rod.</th>
                  {matches.some((m) => m.court || m.scheduled_at) && <th className="px-2 py-1">Quadra</th>}
                  {matches.some((m) => m.scheduled_at) && <th className="px-2 py-1">Horário</th>}
                  <th className="px-2 py-1">Lado A</th>
                  <th className="px-2 py-1">Lado B</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-2 py-1">{i + 1}</td>
                    {matches.some((mm) => mm.group) && <td className="px-2 py-1">{m.group || '—'}</td>}
                    <td className="px-2 py-1">{roundLabel(m)}</td>
                    {matches.some((mm) => mm.court || mm.scheduled_at) && (
                      <td className="px-2 py-1">{m.court || '—'}</td>
                    )}
                    {matches.some((mm) => mm.scheduled_at) && (
                      <td className="px-2 py-1 tabular-nums">{formatMatchTime(m.scheduled_at)}</td>
                    )}
                    <td className="px-2 py-1">{renderSide(m.side_a_ids, m.side_a)}</td>
                    <td className="px-2 py-1">{renderSide(m.side_b_ids, m.side_b)}</td>
                    <td className="px-2 py-1"><Badge variant="secondary">{m.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {matches.length === 0 && !isFirst && (
          <p className="text-xs text-slate-500">
            Esta fase será gerada automaticamente ao concluir a fase anterior e clicar em
            “Gerar próxima fase”.
          </p>
        )}
      </div>
    </div>
  );
}

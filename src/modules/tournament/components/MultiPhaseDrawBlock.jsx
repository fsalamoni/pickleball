import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Shuffle, ChevronsRight, AlertTriangle, Users, ArrowDownToLine, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  useMatches,
  useRegistrations,
  usePhaseGroups,
  useRunPhaseDraw,
  useAdvanceToNextPhase,
  useAdvanceStage,
  useSubstitutePlayer,
  useMovePhaseEntrant,
} from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STAGE_TYPE_LABELS,
  MATCH_STATUS,
  REGISTRATION_STATUS,
} from '@/modules/tournament/domain/constants';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { stageSupportsAdvance } from '@/modules/tournament/domain/progression';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return 'Disputa de 3º lugar';
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

  const activeRegistrations = useMemo(
    () =>
      registrations.filter(
        (r) =>
          r.status === REGISTRATION_STATUS.CONFIRMED ||
          r.status === REGISTRATION_STATUS.CHECKED_IN,
      ),
    [registrations],
  );

  return (
    <CollapsibleSection
      title={modality.name}
      subtitle={`${phases.length} fases · inscrição em lista única · ${registrations.length} inscrito(s)`}
      defaultOpen
    >
      <div className="space-y-3">
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
            activeRegistrations={activeRegistrations}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}

function PhaseSection({ tournament, modality, phase, stageIndex, isFirst, isLast, isAdmin, labelById, activeRegistrations }) {
  const { data: matches = [] } = useMatches(modality.id, stageIndex);
  const { data: groups = [] } = usePhaseGroups(modality.id, stageIndex);
  const runPhaseDraw = useRunPhaseDraw();
  const advanceToNext = useAdvanceToNextPhase();
  const advanceStage = useAdvanceStage(modality.id);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [substitution, setSubstitution] = useState(null);
  const [groupsEditorOpen, setGroupsEditorOpen] = useState(false);

  const doneStatuses = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);
  const playedCount = matches.filter((m) => doneStatuses.has(m.status)).length;
  const allDone = matches.length > 0 && playedCount === matches.length;
  const withinAdvance = stageSupportsAdvance(phase.type);
  const hasGroups = groups.length > 0;

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

  const actions = isAdmin ? (
    <>
      {isFirst && (
        <Button size="sm" onClick={doDraw} disabled={running}>
          <Shuffle className="w-4 h-4 mr-1" />
          {matches.length > 0 ? 'Re-sortear' : 'Sortear grupos e jogos'}
        </Button>
      )}
      {hasGroups && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setGroupsEditorOpen(true)}
          disabled={running}
          title="Mover jogadores entre os grupos sorteados desta fase"
        >
          <Users className="w-4 h-4 mr-1" /> Editar grupos
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
    </>
  ) : null;

  return (
    <CollapsibleSection
      className="border-slate-200 bg-slate-50/40"
      headerClassName="py-1.5"
      title={`Fase ${stageIndex + 1}`}
      badges={(
        <>
          <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[phase.type]}</Badge>
          <span className="text-xs text-slate-500">
            {matches.length > 0 ? `${playedCount}/${matches.length} jogos` : 'não sorteada'}
          </span>
        </>
      )}
      actions={actions}
      defaultOpen
    >
      <div className="space-y-3">
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
                    <td className="px-2 py-1">
                      <SideCell
                        ids={m.side_a_ids}
                        rawSide={m.side_a}
                        labelById={labelById}
                        isAdmin={isAdmin}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <SideCell
                        ids={m.side_b_ids}
                        rawSide={m.side_b}
                        labelById={labelById}
                        isAdmin={isAdmin}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
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

      {groupsEditorOpen && (
        <PhaseGroupsEditorDialog
          tournament={tournament}
          modality={modality}
          stageIndex={stageIndex}
          groups={groups}
          labelById={labelById}
          onClose={() => setGroupsEditorOpen(false)}
        />
      )}

      {substitution && (
        <SubstitutePlayerDialog
          match={substitution.match}
          registrationId={substitution.registrationId}
          modalityId={modality.id}
          labelById={labelById}
          activeRegistrations={activeRegistrations}
          onClose={() => setSubstitution(null)}
        />
      )}
    </CollapsibleSection>
  );
}

function SideCell({ ids, rawSide, labelById, isAdmin, onSubstitute }) {
  if (!ids || ids.length === 0) {
    return <span className="text-slate-400">{rawSide || '—'}</span>;
  }
  return (
    <div className="space-y-0.5">
      {ids.map((regId) => {
        const name = labelById.get(regId) || regId;
        return (
          <div key={regId} className="flex items-center gap-1">
            <span>{name}</span>
            {isAdmin && (
              <button
                onClick={() => onSubstitute(regId)}
                title="Substituir jogador"
                className="text-slate-400 hover:text-slate-700 transition-colors ml-1"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseGroupsEditorDialog({ tournament, modality, stageIndex, groups, labelById, onClose }) {
  const moveMutation = useMovePhaseEntrant();
  const groupNames = groups.map((g) => g.name);

  function entrantsOf(g) {
    if (Array.isArray(g.entrants) && g.entrants.length > 0) return g.entrants;
    return (g.participants || []).map((id) => ({ id, members: [id] }));
  }

  function entrantLabel(e) {
    const members = e.members || [e.id];
    return members.map((m) => labelById.get(m) || m).join(' + ');
  }

  async function handleMove(entrantId, toGroupName, fromGroupName) {
    if (toGroupName === fromGroupName) return;
    try {
      await moveMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex,
        entrantId,
        toGroupName,
      });
      toast.success('Participante movido e jogos da fase regerados.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível mover o participante.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !moveMutation.isPending && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar grupos · {modality.name}</DialogTitle>
          <DialogDescription>
            Mova participantes entre os grupos desta fase. Ao mover, os jogos da fase são
            regerados com a nova composição — os placares já lançados nesta fase serão perdidos.
          </DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum grupo sorteado nesta fase.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {groups.map((g) => {
              const entrants = entrantsOf(g);
              return (
                <div key={g.name} className="rounded-md border border-slate-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-800">
                    {g.name}{' '}
                    <span className="text-xs font-normal text-slate-500">({entrants.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {entrants.length === 0 ? (
                      <p className="text-xs text-slate-400">Grupo vazio</p>
                    ) : (
                      entrants.map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm">{entrantLabel(e)}</span>
                          <select
                            className="h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
                            value={g.name}
                            disabled={moveMutation.isPending}
                            onChange={(ev) => handleMove(e.id, ev.target.value, g.name)}
                            title="Mover para outro grupo"
                          >
                            {groupNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={moveMutation.isPending}>
            {moveMutation.isPending ? 'Movendo…' : 'Fechar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubstitutePlayerDialog({
  match,
  registrationId,
  modalityId,
  labelById,
  activeRegistrations,
  onClose,
}) {
  const substituteMutation = useSubstitutePlayer(modalityId);
  const [selectedId, setSelectedId] = useState('');

  const currentName = labelById.get(registrationId) || registrationId;

  const takenIds = new Set([...(match.side_a_ids || []), ...(match.side_b_ids || [])]);
  const available = activeRegistrations
    .filter((r) => !takenIds.has(r.id))
    .sort((a, b) =>
      (a.label || a.player_a_name || '').localeCompare(b.label || b.player_a_name || ''),
    );

  async function handleConfirm() {
    if (!selectedId) return;
    try {
      await substituteMutation.mutateAsync({
        matchId: match.id,
        oldRegistrationId: registrationId,
        newRegistrationId: selectedId,
      });
      toast.success('Jogador substituído com sucesso.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Falha ao substituir jogador.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Substituir jogador</DialogTitle>
          <DialogDescription>
            Substituindo: <strong>{currentName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Substituto</Label>
            {available.length === 0 ? (
              <p className="text-sm text-slate-500 mt-1">
                Nenhum jogador disponível para substituição.
              </p>
            ) : (
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">— selecione um jogador —</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || r.player_a_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || substituteMutation.isPending}
          >
            {substituteMutation.isPending ? 'Substituindo…' : 'Confirmar substituição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

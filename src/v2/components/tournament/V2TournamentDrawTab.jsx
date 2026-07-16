import React, { useState, useMemo } from 'react';
import { V2Surface, V2Button, V2Badge } from '@/v2/ui/primitives';


import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Shuffle, AlertTriangle, Pencil, ListRestart, CalendarClock, ChevronsRight, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  useModalities,
  useRunDraw,
  useMatches,
  useRegistrations,
  useSubstitutePlayer,
  useReShuffleRemainingMatches,
  useRescheduleMatches,
  useAdvanceStage,
  useRedrawGroupMatchesKeepingGroups,
  useStageGroups,
  useMoveParticipantBetweenGroups,
  useEnsurePlaceholders,
  useClearPlaceholders,
} from '@/modules/tournament/hooks/useTournament';
import { neededPlaceholderCount } from '@/modules/tournament/domain/placeholders';
import {
  TOURNAMENT_STAGE_TYPE_LABELS,
  REGISTRATION_STATUS,
  MATCH_STATUS,
} from '@/modules/tournament/domain/constants';
import { stageSupportsAdvance } from '@/modules/tournament/domain/progression';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import MultiPhaseDrawBlock from '@/modules/tournament/components/MultiPhaseDrawBlock';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return 'Disputa de 3º lugar';
  if (m.bracket === 'gf') return m.round === 2 ? 'Final (reset)' : 'Grande final';
  if (m.bracket === 'wb') return `Vencedores R${m.round}`;
  if (m.bracket === 'lb') return `Repescagem R${m.round}`;
  return m.round;
}

export default function TournamentDrawTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  const multiPhaseEnabled = useFeatureFlag(FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS);

  if (modalities.length === 0) {
    return (
      <V2Surface>
        <div className="p-6 text-sm text-gray-500 text-center">
          Crie modalidades antes de sortear.
        </div>
      </V2Surface>
    );
  }

  return (
    <div className="space-y-4">
      {modalities.map((m) =>
        multiPhaseEnabled && (m.stages?.length || 0) > 1 ? (
          <MultiPhaseDrawBlock key={m.id} tournament={tournament} modality={m} isAdmin={isAdmin} />
        ) : (
          <ModalityDrawBlock key={m.id} tournament={tournament} modality={m} isAdmin={isAdmin} />
        ),
      )}
    </div>
  );
}

function ModalityDrawBlock({ tournament, modality, isAdmin }) {
  const drawMutation = useRunDraw();
  const reShuffleMutation = useReShuffleRemainingMatches(modality.id);
  const rescheduleMutation = useRescheduleMatches(modality.id);
  const advanceMutation = useAdvanceStage(modality.id);
  const redrawKeepGroupsMutation = useRedrawGroupMatchesKeepingGroups();
  const ensurePlaceholdersMutation = useEnsurePlaceholders(modality.id);
  const clearPlaceholdersMutation = useClearPlaceholders(modality.id);
  const placeholderOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_PLACEHOLDER_DRAW);
  const lifecycleOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_LIFECYCLE);
  const locked = lifecycleOn && Boolean(tournament.results_locked);
  const { data: matches = [] } = useMatches(modality.id, 0);
  const { data: registrations = [] } = useRegistrations(modality.id);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reshuffleConfirmOpen, setReshuffleConfirmOpen] = useState(false);
  const [keepGroupsConfirmOpen, setKeepGroupsConfirmOpen] = useState(false);
  const [groupsEditorOpen, setGroupsEditorOpen] = useState(false);
  const [error, setError] = useState(null);
  const [substitution, setSubstitution] = useState(null);

  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, r.label || r.player_a_name));
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

  // Vagas fictícias (Atleta N): completar até o número exato de participantes.
  const maxEntries = Number(modality.max_entries);
  const hasFiniteMax = Number.isFinite(maxEntries) && maxEntries > 0;
  const placeholderCount = registrations.filter((r) => r.is_placeholder).length;
  const realConfirmedCount = activeRegistrations.filter((r) => !r.is_placeholder).length;
  const missingSlots = neededPlaceholderCount(realConfirmedCount, maxEntries);
  const showPlaceholderPanel = placeholderOn && isAdmin && hasFiniteMax && !locked
    && (missingSlots > 0 || placeholderCount > 0);

  async function fillPlaceholders() {
    try {
      const res = await ensurePlaceholdersMutation.mutateAsync(modality);
      toast.success(res.created > 0
        ? `Vagas preenchidas com ${res.created} atleta(s) fictício(s).`
        : 'Nenhuma vaga faltante para preencher.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível preencher as vagas.');
    }
  }

  async function removePlaceholders() {
    try {
      const res = await clearPlaceholdersMutation.mutateAsync();
      toast.success(res.cleared > 0 ? 'Atletas fictícios removidos.' : 'Não havia atletas fictícios.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover os atletas fictícios.');
    }
  }

  const doneStatuses = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);
  const playedCount = matches.filter((m) => doneStatuses.has(m.status)).length;
  const pendingCount = matches.length - playedCount;
  const canReshuffleRemaining = isAdmin && playedCount > 0 && pendingCount > 0;

  // Resumo do agendamento (quadras/horários).
  const startedCount = matches.filter(
    (m) => m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.IN_PROGRESS,
  ).length;
  const playableMatches = matches.filter((m) => m.status !== MATCH_STATUS.WALKOVER);
  const scheduledCount = playableMatches.filter((m) => m.scheduled_at || m.court).length;
  const unscheduledCount = playableMatches.length - scheduledCount;
  const canReschedule = isAdmin && matches.length > 0 && startedCount === 0;

  // Avanço de fase (mata-mata, dupla eliminação, suíço).
  const stageType = modality.stages?.[0]?.type;
  const canAdvance = isAdmin && matches.length > 0 && stageSupportsAdvance(stageType);

  async function performAdvance() {
    setRunning(true);
    try {
      const res = await advanceMutation.mutateAsync({
        tournamentId: tournament.id,
        stageIndex: 0,
        modality,
        tournament,
      });
      if (res.complete) {
        toast.success('Fase concluída — campeão definido! 🏆');
      } else {
        const warns = res.scheduleWarnings || [];
        toast.success(`Próxima rodada gerada (${res.created} jogo(s)).`);
        if (warns.length > 0) {
          toast.warning(`${warns.length} jogo(s) sem horário — ajuste quadras/horário de término.`);
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Não foi possível avançar a fase.');
    } finally {
      setRunning(false);
    }
  }

  async function performReschedule() {
    setRunning(true);
    try {
      const { scheduleWarnings } = await rescheduleMutation.mutateAsync({
        stageIndex: 0,
        modality,
        tournament,
      });
      const warns = scheduleWarnings || [];
      if (warns.length > 0) {
        toast.warning(
          `Jogos reagendados. ${warns.length} ficaram além do horário de término planejado — ajuste quadras ou horário para encaixá-los.`,
        );
      } else {
        toast.success('Jogos reagendados nas quadras e horários.');
      }
    } catch (err) {
      toast.error(err?.message || 'Falha ao reagendar.');
    } finally {
      setRunning(false);
    }
  }

  async function performDraw() {
    setError(null);
    setRunning(true);
    try {
      const result = await drawMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex: 0,
      });
      toast.success('Sorteio realizado!');
      const warns = result?.scheduleWarnings || [];
      if (warns.length > 0) {
        toast.warning(
          `Todos os jogos foram sorteados e agendados. ${warns.length} ficaram além do horário de término planejado — adicione quadras ou estenda o horário para encaixá-los na janela.`,
        );
      }
      setConfirmOpen(false);
    } catch (err) {
      const message = err?.message || 'Falha ao sortear.';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  async function performRedrawKeepingGroups() {
    setRunning(true);
    try {
      const result = await redrawKeepGroupsMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex: 0,
      });
      toast.success(`Jogos re-sorteados (${result.matches}) mantendo os ${result.groups} grupo(s).`);
      const warns = result?.scheduleWarnings || [];
      if (warns.length > 0) {
        toast.warning(
          `${warns.length} jogo(s) ficaram além do horário de término planejado — adicione quadras ou estenda o horário.`,
        );
      }
      setKeepGroupsConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Falha ao re-sortear os jogos.');
    } finally {
      setRunning(false);
    }
  }

  async function performReshuffleRemaining() {
    setRunning(true);
    try {
      const { count } = await reShuffleMutation.mutateAsync(0);
      toast.success(`${count} jogo(s) restante(s) resorteados!`);
      setReshuffleConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Falha ao resortear.');
    } finally {
      setRunning(false);
    }
  }

  const stageName = modality.stages?.[0]?.name || 'fase 1';
  const hasGroups = matches.some((m) => m.group);
  const hasSchedule = matches.some((m) => m.court || m.scheduled_at);

  return (
    <V2Surface>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold">{modality.name}</h4>
            <p className="text-xs text-gray-500">
              Fase: {TOURNAMENT_STAGE_TYPE_LABELS[modality.stages?.[0]?.type]} ·{' '}
              {matches.length > 0 ? `${matches.length} jogos gerados` : 'Ainda não sorteado'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              {canAdvance && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={performAdvance}
                  disabled={running}
                  title="Gerar a próxima rodada com base nos resultados"
                >
                  <ChevronsRight className="w-4 h-4 mr-1" /> Avançar fase
                </V2Button>
              )}
              {canReschedule && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={performReschedule}
                  disabled={running}
                  title="Recalcular quadras e horários sem alterar os confrontos"
                >
                  <CalendarClock className="w-4 h-4 mr-1" /> Reagendar
                </V2Button>
              )}
              {canReshuffleRemaining && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReshuffleConfirmOpen(true)}
                  disabled={running}
                >
                  <ListRestart className="w-4 h-4 mr-1" /> Resortear restantes ({pendingCount})
                </V2Button>
              )}
              {hasGroups && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setGroupsEditorOpen(true)}
                  disabled={running}
                  title="Mover jogadores entre os grupos sorteados"
                >
                  <Users className="w-4 h-4 mr-1" /> Editar grupos
                </V2Button>
              )}
              {hasGroups && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setKeepGroupsConfirmOpen(true)}
                  disabled={running}
                  title="Gera novamente todos os jogos dos grupos atuais, sem alterar a composição dos grupos"
                >
                  <ListRestart className="w-4 h-4 mr-1" /> Re-sortear jogos (manter grupos)
                </V2Button>
              )}
              <V2Button size="sm" onClick={() => setConfirmOpen(true)} disabled={running || locked}>
                <Shuffle className="w-4 h-4 mr-1" /> {matches.length > 0 ? 'Re-sortear tudo' : 'Sortear'}
              </V2Button>
            </div>
          )}
        </div>

        {locked && isAdmin && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Torneio bloqueado. Desbloqueie as alterações (na aba Geral) para sortear ou ajustar.</span>
          </div>
        )}

        {showPlaceholderPanel && (
          <div className="mt-3 rounded-2xl border border-gray-100 bg-paper p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-gray-600">
                <div className="font-medium text-ink">Vagas fictícias (“Atleta N”)</div>
                <div>
                  {realConfirmedCount} inscrito(s) real(is) · {maxEntries} vaga(s) exata(s)
                  {placeholderCount > 0 ? ` · ${placeholderCount} fictício(s) no momento` : ''}
                  {missingSlots > 0 ? ` · faltam ${missingSlots}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingSlots > 0 && (
                  <V2Button size="sm" variant="ghost" onClick={fillPlaceholders} disabled={ensurePlaceholdersMutation.isPending}>
                    <Users className="w-4 h-4 mr-1" /> Preencher {missingSlots} vaga(s)
                  </V2Button>
                )}
                {placeholderCount > 0 && (
                  <V2Button size="sm" variant="ghost" onClick={removePlaceholders} disabled={clearPlaceholdersMutation.isPending}>
                    Remover fictícios
                  </V2Button>
                )}
              </div>
            </div>
          </div>
        )}

        {matches.length > 0 && (scheduledCount > 0 || unscheduledCount > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-gray-500">
              <CalendarClock className="w-3.5 h-3.5" />
              {modality.court_count || 1} quadra(s) · {modality.match_duration_minutes || 30} min/jogo
              {modality.play_start_time ? ` · início ${modality.play_start_time}` : ''}
            </span>
            {scheduledCount > 0 && (
              <V2Badge tone="neutral">{scheduledCount} jogo(s) com horário</V2Badge>
            )}
            {unscheduledCount > 0 && (
              <V2Badge tone="neutral" className="bg-amber-100 text-amber-800">
                {unscheduledCount} sem horário
              </V2Badge>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Não foi possível sortear.</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-3xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr className="text-left">
                  <th className="px-3 py-2">#</th>
                  {hasGroups && <th className="px-3 py-2">Grupo</th>}
                  <th className="px-3 py-2">Rod.</th>
                  {hasSchedule && <th className="px-3 py-2">Quadra</th>}
                  {hasSchedule && <th className="px-3 py-2">Horário</th>}
                  <th className="px-3 py-2">Lado A</th>
                  <th className="px-3 py-2">Lado B</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">{i + 1}</td>
                    {hasGroups && <td className="px-3 py-2">{m.group || '—'}</td>}
                    <td className="px-3 py-2">{roundLabel(m)}</td>
                    {hasSchedule && <td className="px-3 py-2">{m.court || '—'}</td>}
                    {hasSchedule && <td className="px-3 py-2 tabular-nums">{formatMatchTime(m.scheduled_at)}</td>}
                    <td className="px-3 py-2">
                      <SideCell
                        ids={m.side_a_ids}
                        rawSide={m.side_a}
                        labelById={labelById}
                        isAdmin={isAdmin}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <SideCell
                        ids={m.side_b_ids}
                        rawSide={m.side_b}
                        labelById={labelById}
                        isAdmin={isAdmin}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <V2Badge tone="neutral">{m.status}</V2Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !running && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sortear &quot;{stageName}&quot;</DialogTitle>
            <DialogDescription>
              {matches.length > 0
                ? 'Os jogos atuais desta fase serão apagados e novos jogos serão gerados.'
                : 'Serão gerados os jogos desta fase a partir das inscrições confirmadas.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={running}>
              Cancelar
            </V2Button>
            <V2Button onClick={performDraw} disabled={running}>
              {running ? 'Sorteando…' : 'Confirmar sorteio'}
            </V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reshuffleConfirmOpen} onOpenChange={(o) => !running && setReshuffleConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resortear jogos restantes</DialogTitle>
            <DialogDescription>
              Os {pendingCount} jogo(s) ainda não disputado(s) serão resorteados em nova ordem.
              Os {playedCount} jogo(s) já concluído(s) não serão alterados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setReshuffleConfirmOpen(false)} disabled={running}>
              Cancelar
            </V2Button>
            <V2Button onClick={performReshuffleRemaining} disabled={running}>
              {running ? 'Resorteando…' : 'Confirmar'}
            </V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={keepGroupsConfirmOpen} onOpenChange={(o) => !running && setKeepGroupsConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-sortear jogos (manter grupos)</DialogTitle>
            <DialogDescription>
              Os grupos atuais e seus integrantes serão mantidos. Todos os jogos desta fase
              serão gerados novamente (todos contra todos em cada grupo) e reagendados —
              os placares já lançados nesta fase serão perdidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setKeepGroupsConfirmOpen(false)} disabled={running}>
              Cancelar
            </V2Button>
            <V2Button onClick={performRedrawKeepingGroups} disabled={running}>
              {running ? 'Re-sorteando…' : 'Confirmar'}
            </V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {groupsEditorOpen && (
        <GroupsEditorDialog
          tournament={tournament}
          modality={modality}
          labelById={labelById}
          hasPlayedScores={playedCount > 0}
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
    </V2Surface>
  );
}

function SideCell({ ids, rawSide, labelById, isAdmin, onSubstitute }) {
  if (!ids || ids.length === 0) {
    return <span className="text-gray-400">{rawSide || '—'}</span>;
  }
  return (
    <div className="space-y-0.5">
      {ids.map((regId) => {
        const name = labelById.get(regId) || regId;
        return (
          <div key={regId} className="flex items-center gap-1">
            <span>{name}</span>
            {isAdmin && (
              <V2Button
                type="button"
                onClick={() => onSubstitute(regId)}
                title={`Substituir ${name}`}
                aria-label={`Substituir ${name}`}
                className="text-gray-400 hover:text-green-600 focus-visible:text-green-600 transition-colors ml-1"
              >
                <Pencil className="w-3 h-3" />
              </V2Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupsEditorDialog({ tournament, modality, labelById, hasPlayedScores, onClose }) {
  const { data: groups = [], isLoading } = useStageGroups(modality.id, 0);
  const moveMutation = useMoveParticipantBetweenGroups();
  const [pendingMove, setPendingMove] = useState(null);
  const groupNames = groups.map((g) => g.name);

  async function doMove(registrationId, toGroupName) {
    try {
      await moveMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex: 0,
        registrationId,
        toGroupName,
      });
      toast.success('Jogador movido e jogos da fase regerados.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível mover o jogador.');
    }
  }

  function requestMove(registrationId, toGroupName, fromGroupName) {
    if (toGroupName === fromGroupName) return;
    if (hasPlayedScores) {
      setPendingMove({
        registrationId,
        toGroupName,
        fromGroupName,
        name: labelById.get(registrationId) || registrationId,
      });
    } else {
      doMove(registrationId, toGroupName);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !moveMutation.isPending && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar grupos · {modality.name}</DialogTitle>
          <DialogDescription>
            Mova jogadores entre os grupos. Ao mover, os jogos da fase são regerados com a nova
            composição{hasPlayedScores ? ' — os placares já lançados nesta fase serão perdidos' : ''}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando grupos…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum grupo sorteado nesta fase.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {groups.map((g) => (
              <div key={g.name} className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 text-sm font-semibold text-ink">
                  {g.name} <span className="text-xs font-normal text-gray-500">({g.participants.length})</span>
                </div>
                <div className="space-y-1.5">
                  {g.participants.length === 0 ? (
                    <p className="text-xs text-gray-400">Grupo vazio</p>
                  ) : (
                    g.participants.map((pid) => (
                      <div key={pid} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm">{labelById.get(pid) || pid}</span>
                        <select
                          className="h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
                          value={g.name}
                          disabled={moveMutation.isPending}
                          onChange={(e) => requestMove(pid, e.target.value, g.name)}
                          aria-label={`Mover ${labelById.get(pid) || pid} para outro grupo`}
                          title="Mover para outro grupo"
                        >
                          {groupNames.map((name) => (
                            <option key={name} value={name}>
                              {name === g.name ? `${name} (atual)` : `Mover para ${name}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose} disabled={moveMutation.isPending}>
            {moveMutation.isPending ? 'Movendo…' : 'Fechar'}
          </V2Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={Boolean(pendingMove)}
        onOpenChange={(o) => !o && !moveMutation.isPending && setPendingMove(null)}
        destructive
        title="Mover jogador e refazer os jogos?"
        description={
          pendingMove
            ? `${pendingMove.name} vai do ${pendingMove.fromGroupName} para o ${pendingMove.toGroupName}. `
              + 'Os jogos desta fase serão regerados e os placares já lançados nela serão perdidos.'
            : ''
        }
        confirmLabel="Mover e refazer jogos"
        loading={moveMutation.isPending}
        onConfirm={async () => {
          if (!pendingMove) return;
          await doMove(pendingMove.registrationId, pendingMove.toGroupName);
          setPendingMove(null);
        }}
      />
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
              <p className="text-sm text-gray-500 mt-1">
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
          <V2Button variant="ghost" onClick={onClose}>
            Cancelar
          </V2Button>
          <V2Button
            onClick={handleConfirm}
            disabled={!selectedId || substituteMutation.isPending}
          >
            {substituteMutation.isPending ? 'Substituindo…' : 'Confirmar substituição'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

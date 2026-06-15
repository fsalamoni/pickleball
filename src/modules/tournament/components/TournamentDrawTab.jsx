import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Shuffle, AlertTriangle, Pencil, ListRestart, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import {
  useModalities,
  useRunDraw,
  useMatches,
  useRegistrations,
  useSubstitutePlayer,
  useReShuffleRemainingMatches,
  useRescheduleMatches,
} from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STAGE_TYPE_LABELS,
  REGISTRATION_STATUS,
  MATCH_STATUS,
} from '@/modules/tournament/domain/constants';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function TournamentDrawTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);

  if (modalities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500 text-center">
          Crie modalidades antes de sortear.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {modalities.map((m) => (
        <ModalityDrawBlock key={m.id} tournament={tournament} modality={m} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function ModalityDrawBlock({ tournament, modality, isAdmin }) {
  const drawMutation = useRunDraw();
  const reShuffleMutation = useReShuffleRemainingMatches(modality.id);
  const rescheduleMutation = useRescheduleMatches(modality.id);
  const { data: matches = [] } = useMatches(modality.id, 0);
  const { data: registrations = [] } = useRegistrations(modality.id);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reshuffleConfirmOpen, setReshuffleConfirmOpen] = useState(false);
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
          `Jogos reagendados, mas ${warns.length} não couberam na janela de horário. Ajuste quadras ou horário de término.`,
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
          `${warns.length} jogo(s) não couberam na janela de horário definida. Revise as quadras ou o horário de término da modalidade.`,
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold">{modality.name}</h4>
            <p className="text-xs text-slate-500">
              Fase: {TOURNAMENT_STAGE_TYPE_LABELS[modality.stages?.[0]?.type]} ·{' '}
              {matches.length > 0 ? `${matches.length} jogos gerados` : 'Ainda não sorteado'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              {canReschedule && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={performReschedule}
                  disabled={running}
                  title="Recalcular quadras e horários sem alterar os confrontos"
                >
                  <CalendarClock className="w-4 h-4 mr-1" /> Reagendar
                </Button>
              )}
              {canReshuffleRemaining && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReshuffleConfirmOpen(true)}
                  disabled={running}
                >
                  <ListRestart className="w-4 h-4 mr-1" /> Resortear restantes ({pendingCount})
                </Button>
              )}
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={running}>
                <Shuffle className="w-4 h-4 mr-1" /> {matches.length > 0 ? 'Re-sortear tudo' : 'Sortear'}
              </Button>
            </div>
          )}
        </div>

        {matches.length > 0 && (scheduledCount > 0 || unscheduledCount > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-600">
              <CalendarClock className="w-3.5 h-3.5" />
              {modality.court_count || 1} quadra(s) · {modality.match_duration_minutes || 30} min/jogo
              {modality.play_start_time ? ` · início ${modality.play_start_time}` : ''}
            </span>
            {scheduledCount > 0 && (
              <Badge variant="secondary">{scheduledCount} jogo(s) com horário</Badge>
            )}
            {unscheduledCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {unscheduledCount} sem horário
              </Badge>
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
          <div className="mt-3 arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
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
                    <td className="px-3 py-2">{m.round}</td>
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
                      <Badge variant="secondary">{m.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

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
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>
              Cancelar
            </Button>
            <Button onClick={performDraw} disabled={running}>
              {running ? 'Sorteando…' : 'Confirmar sorteio'}
            </Button>
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
            <Button variant="outline" onClick={() => setReshuffleConfirmOpen(false)} disabled={running}>
              Cancelar
            </Button>
            <Button onClick={performReshuffleRemaining} disabled={running}>
              {running ? 'Resorteando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </Card>
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

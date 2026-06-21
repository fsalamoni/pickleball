import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trophy, Play } from 'lucide-react';
import {
  useModalities,
  useAllModalityMatches,
  useRecordMatchResult,
  useRegistrations,
  useMarkMatchInProgress,
} from '@/modules/tournament/hooks/useTournament';
import {
  MATCH_STATUS,
  MATCH_STATUS_LABELS,
  TOURNAMENT_STAGE_TYPE_LABELS,
} from '@/modules/tournament/domain/constants';
import { normalizeScoringConfig } from '@/modules/tournament/domain/scoring';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

export default function TournamentMatchesTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  if (modalities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500 text-center">
          Sem modalidades.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {modalities.map((m) => (
        <ModalityMatchesBlock key={m.id} tournament={tournament} modality={m} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

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

function statusBadgeVariant(status) {
  if (status === MATCH_STATUS.FINISHED || status === MATCH_STATUS.WALKOVER) return 'success';
  if (status === MATCH_STATUS.IN_PROGRESS) return 'warning';
  return 'secondary';
}

/**
 * Lado de uma partida: cada jogador (um ou dois, conforme o sorteio) aparece
 * empilhado, com avatar e nome, espelhando o visual da aba de sorteio.
 */
function MatchSideCell({ people = [], fallback, win }) {
  const list = (people || []).filter(Boolean);
  if (list.length === 0) {
    return <span className="text-slate-400">{fallback || '—'}</span>;
  }
  return (
    <div className={`space-y-1 ${win ? 'font-bold text-emerald-700' : 'font-medium'}`}>
      {list.map((person, index) => (
        <div key={`${person.name || 'p'}-${index}`} className="flex items-center gap-1.5">
          {win && index === 0 && (
            <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-600" aria-label="Vencedor" />
          )}
          <UserAvatar name={person.name} photoUrl={person.photoUrl} size="xs" />
          <span className="leading-tight">{person.name}</span>
        </div>
      ))}
    </div>
  );
}

function ModalityMatchesBlock({ tournament, modality, isAdmin }) {
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

  const cfg = normalizeScoringConfig(modality.scoring_override || tournament.scoring);
  const [openMatchId, setOpenMatchId] = useState(null);
  const openMatch = matches.find((m) => m.id === openMatchId);

  const phases = useMemo(() => normalizePhases(modality.stages), [modality.stages]);
  // Agrupa os jogos por fase (stage_index), na ordem das fases.
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

  const doneCount = matches.filter(
    (m) => m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER,
  ).length;
  const subtitle = matches.length === 0
    ? 'Nenhum jogo gerado ainda'
    : `${doneCount}/${matches.length} jogos concluídos · ${cfg.target_score} pontos · best-of-${cfg.sets_per_match}`;

  return (
    <>
      <CollapsibleSection title={modality.name} subtitle={subtitle} defaultOpen>
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum jogo gerado ainda.</p>
        ) : (
          <div className="space-y-3">
            {byStage.map(([stageIndex, stageMatches]) => (
              <PhaseMatches
                key={stageIndex}
                phaseLabel={showPhaseHeaders
                  ? `Fase ${stageIndex + 1} · ${TOURNAMENT_STAGE_TYPE_LABELS[phases[stageIndex]?.type] || ''}`
                  : null}
                matches={stageMatches}
                modalityId={modality.id}
                labelById={labelById}
                peopleById={peopleById}
                isAdmin={isAdmin}
                onOpenScore={setOpenMatchId}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>
      {openMatch && (
        <ScoreEntryDialog
          match={openMatch}
          modalityId={modality.id}
          scoringConfig={cfg}
          labelById={labelById}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </>
  );
}

function PhaseMatches({ phaseLabel, matches, modalityId, labelById, peopleById, isAdmin, onOpenScore }) {
  const markInProgressMutation = useMarkMatchInProgress(modalityId);

  async function handleMarkInProgress(matchId) {
    try {
      await markInProgressMutation.mutateAsync(matchId);
      toast.success('Partida marcada como em andamento.');
    } catch (err) {
      toast.error(err.message || 'Falha ao atualizar status.');
    }
  }

  const hasGroups = matches.some((m) => m.group);
  const hasSchedule = matches.some((m) => m.court || m.scheduled_at);
  const doneCount = matches.filter(
    (m) => m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER,
  ).length;

  const inner = (
    <>
          <div className="hidden sm:block arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  {hasGroups && <th className="px-3 py-2">Grupo</th>}
                  <th className="px-3 py-2">Rod.</th>
                  {hasSchedule && <th className="px-3 py-2">Quadra</th>}
                  {hasSchedule && <th className="px-3 py-2">Horário</th>}
                  <th className="px-3 py-2">Lado A</th>
                  <th className="px-3 py-2 text-center">vs</th>
                  <th className="px-3 py-2">Lado B</th>
                  <th className="px-3 py-2">Placar (sets)</th>
                  <th className="px-3 py-2">Status</th>
                  {isAdmin && <th className="px-3 py-2 text-right">Ações</th>}
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
                    <tr
                      key={m.id}
                      className={`border-t ${inProgress ? 'bg-amber-50' : ''}`}
                    >
                      {hasGroups && <td className="px-3 py-2">{m.group || '—'}</td>}
                      <td className="px-3 py-2">{roundLabel(m)}</td>
                      {hasSchedule && <td className="px-3 py-2">{m.court || '—'}</td>}
                      {hasSchedule && <td className="px-3 py-2 tabular-nums">{formatMatchTime(m.scheduled_at)}</td>}
                      <td className="px-3 py-2 align-middle">
                        <MatchSideCell people={sideAPeople} fallback={sideA} win={winA} />
                      </td>
                      <td className="px-3 py-2 text-center align-middle text-xs font-medium text-slate-400">
                        vs
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <MatchSideCell people={sideBPeople} fallback={sideB} win={winB} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {(m.games || []).length === 0 ? '—' : m.games.map((g, i) => (
                          <span key={i} className="mr-2">{g.a}-{g.b}</span>
                        ))}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusBadgeVariant(m.status)}>
                          {MATCH_STATUS_LABELS[m.status] || m.status}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {m.status === MATCH_STATUS.SCHEDULED && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkInProgress(m.id)}
                                disabled={markInProgressMutation.isPending}
                                title="Marcar como em andamento"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenScore(m.id)}
                            >
                              {finished ? 'Editar' : 'Lançar'}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        {matches.length > 0 && (
          <div className="mt-1 space-y-2.5 sm:hidden">
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
                <div
                  key={m.id}
                  className={`rounded-2xl border p-3 ${inProgress ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {hasGroups && m.group && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{m.group}</span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Rod. {roundLabel(m)}</span>
                    {hasSchedule && m.court && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{m.court}</span>
                    )}
                    {hasSchedule && m.scheduled_at && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">{formatMatchTime(m.scheduled_at)}</span>
                    )}
                    <Badge variant={statusBadgeVariant(m.status)} className="ml-auto">
                      {MATCH_STATUS_LABELS[m.status] || m.status}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <MatchSideCell people={sideAPeople} fallback={sideA} win={winA} />
                      {hasScore && (
                        <span className="shrink-0 tabular-nums text-sm font-semibold text-slate-700">
                          {m.games.map((g) => g.a).join('  ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                      <span className="h-px flex-1 bg-slate-100" />vs<span className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <MatchSideCell people={sideBPeople} fallback={sideB} win={winB} />
                      {hasScore && (
                        <span className="shrink-0 tabular-nums text-sm font-semibold text-slate-700">
                          {m.games.map((g) => g.b).join('  ')}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="mt-3 flex items-center gap-2">
                      {m.status === MATCH_STATUS.SCHEDULED && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          onClick={() => handleMarkInProgress(m.id)}
                          disabled={markInProgressMutation.isPending}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => onOpenScore(m.id)}>
                        {finished ? 'Editar placar' : 'Lançar placar'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </>
  );

  if (!phaseLabel) return inner;
  return (
    <CollapsibleSection
      className="border-slate-200 bg-slate-50/40"
      headerClassName="py-1.5"
      title={phaseLabel}
      badges={<Badge variant="secondary">{doneCount}/{matches.length} concluídos</Badge>}
      defaultOpen
    >
      {inner}
    </CollapsibleSection>
  );
}

function ScoreEntryDialog({ match, modalityId, scoringConfig, labelById, onClose }) {
  const setsCount = scoringConfig.sets_per_match || 1;
  const [games, setGames] = useState(() => {
    const initial = match.games?.length ? match.games : [];
    while (initial.length < setsCount) initial.push({ a: '', b: '' });
    return initial.slice(0, setsCount).map((g) => ({ a: g.a ?? '', b: g.b ?? '' }));
  });
  const [walkover, setWalkover] = useState(match.walkover || '');
  const recordMutation = useRecordMatchResult(modalityId, scoringConfig);

  const sideA = match.side_a_ids?.map((id) => labelById.get(id) || id).join(' + ') || match.side_a;
  const sideB = match.side_b_ids?.map((id) => labelById.get(id) || id).join(' + ') || match.side_b;

  async function handleSave() {
    try {
      const payload = walkover
        ? { walkover, games: [] }
        : {
            walkover: null,
            games: games
              .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
              .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b)),
          };
      await recordMutation.mutateAsync({ matchId: match.id, payload });
      toast.success('Resultado lançado.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Falha ao salvar.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {sideA} vs {sideB}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!walkover && (
            <div className="space-y-2">
              {games.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                  <div>
                    <Label>Set {i + 1} — Lado A</Label>
                    <Input
                      type="number"
                      min={0}
                      value={g.a}
                      onChange={(e) => setGames((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                    />
                  </div>
                  <span className="pb-2 text-slate-400">×</span>
                  <div>
                    <Label>Lado B</Label>
                    <Input
                      type="number"
                      min={0}
                      value={g.b}
                      onChange={(e) => setGames((arr) => arr.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div>
            <Label>Walkover (WO) — opcional</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={walkover}
              onChange={(e) => setWalkover(e.target.value)}
            >
              <option value="">— sem WO —</option>
              <option value="a">WO para Lado A</option>
              <option value="b">WO para Lado B</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={recordMutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

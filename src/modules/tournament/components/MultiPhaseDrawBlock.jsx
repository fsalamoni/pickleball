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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
  MATCH_STATUS,
  MATCH_STATUS_LABELS,
} from '@/modules/tournament/domain/constants';
import { isActiveRegistration } from '@/modules/tournament/domain/checkin';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { stageSupportsAdvance } from '@/modules/tournament/domain/progression';
import { etapasProgress, etapasResumo, etapaBotaoTexto } from '@/modules/tournament/domain/americanoEtapas';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { V2ErrorState } from '@/v2/ui/primitives';
import { useUpdateModality } from '@/modules/tournament/hooks/useTournament';
import StageExplanation from './StageExplanation';
import PhaseRulesSummary from './PhaseRulesSummary';
import NextPhasePreview from './NextPhasePreview';
import DirectEntryPanel from '@/v2/components/tournament/DirectEntryPanel';
import { t, fmtData } from '@/core/i18n';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtData(d, { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return t('Disputa de 3º lugar');
  if (m.bracket === 'gf') return m.round === 2 ? t('Final (reset)') : t('Grande final');
  if (m.bracket === 'wb') return t('Vencedores R{round}', { round: m.round });
  if (m.bracket === 'lb') return t('Repescagem R{round}', { round: m.round });
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
      registrations.filter(isActiveRegistration),
    [registrations],
  );

  // Salvar a configuração das fases a partir daqui (entrada direta). Só toca em
  // `stages`; o resto da modalidade fica como está.
  const isTeam = Boolean(modality.team_config);
  const updateModality = useUpdateModality(modality.tournament_id);
  const [savingStages, setSavingStages] = useState(false);
  const handleSaveStages = async (stages) => {
    setSavingStages(true);
    try {
      await updateModality.mutateAsync({ id: modality.id, updates: { stages } });
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar a configuração das fases.'));
    } finally {
      setSavingStages(false);
    }
  };

  return (
    <CollapsibleSection
      title={modality.name}
      subtitle={t('{n} fases · inscrição em lista única · {n2} inscrito(s)', { n: phases.length, n2: registrations.length })}
      defaultOpen
    >
      <div className="space-y-3">
        {/* ENTRADA DIRETA: quem pula fases. Fica aqui, na aba de sorteio, porque
            escolher quem entra direto exige ver os NOMES — e é justamente no
            torneio de VÁRIAS fases que ela faz sentido (pular fase exige fase
            para pular). Ver `domain/directEntry.js`. */}
        <DirectEntryPanel
          modality={modality}
          registrations={activeRegistrations}
          isTeam={isTeam}
          isAdmin={isAdmin}
          saving={savingStages}
          onSave={handleSaveStages}
        />

        {/* O PLANO da 1ª fase, com o número REAL de inscritos, antes de clicar
            em sortear: jogos, jogos por atleta, classificados, se a chave
            fecha, e as outras divisões possíveis para aquele número. */}
        {isAdmin && activeRegistrations.length > 0 && phases[0] && (
          <StageExplanation
            stageType={phases[0].type}
            playerCount={activeRegistrations.length}
            groupCount={phases[0].custom_group_sizes.length || phases[0].group_count}
            seedCount={phases[0].seed_count}
            qualifiersPerGroup={phases[0].qualifiers_per_group}
            legs={phases[0].round_robin_legs}
            etapaCount={phases[0].etapa_count}
            maxPerGroup={phases[0].max_per_group}
          />
        )}

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

function PhaseSection({
  tournament, modality, phase, stageIndex, isFirst, isLast, isAdmin,
  labelById, activeRegistrations,
}) {
  // Modalidade de EQUIPES: o participante é a equipe — não há substituição de
  // jogador por aqui (o elenco é editado na inscrição da equipe).
  const isTeam = Boolean(modality.team_config);
  // ⚠️ Falha devolve lista vazia, e lista vazia aqui significa "não sorteada":
  // o botão viraria "Sortear grupos e jogos" e o sorteio apagaria os jogos que
  // a tela não conseguiu ver. Sobre estado desconhecido não se oferece comando.
  const {
    data: matches = [], isError: falhouJogos, refetch: recarregarJogos,
  } = useMatches(modality.id, stageIndex);
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
  // Americano em etapas: "avançar" gera a próxima ETAPA (quando a atual
  // termina), e a fase seguinte só sai depois da ÚLTIMA etapa.
  const ehEtapas = phase.type === TOURNAMENT_STAGE_TYPE.AMERICANO_ETAPAS;
  const progEtapas = ehEtapas ? etapasProgress(matches, phase) : null;
  const faseFechada = allDone && (!ehEtapas || progEtapas.completa);
  const hasGroups = groups.length > 0;

  async function doDraw() {
    setError(null);
    setRunning(true);
    try {
      const res = await runPhaseDraw.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex,
        // Só é reconhecimento quando a tela REALMENTE viu os jogos.
        replacesKnownMatches: matches.length > 0,
      });
      toast.success(t('Fase {v1} sorteada ({n} grupo(s)).', { v1: stageIndex + 1, n: res.groups.length }));
      (res.scheduleWarnings || []).length > 0
        && toast.warning(t('{n} jogo(s) sem horário — ajuste quadras/horário.', { n: res.scheduleWarnings.length }));
    } catch (err) {
      setError(err?.message || t('Falha ao sortear.'));
      toast.error(err?.message || t('Falha ao sortear.'));
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
      if (res.complete) toast.success(ehEtapas ? t('Todas as etapas foram jogadas — a classificação final está valendo. 🏆') : t('Fase concluída — definido! 🏆'));
      else toast.success(ehEtapas
        ? t('Etapa {proxima} gerada ({created} jogo(s)), com os grupos refeitos.', { proxima: progEtapas?.proxima, created: res.created })
        : (res.created ? t('{created} confronto(s) novo(s) na chave.', { created: res.created }) : t('Chave atualizada com os vencedores certos.')));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível avançar a rodada.'));
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
      toast.success(t('Fase {v1} gerada com {n} grupo(s)/chave.', { v1: res.nextStageIndex + 1, n: res.groups.length }));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível gerar a próxima fase.'));
    } finally {
      setRunning(false);
    }
  }

  const actions = (isAdmin && !falhouJogos) ? (
    <>
      {isFirst && (
        <Button size="sm" onClick={doDraw} disabled={running}>
          <Shuffle className="w-4 h-4 mr-1" />
          {matches.length > 0 ? t('Re-sortear') : t('Sortear grupos e jogos')}
        </Button>
      )}
      {hasGroups && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setGroupsEditorOpen(true)}
          disabled={running}
          title={t('Mover participantes entre os grupos sorteados desta fase')}
        >
          <Users className="w-4 h-4 mr-1" /> {t('Editar grupos')}
        </Button>
      )}
      {withinAdvance && matches.length > 0 && (!ehEtapas || progEtapas.podeGerar) && (
        <Button
          size="sm"
          variant="outline"
          onClick={doWithinAdvance}
          disabled={running}
          title={ehEtapas ? t('Refaz os grupos, misturando quem ainda não se encontrou') : undefined}
        >
          <ChevronsRight className="w-4 h-4 mr-1" /> {ehEtapas ? etapaBotaoTexto(progEtapas) : t('Avançar rodada')}
        </Button>
      )}
      {!isLast && (
        <Button
          size="sm"
          variant="outline"
          onClick={doAdvanceToNext}
          disabled={running || !faseFechada}
          title={faseFechada
            ? t('Classificar e gerar a próxima fase')
            : (ehEtapas && allDone ? t('Jogue as {total} etapas antes de gerar a próxima fase', { total: progEtapas.total }) : t('Conclua todos os jogos desta fase'))}
        >
          <ArrowDownToLine className="w-4 h-4 mr-1" /> {t('Gerar próxima fase')}
        </Button>
      )}
    </>
  ) : null;

  return (
    <CollapsibleSection
      className="border-gray-200 bg-paper/40"
      headerClassName="py-1.5"
      title={t('Fase {v1}', { v1: stageIndex + 1 })}
      badges={(
        <>
          <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[phase.type]}</Badge>
          <span className="text-xs text-gray-500">
            {matches.length > 0 ? t('{playedCount}/{n} jogos', { playedCount, n: matches.length }) : t('não sorteada')}
          </span>
        </>
      )}
      actions={actions}
      defaultOpen
    >
      <div className="space-y-3">
        {falhouJogos && (
          <V2ErrorState
            inline
            title={t('Não foi possível carregar os jogos desta fase')}
            description={t('Sem eles não dá para saber se a fase já foi sorteada, então as ações de sorteio ficam fora do ar até a lista voltar.')}
            onRetry={recarregarJogos}
          />
        )}

        {/* O QUE ESTÁ EM VIGOR nesta fase. A configuração mora em Modalidades e
            o sorteio acontece aqui: sem este resumo, quem organiza clica sem
            eco nenhum do que configurou. Ver `domain/phaseRules.js`. */}
        <PhaseRulesSummary
          phase={phase}
          isFirst={isFirst}
          isLast={isLast}
          groupCount={groups.length || undefined}
        />

        {ehEtapas && etapasResumo(progEtapas) && !falhouJogos && (
          <p className="rounded-md bg-white px-2.5 py-2 text-xs font-medium text-gray-600 border border-gray-200" role="status">
            {etapasResumo(progEtapas)}
          </p>
        )}

        {/* QUEM VAI PARA A PRÓXIMA FASE, antes de clicar. Sai da mesma função
            que o serviço usa para gravar — o que se anuncia é o que acontece. */}
        {isAdmin && !isLast && matches.length > 0 && (
          <NextPhasePreview
            tournament={tournament}
            modality={modality}
            stageIndex={stageIndex}
            matches={matches}
            groups={groups}
            registrations={activeRegistrations}
          />
        )}

        {error && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {groups.map((g) => (
              <div key={g.id || g.name} className="rounded border border-gray-200 p-2">
                <div className="text-xs font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-green-600" /> {g.name}
                  <span className="text-gray-400 font-normal">({(g.entrants || []).length})</span>
                </div>
                <ul className="mt-1 text-xs text-gray-500 space-y-0.5">
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
          <div className="overflow-x-auto rounded-3xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr className="text-left">
                  <th className="px-2 py-1">#</th>
                  {matches.some((m) => m.group) && <th className="px-2 py-1">{t('Grupo')}</th>}
                  <th className="px-2 py-1">{t('Rod.')}</th>
                  {matches.some((m) => m.court || m.scheduled_at) && <th className="px-2 py-1">{t('Quadra')}</th>}
                  {matches.some((m) => m.scheduled_at) && <th className="px-2 py-1">{t('Horário')}</th>}
                  <th className="px-2 py-1">{t('Lado A')}</th>
                  <th className="px-2 py-1">{t('Lado B')}</th>
                  <th className="px-2 py-1">{t('Status')}</th>
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
                        isAdmin={isAdmin && !isTeam}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <SideCell
                        ids={m.side_b_ids}
                        rawSide={m.side_b}
                        labelById={labelById}
                        isAdmin={isAdmin && !isTeam}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-2 py-1"><Badge variant="secondary">{MATCH_STATUS_LABELS[m.status] || m.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {matches.length === 0 && !isFirst && (
          <p className="text-xs text-gray-500">
            {t('Esta fase será gerada automaticamente ao concluir a fase anterior e clicar em “Gerar próxima fase”.')}
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
    </CollapsibleSection>
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
              <button
                type="button"
                onClick={() => onSubstitute(regId)}
                title={t('Substituir {name}', { name })}
                aria-label={t('Substituir {name}', { name })}
                className="text-gray-400 hover:text-green-600 focus-visible:text-green-600 transition-colors ml-1"
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

function PhaseGroupsEditorDialog({ tournament, modality, stageIndex, groups, labelById, hasPlayedScores, onClose }) {
  const moveMutation = useMovePhaseEntrant();
  const [pendingMove, setPendingMove] = useState(null);
  const groupNames = groups.map((g) => g.name);

  function entrantsOf(g) {
    if (Array.isArray(g.entrants) && g.entrants.length > 0) return g.entrants;
    return (g.participants || []).map((id) => ({ id, members: [id] }));
  }

  function entrantLabel(e) {
    const members = e.members || [e.id];
    return members.map((m) => labelById.get(m) || m).join(' + ');
  }

  async function doMove(entrantId, toGroupName) {
    try {
      await moveMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex,
        entrantId,
        toGroupName,
      });
      toast.success(t('Participante movido e jogos da fase regerados.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível mover o participante.'));
    }
  }

  function requestMove(entrant, toGroupName, fromGroupName) {
    if (toGroupName === fromGroupName) return;
    if (hasPlayedScores) {
      setPendingMove({ entrantId: entrant.id, toGroupName, fromGroupName, name: entrantLabel(entrant) });
    } else {
      doMove(entrant.id, toGroupName);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !moveMutation.isPending && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Editar grupos · {name}', { name: modality.name })}</DialogTitle>
          <DialogDescription>
            {t('Mova participantes entre os grupos desta fase. Ao mover, os jogos da fase são regerados com a nova composição')}{hasPlayedScores ? t(' — os placares já lançados nesta fase serão perdidos') : ''}.
          </DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('Nenhum grupo sorteado nesta fase.')}</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {groups.map((g) => {
              const entrants = entrantsOf(g);
              return (
                <div key={g.name} className="rounded-md border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-ink">
                    {g.name}{' '}
                    <span className="text-xs font-normal text-gray-500">({entrants.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {entrants.length === 0 ? (
                      <p className="text-xs text-gray-400">{t('Grupo vazio')}</p>
                    ) : (
                      entrants.map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm">{entrantLabel(e)}</span>
                          <select
                            className="h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
                            value={g.name}
                            disabled={moveMutation.isPending}
                            onChange={(ev) => requestMove(e, ev.target.value, g.name)}
                            aria-label={t('Mover {e} para outro grupo', { e: entrantLabel(e) })}
                            title={t('Mover para outro grupo')}
                          >
                            {groupNames.map((name) => (
                              <option key={name} value={name}>
                                {name === g.name ? t('{name} (atual)', { name }) : t('Mover para {name}', { name })}
                              </option>
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
            {moveMutation.isPending ? t('Movendo…') : t('Fechar')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={Boolean(pendingMove)}
        onOpenChange={(o) => !o && !moveMutation.isPending && setPendingMove(null)}
        destructive
        title={t('Mover participante e refazer os jogos?')}
        description={
          pendingMove
            ? t('{name} vai do {fromGroupName} para o {toGroupName}. ', { name: pendingMove.name, fromGroupName: pendingMove.fromGroupName, toGroupName: pendingMove.toGroupName })
              + t('Os jogos desta fase serão regerados e os placares já lançados nela serão perdidos.')
            : ''
        }
        confirmLabel={t('Mover e refazer jogos')}
        loading={moveMutation.isPending}
        onConfirm={async () => {
          if (!pendingMove) return;
          await doMove(pendingMove.entrantId, pendingMove.toGroupName);
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
      toast.success(t('Jogador substituído com sucesso.'));
      onClose();
    } catch (err) {
      toast.error(err.message || t('Falha ao substituir jogador.'));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Substituir jogador')}</DialogTitle>
          <DialogDescription>
            {t('Substituindo:')} <strong>{currentName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t('Substituto')}</Label>
            {available.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">
                {t('Nenhum jogador disponível para substituição.')}
              </p>
            ) : (
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">{t('— selecione um jogador —')}</option>
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
            {t('Cancelar')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || substituteMutation.isPending}
          >
            {substituteMutation.isPending ? t('Substituindo…') : t('Confirmar substituição')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

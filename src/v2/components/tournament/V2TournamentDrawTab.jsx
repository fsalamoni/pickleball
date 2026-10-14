import React, { useState, useMemo } from 'react';
import { V2Surface, V2Button, V2Badge, V2ErrorState, V2Select } from '@/v2/ui/primitives';
import V2Collapsible from '@/v2/components/tournament/V2Collapsible';


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
import { Shuffle, AlertTriangle, Pencil, ListRestart, CalendarClock, ChevronsRight, Users, Lock, Wrench } from 'lucide-react';
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
  useClearStaleSingleGroupMarkers,
  useUpdateModality,
} from '@/modules/tournament/hooks/useTournament';
import { neededPlaceholderCount } from '@/modules/tournament/domain/placeholders';
import { matchesWithStaleSingleGroup } from '@/modules/tournament/domain/phases';
import {
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
  MATCH_STATUS,
  MATCH_STATUS_LABELS,
} from '@/modules/tournament/domain/constants';
import { isActiveRegistration } from '@/modules/tournament/domain/checkin';
import { stageSupportsAdvance } from '@/modules/tournament/domain/progression';
import { etapasProgress, etapasResumo, etapaBotaoTexto } from '@/modules/tournament/domain/americanoEtapas';
import { normalizePhase } from '@/modules/tournament/domain/phases';
import { buildRosterSlots } from '@/modules/tournament/domain/teamFormat';
import MultiPhaseDrawBlock from '@/modules/tournament/components/MultiPhaseDrawBlock';
import StageExplanation from '@/modules/tournament/components/StageExplanation';
import DirectEntryPanel from '@/v2/components/tournament/DirectEntryPanel';
import { t, fmtData, fmtLista } from '@/core/i18n';

function formatMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return fmtData(d, { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return t('Disputa de 3º lugar');
  if (m.bracket === 'gf') return m.round === 2 ? t('Final (reset)') : t('Grande final');
  if (m.bracket === 'wb') return t('Vencedores R{round}', { round: m.round });
  if (m.bracket === 'lb') return t('Repescagem R{round}', { round: m.round });
  return m.round;
}

export default function TournamentDrawTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  const multiPhaseEnabled = true;

  if (modalities.length === 0) {
    return (
      <V2Surface>
        <div className="p-6 text-sm text-gray-500 text-center">
          {t('Crie modalidades antes de sortear.')}
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
  const clearGroupsMutation = useClearStaleSingleGroupMarkers(modality.id);
  const placeholderOn = true;
  const lifecycleOn = true;
  // Modalidade de EQUIPES: o participante do sorteio é a equipe. Não existem
  // "vagas fictícias de atleta" nem substituição de jogador por aqui — o
  // elenco é editado na inscrição da equipe.
  const isTeam = Boolean(modality.team_config);
  const teamRosterSize = isTeam ? buildRosterSlots(modality.team_config).length : 0;
  const locked = lifecycleOn && Boolean(tournament.results_locked);
  // ⚠️ Se esta consulta FALHA, `matches` vem vazio e a tela concluiria que a
  // fase não foi sorteada: o botão viraria "Sortear", o diálogo diria que vai
  // GERAR (sem avisar que apaga) e o sorteio apagaria jogos já disputados.
  // Sobre estado desconhecido não se oferece comando.
  const {
    data: matches = [], isError: falhouJogos, refetch: recarregarJogos,
  } = useMatches(modality.id, 0);
  const { data: registrations = [] } = useRegistrations(modality.id);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reshuffleConfirmOpen, setReshuffleConfirmOpen] = useState(false);
  const [keepGroupsConfirmOpen, setKeepGroupsConfirmOpen] = useState(false);
  const [clearGroupsConfirmOpen, setClearGroupsConfirmOpen] = useState(false);
  const [groupsEditorOpen, setGroupsEditorOpen] = useState(false);
  const [error, setError] = useState(null);
  const [substitution, setSubstitution] = useState(null);

  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, r.label || r.player_a_name));
    return map;
  }, [registrations]);

  // Equipes com elenco menor que o exigido: o sorteio funciona, mas a escalação
  // dos confrontos vai faltar gente — avisamos antes.
  const incompleteTeams = useMemo(
    () => (isTeam
      ? registrations.filter((r) => r.kind === 'team' && (r.members || []).length < teamRosterSize)
      : []),
    [isTeam, registrations, teamRosterSize],
  );

  const activeRegistrations = useMemo(
    () =>
      registrations.filter(isActiveRegistration),
    [registrations],
  );

  // Vagas fictícias (Atleta N): completar até o número exato de participantes.
  const maxEntries = Number(modality.max_entries);
  const hasFiniteMax = Number.isFinite(maxEntries) && maxEntries > 0;
  const placeholderCount = registrations.filter((r) => r.is_placeholder).length;
  const realConfirmedCount = activeRegistrations.filter((r) => !r.is_placeholder).length;
  const missingSlots = neededPlaceholderCount(realConfirmedCount, maxEntries);
  const showPlaceholderPanel = placeholderOn && isAdmin && hasFiniteMax && !locked && !isTeam
    && (missingSlots > 0 || placeholderCount > 0);

  async function fillPlaceholders() {
    try {
      const res = await ensurePlaceholdersMutation.mutateAsync(modality);
      toast.success(res.created > 0
        ? t('Vagas preenchidas com {created} atleta(s) fictício(s).', { created: res.created })
        : t('Nenhuma vaga faltante para preencher.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível preencher as vagas.'));
    }
  }

  async function removePlaceholders() {
    try {
      const res = await clearPlaceholdersMutation.mutateAsync();
      toast.success(res.cleared > 0 ? t('Atletas fictícios removidos.') : t('Não havia atletas fictícios.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível remover os atletas fictícios.'));
    }
  }

  const doneStatuses = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);
  const playedCount = matches.filter((m) => doneStatuses.has(m.status)).length;
  const pendingCount = matches.length - playedCount;
  // Nos formatos em que a rodada nasce do resultado (chave, suíço, Mexicano) a
  // ordem não se re-sorteia — o número da rodada é a estrutura.
  const tipoDaFase = modality.stages?.[0]?.type;
  const canReshuffleRemaining = isAdmin && playedCount > 0 && pendingCount > 0
    && (!stageSupportsAdvance(tipoDaFase) || tipoDaFase === TOURNAMENT_STAGE_TYPE.AMERICANO_ETAPAS);

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
  // Americano em etapas: o "avançar" gera a PRÓXIMA ETAPA, e só quando a atual
  // terminou — a tela diz em que pé está e não oferece o que o serviço recusa.
  const ehEtapas = stageType === TOURNAMENT_STAGE_TYPE.AMERICANO_ETAPAS;
  const progEtapas = ehEtapas ? etapasProgress(matches, normalizePhase(modality.stages?.[0] || {})) : null;
  const canAdvance = isAdmin && matches.length > 0 && stageSupportsAdvance(stageType)
    && (!ehEtapas || progEtapas.podeGerar);

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
        toast.success(ehEtapas ? t('Todas as etapas foram jogadas — a classificação final está valendo. 🏆') : t('Fase concluída — campeão definido! 🏆'));
      } else {
        const warns = res.scheduleWarnings || [];
        toast.success(ehEtapas
          ? t('Etapa {proxima} gerada ({created} jogo(s)), com os grupos refeitos.', { proxima: progEtapas?.proxima, created: res.created })
          : (res.created ? t('{created} confronto(s) novo(s) na chave.', { created: res.created }) : t('Chave atualizada com os vencedores certos.')));
        if (warns.length > 0) {
          toast.warning(t('{n} jogo(s) sem horário — ajuste quadras/horário de término.', { n: warns.length }));
        }
      }
    } catch (err) {
      toast.error(err?.message || t('Não foi possível avançar a fase.'));
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
          t('Jogos reagendados. {n} ficaram além do horário de término planejado — ajuste quadras ou horário para encaixá-los.', { n: warns.length }),
        );
      } else {
        toast.success(t('Jogos reagendados nas quadras e horários.'));
      }
    } catch (err) {
      toast.error(err?.message || t('Falha ao reagendar.'));
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
        // Só é reconhecimento quando a tela REALMENTE viu os jogos. O serviço
        // recusa descartar resultado sem isto.
        replacesKnownMatches: matches.length > 0,
      });
      toast.success(t('Sorteio realizado!'));
      const warns = result?.scheduleWarnings || [];
      if (warns.length > 0) {
        toast.warning(
          t('Todos os jogos foram sorteados e agendados. {n} ficaram além do horário de término planejado — adicione quadras ou estenda o horário para encaixá-los na janela.', { n: warns.length }),
        );
      }
      setConfirmOpen(false);
    } catch (err) {
      const message = err?.message || t('Falha ao sortear.');
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
      toast.success(t('Jogos re-sorteados ({matches}) mantendo os {groups} grupo(s).', { matches: result.matches, groups: result.groups }));
      const warns = result?.scheduleWarnings || [];
      if (warns.length > 0) {
        toast.warning(
          t('{n} jogo(s) ficaram além do horário de término planejado — adicione quadras ou estenda o horário.', { n: warns.length }),
        );
      }
      setKeepGroupsConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || t('Falha ao re-sortear os jogos.'));
    } finally {
      setRunning(false);
    }
  }

  async function performReshuffleRemaining() {
    setRunning(true);
    try {
      const { count } = await reShuffleMutation.mutateAsync(0);
      toast.success(t('{count} jogo(s) restante(s) resorteados!', { count }));
      setReshuffleConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || t('Falha ao resortear.'));
    } finally {
      setRunning(false);
    }
  }

  async function performClearGroups() {
    setRunning(true);
    try {
      const { cleared, groupsRemoved } = await clearGroupsMutation.mutateAsync(modality);
      const total = (cleared || 0) + (groupsRemoved || 0);
      if (total === 0) {
        toast.success(t('Nada a corrigir — os confrontos já seguem o grupo único.'));
      } else {
        const partes = [];
        if (cleared > 0) partes.push(t('{cleared} confronto(s) agora seguem o grupo único', { cleared }));
        if (groupsRemoved > 0) partes.push(t('{groupsRemoved} grupo(s) órfão(s) removido(s)', { groupsRemoved }));
        toast.success(t('Grupos corrigidos: {v1}.', { v1: fmtLista(partes) }));
      }
    } catch (err) {
      toast.error(err?.message || t('Falha ao corrigir os grupos.'));
    } finally {
      setRunning(false);
      setClearGroupsConfirmOpen(false);
    }
  }

  const stageName = modality.stages?.[0]?.name || t('fase 1');

  // Salvar as fases a partir desta aba (usado pela entrada direta). Só toca em
  // `stages`; o resto da modalidade fica como está.
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
  const hasGroups = matches.some((m) => m.group);
  // No Americano em etapas os grupos são do FORMATO (refeitos a cada etapa):
  // mover gente entre eles ou regenerar "mantendo os grupos" desmontaria as
  // etapas. Esses comandos não aparecem ali.
  const gruposEditaveis = hasGroups && !ehEtapas;
  const hasSchedule = matches.some((m) => m.court || m.scheduled_at);
  // Marcadores de grupo resquício de sorteios antigos numa fase de grupo único
  // (o dado precisa ser corrigido para seguir a definição da modalidade).
  const staleGroupIds = useMemo(
    () => matchesWithStaleSingleGroup(matches, modality.stages || []),
    [matches, modality.stages],
  );

  return (
    <V2Collapsible
      defaultOpen={false}
      persistId={`sorteio:${modality.id}`}
      title={modality.name}
      subtitle={t('Fase: {v1} · {v2}', { v1: TOURNAMENT_STAGE_TYPE_LABELS[modality.stages?.[0]?.type] || '', v2: matches.length > 0
        ? `${matches.length} ${isTeam ? t('confrontos gerados') : t('jogos gerados')}`
        : t('Ainda não sorteado') })}
    >
      {isTeam && (
        <div className="mb-2 space-y-1 rounded-2xl border border-acid/30 bg-acid/5 p-3 text-xs text-ink">
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone="acid">{t('Equipes')}</V2Badge>
            <span>
              {t('{n} equipe(s) confirmada(s) — o sorteio monta', { n: activeRegistrations.length })}{' '}
              {TOURNAMENT_STAGE_TYPE_LABELS[modality.stages?.[0]?.type] || t('a fase')} {t('com as equipes como participantes; cada jogo é um confronto decidido pelas etapas.')}
            </span>
          </div>
          {incompleteTeams.length > 0 && (
            <p className="font-semibold text-amber-700">
              {t('Atenção: {n} equipe(s) com elenco incompleto (', { n: incompleteTeams.length })}{incompleteTeams.map((tt) => tt.team_name || tt.label).join(', ')}{t(') — dá para sortear, mas complete os elencos antes de escalar os confrontos.')}
            </p>
          )}
        </div>
      )}
      {/* ENTRADA DIRETA: quem pula fases. Aqui, e não no editor de formato,
          porque escolher quem entra direto exige ver os NOMES — e no editor o
          torneio pode nem ter inscrição ainda. */}
      <DirectEntryPanel
        modality={modality}
        registrations={activeRegistrations}
        isTeam={isTeam}
        isAdmin={isAdmin}
        saving={savingStages}
        onSave={handleSaveStages}
      />

      {/* O PLANO, com o número REAL de inscritos, antes de clicar em sortear.
          Quem organiza chega aqui com a pergunta "em quantos grupos eu divido
          isto?" — e a tela respondia mostrando só o botão. Agora mostra o que
          o sorteio vai produzir (jogos, jogos por atleta, classificados, se a
          chave fecha) e as outras divisões possíveis para aquele número. */}
      {isAdmin && activeRegistrations.length > 0 && stageType && (
        <div className="mb-3">
          <StageExplanation
            stageType={stageType}
            playerCount={activeRegistrations.length}
            groupCount={Number(modality.stages?.[0]?.group_count) || 1}
            seedCount={Number(modality.stages?.[0]?.seed_count) || 0}
            qualifiersPerGroup={Number(modality.stages?.[0]?.qualifiers_per_group ?? 2)}
            legs={Number(modality.stages?.[0]?.round_robin_legs) === 2 ? 2 : 1}
            etapaCount={modality.stages?.[0]?.etapa_count}
            maxPerGroup={modality.stages?.[0]?.max_per_group}
          />
        </div>
      )}

        {/* ⚠️ Os jogos não carregaram: a tela NÃO sabe se a fase foi sorteada.
            Oferecer "Sortear" aqui é oferecer apagar o que ela não viu. */}
        {falhouJogos && (
          <V2ErrorState
            inline
            className="mb-2"
            title={t('Não foi possível carregar os jogos desta fase')}
            description={t('Sem eles não dá para saber se a fase já foi sorteada, então as ações de sorteio ficam fora do ar até a lista voltar.')}
            onRetry={recarregarJogos}
          />
        )}

        {ehEtapas && etapasResumo(progEtapas) && !falhouJogos && (
          <p className="mb-2 rounded-2xl bg-paper px-3 py-2 text-xs font-medium text-gray-600" role="status">
            {etapasResumo(progEtapas)}
          </p>
        )}

        <div className="mb-1 flex flex-wrap justify-end">
          {isAdmin && !falhouJogos && (
            <div className="flex gap-2 flex-wrap">
              {canAdvance && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={performAdvance}
                  disabled={running}
                  title={ehEtapas ? t('Refaz os grupos, misturando quem ainda não se encontrou') : t('Gerar a próxima rodada com base nos resultados')}
                >
                  <ChevronsRight className="w-4 h-4 mr-1" /> {ehEtapas ? etapaBotaoTexto(progEtapas) : t('Avançar fase')}
                </V2Button>
              )}
              {canReschedule && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={performReschedule}
                  disabled={running}
                  title={t('Recalcular quadras e horários sem alterar os confrontos')}
                >
                  <CalendarClock className="w-4 h-4 mr-1" /> {t('Reagendar')}
                </V2Button>
              )}
              {canReshuffleRemaining && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReshuffleConfirmOpen(true)}
                  disabled={running}
                >
                  <ListRestart className="w-4 h-4 mr-1" /> {t('Resortear restantes ({pendingCount})', { pendingCount })}
                </V2Button>
              )}
              {staleGroupIds.length > 0 && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setClearGroupsConfirmOpen(true)}
                  disabled={running}
                  title={t('Esta fase é grupo único, mas há confrontos marcados com grupo (sorteio antigo). Corrige os dados para seguir a definição da modalidade, sem alterar os confrontos.')}
                >
                  <Wrench className="w-4 h-4 mr-1" /> {t('Corrigir grupos ({n})', { n: staleGroupIds.length })}
                </V2Button>
              )}
              {gruposEditaveis && staleGroupIds.length === 0 && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setGroupsEditorOpen(true)}
                  disabled={running}
                  title={t('Mover participantes entre os grupos sorteados')}
                >
                  <Users className="w-4 h-4 mr-1" /> {t('Editar grupos')}
                </V2Button>
              )}
              {gruposEditaveis && staleGroupIds.length === 0 && (
                <V2Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setKeepGroupsConfirmOpen(true)}
                  disabled={running}
                  title={t('Gera novamente todos os jogos dos grupos atuais, sem alterar a composição dos grupos')}
                >
                  <ListRestart className="w-4 h-4 mr-1" /> {t('Re-sortear jogos (manter grupos)')}
                </V2Button>
              )}
              <V2Button size="sm" onClick={() => setConfirmOpen(true)} disabled={running || locked}>
                <Shuffle className="w-4 h-4 mr-1" /> {matches.length > 0 ? t('Re-sortear tudo') : t('Sortear')}
              </V2Button>
            </div>
          )}
        </div>

        {locked && isAdmin && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{t('Torneio bloqueado. Desbloqueie as alterações (na aba Geral) para sortear ou ajustar.')}</span>
          </div>
        )}

        {showPlaceholderPanel && (
          <div className="mt-3 rounded-2xl border border-gray-100 bg-paper p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-gray-600">
                <div className="font-medium text-ink">{t('Vagas fictícias (“Atleta N”)')}</div>
                <div>
                  {t('{realConfirmedCount} inscrito(s) real(is) · {maxEntries} vaga(s) exata(s)', { realConfirmedCount, maxEntries })}
                  {placeholderCount > 0 ? t('· {placeholderCount} fictício(s) no momento', { placeholderCount }) : ''}
                  {missingSlots > 0 ? t('· faltam {missingSlots}', { missingSlots }) : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingSlots > 0 && (
                  <V2Button size="sm" variant="ghost" onClick={fillPlaceholders} disabled={ensurePlaceholdersMutation.isPending}>
                    <Users className="w-4 h-4 mr-1" /> {t('Preencher {missingSlots} vaga(s)', { missingSlots })}
                  </V2Button>
                )}
                {placeholderCount > 0 && (
                  <V2Button size="sm" variant="ghost" onClick={removePlaceholders} disabled={clearPlaceholdersMutation.isPending}>
                    {t('Remover fictícios')}
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
              {modality.court_count || 1} {t('quadra(s) ·')} {modality.match_duration_minutes || 30} {t('min/jogo')}
              {modality.play_start_time ? t('· início {play_start_time}', { play_start_time: modality.play_start_time }) : ''}
            </span>
            {scheduledCount > 0 && (
              <V2Badge tone="neutral">{t('{scheduledCount} jogo(s) com horário', { scheduledCount })}</V2Badge>
            )}
            {unscheduledCount > 0 && (
              <V2Badge tone="neutral" className="bg-amber-100 text-amber-800">
                {t('{unscheduledCount} sem horário', { unscheduledCount })}
              </V2Badge>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{t('Não foi possível sortear.')}</div>
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
                  {hasGroups && <th className="px-3 py-2">{t('Grupo')}</th>}
                  <th className="px-3 py-2">{t('Rod.')}</th>
                  {hasSchedule && <th className="px-3 py-2">{t('Quadra')}</th>}
                  {hasSchedule && <th className="px-3 py-2">{t('Horário')}</th>}
                  <th className="px-3 py-2">{t('Lado A')}</th>
                  <th className="px-3 py-2">{t('Lado B')}</th>
                  <th className="px-3 py-2">{t('Status')}</th>
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
                        isAdmin={isAdmin && !isTeam}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <SideCell
                        ids={m.side_b_ids}
                        rawSide={m.side_b}
                        labelById={labelById}
                        isAdmin={isAdmin && !isTeam}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <V2Badge tone="neutral">{MATCH_STATUS_LABELS[m.status] || m.status}</V2Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Dialog open={confirmOpen} onOpenChange={(o) => !running && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Sortear "{stageName}"', { stageName })}</DialogTitle>
            <DialogDescription>
              {matches.length > 0
                ? t('Os {v1} atuais desta fase serão apagados e novos serão gerados.', { v1: isTeam ? t('confrontos') : t('jogos') })
                : isTeam
                  ? t('Serão gerados os confrontos desta fase com as {n} equipe(s) confirmada(s), no formato definido na modalidade.', { n: activeRegistrations.length })
                  : t('Serão gerados os jogos desta fase a partir das inscrições confirmadas.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={running}>
              {t('Cancelar')}
            </V2Button>
            <V2Button onClick={performDraw} disabled={running}>
              {running ? t('Sorteando…') : t('Confirmar sorteio')}
            </V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reshuffleConfirmOpen} onOpenChange={(o) => !running && setReshuffleConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Resortear jogos restantes')}</DialogTitle>
            <DialogDescription>
              {t('Os {pendingCount} jogo(s) ainda não disputado(s) serão resorteados em nova ordem. Os {playedCount} jogo(s) já concluído(s) não serão alterados.', { pendingCount, playedCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setReshuffleConfirmOpen(false)} disabled={running}>
              {t('Cancelar')}
            </V2Button>
            <V2Button onClick={performReshuffleRemaining} disabled={running}>
              {running ? t('Resorteando…') : t('Confirmar')}
            </V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={keepGroupsConfirmOpen} onOpenChange={(o) => !running && setKeepGroupsConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Re-sortear jogos (manter grupos)')}</DialogTitle>
            <DialogDescription>
              {t('Os grupos atuais e seus integrantes serão mantidos. Todos os jogos desta fase serão gerados novamente (todos contra todos em cada grupo) e reagendados — os placares já lançados nesta fase serão perdidos.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setKeepGroupsConfirmOpen(false)} disabled={running}>
              {t('Cancelar')}
            </V2Button>
            <V2Button onClick={performRedrawKeepingGroups} disabled={running}>
              {running ? t('Re-sorteando…') : t('Confirmar')}
            </V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearGroupsConfirmOpen}
        onOpenChange={(o) => !running && setClearGroupsConfirmOpen(o)}
        title={t('Corrigir grupos desta fase?')}
        description={
          t('Esta fase é grupo único. A correção remove o rótulo de grupo dos confrontos ')
          + t('e apaga os metadados de grupo órfãos (sorteio antigo), sem alterar os ')
          + t('confrontos, as escalações nem os resultados já lançados.')
        }
        confirmLabel={t('Corrigir grupos')}
        loading={running}
        onConfirm={performClearGroups}
      />

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
    </V2Collapsible>
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
                title={t('Substituir {name}', { name })}
                aria-label={t('Substituir {name}', { name })}
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
      toast.success(t('Jogador movido e jogos da fase regerados.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível mover o jogador.'));
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
          <DialogTitle>{t('Editar grupos · {name}', { name: modality.name })}</DialogTitle>
          <DialogDescription>
            {t('Mova jogadores entre os grupos. Ao mover, os jogos da fase são regerados com a nova composição')}{hasPlayedScores ? t(' — os placares já lançados nesta fase serão perdidos') : ''}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-gray-500">{t('Carregando grupos…')}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('Nenhum grupo sorteado nesta fase.')}</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {groups.map((g) => (
              <div key={g.name} className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 text-sm font-semibold text-ink">
                  {g.name} <span className="text-xs font-normal text-gray-500">({g.participants.length})</span>
                </div>
                <div className="space-y-1.5">
                  {g.participants.length === 0 ? (
                    <p className="text-xs text-gray-500">{t('Grupo vazio')}</p>
                  ) : (
                    g.participants.map((pid) => (
                      <div key={pid} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm">{labelById.get(pid) || pid}</span>
                        <V2Select
                          className="h-8 shrink-0 px-2 text-xs"
                          value={g.name}
                          disabled={moveMutation.isPending}
                          onChange={(e) => requestMove(pid, e.target.value, g.name)}
                          aria-label={t('Mover {v1} para outro grupo', { v1: labelById.get(pid) || pid })}
                          title={t('Mover para outro grupo')}
                        >
                          {groupNames.map((name) => (
                            <option key={name} value={name}>
                              {name === g.name ? t('{name} (atual)', { name }) : t('Mover para {name}', { name })}
                            </option>
                          ))}
                        </V2Select>
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
            {moveMutation.isPending ? t('Movendo…') : t('Fechar')}
          </V2Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={Boolean(pendingMove)}
        onOpenChange={(o) => !o && !moveMutation.isPending && setPendingMove(null)}
        destructive
        title={t('Mover jogador e refazer os jogos?')}
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
              <V2Select
                className="h-10 px-3 mt-1"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">{t('— selecione um jogador —')}</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || r.player_a_name}
                  </option>
                ))}
              </V2Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>
            {t('Cancelar')}
          </V2Button>
          <V2Button
            onClick={handleConfirm}
            disabled={!selectedId || substituteMutation.isPending}
          >
            {substituteMutation.isPending ? t('Substituindo…') : t('Confirmar substituição')}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

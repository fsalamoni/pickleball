/**
 * A aba METAS da Carreira (`?aba=metas`, docs/54 §4.10): as metas da
 * TEMPORADA em `player_goals` (com `kind`). Resultado (uma métrica da
 * carreira com alvo, ou marcada à mão) ou processo (progresso de 0 a 100).
 * Cada métrica diz de onde conta; a do DUPR só com o DUPR oficial valendo.
 * Abandonar não é falhar: a meta sai das ativas, sem vermelho.
 *
 * As gravações (concluir, deixar de lado, excluir) moram na ABA, não no
 * cartão: o cartão some da lista quando a meta muda de estado, e o aviso de
 * "salvou"/"falhou" de uma mutação morre junto com quem a chamou.
 */
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Flag, Pencil, Plus, Undo2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { formatDuprRating } from '@/core/domain/duprRating';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDuprMode } from '@/modules/rating/hooks/useDuprMode';
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from '@/modules/progression/hooks/useProgression';
import { GOAL_KIND, GOAL_LIMITS, GOAL_STATUS, SEASON_GOAL_METRIC, goalProgress } from '@/modules/progression/domain/progression.js';
import {
  SEASON_GOAL_METRIC_LABEL, SEASON_GOAL_METRIC_SOURCE, careerGoalValues, seasonGoalMetrics, splitSeasonGoals, yearOnlyInGoalWindow,
} from '@/modules/career/domain/careerGoals.js';
import { addDays, todayLocal } from '@/modules/training/domain/dates.js';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { ChoiceGroup, careerDateLabel } from './careerUi';
import { fmtNumero, t, tk, tn } from '@/core/i18n';

const KIND_CHOICES = [
  { value: GOAL_KIND.OUTCOME, label: tk('De resultado') },
  { value: GOAL_KIND.PROCESS, label: tk('De processo') },
];

/**
 * O botão que abre um formulário some enquanto ele está aberto: ao fechar, o
 * foco volta a ele (senão cairia no topo da página para quem usa teclado).
 */
function useFocoAoFechar(aberto, seletor) {
  const raiz = useRef(null);
  const abriu = useRef(false);
  useEffect(() => {
    if (!aberto && abriu.current) raiz.current?.querySelector(seletor)?.focus();
    abriu.current = aberto;
  }, [aberto, seletor]);
  return raiz;
}

/** Criar (sem `goal`) ou editar (com `goal`: o tipo não muda — `updateGoal` o mantém). */
function NovaMeta({ metrics, goal, onDone }) {
  const hoje = todayLocal();
  const criar = useCreateGoal();
  const atualizar = useUpdateGoal();
  const salvando = criar.isPending || atualizar.isPending;
  const [f, setF] = useState(() => (goal
    ? { kind: goal.kind, title: goal.title || '', metric: goal.metric || null, target: goal.target ?? '', since: goal.since || '', due_date: goal.due_date || '', if_then: goal.if_then || '' }
    : { kind: GOAL_KIND.OUTCOME, title: '', metric: metrics[0], target: '', since: hoje, due_date: addDays(hoje, 180), if_then: '' }));
  const [erro, setErro] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // Ids próprios por meta: dois formulários nunca dividem o mesmo `id`.
  const pid = goal ? `meta-${goal.id}` : 'meta';
  // A métrica da meta editada entra na lista mesmo que hoje não seja oferecida (DUPR desligado).
  const opcoes = f.metric && !metrics.includes(f.metric) ? [...metrics, f.metric] : metrics;
  const enviar = (e) => {
    e.preventDefault();
    setErro('');
    const base = { title: f.title, since: f.since, due_date: f.due_date, if_then: f.if_then };
    const aoFalhar = (err) => setErro(err?.message || t('Não foi possível salvar. Tente de novo.'));
    if (goal) {
      // `metric: null` tira a métrica do documento (a meta passa a ser marcada à mão).
      const patch = f.kind === GOAL_KIND.PROCESS ? base : { ...base, metric: f.metric || null, target: f.target };
      atualizar.mutate({ goal, patch }, { onSuccess: () => { toast.success(t('Meta salva.')); onDone(); }, onError: aoFalhar });
      return;
    }
    const input = f.kind === GOAL_KIND.PROCESS
      ? { kind: f.kind, ...base, progress_manual: 0 }
      : { kind: f.kind, ...base, ...(f.metric ? { metric: f.metric, target: f.target } : {}) };
    criar.mutate(input, { onSuccess: () => { toast.success(t('Meta criada.')); onDone(); }, onError: aoFalhar });
  };
  return (
    <form onSubmit={enviar} aria-label={goal ? t('Editar a meta {meta}', { meta: goal.title }) : t('Nova meta da temporada')} className="space-y-3 rounded-3xl border border-gray-100 p-4" data-dica={goal ? undefined : 'carreira-nova-meta'}>
      {!goal && (
        <>
          <p className="text-sm font-semibold text-ink" aria-hidden="true">{t('Tipo de meta')}</p>
          <ChoiceGroup label={t('Tipo de meta')} options={KIND_CHOICES} value={f.kind} onChange={(v) => set('kind', v || GOAL_KIND.OUTCOME)} />
        </>
      )}
      <V2Field label={t('A meta')} htmlFor={`${pid}-titulo`} required hint={f.kind === GOAL_KIND.PROCESS ? t('Ex.: treinar a terceira bola duas vezes por semana.') : t('Ex.: subir ao pódio em dois torneios.')}>
        {/* O formulário abre por um toque da pessoa: o foco vai ao primeiro campo. */}
        <V2Input id={`${pid}-titulo`} autoFocus aria-required="true" value={f.title} maxLength={GOAL_LIMITS.title} onChange={(e) => set('title', e.target.value)} />
      </V2Field>
      {f.kind === GOAL_KIND.OUTCOME && (
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Como medir')} htmlFor={`${pid}-metrica`} hint={f.metric ? t(SEASON_GOAL_METRIC_SOURCE[f.metric]) : t('Você marca como concluída quando chegar lá.')}>
            <V2Select id={`${pid}-metrica`} value={f.metric || ''} onChange={(e) => set('metric', e.target.value || null)}>
              {opcoes.map((m) => <option key={m} value={m}>{t(SEASON_GOAL_METRIC_LABEL[m])}</option>)}
              <option value="">{t('Eu marco à mão')}</option>
            </V2Select>
          </V2Field>
          {f.metric && (
            <V2Field label={t('Alvo')} htmlFor={`${pid}-alvo`}>
              <V2Input id={`${pid}-alvo`} type="number" min={0} step={f.metric === SEASON_GOAL_METRIC.DUPR_RATING ? 0.001 : 1} value={f.target} onChange={(e) => set('target', e.target.value)} />
            </V2Field>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Começa em')} htmlFor={`${pid}-inicio`}>
          <V2Input id={`${pid}-inicio`} type="date" value={f.since} onChange={(e) => set('since', e.target.value)} />
        </V2Field>
        <V2Field label={t('Prazo')} htmlFor={`${pid}-prazo`} required>
          <V2Input id={`${pid}-prazo`} type="date" min={f.since || undefined} value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
        </V2Field>
      </div>
      <V2Field label={t('Se acontecer…, então eu… (opcional)')} htmlFor={`${pid}-se-entao`}>
        <V2Input id={`${pid}-se-entao`} value={f.if_then} maxLength={GOAL_LIMITS.ifThen} onChange={(e) => set('if_then', e.target.value)} />
      </V2Field>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <V2Button type="submit" variant="primary" disabled={salvando || !f.title.trim()}>{salvando ? t('Salvando…') : goal ? t('Salvar') : t('Criar meta')}</V2Button>
        <V2Button type="button" variant="ghost" onClick={onDone}>{t('Cancelar')}</V2Button>
      </div>
    </form>
  );
}

/** O estado da meta em palavras (nunca só pela barra): abandonada não aparece como alcançada. */
function Estado({ goal, alcancada, ativa }) {
  if (goal.status === GOAL_STATUS.DROPPED) return <V2Badge tone="neutral">{t('Deixada de lado')}</V2Badge>;
  if (goal.status === GOAL_STATUS.DONE) return <V2Badge tone="green">{t('Concluída')}</V2Badge>;
  if (alcancada) return <V2Badge tone="acid">{t('Alcançada')}</V2Badge>;
  // Sem vermelho: prazo que passou não é falha — dá para editar o prazo, concluir ou deixar de lado.
  if (ativa && goal.due_date && goal.due_date < todayLocal()) return <V2Badge tone="neutral">{t('Prazo encerrado')}</V2Badge>;
  return null;
}

function Meta({ goal, values, incompleto, soAno, metrics, busy, onChange, onDelete }) {
  const [editando, setEditando] = useState(false);
  const raiz = useFocoAoFechar(editando, '[data-foco="editar"]');
  const p = goalProgress(goal, values);
  const ativa = !goal.status || goal.status === GOAL_STATUS.ACTIVE;
  const pct = Math.round((p.ratio || 0) * 100);
  // O rating DUPR sai com três casas e o separador do idioma ("4,525"), nunca cru ("4.525" lê-se quatro mil).
  const fmt = goal.metric === SEASON_GOAL_METRIC.DUPR_RATING ? formatDuprRating : fmtNumero;
  const soComAno = ativa ? yearOnlyInGoalWindow(goal, soAno) : 0;
  if (editando) return <li ref={raiz}><NovaMeta metrics={metrics} goal={goal} onDone={() => setEditando(false)} /></li>;
  return (
    <li ref={raiz} className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-semibold text-ink">{goal.title}</p>
          <p className="text-sm text-gray-500">{t('Até {data}', { data: careerDateLabel(goal.due_date) })}</p>
        </div>
        <Estado goal={goal} alcancada={p.done} ativa={ativa} />
      </div>
      {goal.kind === GOAL_KIND.OUTCOME && goal.metric && (
        <p className="text-sm text-gray-600">
          {p.unknown
            ? t('Não deu para medir agora.')
            : t('{atual} de {alvo} · {metrica}', { atual: fmt(p.current), alvo: fmt(p.target), metrica: t(SEASON_GOAL_METRIC_LABEL[goal.metric]) })}
          {!p.unknown && incompleto && ` ${t('(pode ter mais: parte da carreira não carregou)')}`}
        </p>
      )}
      {(goal.kind === GOAL_KIND.PROCESS || (goal.metric && !p.unknown)) && (
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('Progresso da meta')}>
          <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
      )}
      {goal.kind === GOAL_KIND.OUTCOME && goal.metric && <p className="text-xs text-gray-500">{t(SEASON_GOAL_METRIC_SOURCE[goal.metric])}</p>}
      {/* Lançado só com o ano, o torneio fica com a data de 1º de janeiro: a janela da meta pode deixá-lo de fora. */}
      {soComAno > 0 && (
        <p className="text-xs text-gray-600">
          {tn(soComAno, '{n} torneio lançado só com o ano pode estar fora desta conta. Ponha a data na ficha dele, na linha do tempo.', '{n} torneios lançados só com o ano podem estar fora desta conta. Ponha a data na ficha deles, na linha do tempo.')}
        </p>
      )}
      {goal.if_then && <p className="break-words text-sm text-gray-600">{goal.if_then}</p>}
      {ativa ? (
        <div className="flex flex-wrap items-center gap-2">
          {goal.kind === GOAL_KIND.PROCESS && (
            // Não é desligado enquanto salva (perderia o foco no teclado): a aba ignora a mudança concorrente.
            <V2Select aria-label={t('Progresso de {meta}', { meta: goal.title })} className="w-auto" value={String(goal.progress_manual || 0)} aria-busy={busy} onChange={(e) => onChange(goal, { progress_manual: Number(e.target.value) }, t('Progresso salvo.'))}>
              {[0, 25, 50, 75, 100].map((n) => <option key={n} value={n}>{`${n}%`}</option>)}
            </V2Select>
          )}
          <V2Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => onChange(goal, { status: GOAL_STATUS.DONE }, t('Meta concluída.'))}><Check className="h-4 w-4" aria-hidden="true" /> {t('Concluir')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" data-foco="editar" aria-label={t('Editar a meta {meta}', { meta: goal.title })} onClick={() => setEditando(true)}><Pencil className="h-4 w-4" aria-hidden="true" /> {t('Editar')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange(goal, { status: GOAL_STATUS.DROPPED }, t('Meta guardada.'))}>{t('Deixar de lado')}</V2Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange(goal, { status: GOAL_STATUS.ACTIVE }, t('Meta de volta.'))}><Undo2 className="h-4 w-4" aria-hidden="true" /> {t('Retomar')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={t('Excluir a meta {meta}', { meta: goal.title })} onClick={() => onDelete(goal)}>{t('Excluir')}</V2Button>
        </div>
      )}
    </li>
  );
}

/** @param {{ data: object }} props a linha do tempo (as métricas saem dela) */
export default function CareerGoalsTab({ data }) {
  const { user, userProfile } = useAuth();
  const dupr = useDuprMode();
  const goals = useGoals(user?.uid);
  const atualizar = useUpdateGoal();
  const apagar = useDeleteGoal();
  const [nova, setNova] = useState(false);
  const [verOutras, setVerOutras] = useState(false);
  const [excluir, setExcluir] = useState(null);
  const raiz = useFocoAoFechar(nova, '[data-dica="carreira-criar-meta"]');
  if (goals.isPending || data.isPending) return <V2Skeleton lines={4} />;
  if (goals.isError) return <V2ErrorState title={t('As suas metas não carregaram')} description={t('Elas continuam lá — a conexão é que falhou.')} onRetry={() => goals.refetch()} />;
  const duprRating = dupr.official && userProfile?.dupr_verified ? userProfile.dupr_rating : null;
  const { values, incompleto, soAno } = careerGoalValues(data.timeline, { duprRating });
  const { active, done, dropped } = splitSeasonGoals(goals.data);
  const metrics = seasonGoalMetrics({ dupr: dupr.official });
  const outras = [...done, ...dropped];
  const ocupado = atualizar.isPending || apagar.isPending;
  const muda = (goal, patch, ok) => {
    if (ocupado) return;
    atualizar.mutate({ goal, patch }, {
      onSuccess: () => toast.success(ok),
      onError: (err) => toast.error(err?.message || t('Não foi possível salvar. Tente de novo.')),
    });
  };
  const excluirDeVez = () => apagar.mutate(excluir.id, {
    onSuccess: () => { toast.success(t('Meta excluída.')); setExcluir(null); },
    // A pergunta fecha: a meta segue na lista e o aviso diz que nada foi apagado.
    onError: (err) => { toast.error(err?.message || t('Não foi possível excluir. Tente de novo.')); setExcluir(null); },
  });
  const meta = (g) => <Meta key={g.id} goal={g} values={values} incompleto={incompleto.length > 0} soAno={soAno} metrics={metrics} busy={ocupado} onChange={muda} onDelete={setExcluir} />;
  return (
    <div ref={raiz} className="space-y-4">
      {nova ? <NovaMeta metrics={metrics} onDone={() => setNova(false)} /> : (
        <V2Button type="button" variant="primary" data-dica="carreira-criar-meta" onClick={() => setNova(true)}><Plus className="h-4 w-4" aria-hidden="true" /> {t('Nova meta da temporada')}</V2Button>
      )}
      {active.length > 0 ? <ul className="space-y-2">{active.map(meta)}</ul> : !nova && (
        <V2EmptyState icon={Flag} title={t('Nenhuma meta ativa')} description={t('Uma meta de resultado (pódios, torneios federados) ou de processo (o que você vai treinar) para a temporada.')} />
      )}
      {outras.length > 0 && (
        <section className="space-y-2">
          <V2Button type="button" size="sm" variant="ghost" aria-expanded={verOutras} onClick={() => setVerOutras((v) => !v)}>
            {verOutras ? t('Esconder as concluídas e deixadas de lado') : t('Concluídas e deixadas de lado ({n})', { n: outras.length })}
          </V2Button>
          {verOutras && <ul className="space-y-2">{outras.map(meta)}</ul>}
        </section>
      )}
      {excluir && (
        <ConfirmDialog
          open
          onOpenChange={(v) => { if (!v) setExcluir(null); }}
          title={t('Excluir esta meta?')}
          description={t('"{meta}" sai das suas metas. Não dá para desfazer.', { meta: excluir.title })}
          confirmLabel={t('Excluir de vez')}
          destructive
          loading={apagar.isPending}
          onConfirm={excluirDeVez}
        />
      )}
    </div>
  );
}

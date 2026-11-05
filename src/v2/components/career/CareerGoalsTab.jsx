/**
 * A aba METAS da Carreira (`?aba=metas`, docs/54 §4.10): as metas da
 * TEMPORADA em `player_goals` (com `kind`). Resultado (uma métrica da
 * carreira com alvo, ou marcada à mão) ou processo (progresso de 0 a 100).
 * Cada métrica diz de onde conta; a do DUPR só com o DUPR oficial valendo.
 * Abandonar não é falhar: a meta sai das ativas, sem vermelho.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, Flag, Plus, Undo2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useDuprMode } from '@/modules/rating/hooks/useDuprMode';
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from '@/modules/progression/hooks/useProgression';
import { GOAL_KIND, GOAL_LIMITS, GOAL_STATUS, goalProgress } from '@/modules/progression/domain/progression.js';
import {
  SEASON_GOAL_METRIC_LABEL, SEASON_GOAL_METRIC_SOURCE, careerGoalValues, seasonGoalMetrics, splitSeasonGoals,
} from '@/modules/career/domain/careerGoals.js';
import { addDays, todayLocal } from '@/modules/training/domain/dates.js';
import { V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { ChoiceGroup, careerDateLabel } from './careerUi';
import { t, tk } from '@/core/i18n';

const KIND_CHOICES = [
  { value: GOAL_KIND.OUTCOME, label: tk('De resultado') },
  { value: GOAL_KIND.PROCESS, label: tk('De processo') },
];

function NovaMeta({ metrics, onDone }) {
  const hoje = todayLocal();
  const criar = useCreateGoal();
  const [f, setF] = useState({ kind: GOAL_KIND.OUTCOME, title: '', metric: metrics[0], target: '', since: hoje, due_date: addDays(hoje, 180), if_then: '' });
  const [erro, setErro] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const enviar = (e) => {
    e.preventDefault();
    setErro('');
    const input = f.kind === GOAL_KIND.PROCESS
      ? { kind: f.kind, title: f.title, since: f.since, due_date: f.due_date, if_then: f.if_then, progress_manual: 0 }
      : { kind: f.kind, title: f.title, since: f.since, due_date: f.due_date, if_then: f.if_then, ...(f.metric ? { metric: f.metric, target: f.target } : {}) };
    criar.mutate(input, {
      onSuccess: () => { toast.success(t('Meta criada.')); onDone(); },
      onError: (err) => setErro(err?.message || t('Não foi possível salvar. Tente de novo.')),
    });
  };
  return (
    <form onSubmit={enviar} className="space-y-3 rounded-3xl border border-gray-100 p-4" data-dica="carreira-nova-meta">
      <p className="text-sm font-semibold text-ink">{t('Tipo de meta')}</p>
      <ChoiceGroup label={t('Tipo de meta')} options={KIND_CHOICES} value={f.kind} onChange={(v) => set('kind', v || GOAL_KIND.OUTCOME)} />
      <V2Field label={t('A meta')} htmlFor="meta-titulo" required hint={f.kind === GOAL_KIND.PROCESS ? t('Ex.: treinar a terceira bola duas vezes por semana.') : t('Ex.: subir ao pódio em dois torneios.')}>
        <V2Input id="meta-titulo" value={f.title} maxLength={GOAL_LIMITS.title} onChange={(e) => set('title', e.target.value)} />
      </V2Field>
      {f.kind === GOAL_KIND.OUTCOME && (
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Como medir')} htmlFor="meta-metrica" hint={f.metric ? t(SEASON_GOAL_METRIC_SOURCE[f.metric]) : t('Você marca como concluída quando chegar lá.')}>
            <V2Select id="meta-metrica" value={f.metric || ''} onChange={(e) => set('metric', e.target.value || null)}>
              {metrics.map((m) => <option key={m} value={m}>{t(SEASON_GOAL_METRIC_LABEL[m])}</option>)}
              <option value="">{t('Eu marco à mão')}</option>
            </V2Select>
          </V2Field>
          {f.metric && (
            <V2Field label={t('Alvo')} htmlFor="meta-alvo">
              <V2Input id="meta-alvo" type="number" min={0} step={f.metric === 'dupr_rating' ? 0.001 : 1} value={f.target} onChange={(e) => set('target', e.target.value)} />
            </V2Field>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Começa em')} htmlFor="meta-inicio">
          <V2Input id="meta-inicio" type="date" value={f.since} onChange={(e) => set('since', e.target.value)} />
        </V2Field>
        <V2Field label={t('Prazo')} htmlFor="meta-prazo" required>
          <V2Input id="meta-prazo" type="date" min={f.since} value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
        </V2Field>
      </div>
      <V2Field label={t('Se acontecer…, então eu… (opcional)')} htmlFor="meta-se-entao">
        <V2Input id="meta-se-entao" value={f.if_then} maxLength={GOAL_LIMITS.ifThen} onChange={(e) => set('if_then', e.target.value)} />
      </V2Field>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <V2Button type="submit" variant="primary" disabled={criar.isPending || !f.title.trim()}>{criar.isPending ? t('Salvando…') : t('Criar meta')}</V2Button>
        <V2Button type="button" variant="ghost" onClick={onDone}>{t('Cancelar')}</V2Button>
      </div>
    </form>
  );
}

function Meta({ goal, values, incompleto }) {
  const atualizar = useUpdateGoal();
  const apagar = useDeleteGoal();
  const p = goalProgress(goal, values);
  const muda = (patch, ok) => atualizar.mutate({ goal, patch }, {
    onSuccess: () => toast.success(ok),
    onError: (err) => toast.error(err?.message || t('Não foi possível salvar. Tente de novo.')),
  });
  const ativa = !goal.status || goal.status === GOAL_STATUS.ACTIVE;
  const pct = Math.round((p.ratio || 0) * 100);
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{goal.title}</p>
          <p className="text-sm text-gray-500">{t('Até {data}', { data: careerDateLabel(goal.due_date) })}</p>
        </div>
        {p.done && <span className="text-sm font-semibold text-ink">{t('Alcançada')}</span>}
      </div>
      {goal.kind === GOAL_KIND.OUTCOME && goal.metric && (
        <p className="text-sm text-gray-600">
          {p.unknown
            ? t('Não deu para medir agora.')
            : t('{atual} de {alvo} · {metrica}', { atual: p.current, alvo: p.target, metrica: t(SEASON_GOAL_METRIC_LABEL[goal.metric]) })}
          {!p.unknown && incompleto && ` ${t('(pode ter mais: parte da carreira não carregou)')}`}
        </p>
      )}
      {(goal.kind === GOAL_KIND.PROCESS || (goal.metric && !p.unknown)) && (
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('Progresso da meta')}>
          <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
      )}
      {goal.kind === GOAL_KIND.OUTCOME && goal.metric && <p className="text-xs text-gray-500">{t(SEASON_GOAL_METRIC_SOURCE[goal.metric])}</p>}
      {goal.if_then && <p className="text-sm text-gray-600">{goal.if_then}</p>}
      {ativa ? (
        <div className="flex flex-wrap items-center gap-2">
          {goal.kind === GOAL_KIND.PROCESS && (
            <V2Select aria-label={t('Progresso de {meta}', { meta: goal.title })} className="w-auto" value={String(goal.progress_manual || 0)} disabled={atualizar.isPending} onChange={(e) => muda({ progress_manual: Number(e.target.value) }, t('Progresso salvo.'))}>
              {[0, 25, 50, 75, 100].map((n) => <option key={n} value={n}>{`${n}%`}</option>)}
            </V2Select>
          )}
          <V2Button type="button" size="sm" variant="secondary" disabled={atualizar.isPending} onClick={() => muda({ status: GOAL_STATUS.DONE }, t('Meta concluída.'))}><Check className="h-4 w-4" /> {t('Concluir')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={atualizar.isPending} onClick={() => muda({ status: GOAL_STATUS.DROPPED }, t('Meta guardada.'))}>{t('Deixar de lado')}</V2Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="ghost" disabled={atualizar.isPending} onClick={() => muda({ status: GOAL_STATUS.ACTIVE }, t('Meta de volta.'))}><Undo2 className="h-4 w-4" /> {t('Retomar')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={apagar.isPending} onClick={() => apagar.mutate(goal.id)}>{t('Excluir')}</V2Button>
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
  const [nova, setNova] = useState(false);
  const [verOutras, setVerOutras] = useState(false);
  if (goals.isPending || data.isPending) return <V2Skeleton lines={4} />;
  if (goals.isError) return <V2ErrorState title={t('As suas metas não carregaram')} description={t('Elas continuam lá — a conexão é que falhou.')} onRetry={() => goals.refetch()} />;
  const duprRating = dupr.official && userProfile?.dupr_verified ? userProfile.dupr_rating : null;
  const { values, incompleto } = careerGoalValues(data.timeline, { duprRating });
  const { active, done, dropped } = splitSeasonGoals(goals.data);
  const metrics = seasonGoalMetrics({ dupr: dupr.official });
  const outras = [...done, ...dropped];
  const meta = (g) => <Meta key={g.id} goal={g} values={values} incompleto={incompleto.length > 0} />;
  return (
    <div className="space-y-4">
      {nova ? <NovaMeta metrics={metrics} onDone={() => setNova(false)} /> : (
        <V2Button type="button" variant="primary" data-dica="carreira-criar-meta" onClick={() => setNova(true)}><Plus className="h-4 w-4" /> {t('Nova meta da temporada')}</V2Button>
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
    </div>
  );
}

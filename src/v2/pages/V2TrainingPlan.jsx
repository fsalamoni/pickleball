/**
 * V2TrainingPlan — um plano de treino (`/treino/planos/:planId`): as semanas,
 * o que há em cada dia, o que já foi feito, e editar dia a dia.
 *
 * Três desfechos da leitura, que não se confundem: carregando (esqueleto),
 * falhou (erro com "Tentar de novo") e "este plano não existe" — este só com
 * a lista de planos da pessoa carregada inteira.
 *
 * "Ficou para depois" nunca é vermelho: não treinar num dia planejado não é
 * falha, é a vida.
 */
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowLeft, ArrowUp, CalendarRange, Check, CheckCircle2, NotebookPen, Pause, Pencil, Play, Plus, Trash2, X,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useMyTrainingPlans, usePlanActions } from '@/modules/training/hooks/useTrainingPlans';
import { useMyTrainingSessions } from '@/modules/training/hooks/useTrainingSessions';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import {
  PLAN_LIMITS, PLAN_STATUS, PLAN_STATUS_LABELS, currentPlanWeek, planProgress,
} from '@/modules/training/domain/plan';
import {
  courtBlocks, minutesFromSeconds, moveInList, pickItems, planWeekView, planWeeksSummary, repeatSlotInWeeks, setSlotItems, slotFit,
  weekRangeLabel,
} from '@/modules/training/domain/treinar';
import { WEEKDAY_LONG, formatDayLabel, todayLocal, addDays } from '@/modules/training/domain/dates';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Input, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import TrainingGate from '@/v2/components/training/TrainingGate';
import { ConfirmDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { KindIcon } from '@/v2/components/training/ItemCard';
import ItemPickerDialog from '@/v2/components/training/plan/ItemPickerDialog';

const LogSessionDialog = lazy(() => import('@/v2/components/training/LogSessionDialog'));
const CourtMode = lazy(() => import('@/v2/components/training/today/CourtMode'));

const VOLTAR = '/treino?aba=planos';
const TOM = { [PLAN_STATUS.ATIVO]: 'acid', [PLAN_STATUS.PAUSADO]: 'amber', [PLAN_STATUS.CONCLUIDO]: 'neutral' };
const ESTADO_DIA = {
  feito: { texto: 'Feito', tom: 'green' },
  hoje: { texto: 'Hoje', tom: 'ink' },
  planejado: { texto: 'Planejado', tom: 'neutral' },
  depois: { texto: 'Ficou para depois', tom: 'neutral' },
};

function Voltar() {
  return (
    <Link to={VOLTAR} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Planos
    </Link>
  );
}

/** Título e objetivo, editáveis no lugar. */
function Cabecalho({ plan, acoes }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ title: plan.title, goal: plan.goal || '' });
  const [erro, setErro] = useState('');

  const salvar = (e) => {
    e.preventDefault();
    acoes.update.mutate({ plan, input: f }, {
      onSuccess: () => { toast.success('Plano atualizado.'); setEditando(false); },
      onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível salvar agora.')),
    });
  };

  if (editando) {
    return (
      <form onSubmit={salvar} className="space-y-3">
        <label className="block space-y-1 text-sm font-semibold text-ink">
          Nome do plano
          <V2Input maxLength={PLAN_LIMITS.title} value={f.title} onChange={(e) => { setErro(''); setF({ ...f, title: e.target.value }); }} />
        </label>
        <label className="block space-y-1 text-sm font-semibold text-ink">
          Objetivo
          <V2Textarea rows={2} maxLength={PLAN_LIMITS.goal} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        </label>
        {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
        <div className="flex gap-2">
          <V2Button type="submit" size="sm" disabled={acoes.update.isPending}>{acoes.update.isPending ? 'Salvando…' : 'Salvar'}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => { setEditando(false); setF({ title: plan.title, goal: plan.goal || '' }); }}>Cancelar</V2Button>
        </div>
      </form>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <V2Badge tone={TOM[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</V2Badge>
        <span className="text-sm text-gray-500">
          {plan.weeks} {plan.weeks === 1 ? 'semana' : 'semanas'} · {plan.days.length} {plan.days.length === 1 ? 'dia' : 'dias'} por semana · {plan.minutes} min
        </span>
      </div>
      <div className="flex items-start gap-2">
        <h1 className="font-display text-3xl font-bold text-ink">{plan.title}</h1>
        <button type="button" aria-label="Editar nome e objetivo" onClick={() => setEditando(true)} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {plan.goal && <p className="max-w-2xl text-gray-600">{plan.goal}</p>}
    </div>
  );
}

/** Quanto do dia os itens ocupam, frente ao tempo do plano. */
function TempoDoDia({ items, alvo }) {
  const fit = slotFit(items, alvo);
  if (fit.state === 'sem_tempo') return null;
  return (
    <p className={cn('text-xs font-semibold', fit.state === 'passa' ? 'text-amber-700' : 'text-gray-500')}>
      {fit.state === 'passa'
        ? `${fit.minutes} min · passa ${fit.over} min do tempo do plano (${alvo} min)`
        : `${fit.minutes} de ${alvo} min do plano`}
    </p>
  );
}

const BOTAO_ICONE = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:pointer-events-none disabled:opacity-30';

/**
 * Editar um dia: acrescentar da biblioteca (vários de uma vez), mudar a
 * ordem, tirar e, se quiser, repetir o dia nas semanas seguintes.
 */
function EditarDia({ plan, dia, semana, visiveis, contexto, acoes, onFechar }) {
  const [ids, setIds] = useState(dia.slot?.item_ids || []);
  const [repetir, setRepetir] = useState(false);
  const [escolher, setEscolher] = useState(false);
  const [erro, setErro] = useState('');
  const vagas = PLAN_LIMITS.itemsPerSlot - ids.length;
  const seguintes = plan.weeks - semana;
  const titulo = (id) => visiveis.byId[id]?.title || 'Item indisponível';

  const salvar = () => {
    const r = repetir && seguintes > 0
      ? repeatSlotInWeeks(plan, { week: semana, day: dia.day }, ids)
      : setSlotItems(plan, { week: semana, day: dia.day }, ids);
    if (!r.ok) { setErro(r.error); return; }
    acoes.update.mutate({ plan, input: { slots: r.slots } }, {
      onSuccess: () => {
        toast.success(r.weeks ? `Dia atualizado nesta semana e em mais ${r.weeks === 1 ? '1 semana' : `${r.weeks} semanas`}.` : 'Dia atualizado.');
        onFechar();
      },
      onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível salvar agora.')),
    });
  };

  return (
    <div className="space-y-3 rounded-3xl bg-gray-50 p-3 sm:p-4">
      {ids.length === 0 && <p className="text-sm text-gray-500">Nenhum item neste dia ainda.</p>}
      <ol className="space-y-1.5" aria-label="Itens do dia, na ordem do treino">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-2xl bg-paper-pure px-2 py-1.5 text-sm">
            <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-400" aria-hidden="true">{i + 1}</span>
            {visiveis.byId[id] && <KindIcon kind={visiveis.byId[id].kind} size="sm" className="hidden sm:inline-flex" />}
            <span className="min-w-0 flex-1">
              <span className="block line-clamp-2 font-semibold leading-snug text-ink">{titulo(id)}</span>
              {visiveis.byId[id]?.duration_min ? <span className="block text-xs text-gray-500">{visiveis.byId[id].duration_min} min</span> : null}
            </span>
            <button type="button" aria-label={`Subir ${titulo(id)}`} disabled={i === 0} onClick={() => setIds(moveInList(ids, i, -1))} className={BOTAO_ICONE}>
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Descer ${titulo(id)}`} disabled={i === ids.length - 1} onClick={() => setIds(moveInList(ids, i, 1))} className={BOTAO_ICONE}>
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Tirar ${titulo(id)} deste dia`} onClick={() => { setErro(''); setIds(ids.filter((x) => x !== id)); }} className={BOTAO_ICONE}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <TempoDoDia items={pickItems(ids, visiveis.byId).items} alvo={plan.minutes} />
      {vagas > 0 ? (
        <V2Button size="sm" variant="secondary" onClick={() => setEscolher(true)} disabled={visiveis.isLoading} data-dica="treino-plano-acrescentar">
          <Plus className="h-4 w-4" aria-hidden="true" /> {visiveis.isLoading ? 'Carregando a biblioteca…' : 'Acrescentar da biblioteca'}
        </V2Button>
      ) : (
        <p className="text-xs text-gray-500">Um dia tem no máximo {PLAN_LIMITS.itemsPerSlot} itens.</p>
      )}
      {seguintes > 0 && (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-ink" />
          <span>
            Repetir nas próximas semanas
            <span className="block text-xs text-gray-500">
              {WEEKDAY_LONG[dia.day]} das semanas {semana + 1}{seguintes > 1 ? ` a ${plan.weeks}` : ''} fica igual a este (substitui o que houver lá).
            </span>
          </span>
        </label>
      )}
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <V2Button size="sm" onClick={salvar} disabled={acoes.update.isPending}>{acoes.update.isPending ? 'Salvando…' : 'Salvar o dia'}</V2Button>
        <V2Button size="sm" variant="ghost" onClick={onFechar}>Cancelar</V2Button>
      </div>
      {escolher && (
        <ItemPickerDialog
          open={escolher}
          onOpenChange={setEscolher}
          items={visiveis.items}
          excludeIds={ids}
          max={vagas}
          favorites={contexto.favorites}
          level={contexto.level}
          incompleto={visiveis.incompleto}
          onAdd={(novos) => { setErro(''); setIds([...ids, ...novos]); }}
        />
      )}
    </div>
  );
}

function Dia({ plan, dia, semana, visiveis, contexto, acoes, hoje, diarioPronto, onRegistrar, onTreinar }) {
  const [editando, setEditando] = useState(false);
  const { items, missingIds } = pickItems(dia.slot?.item_ids || [], visiveis.byId);
  const e = ESTADO_DIA[dia.state] || ESTADO_DIA.planejado;
  const minutos = dia.sessions.reduce((t, s) => t + (s.duration_min || 0), 0);
  const aberto = plan.status !== PLAN_STATUS.CONCLUIDO;
  // Sem o diário carregado todo dia parece "pendente": registrar de novo duplicaria o treino.
  const podeRegistrar = dia.date <= hoje && aberto && diarioPronto;
  const registro = { // Biblioteca parcial: guarda o que o plano pede, não só o que chegou.
    item_ids: visiveis.isLoading || visiveis.incompleto ? (dia.slot?.item_ids || []) : items.map((i) => i.id), plan_id: plan.id, date: dia.date, title: dia.slot?.title || '' };

  return (
    <li className={cn('min-w-0 space-y-3 rounded-4xl border bg-paper-pure p-5', dia.state === 'hoje' ? 'border-ink' : 'border-gray-100')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-ink">{WEEKDAY_LONG[dia.day]}</p>
          <p className="text-sm text-gray-500">{formatDayLabel(dia.date, hoje)}</p>
        </div>
        <V2Badge tone={e.tom}>{dia.state === 'feito' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{e.texto}</V2Badge>
      </div>

      {editando ? (
        <EditarDia plan={plan} dia={dia} semana={semana} visiveis={visiveis} contexto={contexto} acoes={acoes} onFechar={() => setEditando(false)} />
      ) : (
        <>
          {items.length > 0 ? (
            <>
              <ol className="space-y-1.5">
                {items.map((it) => (
                  <li key={it.id}>
                    <Link to={`/treino/item/${it.id}`} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-2 py-1.5 hover:bg-gray-100">
                      <KindIcon kind={it.kind} size="sm" />
                      <span className="min-w-0 flex-1 line-clamp-2 text-sm leading-snug font-semibold text-ink">{it.title}</span>
                      {it.duration_min ? <span className="shrink-0 text-xs text-gray-500">{it.duration_min} min</span> : null}
                    </Link>
                  </li>
                ))}
              </ol>
              <TempoDoDia items={items} alvo={plan.minutes} />
            </>
          ) : (!missingIds.length && <p className="text-sm text-gray-500">Dia livre: escolha o que treinar.</p>)}
          {missingIds.length > 0 && !visiveis.isLoading && (
            <p className="text-xs text-gray-500">
              {missingIds.length === 1 ? 'Um item não está disponível' : `${missingIds.length} itens não estão disponíveis`}
              {visiveis.incompleto ? ' agora (parte da biblioteca não carregou).' : ' (apagado pelo autor ou fora da sua visão).'}
            </p>
          )}
          {dia.sessions.length > 0 && (
            <p className="text-sm text-gray-600">
              {dia.sessions.length === 1 ? 'Um treino registrado' : `${dia.sessions.length} treinos registrados`}{minutos ? ` · ${minutos} min` : ''}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {dia.date === hoje && aberto && items.length > 0 && (
              <V2Button size="sm" onClick={() => onTreinar({ items, registro })}>
                <Play className="h-4 w-4" aria-hidden="true" /> Treinar agora
              </V2Button>
            )}
            {aberto && (
              <V2Button size="sm" variant="secondary" onClick={() => setEditando(true)} data-dica="treino-plano-editar-dia">
                <Pencil className="h-4 w-4" aria-hidden="true" /> {items.length || missingIds.length ? 'Editar o dia' : 'Escolher o que treinar'}
              </V2Button>
            )}
            {podeRegistrar && (
              <V2Button size="sm" variant="ghost" onClick={() => onRegistrar(registro)}>
                <NotebookPen className="h-4 w-4" aria-hidden="true" /> Registrar
              </V2Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Plano({ plan, identity, planos, sessoes, visiveis, hoje }) {
  const navigate = useNavigate();
  const acoes = usePlanActions(identity, planos);
  const atual = currentPlanWeek(plan, hoje);
  const [semana, setSemana] = useState(atual || 1);
  const [apagar, setApagar] = useState(false);
  const [registro, setRegistro] = useState(null);
  const [quadra, setQuadra] = useState(null);
  const meta = useTrainingMeta(identity.uid);
  const { level } = useMyUnifiedLevel();
  const contexto = useMemo(() => ({ favorites: meta.data?.favorites || [], level }), [meta.data, level]);
  const lista = sessoes.isSuccess ? sessoes.data : [];
  const resumo = useMemo(() => planWeeksSummary(plan, lista), [plan, lista]);
  const dias = useMemo(() => planWeekView(plan, lista, semana, hoje), [plan, lista, semana, hoje]);
  const prog = sessoes.isSuccess ? planProgress(plan, lista, hoje) : null;
  const inicioSemana = addDays(plan.start_date, (semana - 1) * 7);

  const mudarStatus = (status, msg) => acoes.setStatus.mutate({ plan, status }, {
    onSuccess: () => toast.success(msg),
    onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível mudar agora.')),
  });

  return (
    <div className="space-y-6">
      <Voltar />
      <V2Surface className="space-y-5">
        <Cabecalho key={`${plan.title}:${plan.goal}`} plan={plan} acoes={acoes} />
        {prog && prog.total > 0 && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-full rounded-full bg-acid" style={{ width: `${prog.pct}%` }} />
            </div>
            <p className="text-sm text-gray-500">{prog.done} de {prog.total} treinos feitos{atual ? ` · semana ${atual} de ${plan.weeks}` : ''}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {plan.status === PLAN_STATUS.ATIVO && (
            <V2Button size="sm" variant="secondary" onClick={() => mudarStatus(PLAN_STATUS.PAUSADO, 'Plano pausado.')} disabled={acoes.setStatus.isPending}>
              <Pause className="h-4 w-4" aria-hidden="true" /> Pausar
            </V2Button>
          )}
          {plan.status !== PLAN_STATUS.ATIVO && (
            <V2Button size="sm" variant="secondary" onClick={() => mudarStatus(PLAN_STATUS.ATIVO, 'Plano ativo: ele aparece em “Hoje”.')} disabled={acoes.setStatus.isPending}>
              <Play className="h-4 w-4" aria-hidden="true" /> {plan.status === PLAN_STATUS.CONCLUIDO ? 'Reativar' : 'Retomar'}
            </V2Button>
          )}
          {plan.status !== PLAN_STATUS.CONCLUIDO && (
            <V2Button size="sm" variant="ghost" onClick={() => mudarStatus(PLAN_STATUS.CONCLUIDO, 'Plano concluído. Parabéns pela constância!')} disabled={acoes.setStatus.isPending}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Concluir
            </V2Button>
          )}
          <V2Button size="sm" variant="ghost" onClick={() => setApagar(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar
          </V2Button>
        </div>
        {plan.status !== PLAN_STATUS.ATIVO && planos.some((p) => p.status === PLAN_STATUS.ATIVO && p.id !== plan.id) && (
          <p className="text-xs text-gray-500">Ativar este plano pausa o que está ativo agora.</p>
        )}
      </V2Surface>

      {sessoes.isError && (
        <V2ErrorState inline title="O diário não carregou" description="O plano está aqui; o que já foi feito aparece quando o diário carregar." onRetry={() => sessoes.refetch()} />
      )}

      <section className="space-y-4" aria-label="Semanas do plano">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Escolher a semana" data-dica="treino-plano-semanas">
          {resumo.map((s) => (
            <V2FilterChip key={s.week} active={s.week === semana} aria-pressed={s.week === semana} onClick={() => setSemana(s.week)} className="px-3 py-1.5">
              Semana {s.week}
              {sessoes.isSuccess && s.done > 0 && <span className="ml-1 text-xs opacity-70">{s.done}/{s.total}</span>}
              {s.week === atual && <span className="sr-only"> (semana atual)</span>}
            </V2FilterChip>
          ))}
        </div>
        <p className="text-sm text-gray-500">{weekRangeLabel(inicioSemana)}{semana === atual ? ' · esta semana' : ''}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {dias.map((d) => (
            <Dia key={`${semana}-${d.day}`} plan={plan} dia={d} semana={semana} visiveis={visiveis} contexto={contexto} acoes={acoes} hoje={hoje} diarioPronto={sessoes.isSuccess} onRegistrar={setRegistro} onTreinar={setQuadra} />
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={apagar}
        onOpenChange={setApagar}
        title="Apagar este plano?"
        description="Os treinos já registrados no diário continuam lá; só o plano some."
        confirmLabel="Apagar o plano"
        pending={acoes.remove.isPending}
        onConfirm={() => acoes.remove.mutate(plan, {
          onSuccess: () => { toast.success('Plano apagado.'); navigate(VOLTAR); },
          onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível apagar agora.')),
        })}
      />
      <Suspense fallback={null}>
        {quadra && (
          <CourtMode
            blocks={courtBlocks(quadra.items, plan.minutes)}
            onClose={() => setQuadra(null)}
            onFinish={(seg) => {
              const { registro: base } = quadra;
              setQuadra(null);
              setRegistro({ ...base, duration_min: minutesFromSeconds(seg) || plan.minutes || null });
            }}
          />
        )}
        {registro && (
          <LogSessionDialog
            open={!!registro}
            onOpenChange={(o) => { if (!o) setRegistro(null); }}
            identity={identity}
            itemsById={visiveis.byId}
            initial={registro}
          />
        )}
      </Suspense>
    </div>
  );
}

function PlanoPage() {
  const { planId } = useParams();
  const identity = useTrainingIdentity();
  const planos = useMyTrainingPlans(identity.uid);
  const sessoes = useMyTrainingSessions(identity.uid);
  const visiveis = useVisibleTrainingItems(identity);
  const hoje = todayLocal();

  if (!identity.uid || planos.isPending) return <V2Skeleton className="h-96 rounded-4xl" />;
  if (planos.isError) {
    return (
      <div className="space-y-6">
        <Voltar />
        <V2Surface><V2ErrorState title="O plano não carregou" onRetry={() => planos.refetch()} /></V2Surface>
      </div>
    );
  }
  const plan = planos.data.find((p) => p.id === planId);
  if (!plan) {
    return (
      <div className="space-y-6">
        <Voltar />
        <V2Surface>
          <V2EmptyState
            icon={CalendarRange}
            title="Este plano não está entre os seus"
            description="Ele pode ter sido apagado. Os seus planos estão na aba Planos."
            action={<V2Button asChild variant="secondary"><Link to={VOLTAR}><Plus className="h-4 w-4" aria-hidden="true" /> Ver os planos</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }
  return <Plano key={plan.id} plan={plan} identity={identity} planos={planos.data} sessoes={sessoes} visiveis={visiveis} hoje={hoje} />;
}

export default function V2TrainingPlan() {
  return (
    <TrainingGate>
      <PlanoPage />
    </TrainingGate>
  );
}

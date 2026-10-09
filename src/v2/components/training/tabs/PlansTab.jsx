/**
 * Aba PLANOS: os planos da pessoa (ativo, pausados, concluídos), o progresso
 * de cada um e "Novo plano". Um plano ativo por vez — é ele que o "Hoje" lê.
 *
 * `?adicionar=<itemId>` (vindo da ficha de um item): põe o item num dia do
 * plano ativo, com o dia escolhido pela pessoa; sem plano ativo, oferece criar
 * um já com o item.
 *
 * Falha ≠ vazio: "Você ainda não tem um plano" só com a lista carregada.
 */
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarPlus, CalendarRange, ChevronRight, Plus, X } from 'lucide-react';
import { useMyTrainingPlans, usePlanActions } from '@/modules/training/hooks/useTrainingPlans';
import { useMyTrainingSessions } from '@/modules/training/hooks/useTrainingSessions';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import {
  PLAN_STATUS, PLAN_STATUS_LABELS, currentPlanWeek, planProgress, slotDate,
} from '@/modules/training/domain/plan';
import { WEEK_ORDER, addItemToSlot, nextPlanSlot } from '@/modules/training/domain/treinar';
import { WEEKDAY_LONG, formatDayLabel, todayLocal } from '@/modules/training/domain/dates';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

const CreatePlanDialog = lazy(() => import('@/v2/components/training/plan/CreatePlanDialog'));

const ORDEM = [PLAN_STATUS.ATIVO, PLAN_STATUS.PAUSADO, PLAN_STATUS.CONCLUIDO];
const TOM = { [PLAN_STATUS.ATIVO]: 'acid', [PLAN_STATUS.PAUSADO]: 'amber', [PLAN_STATUS.CONCLUIDO]: 'neutral' };

function PlanCard({ plan, sessoes, hoje }) {
  const semana = plan.status === PLAN_STATUS.ATIVO ? currentPlanWeek(plan, hoje) : null;
  const prog = sessoes ? planProgress(plan, sessoes, hoje) : null;
  return (
    <Link
      to={`/treino/planos/${plan.id}`}
      className="group flex items-center gap-4 rounded-4xl border border-gray-100 bg-paper-pure p-5 transition hover:border-gray-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone={TOM[plan.status]}>{PLAN_STATUS_LABELS[plan.status]}</V2Badge>
          {semana && <span className="text-xs font-semibold text-gray-500">Semana {semana} de {plan.weeks}</span>}
        </div>
        <h3 className="font-display text-lg font-bold text-ink">{plan.title}</h3>
        {plan.goal && <p className="line-clamp-2 text-sm text-gray-500">{plan.goal}</p>}
        <p className="text-sm text-gray-500">
          {plan.weeks} {plan.weeks === 1 ? 'semana' : 'semanas'} · {plan.days.length} {plan.days.length === 1 ? 'dia' : 'dias'} por semana · {plan.minutes} min
        </p>
        {prog && prog.total > 0 && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-full rounded-full bg-acid" style={{ width: `${prog.pct}%` }} />
            </div>
            <p className="text-xs text-gray-500">{prog.done} de {prog.total} treinos feitos</p>
          </div>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 group-hover:text-ink" aria-hidden="true" />
    </Link>
  );
}

/** "Pôr no meu treino": o item vindo da ficha entra num dia do plano ativo. */
function AdicionarAoPlano({ itemId, item, ativo, acoes, onCriar, onFechar, hoje, carregandoItem }) {
  const padrao = ativo ? nextPlanSlot(ativo, hoje) : null;
  const [escolha, setEscolha] = useState(() => (padrao ? `${padrao.week}-${padrao.day}` : ''));
  const [erro, setErro] = useState('');
  const titulo = item?.title || (carregandoItem ? 'Carregando…' : 'Este item');

  const opcoes = useMemo(() => {
    if (!ativo) return [];
    const out = [];
    for (let week = 1; week <= ativo.weeks; week += 1) {
      for (const day of WEEK_ORDER.filter((d) => ativo.days.includes(d))) {
        const date = slotDate(ativo, { week, day });
        if (date >= hoje || (padrao && padrao.week === week && padrao.day === day)) {
          out.push({ value: `${week}-${day}`, label: `Semana ${week} · ${WEEKDAY_LONG[day]}, ${formatDayLabel(date, hoje).split(', ')[1]}` });
        }
      }
    }
    return out;
  }, [ativo, hoje, padrao]);

  const salvar = () => {
    const [week, day] = escolha.split('-').map(Number);
    const r = addItemToSlot(ativo, { week, day }, itemId);
    if (!r.ok) { setErro(r.error); return; }
    acoes.update.mutate({ plan: ativo, input: { slots: r.slots } }, {
      onSuccess: () => { toast.success('Item colocado no plano.'); onFechar(); },
      onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível salvar agora.')),
    });
  };

  return (
    <V2Surface className="space-y-4 border-acid/40" data-dica="treino-planos-adicionar">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pôr no meu treino</p>
          <h2 className="mt-1 font-display text-lg font-bold text-ink">{titulo}</h2>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {ativo ? (
        <>
          <label className="block space-y-1 text-sm font-semibold text-ink">
            Em que dia do plano “{ativo.title}”?
            <V2Select value={escolha} onChange={(e) => { setErro(''); setEscolha(e.target.value); }}>
              {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </V2Select>
          </label>
          {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            <V2Button onClick={salvar} disabled={!escolha || acoes.update.isPending}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {acoes.update.isPending ? 'Salvando…' : 'Colocar neste dia'}
            </V2Button>
            <V2Button variant="ghost" onClick={onCriar}>Criar outro plano com ele</V2Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">Você não tem um plano ativo. Crie um e este item entra no primeiro dia.</p>
          <V2Button onClick={onCriar}><Plus className="h-4 w-4" aria-hidden="true" /> Criar plano com este item</V2Button>
        </>
      )}
    </V2Surface>
  );
}

export default function PlansTab({ identity, params, irPara }) {
  const hoje = todayLocal();
  const planos = useMyTrainingPlans(identity.uid);
  const sessoes = useMyTrainingSessions(identity.uid);
  const visiveis = useVisibleTrainingItems(identity);
  const meta = useTrainingMeta(identity.uid);
  const lista = planos.data || [];
  const acoes = usePlanActions(identity, lista);
  const [criar, setCriar] = useState(false);
  const adicionar = params.get('adicionar');
  const ativo = lista.find((p) => p.status === PLAN_STATUS.ATIVO) || null;

  const grupos = useMemo(() => ORDEM
    .map((status) => ({
      status,
      planos: lista.filter((p) => p.status === status)
        .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date))),
    }))
    .filter((g) => g.planos.length), [lista]);

  if (planos.isPending) return <V2Skeleton className="h-72 rounded-4xl" />;
  if (planos.isError) {
    return (
      <V2Surface>
        <V2ErrorState title="Os seus planos não carregaram" onRetry={() => planos.refetch()} />
      </V2Surface>
    );
  }

  return (
    <div className="space-y-6">
      {adicionar && (
        <AdicionarAoPlano
          key={`${adicionar}:${ativo?.id || ''}`}
          itemId={adicionar}
          item={visiveis.byId[adicionar]}
          carregandoItem={visiveis.isLoading}
          ativo={ativo}
          acoes={acoes}
          hoje={hoje}
          onCriar={() => setCriar(true)}
          onFechar={() => irPara('planos')}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-500">
          Um plano dá a cada dia de treino o que fazer, por algumas semanas. O plano ativo é o que aparece em “Hoje”.
        </p>
        <V2Button onClick={() => setCriar(true)} data-dica="treino-planos-criar">
          <Plus className="h-4 w-4" aria-hidden="true" /> Novo plano
        </V2Button>
      </div>

      {sessoes.isError && (
        <V2ErrorState inline title="O progresso dos planos não carregou" description="Os planos estão aqui; o quanto já foi feito aparece quando o diário carregar." onRetry={() => sessoes.refetch()} />
      )}

      {podeAfirmarVazio(planos) && lista.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={CalendarRange}
            title="Você ainda não tem um plano"
            description="Diga em que dias treina e por quanto tempo; o assistente monta as semanas com drills da biblioteca, e você ajusta o que quiser."
            action={<V2Button onClick={() => setCriar(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Criar o primeiro plano</V2Button>}
          />
        </V2Surface>
      ) : (
        grupos.map((g) => (
          <section key={g.status} className="space-y-3" aria-label={PLAN_STATUS_LABELS[g.status]}>
            {g.status !== PLAN_STATUS.ATIVO && (
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {g.status === PLAN_STATUS.PAUSADO ? 'Pausados' : 'Concluídos'}
              </h2>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {g.planos.map((p) => <PlanCard key={p.id} plan={p} sessoes={sessoes.isSuccess ? sessoes.data : null} hoje={hoje} />)}
            </div>
          </section>
        ))
      )}

      <Suspense fallback={null}>
        {criar && (
          <CreatePlanDialog
            open={criar}
            onOpenChange={setCriar}
            identity={identity}
            plans={lista}
            visiveis={visiveis}
            routine={meta.data?.routine || null}
            firstItemId={adicionar || null}
          />
        )}
      </Suspense>
    </div>
  );
}

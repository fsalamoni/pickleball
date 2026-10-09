/**
 * Aba HOJE do treino: o que treinar hoje, numa resposta só (`todaySession`):
 * o dia do plano ativo, o que o professor mandou, ou uma sugestão pela rotina
 * e pelo nível. "Começar" abre o Modo quadra; "Registrar" abre o diário.
 *
 * Falha ≠ vazio: sem os planos não dá para saber o dia do plano, então a aba
 * diz que não carregou em vez de sugerir outra coisa; as outras fontes que
 * falham viram aviso do que ficou de fora.
 */
import React, { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, GraduationCap, Library, NotebookPen, Play, RefreshCw, Settings2, Sparkles, Sun,
} from 'lucide-react';
import { useMyTrainingSessions } from '@/modules/training/hooks/useTrainingSessions';
import { useTodaySession } from '@/modules/training/hooks/useTodaySession';
import { TODAY_SOURCE } from '@/modules/training/domain/today';
import { plannedByDate } from '@/modules/training/domain/plan';
import { weekSummary } from '@/modules/training/domain/session';
import { weekKeyOf, WEEKDAY_SHORT } from '@/modules/training/domain/dates';
import { courtBlocks, minutesFromSeconds } from '@/modules/training/domain/treinar';
import { PLACE_LABELS, SKILL_AREA_LABELS } from '@/modules/training/domain/taxonomy';
import {
  V2Button, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import ItemCard from '@/v2/components/training/ItemCard';
import WeekStrip from '@/v2/components/training/WeekStrip';
import RoutineEditor from '@/v2/components/training/today/RoutineEditor';

const CourtMode = lazy(() => import('@/v2/components/training/today/CourtMode'));
const LogSessionDialog = lazy(() => import('@/v2/components/training/LogSessionDialog'));

const ORIGEM = {
  [TODAY_SOURCE.PLANO]: { icon: CalendarDays, texto: 'Do seu plano' },
  [TODAY_SOURCE.PROFESSOR]: { icon: GraduationCap, texto: 'Do seu professor' },
  [TODAY_SOURCE.RECOMENDACAO]: { icon: Sparkles, texto: 'Sugestão para você' },
  [TODAY_SOURCE.DESCANSO]: { icon: Sun, texto: 'Dia de descanso' },
  [TODAY_SOURCE.VAZIO]: { icon: Library, texto: 'Monte o seu treino' },
};

function ResumoRotina({ routine }) {
  const dias = (routine.days || []).map((d) => WEEKDAY_SHORT[d]).join(', ');
  const partes = [dias, `${routine.minutes} min`];
  if (routine.place) partes.push(PLACE_LABELS[routine.place]);
  if (routine.focus?.length) partes.push(`foco: ${routine.focus.map((f) => SKILL_AREA_LABELS[f] || f).join(', ')}`);
  return <span>{partes.join(' · ')}</span>;
}

export default function TodayTab({ identity, irPara }) {
  const sessoes = useMyTrainingSessions(identity.uid);
  const [variacao, setVariacao] = useState(0);
  const [forcar, setForcar] = useState(false);
  const [editRotina, setEditRotina] = useState(false);
  const [quadra, setQuadra] = useState(false);
  const [registro, setRegistro] = useState(null);

  const {
    hoje, sessao, items, missingIds, minutos, ativo, routine, visiveis, planos, inbox, meta, isLoading,
  } = useTodaySession(identity, { variacao, forcar });

  if (isLoading) return <V2Skeleton className="h-72 rounded-4xl" />;
  if (planos.isError) {
    return (
      <V2Surface>
        <V2ErrorState
          title="Não foi possível montar o treino de hoje"
          description="Os seus planos não carregaram, então ainda não dá para saber o que estava marcado para hoje."
          onRetry={() => planos.refetch()}
        />
      </V2Surface>
    );
  }

  const origem = ORIGEM[sessao.source];
  const OrigemIcon = origem.icon;
  const semRotina = meta.isSuccess && !routine;
  // "Monte o seu treino" só é afirmado com a biblioteca inteira na mão.
  const vazioIncerto = sessao.source === TODAY_SOURCE.VAZIO && visiveis.incompleto;
  const resumo = sessoes.isSuccess
    ? weekSummary({ weekKey: weekKeyOf(hoje), sessions: sessoes.data, plannedByDate: plannedByDate(ativo), today: hoje })
    : null;
  const abrirRegistro = (extra = {}) => setRegistro({
    item_ids: items.map((i) => i.id),
    plan_id: sessao.source === TODAY_SOURCE.PLANO ? ativo?.id : null,
    title: sessao.source === TODAY_SOURCE.RECOMENDACAO || sessao.source === TODAY_SOURCE.PLANO ? sessao.title : '',
    ...extra,
  });

  return (
    <div className="space-y-6">
      {(inbox.isError || meta.isError || visiveis.incompleto) && (
        <V2ErrorState
          inline
          title="Parte do seu treino não carregou"
          description={`Ficou de fora: ${[
            inbox.isError && 'o que o professor mandou',
            meta.isError && 'a sua rotina',
            visiveis.incompleto && 'uma parte da biblioteca',
          ].filter(Boolean).join(', ')}.`}
          onRetry={() => { inbox.refetch(); meta.refetch(); visiveis.refetch(); }}
        />
      )}

      <V2Surface className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
              <OrigemIcon className="h-4 w-4" aria-hidden="true" /> {origem.texto}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">{sessao.title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {sessao.note}
              {minutos ? ` · cerca de ${minutos} min` : ''}
            </p>
          </div>
          {sessao.source === TODAY_SOURCE.RECOMENDACAO && (
            <V2Button variant="ghost" size="sm" onClick={() => setVariacao((v) => v + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Outra sugestão
            </V2Button>
          )}
        </div>

        {sessao.source === TODAY_SOURCE.DESCANSO && (
          <div className="flex flex-wrap gap-2">
            <V2Button variant="secondary" onClick={() => setForcar(true)}>Treinar mesmo assim</V2Button>
            <V2Button variant="ghost" onClick={() => abrirRegistro({ item_ids: [], title: '' })}>
              <NotebookPen className="h-4 w-4" aria-hidden="true" /> Registrar outro treino
            </V2Button>
          </div>
        )}

        {sessao.source === TODAY_SOURCE.VAZIO && (vazioIncerto ? (
          <p className="text-sm text-gray-500">A biblioteca não carregou inteira; tente de novo para ver uma sugestão.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <V2Button variant="secondary" onClick={() => irPara('biblioteca')}>Ver a biblioteca</V2Button>
            <V2Button variant="ghost" onClick={() => setEditRotina(true)}>Ajustar a rotina</V2Button>
          </div>
        ))}

        {items.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((it) => <ItemCard key={it.id} item={it} />)}
          </div>
        )}
        {missingIds.length > 0 && !visiveis.isLoading && (
          <p className="text-sm text-gray-500">
            {missingIds.length === 1 ? 'Um item deste treino não está disponível' : `${missingIds.length} itens deste treino não estão disponíveis`}
            {visiveis.incompleto ? ' agora (parte da biblioteca não carregou).' : ' (apagado pelo autor ou fora da sua visão).'}
          </p>
        )}

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <V2Button size="lg" onClick={() => setQuadra(true)} data-dica="treino-hoje-comecar">
              <Play className="h-5 w-5" aria-hidden="true" /> Começar
            </V2Button>
            <V2Button size="lg" variant="secondary" onClick={() => abrirRegistro()} data-dica="treino-hoje-registrar">
              <NotebookPen className="h-5 w-5" aria-hidden="true" /> Já fiz, registrar
            </V2Button>
          </div>
        )}
      </V2Surface>

      {resumo && (
        <V2Surface className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">Esta semana</h2>
            <p className="text-sm text-gray-500">
              {resumo.sessionsCount} {resumo.sessionsCount === 1 ? 'treino' : 'treinos'} · {resumo.minutes} min
            </p>
          </div>
          <WeekStrip summary={resumo} />
          <Link to="/treino?aba=diario" className="inline-block text-sm font-semibold text-ink underline underline-offset-4">Abrir o diário</Link>
        </V2Surface>
      )}
      {sessoes.isError && <V2ErrorState inline title="O resumo da semana não carregou" onRetry={() => sessoes.refetch()} />}

      {(semRotina || editRotina) ? (
        <V2Surface className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{semRotina ? 'Conte como é a sua rotina' : 'Sua rotina'}</h2>
            <p className="mt-1 text-sm text-gray-500">Com ela, o “Hoje” sugere um treino do seu tamanho nos dias em que você treina.</p>
          </div>
          <RoutineEditor uid={identity.uid} routine={routine} onDone={() => setEditRotina(false)} onCancel={editRotina ? () => setEditRotina(false) : undefined} />
        </V2Surface>
      ) : routine && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-gray-600">Sua rotina:</span> <ResumoRotina routine={routine} />
          <V2Button variant="ghost" size="sm" onClick={() => setEditRotina(true)}>
            <Settings2 className="h-4 w-4" aria-hidden="true" /> Ajustar
          </V2Button>
        </p>
      )}

      <Suspense fallback={null}>
        {quadra && (
          <CourtMode
            blocks={courtBlocks(items, minutos)}
            onClose={() => setQuadra(false)}
            onFinish={(seg) => { setQuadra(false); abrirRegistro({ duration_min: minutesFromSeconds(seg) || minutos || null }); }}
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

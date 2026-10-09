/**
 * Aba DIÁRIO: os treinos registrados, por semana, com a semana atual em sete
 * bolinhas. Registrar, editar, apagar; e, quando a sessão foi mostrada a um
 * professor, a conversa sobre ela (`SessionComments`) e o selo de que ele viu.
 *
 * `?registrar=<itemId>` (vindo da ficha de um item) abre o registro já com o
 * item. Falha ≠ vazio: "nenhum treino registrado" só com a lista carregada.
 */
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BadgeCheck, MessageCircle, NotebookPen, Pencil, Plus, Trash2,
} from 'lucide-react';
import { useMyTrainingSessions, useSessionActions } from '@/modules/training/hooks/useTrainingSessions';
import { useMyTrainingPlans } from '@/modules/training/hooks/useTrainingPlans';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import {
  SESSION_KIND_LABELS, SESSION_STATUS, SESSION_STATUS_LABELS, sessionLoad, sortSessions, weekSummary,
} from '@/modules/training/domain/session';
import { PLAN_STATUS, plannedByDate } from '@/modules/training/domain/plan';
import { sessionsByWeek, weekRangeLabel } from '@/modules/training/domain/treinar';
import { rpeLabel } from '@/modules/training/domain/taxonomy';
import { formatDayLabel, todayLocal, weekKeyOf } from '@/modules/training/domain/dates';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import WeekStrip from '@/v2/components/training/WeekStrip';
import SessionComments from '@/v2/components/training/SessionComments';
import { ConfirmDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

const LogSessionDialog = lazy(() => import('@/v2/components/training/LogSessionDialog'));

const SEMANAS_POR_VEZ = 6;

function Sessao({ s, hoje, byId, itensIncompletos, coachName, identity, onEditar, onApagar }) {
  const [conversa, setConversa] = useState(false);
  const carga = sessionLoad(s);
  return (
    <li className="space-y-3 rounded-4xl border border-gray-100 bg-paper-pure p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{formatDayLabel(s.date, hoje)} · {SESSION_KIND_LABELS[s.kind] || 'Treino'}</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">{s.title}</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            {s.duration_min} min
            {Number.isFinite(s.rpe) ? ` · esforço ${s.rpe} (${rpeLabel(s.rpe).toLowerCase()})` : ''}
            {carga !== null ? ` · carga ${carga}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.status !== SESSION_STATUS.FEITO && <V2Badge>{SESSION_STATUS_LABELS[s.status]}</V2Badge>}
          {s.coach_confirmed_at && (
            <V2Badge tone="green"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> {coachName ? `${coachName} viu` : 'O professor viu'}</V2Badge>
          )}
        </div>
      </div>

      {s.item_ids?.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Itens do treino">
          {s.item_ids.map((id) => (
            <li key={id}>
              {byId[id] ? (
                <Link to={`/treino/item/${id}`} className="inline-block rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-ink hover:bg-gray-100">{byId[id].title}</Link>
              ) : (
                <span className="inline-block rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-400">{itensIncompletos ? 'Item (não carregou)' : 'Item indisponível'}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {s.notes && <p className="whitespace-pre-line text-sm text-gray-700">{s.notes}</p>}
      {s.shared_coach_id && (
        <p className="text-xs text-gray-500">Visível para {coachName || 'o seu professor'}.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <V2Button size="sm" variant="ghost" onClick={() => onEditar(s)}><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</V2Button>
        <V2Button size="sm" variant="ghost" onClick={() => onApagar(s)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar</V2Button>
        {s.shared_coach_id && (
          <V2Button size="sm" variant="ghost" aria-expanded={conversa} onClick={() => setConversa((c) => !c)}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> {conversa ? 'Fechar a conversa' : 'Conversa com o professor'}
          </V2Button>
        )}
      </div>
      {conversa && <SessionComments session={s} identity={identity} />}
    </li>
  );
}

export default function DiaryTab({ identity, params, irPara }) {
  const hoje = todayLocal();
  const sessoes = useMyTrainingSessions(identity.uid);
  const planos = useMyTrainingPlans(identity.uid);
  const visiveis = useVisibleTrainingItems(identity);
  const acoes = useSessionActions(identity);
  const { people } = usePeople(identity.activeCoachIds);
  const [semanas, setSemanas] = useState(SEMANAS_POR_VEZ);
  const [registro, setRegistro] = useState(null); // { initial } | { session }
  const [apagar, setApagar] = useState(null);
  const registrar = params.get('registrar');

  // Vindo da ficha de um item: abre o registro uma vez e limpa a URL ao fechar.
  useEffect(() => {
    if (registrar) setRegistro({ initial: { item_ids: [registrar] }, daUrl: true });
  }, [registrar]);

  const lista = useMemo(() => sortSessions(sessoes.data || []), [sessoes.data]);
  const porSemana = useMemo(() => sessionsByWeek(lista), [lista]);
  const ativo = (planos.data || []).find((p) => p.status === PLAN_STATUS.ATIVO) || null;
  const resumo = sessoes.isSuccess
    ? weekSummary({ weekKey: weekKeyOf(hoje), sessions: lista, plannedByDate: plannedByDate(ativo), today: hoje })
    : null;

  const fecharRegistro = () => {
    if (registro?.daUrl) irPara('diario');
    setRegistro(null);
  };

  const botaoRegistrar = (
    <V2Button onClick={() => setRegistro({ initial: {} })} data-dica="treino-diario-registrar">
      <Plus className="h-4 w-4" aria-hidden="true" /> Registrar treino
    </V2Button>
  );

  let corpo;
  if (sessoes.isPending) corpo = <V2Skeleton className="h-72 rounded-4xl" />;
  else if (sessoes.isError) {
    corpo = <V2Surface><V2ErrorState title="O seu diário não carregou" onRetry={() => sessoes.refetch()} /></V2Surface>;
  } else if (podeAfirmarVazio(sessoes) && lista.length === 0) {
    corpo = (
      <V2Surface>
        <V2EmptyState
          icon={NotebookPen}
          title="Nenhum treino registrado ainda"
          description="Registrar leva poucos segundos: quanto tempo durou e quão puxado foi. Com algumas semanas, a aba Evolução mostra o seu ritmo."
          action={botaoRegistrar}
        />
      </V2Surface>
    );
  } else {
    corpo = (
      <div className="space-y-8">
        {porSemana.slice(0, semanas).map((g) => {
          const min = g.sessions.reduce((t, s) => t + (s.duration_min || 0), 0);
          return (
            <section key={g.weekKey} className="space-y-3" aria-label={`Semana de ${weekRangeLabel(g.weekKey)}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold text-ink">{g.weekKey === weekKeyOf(hoje) ? 'Esta semana' : weekRangeLabel(g.weekKey)}</h2>
                <p className="text-xs text-gray-500">{g.sessions.length} {g.sessions.length === 1 ? 'treino' : 'treinos'} · {min} min</p>
              </div>
              <ul className="space-y-3">
                {g.sessions.map((s) => (
                  <Sessao
                    key={s.id}
                    s={s}
                    hoje={hoje}
                    byId={visiveis.byId}
                    itensIncompletos={visiveis.isLoading || visiveis.incompleto}
                    coachName={people.get(s.shared_coach_id)?.name}
                    identity={identity}
                    onEditar={(x) => setRegistro({ session: x })}
                    onApagar={setApagar}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {porSemana.length > semanas && (
          <div className="flex justify-center">
            <V2Button variant="secondary" onClick={() => setSemanas((n) => n + SEMANAS_POR_VEZ)}>Mostrar semanas anteriores</V2Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-500">O que você treinou, semana a semana. Só você vê — a não ser a sessão que você escolher mostrar ao seu professor.</p>
        {botaoRegistrar}
      </div>

      {resumo && (
        <V2Surface className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">Esta semana</h2>
            <p className="text-sm text-gray-500">{resumo.sessionsCount} {resumo.sessionsCount === 1 ? 'treino' : 'treinos'} · {resumo.minutes} min</p>
          </div>
          <WeekStrip summary={resumo} />
          {planos.isError && <p className="text-xs text-gray-500">Os planos não carregaram; os dias planejados não aparecem.</p>}
        </V2Surface>
      )}

      {corpo}

      <ConfirmDialog
        open={!!apagar}
        onOpenChange={(o) => { if (!o) setApagar(null); }}
        title="Apagar este registro?"
        description="Ele sai do diário e da evolução. A conversa com o professor sobre ele também é apagada."
        confirmLabel="Apagar"
        pending={acoes.remove.isPending}
        onConfirm={() => acoes.remove.mutate(apagar, {
          onSuccess: () => { toast.success('Registro apagado.'); setApagar(null); },
          onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível apagar agora.')),
        })}
      />
      <Suspense fallback={null}>
        {registro && (
          <LogSessionDialog
            open={!!registro}
            onOpenChange={(o) => { if (!o) fecharRegistro(); }}
            identity={identity}
            itemsById={visiveis.byId}
            initial={registro.initial}
            session={registro.session || null}
          />
        )}
      </Suspense>
    </div>
  );
}

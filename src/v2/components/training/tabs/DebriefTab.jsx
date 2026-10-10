/**
 * Aba BALANÇO (flag `game_debrief`): depois de jogar, a pessoa conta como foi
 * e a plataforma sugere a semana de treino. É opcional POR PESSOA — enquanto
 * ela não liga, a aba só explica e oferece ligar, sem ler jogo nenhum.
 *
 * Ligado: os jogos que pedem balanço (dia de jogo, torneio, reserva dos
 * últimos 7 dias, só depois de terminados), o "balanço de outro jogo", o que
 * se repete nos balanços e o histórico. Consulta que falhou é aviso, nunca
 * "nenhum jogo".
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardCheck, Plus } from 'lucide-react';
import {
  useDebriefActions, useDebriefSettings, usePendingDebriefs,
} from '@/modules/training/hooks/useDebriefs';
import {
  DEBRIEF_RATING_LABELS, DEBRIEF_SOURCE_LABELS, EVOLUTION_LABELS, answeredDebriefs, aspectLabel, debriefTrends,
} from '@/modules/training/domain/debrief';
import { formatDayLabel, todayLocal } from '@/modules/training/domain/dates';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';
import DebriefDialog from '@/v2/components/training/debrief/DebriefDialog';

const HISTORICO = 12;

function Ligar({ uid }) {
  const { setEnabled } = useDebriefActions(uid);
  return (
    <V2Surface>
      <V2EmptyState
        icon={ClipboardCheck}
        title="Balanço do jogo"
        description="Depois de um dia de jogo, de um torneio ou de um jogo na arena, você conta em um minuto como foi, o que funcionou e o que faltou. A plataforma sugere drills para a semana, e você escolhe se eles entram nos seus treinos. Só você vê as respostas."
        action={(
          <V2Button
            data-dica="treino-balanco-ligar"
            disabled={setEnabled.isPending}
            onClick={() => setEnabled.mutate(true, {
              onSuccess: () => toast.success('Balanço ligado. Os próximos jogos aparecem aqui.'),
              onError: () => toast.error('Não foi possível ligar agora. Tente de novo.'),
            })}
          >
            {setEnabled.isPending ? 'Ligando…' : 'Ligar para mim'}
          </V2Button>
        )}
      />
    </V2Surface>
  );
}

function Tendencias({ trends }) {
  const subiu = trends.previousAverage !== null && trends.recentAverage !== null
    ? Math.round((trends.recentAverage - trends.previousAverage) * 10) / 10
    : null;
  return (
    <V2Surface>
      <h2 className="font-display text-xl font-bold text-ink">O que se repete</h2>
      <p className="mt-1 text-sm text-gray-500">
        {`${trends.total} ${trends.total === 1 ? 'balanço' : 'balanços'} · nota média ${String(trends.average).replace('.', ',')}`}
        {subiu ? ` · ${subiu > 0 ? '+' : ''}${String(subiu).replace('.', ',')} nos últimos 5` : ''}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Mais falta</p>
          {trends.weaknesses.length ? (
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {trends.weaknesses.map((w) => <li key={w.id}>{w.label} <span className="text-gray-400">({w.count}×)</span></li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-gray-500">Nada marcado ainda.</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Mais funciona</p>
          {trends.strengths.length ? (
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {trends.strengths.map((s) => <li key={s.id}>{s.label} <span className="text-gray-400">({s.count}×)</span></li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-gray-500">Nada marcado ainda.</p>}
        </div>
      </div>
    </V2Surface>
  );
}

export default function DebriefTab({ identity }) {
  const hoje = todayLocal();
  const settings = useDebriefSettings();
  const pend = usePendingDebriefs();
  const acoes = useDebriefActions(identity.uid);
  const [aberto, setAberto] = useState(null); // { source, initial? }; source nulo = jogo avulso

  const respondidos = useMemo(() => answeredDebriefs(pend.debriefs), [pend.debriefs]);
  const trends = useMemo(() => debriefTrends(pend.debriefs), [pend.debriefs]);

  if (settings.isLoading) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (settings.isError) {
    return <V2Surface><V2ErrorState title="Não deu para saber se o balanço está ligado" onRetry={() => settings.refetch()} /></V2Surface>;
  }
  if (!settings.enabled) return <Ligar uid={identity.uid} />;

  const dispensar = (source) => acoes.skip.mutate(source, {
    onError: () => toast.error('Não foi possível dispensar agora. Tente de novo.'),
  });

  return (
    <div className="space-y-6">
      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-ink">Jogos esperando balanço</h2>
            <p className="mt-1 text-sm text-gray-500">Dos últimos 7 dias, depois que o jogo termina.</p>
          </div>
          <V2Button size="sm" variant="secondary" data-dica="treino-balanco-avulso" onClick={() => setAberto({ source: null })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Balanço de outro jogo
          </V2Button>
        </div>
        <div className="mt-4" data-dica="treino-balanco-pendentes">
          {pend.isLoading ? (
            <V2Skeleton className="h-24 rounded-3xl" />
          ) : pend.isError ? (
            <V2ErrorState inline title="Os seus jogos recentes não carregaram" onRetry={pend.refetch} />
          ) : pend.pending.length ? (
            <ul className="space-y-2">
              {pend.pending.map((p) => (
                <li key={`${p.type}_${p.ref_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.title}</p>
                    <p className="text-xs text-gray-500">{DEBRIEF_SOURCE_LABELS[p.type]} · {formatDayLabel(p.date, hoje)}</p>
                  </div>
                  <div className="flex gap-2">
                    <V2Button size="sm" variant="ghost" disabled={acoes.skip.isPending} onClick={() => dispensar(p)}>Agora não</V2Button>
                    <V2Button size="sm" onClick={() => setAberto({ source: p })}>Fazer o balanço</V2Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhum jogo esperando. Depois do próximo dia de jogo, torneio ou reserva, ele aparece aqui e no seu início.</p>
          )}
          {pend.incompleto.length > 0 && !pend.isError && (
            <p className="mt-3 text-xs text-amber-700">Ficou de fora porque não carregou: {pend.incompleto.join(', ').toLowerCase()}.</p>
          )}
        </div>
      </V2Surface>

      {trends && <Tendencias trends={trends} />}

      {respondidos.length > 0 && (
        <V2Surface>
          <h2 className="font-display text-xl font-bold text-ink">Seus balanços</h2>
          <ul className="mt-4 space-y-3">
            {respondidos.slice(0, HISTORICO).map((d) => (
              <li key={d.id} className="rounded-3xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{d.source?.title}</p>
                    <p className="text-xs text-gray-500">{DEBRIEF_SOURCE_LABELS[d.source?.type] || 'Jogo'} · {formatDayLabel(d.source?.date, hoje)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <V2Badge tone="ink">{d.rating} · {DEBRIEF_RATING_LABELS[d.rating]}</V2Badge>
                    <V2Badge>{EVOLUTION_LABELS[d.evolution] || EVOLUTION_LABELS.nao_sei}</V2Badge>
                  </div>
                </div>
                {(d.strengths?.length > 0 || d.weaknesses?.length > 0) && (
                  <p className="mt-2 text-xs text-gray-600">
                    {d.strengths?.length > 0 && <>Funcionou: {d.strengths.map(aspectLabel).join(', ')}. </>}
                    {d.weaknesses?.length > 0 && <>Faltou: {d.weaknesses.map(aspectLabel).join(', ')}.</>}
                  </p>
                )}
                {d.note && <p className="mt-2 text-xs italic text-gray-500">“{d.note}”</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {d.applied?.plan_id ? (
                    <Link className="text-xs font-semibold text-ink underline" to={`/treino/planos/${d.applied.plan_id}`}>
                      A sugestão entrou nos treinos
                    </Link>
                  ) : <span className="text-xs text-gray-400">Sugestão não adicionada</span>}
                  <V2Button size="sm" variant="ghost" onClick={() => setAberto({ source: d.source, initial: d })}>Refazer</V2Button>
                </div>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}

      <V2Surface>
        <V2Toggle
          id="balanco-ligado"
          checked
          label="Balanço do jogo ligado"
          hint="Desligado, a plataforma para de perguntar. Os balanços feitos continuam aqui."
          onChange={() => acoes.setEnabled.mutate(false, {
            onError: () => toast.error('Não foi possível desligar agora. Tente de novo.'),
          })}
        />
      </V2Surface>

      {aberto && (
        <DebriefDialog
          open
          onOpenChange={(o) => { if (!o) setAberto(null); }}
          identity={identity}
          source={aberto.source}
          history={pend.debriefs}
          initial={aberto.initial || null}
        />
      )}
    </div>
  );
}

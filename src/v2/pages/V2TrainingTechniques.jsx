/**
 * V2TrainingTechniques — a TRILHA DOS GOLPES (`/treino/golpes`): os golpes e
 * movimentos do pickleball numa ordem de aprender, em famílias, com o quanto a
 * pessoa já domina de cada um e o golpe para continuar.
 *
 * A conta é `buildTechniqueTrail` (domínio). O domínio de cada golpe é o que a
 * pessoa marca na ficha ("Aprendendo", "Consistente", "Dominado"); se ele não
 * carregou, a trilha aparece sem ele — nunca como "nada dominado".
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Route } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import { MASTERY, MASTERY_LABELS } from '@/modules/training/domain/evolution';
import { buildTechniqueTrail } from '@/modules/training/domain/techniqueTrail';
import { itemMetaLine } from '@/modules/training/domain/trainingItem';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import TrainingGate from '@/v2/components/training/TrainingGate';
import { rolarAte } from '@/v2/ui/rolarAte';

const menosMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const TOM = { [MASTERY.DOMINADO]: 'green', [MASTERY.CONSISTENTE]: 'acid', [MASTERY.APRENDENDO]: 'amber' };

function Voltar() {
  return (
    <Link to="/treino?aba=biblioteca" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Biblioteca
    </Link>
  );
}

function Barra({ feitos, total, className }) {
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-gray-100', className)} aria-hidden="true">
      <div className="h-full rounded-full bg-acid" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Golpe({ item, mastery, ordem, comDominio }) {
  return (
    <li>
      <Link
        to={`/treino/item/${item.id}`}
        className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure px-4 py-3 transition-colors hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            mastery === MASTERY.DOMINADO ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500',
          )}
        >
          {mastery === MASTERY.DOMINADO ? <Check className="h-4 w-4" /> : ordem}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{item.title}</span>
          {(item.summary || itemMetaLine(item)) && (
            <span className="line-clamp-2 block text-sm text-gray-500">{item.summary || itemMetaLine(item)}</span>
          )}
        </span>
        {comDominio && mastery && <V2Badge tone={TOM[mastery]} className="shrink-0">{MASTERY_LABELS[mastery]}</V2Badge>}
        <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

function Trilha() {
  const identity = useTrainingIdentity();
  const visiveis = useVisibleTrainingItems(identity);
  const meta = useTrainingMeta(identity.uid);
  const [faltam, setFaltam] = useState(false);
  const comDominio = meta.isSuccess;
  const trilha = useMemo(
    () => buildTechniqueTrail(visiveis.items, comDominio ? meta.data?.mastery || {} : {}),
    [visiveis.items, comDominio, meta.data],
  );

  if (visiveis.isLoading) return <V2Skeleton className="h-96 rounded-4xl" />;
  if (visiveis.isError) {
    return <V2Surface><V2ErrorState title="A trilha não carregou" onRetry={() => visiveis.refetch()} /></V2Surface>;
  }

  const { counts } = trilha;
  const avancando = counts.dominado + counts.consistente;
  const familias = faltam
    ? trilha.families.map((f) => ({ ...f, items: f.items.filter((x) => x.mastery !== MASTERY.DOMINADO) })).filter((f) => f.items.length)
    : trilha.families;

  return (
    <div className="space-y-6">
      <V2Surface className="space-y-4">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500">
            <Route className="h-4 w-4" aria-hidden="true" /> Trilha dos golpes
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">Aprenda cada golpe, do jeito certo</h1>
          <p className="max-w-2xl text-gray-600">
            Os golpes e movimentos do pickleball numa ordem de aprender: o que vem antes é a base do que vem depois.
            Cada um traz o passo a passo, o corpo ponto a ponto, o certo e o errado e como saber se você fez certo.
          </p>
        </div>
        {visiveis.incompleto && <p className="text-sm text-amber-700">Parte da biblioteca não carregou; a trilha pode estar incompleta.</p>}
        {meta.isError && (
          <V2ErrorState inline title="O seu domínio dos golpes não carregou" description="A trilha está aqui; o que você já marcou aparece quando carregar." onRetry={() => meta.refetch()} />
        )}
        {comDominio && counts.total > 0 && (
          <div className="space-y-1.5">
            <Barra feitos={avancando} total={counts.total} />
            <p className="text-sm text-gray-500">
              {counts.dominado} {counts.dominado === 1 ? 'dominado' : 'dominados'} · {counts.consistente} {counts.consistente === 1 ? 'consistente' : 'consistentes'} · {counts.aprendendo} aprendendo · de {counts.total} golpes
            </p>
          </div>
        )}
      </V2Surface>

      {counts.total === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Route}
            title="A trilha ainda não tem golpes"
            description={visiveis.incompleto
              ? 'Parte da biblioteca não carregou. Tente de novo em instantes.'
              : 'Os golpes da Equipe PickleRush ainda não foram publicados na biblioteca.'}
            action={<V2Button asChild variant="secondary"><Link to="/treino?aba=biblioteca">Ver a biblioteca</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <>
          {comDominio && trilha.next && (
            <V2Surface className="flex flex-wrap items-center justify-between gap-4 border-ink" data-dica="treino-golpes-proximo">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-gray-500">
                  {meta.data?.mastery?.[trilha.next.id] === MASTERY.APRENDENDO ? 'Continue de onde parou' : 'Seu próximo golpe'}
                </p>
                <p className="font-display text-xl font-bold text-ink">{trilha.next.title}</p>
                {trilha.next.summary && <p className="text-sm text-gray-600">{trilha.next.summary}</p>}
              </div>
              <V2Button asChild>
                <Link to={`/treino/item/${trilha.next.id}`}>Abrir o golpe <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </V2Button>
            </V2Surface>
          )}
          {comDominio && !trilha.next && (
            <V2Surface><p className="font-semibold text-ink">Você marcou todos os golpes da trilha. Agora é repetir nos drills para manter.</p></V2Surface>
          )}

          {comDominio && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mostrar">
              <V2FilterChip active={!faltam} aria-pressed={!faltam} onClick={() => setFaltam(false)} className="px-3 py-1.5">Todos os golpes</V2FilterChip>
              <V2FilterChip active={faltam} aria-pressed={faltam} onClick={() => setFaltam(true)} className="px-3 py-1.5">Só os que faltam dominar</V2FilterChip>
            </div>
          )}

          <nav aria-label="Famílias de golpes" className="flex flex-wrap gap-1.5" data-dica="treino-golpes-familias">
            {familias.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => rolarAte(document.getElementById(`familia-${f.id}`), { suave: !menosMovimento() })}
                className="rounded-full border border-gray-200 bg-paper-pure px-3 py-1.5 text-sm font-semibold text-gray-600 hover:border-ink hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                {f.title}
              </button>
            ))}
          </nav>

          {familias.map((f) => (
            <section key={f.id} id={`familia-${f.id}`} className="scroll-mt-4 space-y-3" aria-labelledby={`familia-${f.id}-titulo`}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id={`familia-${f.id}-titulo`} className="font-display text-xl font-bold text-ink">{f.title}</h2>
                  <p className="text-sm text-gray-500">{f.description}</p>
                </div>
                {comDominio && (
                  <div className="w-32 space-y-1 text-right">
                    <p className="text-xs font-semibold text-gray-500">{f.counts.dominado} de {f.counts.total} dominados</p>
                    <Barra feitos={f.counts.dominado} total={f.counts.total} />
                  </div>
                )}
              </div>
              <ol className="space-y-2">
                {f.items.map(({ item, mastery }) => (
                  <Golpe
                    key={item.id}
                    item={item}
                    mastery={mastery}
                    comDominio={comDominio}
                    ordem={trilha.families.find((x) => x.id === f.id).items.findIndex((x) => x.item.id === item.id) + 1}
                  />
                ))}
              </ol>
            </section>
          ))}
          {faltam && familias.length === 0 && (
            <V2Surface><p className="text-gray-600">Nada faltando: você marcou todos como dominados.</p></V2Surface>
          )}
        </>
      )}
    </div>
  );
}

export default function V2TrainingTechniques() {
  return (
    <TrainingGate>
      <div className="space-y-6">
        <Voltar />
        <Trilha />
      </div>
    </TrainingGate>
  );
}

/**
 * A FICHA de um item de treino — só o conteúdo. Serve à página do item
 * (`/treino/item/:id`) e à prévia do editor, por isso não tem ação nem
 * consulta: quem monta passa `item`, e o treino passa `itemsById` para os
 * blocos apontarem para os itens vinculados.
 *
 * Toda seção do modelo aparece, mas só com conteúdo (a lista vem de
 * `itemView`). Texto do banco é texto: nada aqui é renderizado como HTML.
 */
import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CircleCheck, CircleX, CopyPlus, ExternalLink, ShieldAlert, Star,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { itemMetaLine } from '@/modules/training/domain/trainingItem';
import {
  BLOCK_TYPE_LABELS, EQUIPMENT_LABELS, ITEM_KIND_LABELS, METRIC_TYPE_LABELS, MOTOR_ABILITY_LABELS,
  PLACE_LABELS, PRACTICE_MODE_LABELS, STUDY_TYPE_LABELS, TECHNIQUE_PART_LABELS, rpeLabel, skillLabel,
} from '@/modules/training/domain/taxonomy';
import CourtDiagram from '@/v2/components/training/CourtDiagram';
import { AuthorLine, KindIcon } from '@/v2/components/training/ItemCard';
import { MediaGallery, MediaTile } from './ItemMedia';
import { INDEX_MIN_SECTIONS, SECTION_TITLES, itemView } from './contentView';
import { rolarAte } from '@/v2/ui/rolarAte';

const menosMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Secao({ id, title, children, className }) {
  return (
    <section aria-labelledby={id} className={cn('space-y-3', className)}>
      <h2 id={id} className="font-display text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const Chips = ({ items }) => (
  <ul className="flex flex-wrap gap-2">
    {items.map((t, i) => (
      <li key={`${t}-${i}`} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">{t}</li>
    ))}
  </ul>
);

const Texto = ({ children }) => <p className="whitespace-pre-line leading-7 text-gray-700">{children}</p>;

function descanso(s) {
  if (s < 60) return `${s} s`;
  const r = s % 60;
  return `${Math.floor(s / 60)} min${r ? ` ${r} s` : ''}`;
}

function Rotulo({ children }) {
  return <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{children}</dt>;
}

/** Uma coluna do certo × errado: ícone + palavra, não só a cor. */
function Coluna({ certo, textos, midias }) {
  const Icon = certo ? CircleCheck : CircleX;
  return (
    <div className={cn('space-y-3 rounded-3xl border-2 p-4', certo ? 'border-emerald-300' : 'border-red-300')}>
      <p className={cn('flex items-center gap-1.5 font-bold', certo ? 'text-emerald-700' : 'text-red-700')}>
        <Icon className="h-5 w-5" aria-hidden="true" /> {certo ? 'Certo' : 'Errado'}
      </p>
      {textos.length > 0 && (
        <ul className="space-y-2">
          {textos.map((p, i) => (
            <li key={i} className="flex gap-2 text-gray-700">
              <Icon className={cn('mt-1 h-4 w-4 shrink-0', certo ? 'text-emerald-600' : 'text-red-600')} aria-hidden="true" />
              <span><span className="sr-only">{certo ? 'Certo: ' : 'Errado: '}</span>{p.text}</span>
            </li>
          ))}
        </ul>
      )}
      {midias.map((m, i) => <MediaTile key={`${m.url}-${i}`} media={m} />)}
    </div>
  );
}

/**
 * @param {{ item: object, itemsById?: Record<string, object>, aside?: React.ReactNode, className?: string }} props
 */
export default function TrainingItemView({ item, itemsById, aside, className }) {
  const base = useId().replace(/:/g, '');
  if (!item) return null;
  const view = itemView(item);
  const { v } = view;
  const meta = itemMetaLine(v);
  const hid = (k) => `${base}-${k}`;
  const derivado = item.derived_from?.id ? item.derived_from : null;

  const secoes = {
    diagramas: () => (
      <Secao id={hid('diagramas')} title={v.diagrams.length > 1 ? 'Diagramas' : 'Diagrama'}>
        <div className={cn('grid gap-4', v.diagrams.length > 1 && 'sm:grid-cols-2')}>
          {v.diagrams.map((d, i) => <CourtDiagram key={i} diagram={d} className="mx-auto w-full max-w-sm" />)}
        </div>
      </Secao>
    ),
    objetivo: () => <Secao id={hid('objetivo')} title="Objetivo"><Texto>{v.objective}</Texto></Secao>,
    quando: () => <Secao id={hid('quando')} title="Quando usar"><Texto>{v.when_to_use}</Texto></Secao>,
    pratica: () => (
      <Secao id={hid('pratica')} title="Para praticar">
        <dl className="grid gap-4 sm:grid-cols-2">
          {v.skills.length > 0 && <div className="space-y-2"><Rotulo>Habilidades</Rotulo><dd><Chips items={v.skills.map(skillLabel)} /></dd></div>}
          {v.place.length > 0 && <div className="space-y-2"><Rotulo>Onde</Rotulo><dd><Chips items={v.place.map((p) => PLACE_LABELS[p])} /></dd></div>}
          {v.equipment.length > 0 && <div className="space-y-2"><Rotulo>Material</Rotulo><dd><Chips items={v.equipment.map((e) => EQUIPMENT_LABELS[e])} /></dd></div>}
          {v.roles.length > 0 && <div className="space-y-2"><Rotulo>Papéis</Rotulo><dd><Chips items={v.roles} /></dd></div>}
          {v.intensity !== null && (
            <div className="space-y-1"><Rotulo>Esforço</Rotulo><dd className="text-gray-700">{v.intensity}/10 — {rpeLabel(v.intensity)}</dd></div>
          )}
          {v.practice_mode && (
            <div className="space-y-1"><Rotulo>Como praticar</Rotulo><dd className="text-gray-700">{PRACTICE_MODE_LABELS[v.practice_mode]}</dd></div>
          )}
        </dl>
      </Secao>
    ),
    seguranca: () => (
      <section aria-labelledby={hid('seguranca')} className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
        <h2 id={hid('seguranca')} className="flex items-center gap-2 font-display text-lg font-bold text-amber-900">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" /> Segurança
        </h2>
        <p className="mt-2 whitespace-pre-line leading-7 text-amber-900">{v.safety}</p>
      </section>
    ),
    blocos: () => (
      <Secao id={hid('blocos')} title="Blocos do treino">
        <ol className="space-y-3">
          {v.blocks.map((b, i) => {
            const ligado = b.item_id ? itemsById?.[b.item_id] : null;
            return (
              <li key={i} className="rounded-3xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{i + 1}. {BLOCK_TYPE_LABELS[b.type]}</span>
                  {b.duration_min ? <span className="text-xs text-gray-400">{b.duration_min} min</span> : null}
                </div>
                <p className="mt-1 font-semibold text-ink">{b.title}</p>
                {b.notes && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{b.notes}</p>}
                {b.item_id && (
                  <Link to={`/treino/item/${b.item_id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink underline underline-offset-4">
                    {ligado ? ligado.title : 'Abrir o item vinculado'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </Secao>
    ),
    fisico: () => (
      <Secao id={hid('fisico')} title="Séries e repetições">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {(v.sets || v.reps) && (
            <div><Rotulo>Séries × repetições</Rotulo><dd className="font-display text-xl font-bold text-ink">{[v.sets, v.reps].filter(Boolean).join(' × ')}</dd></div>
          )}
          {v.rest_sec ? <div><Rotulo>Descanso</Rotulo><dd className="font-display text-xl font-bold text-ink">{descanso(v.rest_sec)}</dd></div> : null}
          {v.tempo && <div><Rotulo>Cadência</Rotulo><dd className="font-display text-xl font-bold text-ink">{v.tempo}</dd></div>}
        </dl>
      </Secao>
    ),
    montagem: () => <Secao id={hid('montagem')} title="Montagem"><Texto>{v.setup}</Texto></Secao>,
    passos: () => (
      <Secao id={hid('passos')} title="Passo a passo">
        <ol className="space-y-3">
          {v.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-acid" aria-hidden="true">{i + 1}</span>
              <span className="pt-0.5 leading-7 text-gray-700"><span className="sr-only">Passo {i + 1}: </span>{s}</span>
            </li>
          ))}
        </ol>
      </Secao>
    ),
    tecnica: () => (
      <Secao id={hid('tecnica')} title="O corpo, ponto a ponto">
        <p className="text-sm text-gray-500">Confira cada parte do corpo, uma de cada vez — é assim que o golpe sai igual toda vez.</p>
        <dl className="divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-100">
          {v.technique.checkpoints.map((c, i) => (
            <div key={i} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-sm font-bold text-ink">{TECHNIQUE_PART_LABELS[c.part]}</dt>
              <dd className="leading-7 text-gray-700">{c.text}</dd>
            </div>
          ))}
        </dl>
      </Secao>
    ),
    autoavaliacao: () => (
      <Secao id={hid('autoavaliacao')} title="Como saber se você fez certo">
        <ul className="space-y-2">
          {v.technique.self_check.map((t, i) => (
            <li key={i} className="flex gap-2 rounded-2xl bg-emerald-50 p-3 text-emerald-900">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Secao>
    ),
    dicas: () => <Secao id={hid('dicas')} title="Dicas"><Chips items={v.cues} /></Secao>,
    certoErrado: () => {
      const temCerto = view.certos.length + view.mediaCerto.length > 0;
      const temErrado = view.errados.length + view.mediaErrado.length > 0;
      return (
        <Secao id={hid('certo')} title="Certo e errado">
          <div className={cn('grid gap-4', temCerto && temErrado && 'sm:grid-cols-2')}>
            {temCerto && <Coluna certo textos={view.certos} midias={view.mediaCerto} />}
            {temErrado && <Coluna certo={false} textos={view.errados} midias={view.mediaErrado} />}
          </div>
        </Secao>
      );
    },
    erros: () => (
      <Secao id={hid('erros')} title="Erros comuns">
        <ul className="space-y-3">
          {v.common_errors.map((e, i) => (
            <li key={i} className="rounded-3xl border border-gray-100 p-4">
              <p className="flex gap-2 font-semibold text-ink">
                <CircleX className="mt-1 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span><span className="sr-only">Erro: </span>{e.error}</span>
              </p>
              {e.fix && (
                <p className="mt-2 flex gap-2 text-gray-700">
                  <CircleCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span><span className="font-semibold">Como corrigir: </span>{e.fix}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </Secao>
    ),
    motor: () => {
      const fases = [['preparacao', 'Preparação'], ['execucao', 'Execução'], ['finalizacao', 'Finalização']]
        .filter(([k]) => v.motor.phases[k]);
      return (
        <Secao id={hid('motor')} title="O movimento">
          {fases.length > 0 && (
            <ol className="grid gap-3 sm:grid-cols-3">
              {fases.map(([k, rot], i) => (
                <li key={k} className="rounded-3xl bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{i + 1}. {rot}</p>
                  <p className="mt-1 whitespace-pre-line text-gray-700">{v.motor.phases[k]}</p>
                </li>
              ))}
            </ol>
          )}
          {v.motor.abilities.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">Capacidades trabalhadas</p>
              <Chips items={v.motor.abilities.map((a) => MOTOR_ABILITY_LABELS[a])} />
            </div>
          )}
        </Secao>
      );
    },
    variacoes: () => (
      <Secao id={hid('variacoes')} title="Variações">
        <dl className="grid gap-3 sm:grid-cols-2">
          {v.variations.easier && <div className="rounded-3xl bg-gray-50 p-4"><Rotulo>Mais fácil</Rotulo><dd className="mt-1 whitespace-pre-line text-gray-700">{v.variations.easier}</dd></div>}
          {v.variations.harder && <div className="rounded-3xl bg-gray-50 p-4"><Rotulo>Mais difícil</Rotulo><dd className="mt-1 whitespace-pre-line text-gray-700">{v.variations.harder}</dd></div>}
        </dl>
      </Secao>
    ),
    meta: () => (
      <Secao id={hid('meta')} title="Meta">
        {v.metric.type && (
          <p className="font-display text-xl font-bold text-ink">
            {METRIC_TYPE_LABELS[v.metric.type]}{v.metric.target ? `: ${v.metric.target}` : ''}
          </p>
        )}
        {v.success_criteria && <Texto>{v.success_criteria}</Texto>}
      </Secao>
    ),
    estudo: () => (
      <Secao id={hid('estudo')} title={STUDY_TYPE_LABELS[v.study_type] ? `Para estudar · ${STUDY_TYPE_LABELS[v.study_type]}` : 'Para estudar'}>
        {(v.rules_edition || v.rules_section) && (
          <p className="text-gray-700">
            {v.rules_edition && <span className="font-semibold">{v.rules_edition}</span>}
            {v.rules_edition && v.rules_section && ' · '}
            {v.rules_section && <span>Seção {v.rules_section}</span>}
          </p>
        )}
        {v.link && (
          <a
            href={v.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 break-all font-semibold text-ink underline underline-offset-4"
          >
            Abrir o material <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
        )}
        {v.questions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-600">Para fixar</p>
            <ol className="list-decimal space-y-1 pl-5 text-gray-700">
              {v.questions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </div>
        )}
      </Secao>
    ),
    midia: () => <Secao id={hid('midia')} title="Fotos e vídeos"><MediaGallery media={view.mediaDemo} /></Secao>,
    conteudo: () => <Secao id={hid('conteudo')} title="Conteúdo"><Texto>{view.body}</Texto></Secao>,
  };

  return (
    <article className={cn('space-y-8', className)}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <KindIcon kind={v.kind} size="sm" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{ITEM_KIND_LABELS[v.kind]}</span>
          {item.featured && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Destaque
            </span>
          )}
        </div>
        <h1 className="break-words font-display text-3xl font-bold leading-tight text-ink">{v.title || item.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <AuthorLine item={item} className="text-sm" />
          {meta && <span className="text-sm text-gray-500">{meta}</span>}
        </div>
        {derivado && (
          <p className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
            <CopyPlus className="h-4 w-4" aria-hidden="true" /> Adaptado de
            <Link to={`/treino/item/${derivado.id}`} className="font-semibold text-ink underline underline-offset-4">
              {derivado.title || 'outro item'}
            </Link>
            {derivado.author_name && <span>({derivado.author_name})</span>}
          </p>
        )}
        {view.resumo && <p className="text-lg leading-8 text-gray-600">{view.resumo}</p>}
      </header>
      {aside}
      {view.sections.length >= INDEX_MIN_SECTIONS && (
        <nav aria-label="Nesta ficha" className="flex flex-wrap gap-1.5">
          {view.sections.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => rolarAte(document.getElementById(hid(k === 'certoErrado' ? 'certo' : k)), { suave: !menosMovimento() })}
              className="rounded-full border border-gray-200 bg-paper-pure px-3 py-1 text-xs font-semibold text-gray-600 hover:border-ink hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {SECTION_TITLES[k]}
            </button>
          ))}
        </nav>
      )}
      {view.sections.map((k) => <React.Fragment key={k}>{secoes[k]()}</React.Fragment>)}
    </article>
  );
}

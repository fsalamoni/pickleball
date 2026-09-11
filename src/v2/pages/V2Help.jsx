/**
 * V2Help — CENTRAL DE AJUDA (flag `help_center`). Rota `/ajuda`.
 *
 * O manual da plataforma, dividido por TIPO DE USUÁRIO. A divisão é o ponto:
 * quem administra uma arena e quem só joga têm perguntas completamente
 * diferentes, e um texto corrido faria cada um garimpar o que não interessa.
 *
 * ## Como a tela se comporta
 *
 *  · SEM busca — mostra uma seção por vez, escolhida nas abas. É leitura
 *    guiada: a pessoa se reconhece num papel e lê o que é dela.
 *  · COM busca — some com as abas e mostra os resultados de TODAS as seções,
 *    cada um dizendo de onde veio. Quem busca não sabe (nem tem de saber) em
 *    que parte a resposta mora.
 *
 * ## Estado na URL
 *
 * `?s=<seção>&a=<artigo>&q=<busca>` — o endereço reproduz a tela. Isso é o que
 * permite a outras telas (e ao suporte) mandarem alguém direto ao artigo certo,
 * e faz o botão "voltar" do navegador funcionar.
 *
 * ## Só leitura
 *
 * Nenhuma consulta, nenhuma escrita, nenhuma coleção. O conteúdo é estático e
 * vem do domínio (`modules/help/domain/helpCenter.js`). **Nada toca o banco.**
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  Search, ChevronDown, Lightbulb, AlertTriangle, ArrowRight, BookOpen,
  Rocket, User, Building2, GraduationCap, ShieldCheck, LifeBuoy,
} from 'lucide-react';

import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import {
  HELP_SECTION, HELP_SECTIONS, getHelpSection, searchHelp,
} from '@/modules/help/domain/helpCenter';
import {
  V2Badge, V2ContentHero, V2SearchInput, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

/** Ícone de cada seção — reforça o "isto é sobre mim" antes da leitura. */
const ICONE = {
  [HELP_SECTION.START]: Rocket,
  [HELP_SECTION.ATHLETE]: User,
  [HELP_SECTION.ARENA]: Building2,
  [HELP_SECTION.COACH]: GraduationCap,
  [HELP_SECTION.ACCOUNT]: ShieldCheck,
};

/* ------------------------------------------------------------- os blocos -- */

function Bloco({ bloco }) {
  switch (bloco.type) {
    case 'steps':
      return (
        <ol className="ml-1 space-y-2">
          {bloco.items.map((item, i) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-gray-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-acid">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul className="ml-1 space-y-1.5">
          {bloco.items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-6 text-gray-600">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'tip':
      return (
        <p className="flex items-start gap-2 rounded-2xl bg-paper px-3.5 py-2.5 text-xs leading-5 text-gray-600">
          <Lightbulb aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acid-dark" />
          <span>{bloco.text}</span>
        </p>
      );
    case 'warn':
      return (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{bloco.text}</span>
        </p>
      );
    case 'link':
      return (
        <Link
          to={bloco.to}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 underline underline-offset-2 hover:text-green-800"
        >
          {bloco.label} <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      );
    case 'p':
    default:
      return <p className="text-sm leading-6 text-gray-600">{bloco.text}</p>;
  }
}

/* ------------------------------------------------------------- o artigo --- */

function Artigo({ artigo, aberto, onAlternar, mostrarSecao = false }) {
  const painelId = `ajuda-${artigo.sectionId}-${artigo.id}`;
  return (
    <div className={cn(
      'overflow-hidden rounded-3xl border transition-colors',
      aberto ? 'border-ink/15 bg-paper-pure' : 'border-gray-100 bg-paper-pure hover:border-gray-200',
    )}
    >
      <h3>
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          aria-controls={painelId}
          className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        >
          <span className="min-w-0">
            {mostrarSecao && (
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {artigo.sectionLabel}
              </span>
            )}
            <span className="block font-semibold text-ink">{artigo.title}</span>
            <span className="mt-0.5 block text-sm text-gray-500">{artigo.summary}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn('mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')}
          />
        </button>
      </h3>
      {aberto && (
        <div id={painelId} className="space-y-3 border-t border-gray-100 px-5 py-4">
          {artigo.blocks.map((bloco, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Bloco key={`${artigo.id}-${i}`} bloco={bloco} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- a página -- */

export default function V2Help() {
  const ligado = useFeatureFlag(FEATURE_FLAG.HELP_CENTER);
  const [params, setParams] = useSearchParams();
  const listaRef = useRef(null);

  const q = params.get('q') || '';
  const secaoDaUrl = params.get('s');
  const secaoAtual = getHelpSection(secaoDaUrl) ? secaoDaUrl : HELP_SECTION.START;
  const artigoAberto = params.get('a') || null;

  const atualizar = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    });
    setParams(next, { replace: true });
  };

  const buscando = q.trim().length > 0;
  const resultados = useMemo(
    () => (buscando ? searchHelp(q) : []),
    [buscando, q],
  );
  const secao = getHelpSection(secaoAtual);

  // Chegou por link direto para um artigo: leva a leitura até ele. Sem isto,
  // um link de suporte abriria a página no topo e a pessoa teria de procurar.
  useEffect(() => {
    if (!artigoAberto || buscando) return;
    const alvo = document.getElementById(`ajuda-${secaoAtual}-${artigoAberto}`);
    if (alvo) alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [artigoAberto, secaoAtual, buscando]);

  if (!ligado) return <Navigate to="/" replace />;

  const alternar = (sectionId, articleId) => {
    atualizar({ a: artigoAberto === articleId ? null : articleId, s: sectionId });
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="Central de ajuda"
        title="Como usar o PickleRush"
        description="O manual completo da plataforma, separado pelo que é seu: atleta, arena ou professor. Comece pela parte que é a sua — ou busque direto o que você precisa."
      />

      <div className="mb-5">
        <V2SearchInput
          value={q}
          onChange={(e) => atualizar({ q: e.target.value, a: null })}
          placeholder="Buscar na ajuda: inscrição, reserva, ranking, aluno…"
          icon={Search}
          aria-label="Buscar na central de ajuda"
        />
      </div>

      {/* Abas das seções. Somem durante a busca: ali o resultado atravessa as
          seções, e manter a aba marcada sugeriria um filtro que não existe. */}
      {!buscando && (
        <div className="mb-5 flex flex-wrap gap-2">
          {HELP_SECTIONS.map((s) => {
            const Icone = ICONE[s.id] || BookOpen;
            const ativa = s.id === secaoAtual;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { atualizar({ s: s.id, a: null }); listaRef.current?.focus?.(); }}
                aria-current={ativa ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  ativa ? 'bg-ink text-white' : 'border border-gray-200 bg-paper-pure text-gray-600 hover:border-ink hover:text-ink',
                )}
              >
                <Icone aria-hidden="true" className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {buscando ? (
        <>
          <p className="mb-3 text-sm text-gray-500">
            {resultados.length === 0
              ? 'Nenhum artigo encontrado. Tente outra palavra — a busca também procura no corpo dos textos.'
              : `${resultados.length} artigo(s) para “${q.trim()}”.`}
          </p>
          <div className="space-y-2">
            {resultados.map((a) => (
              <Artigo
                key={`${a.sectionId}-${a.id}`}
                artigo={a}
                mostrarSecao
                aberto={artigoAberto === a.id}
                onAlternar={() => alternar(a.sectionId, a.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <V2Surface className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-ink">{secao.label}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{secao.tagline}</p>
            </div>
            <V2Badge tone="neutral">{secao.audience}</V2Badge>
          </V2Surface>

          <div ref={listaRef} tabIndex={-1} className="space-y-2 outline-none">
            {secao.articles.map((a) => (
              <Artigo
                key={a.id}
                artigo={{ ...a, sectionId: secao.id, sectionLabel: secao.label }}
                aberto={artigoAberto === a.id}
                onAlternar={() => alternar(secao.id, a.id)}
              />
            ))}
          </div>
        </>
      )}

      <V2Surface className="mt-6">
        <div className="flex items-start gap-3">
          <LifeBuoy aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
          <div className="text-sm leading-6 text-gray-600">
            <p className="font-semibold text-ink">Não achou o que procurava?</p>
            <p className="mt-1">
              As telas de torneio e de dia de jogo têm tutoriais próprios, com o passo a passo
              completo — procure o botão <strong>Como funciona</strong> dentro delas. E as regras
              do esporte, o nivelamento e a conduta ficam no menu Pickleball.
            </p>
          </div>
        </div>
      </V2Surface>
    </div>
  );
}

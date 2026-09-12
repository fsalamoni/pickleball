/**
 * V2Help — CENTRAL DE AJUDA (flag `help_center`). Rota `/ajuda`.
 *
 * O manual da plataforma, dividido por TIPO DE USUÁRIO. A divisão é o ponto:
 * quem administra uma arena e quem só joga têm perguntas completamente
 * diferentes, e um texto corrido faria cada um garimpar o que não interessa.
 *
 * ## O momento em que esta tela é usada
 *
 * Ninguém abre a ajuda por lazer. Abre-se travado, no meio de outra coisa,
 * já irritado. Cada passo entre "cliquei em ajuda" e "achei a resposta" é
 * cobrado em paciência que a pessoa não tem mais. A tela é desenhada em cima
 * disso:
 *
 *  1. **De onde ela veio** (`?de=<rota>`): o link de ajuda de qualquer tela
 *     manda a rota junto, e a central abre com "Ajuda para esta tela" no topo.
 *     Zero passos de adivinhação no caso mais comum.
 *  2. **As perguntas mais comuns**, escritas como pergunta. Buscar pressupõe
 *     saber o NOME da coisa; quem está perdido não sabe, mas reconhece a
 *     própria pergunta quando a lê.
 *  3. **Quem é você**: cartões de identificação (sou atleta / tenho uma arena
 *     / dou aulas) em vez de abas abstratas, e a escolha fica LEMBRADA — a
 *     segunda visita já abre na parte certa.
 *  4. **A busca** destaca o termo e mostra o TRECHO em que ele apareceu, para
 *     o resultado não parecer arbitrário. Tecla `/` foca, `Esc` limpa.
 *  5. **Sem becos**: o fim de um artigo oferece o próximo, o link direto para
 *     mandar a alguém, e a volta ao topo. Busca sem resultado vira sugestão,
 *     não parede.
 *
 * ## Estado na URL
 *
 * `?s=<seção>&a=<artigo>&q=<busca>&de=<rota de origem>` — o endereço reproduz
 * a tela. É o que permite a outras telas (e ao suporte) mandarem alguém direto
 * ao artigo certo, e faz o botão "voltar" do navegador funcionar.
 *
 * ## Só leitura
 *
 * Nenhuma consulta, nenhuma escrita, nenhuma coleção. O conteúdo é estático e
 * vem do domínio (`modules/help/domain/helpCenter.js`). A única memória é a
 * parte preferida, no `localStorage` por usuário. **Nada toca o banco.**
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  Search, ChevronDown, Lightbulb, AlertTriangle, ArrowRight, BookOpen,
  Rocket, User, Building2, GraduationCap, ShieldCheck, LifeBuoy,
  Compass, HelpCircle, Link2, ArrowUp, CornerDownLeft, X,
} from 'lucide-react';

import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useClipboard } from '@/core/lib/useClipboard';
import {
  HELP_SECTION, HELP_SECTIONS, getHelpSection, searchHelp,
  helpForRoute, faqArticles, highlightParts, searchSnippet, nextHelpArticle,
} from '@/modules/help/domain/helpCenter';
import {
  V2Badge, V2Button, V2ContentHero, V2SearchInput, V2Surface,
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

/**
 * Como a pessoa se descreve. As abas nomeiam a SEÇÃO ("Atleta"); os cartões
 * nomeiam a PESSOA ("Eu jogo") — e é assim que alguém se reconhece.
 */
const SOU = {
  [HELP_SECTION.ATHLETE]: 'Eu jogo',
  [HELP_SECTION.ARENA]: 'Tenho uma arena',
  [HELP_SECTION.COACH]: 'Dou aulas',
};

/** Id do campo de busca — o atalho `/` precisa achá-lo sem `ref` encadeado. */
const ID_BUSCA = 'ajuda-busca';

/** Preferência (por usuário, no navegador) da parte em que a pessoa vive. */
const PREF_SECAO = 'ajuda:secao';

/* --------------------------------------------------------------- destaque -- */

/** Texto com os termos buscados realçados. Sem termo, é texto puro. */
function Realce({ texto, termo }) {
  if (!termo) return <>{texto}</>;
  return (
    <>
      {highlightParts(texto, termo).map((parte, i) => (parte.match ? (
        <mark key={`m${i}`} className="rounded bg-acid/40 px-0.5 text-ink">{parte.text}</mark>
      ) : (
        <React.Fragment key={`t${i}`}>{parte.text}</React.Fragment>
      )))}
    </>
  );
}

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

function Artigo({
  artigo, aberto, onAlternar, mostrarSecao = false, termo = '',
  trecho = null, rodape = null,
}) {
  const painelId = `ajuda-${artigo.sectionId}-${artigo.id}`;
  return (
    <div
      className={cn(
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
            <span className="block font-semibold text-ink">
              <Realce texto={artigo.title} termo={termo} />
            </span>
            <span className="mt-0.5 block text-sm text-gray-500">
              <Realce texto={artigo.summary} termo={termo} />
            </span>
            {!aberto && trecho && (
              <span className="mt-1.5 block text-xs leading-5 text-gray-400">
                <Realce texto={trecho} termo={termo} />
              </span>
            )}
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
            <Bloco key={`${artigo.id}-${i}`} bloco={bloco} />
          ))}
          {rodape}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- as perguntas -- */

/**
 * As dúvidas mais comuns, escritas como PERGUNTA.
 *
 * Buscar pressupõe saber o nome da coisa. Quem está perdido não sabe o nome —
 * mas reconhece a própria pergunta assim que a lê. Por isso esta lista abre a
 * tela, e por isso ela reaparece quando a busca não acha nada: ali ela é a
 * saída, não a decoração.
 */
function Perguntas({ perguntas, onAbrir, titulo, subtitulo }) {
  return (
    <V2Surface className="mb-4">
      <div className="mb-3 flex items-start gap-3">
        <HelpCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-acid-dark" />
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-sm text-gray-500">{subtitulo}</p>}
        </div>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {perguntas.map((f) => (
          <li key={`${f.sectionId}-${f.id}`}>
            <button
              type="button"
              onClick={() => onAbrir(f.sectionId, f.id)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper px-3.5 py-2.5 text-left text-sm font-medium text-gray-600 transition-colors hover:border-ink/20 hover:text-ink"
            >
              <span>{f.question}</span>
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            </button>
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}

/* -------------------------------------------------------------- a página -- */

export default function V2Help() {
  const ligado = useFeatureFlag(FEATURE_FLAG.HELP_CENTER);
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [params, setParams] = useSearchParams();
  const { copy } = useClipboard();
  const listaRef = useRef(null);
  const topoRef = useRef(null);

  const q = params.get('q') || '';
  const secaoDaUrl = params.get('s');
  const artigoAberto = params.get('a') || null;
  const veioDe = params.get('de') || '';

  // A parte preferida: URL manda (é link direto), depois a memória do usuário,
  // depois "Começar aqui". A memória só existe para a SEGUNDA visita — quem
  // cuida de uma arena não deveria reencontrar a tela no estado inicial toda
  // vez que precisa de ajuda.
  const [secaoLembrada, setSecaoLembrada] = useState(() => readViewPreference(uid, PREF_SECAO));
  useEffect(() => { setSecaoLembrada(readViewPreference(uid, PREF_SECAO)); }, [uid]);

  const secaoAtual = (getHelpSection(secaoDaUrl) && secaoDaUrl)
    || (getHelpSection(secaoLembrada) && secaoLembrada)
    || HELP_SECTION.START;

  const atualizar = useCallback((patch) => {
    setParams((atual) => {
      const next = new URLSearchParams(atual);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === '' || v == null) next.delete(k);
        else next.set(k, String(v));
      });
      return next;
    }, { replace: true });
  }, [setParams]);

  const buscando = q.trim().length > 0;
  const resultados = useMemo(() => (buscando ? searchHelp(q) : []), [buscando, q]);
  const perguntas = useMemo(() => faqArticles(), []);
  const contexto = useMemo(() => (veioDe ? helpForRoute(veioDe) : null), [veioDe]);
  const secao = getHelpSection(secaoAtual) || getHelpSection(HELP_SECTION.START);

  // Chegou por link direto para um artigo: leva a leitura até ele. Sem isto,
  // um link de suporte abriria a página no topo e a pessoa teria de procurar.
  useEffect(() => {
    if (!artigoAberto || buscando) return;
    const alvo = document.getElementById(`ajuda-${secaoAtual}-${artigoAberto}`);
    if (alvo) alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [artigoAberto, secaoAtual, buscando]);

  // `/` foca a busca, `Esc` limpa. É o gesto que quem usa teclado já tem no
  // dedo — e quem não usa nunca esbarra nele.
  useEffect(() => {
    const aoTeclar = (e) => {
      const alvo = e.target;
      const digitando = !!alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
      if (e.key === '/' && !digitando && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        document.getElementById(ID_BUSCA)?.focus();
        return;
      }
      if (e.key === 'Escape' && alvo?.id === ID_BUSCA) {
        atualizar({ q: null, a: null });
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [atualizar]);

  if (!ligado) return <Navigate to="/" replace />;

  const escolherSecao = (sectionId) => {
    atualizar({ s: sectionId, a: null, q: null });
    // "Começar aqui" é o padrão: não vale gravar como escolha.
    const guardar = sectionId === HELP_SECTION.START ? null : sectionId;
    writeViewPreference(uid, PREF_SECAO, guardar);
    setSecaoLembrada(guardar);
    listaRef.current?.focus?.();
  };

  const abrir = (sectionId, articleId) => atualizar({ s: sectionId, a: articleId, q: null });
  const alternar = (sectionId, articleId) => {
    atualizar({ a: artigoAberto === articleId ? null : articleId, s: sectionId });
  };
  const aoTopo = () => topoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  /** O rodapé de um artigo aberto: sem becos — próximo, link, topo. */
  const rodapeDoArtigo = (a) => {
    const proximo = nextHelpArticle(a.sectionId, a.id);
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/ajuda?s=${a.sectionId}&a=${a.id}`
      : `/ajuda?s=${a.sectionId}&a=${a.id}`;
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        {proximo && (
          <V2Button
            type="button"
            size="sm"
            variant="subtle"
            onClick={() => abrir(proximo.sectionId, proximo.id)}
          >
            <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 -scale-x-100" />
            Próximo: {proximo.title}
          </V2Button>
        )}
        <V2Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => copy(url, 'Link do artigo copiado.')}
          title="Copiar o link direto deste artigo"
        >
          <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
          Copiar link
        </V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={aoTopo}>
          <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
          Topo
        </V2Button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <span ref={topoRef} aria-hidden="true" />
      <V2ContentHero
        eyebrow="Central de ajuda"
        title="Como usar o PickleRush"
        description="O manual completo da plataforma, separado pelo que é seu: atleta, arena ou professor. Comece pela parte que é a sua — ou busque direto o que você precisa."
      />

      <div className="relative mb-5">
        <V2SearchInput
          id={ID_BUSCA}
          className="pr-12"
          value={q}
          onChange={(e) => atualizar({ q: e.target.value, a: null })}
          placeholder="Buscar na ajuda: inscrição, reserva, ranking, aluno…"
          icon={Search}
          aria-label="Buscar na central de ajuda"
        />
        {/* Com texto, um jeito de apagar sem selecionar tudo (no celular não
            há Esc). Vazio, a dica do atalho — só onde existe teclado. */}
        {q ? (
          <button
            type="button"
            onClick={() => atualizar({ q: null, a: null })}
            aria-label="Limpar a busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-paper hover:text-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-paper px-1.5 py-0.5 text-[10px] font-bold text-gray-400 sm:block">
            /
          </kbd>
        )}
      </div>

      {/* De onde a pessoa veio. É o bloco mais importante da tela: cobre o
          caso comum — travou ALI, clicou em ajuda, quer aquilo. */}
      {contexto && !buscando && (
        <V2Surface className="mb-4 border-acid/40 bg-acid/5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Compass aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-acid-dark" />
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Ajuda para esta tela</h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  Você veio de <strong className="text-ink">{contexto.label}</strong>. Provavelmente é sobre isto:
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => atualizar({ de: null })}
              aria-label="Dispensar a ajuda desta tela"
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-paper hover:text-ink"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {contexto.articles.map((a) => (
              <li key={`ctx-${a.sectionId}-${a.id}`}>
                <button
                  type="button"
                  onClick={() => abrir(a.sectionId, a.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure px-4 py-3 text-left transition-colors hover:border-ink/25"
                >
                  <span className="min-w-0">
                    <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                      {a.sectionLabel}
                    </span>
                    <span className="block font-semibold text-ink">{a.title}</span>
                    <span className="mt-0.5 block text-sm text-gray-500">{a.summary}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}

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
                onClick={() => escolherSecao(s.id)}
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
              ? `Nada encontrado para “${q.trim()}”.`
              : `${resultados.length} ${resultados.length === 1 ? 'artigo' : 'artigos'} para “${q.trim()}”.`}
          </p>
          {resultados.length === 0 ? (
            // Busca vazia não pode ser parede. Quem não achou com a própria
            // palavra precisa de outro caminho, não de um pedido para tentar
            // de novo com a mesma dúvida.
            <>
              <Perguntas
                perguntas={perguntas}
                onAbrir={abrir}
                titulo="Talvez seja uma destas"
                subtitulo="A busca procura no corpo dos textos — se não achou, tente outra palavra ou comece por uma pergunta."
              />
              <div className="flex flex-wrap gap-2">
                {HELP_SECTIONS.map((s) => (
                  <V2Button key={s.id} type="button" size="sm" variant="secondary" onClick={() => escolherSecao(s.id)}>
                    Ver {s.label}
                  </V2Button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {resultados.map((a) => (
                <Artigo
                  key={`${a.sectionId}-${a.id}`}
                  artigo={a}
                  mostrarSecao
                  termo={q}
                  trecho={searchSnippet(a, q)}
                  aberto={artigoAberto === a.id}
                  onAlternar={() => alternar(a.sectionId, a.id)}
                  rodape={rodapeDoArtigo(a)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Tela inicial: pergunta e identificação. As abas nomeiam a seção;
              aqui a pessoa se reconhece antes de precisar entender o mapa. */}
          {secaoAtual === HELP_SECTION.START && !artigoAberto && (
            <>
              <Perguntas
                perguntas={perguntas}
                onAbrir={abrir}
                titulo="Dúvidas mais comuns"
                subtitulo="Se a sua está aqui, são dois cliques."
              />
              <V2Surface className="mb-4">
                <h2 className="font-display text-lg font-bold text-ink">Qual é o seu caso?</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Cada parte responde a um uso da plataforma. Sua escolha fica guardada para a próxima visita.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[HELP_SECTION.ATHLETE, HELP_SECTION.ARENA, HELP_SECTION.COACH].map((id) => {
                    const s = getHelpSection(id);
                    const Icone = ICONE[id] || BookOpen;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => escolherSecao(id)}
                        className="group flex h-full flex-col rounded-3xl border border-gray-100 bg-paper p-4 text-left transition-colors hover:border-ink/25"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-acid">
                          <Icone aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="mt-2.5 block font-display text-base font-bold text-ink">{SOU[id]}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-gray-500">{s.tagline}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors group-hover:text-ink">
                          {s.articles.length} artigos
                          <ArrowRight aria-hidden="true" className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </V2Surface>
            </>
          )}

          <V2Surface className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-ink">{secao.label}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{secao.tagline}</p>
            </div>
            <V2Badge tone="neutral">{secao.audience}</V2Badge>
          </V2Surface>

          <div ref={listaRef} tabIndex={-1} className="space-y-2 outline-none">
            {secao.articles.map((a) => {
              const artigo = { ...a, sectionId: secao.id, sectionLabel: secao.label };
              return (
                <Artigo
                  key={a.id}
                  artigo={artigo}
                  aberto={artigoAberto === a.id}
                  onAlternar={() => alternar(secao.id, a.id)}
                  rodape={rodapeDoArtigo(artigo)}
                />
              );
            })}
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

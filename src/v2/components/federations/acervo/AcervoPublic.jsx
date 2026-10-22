/**
 * O ACERVO OFICIAL para quem lê (módulo `official_docs`):
 *  - `FedAcervoBlock`: o resumo na página da federação (app e `/f/:slug`) —
 *    os últimos publicados e o caminho para o acervo inteiro;
 *  - `AcervoBrowser`: a página `/f/:slug/acervo` — o MURAL (o que saiu por
 *    último, como o mural da sede), os DOCUMENTOS (busca e filtros) e a
 *    TRANSPARÊNCIA (o que a Lei Geral do Esporte pede publicado);
 *  - `AcervoFollowButton`: seguir o acervo — o servidor avisa quem segue a
 *    cada publicação e retificação.
 * Cada pessoa vê o que a regra deixa (`useVisibleAcervo`): o público sempre,
 * "só filiados" para filiado ativo e equipe, "só a equipe" para a equipe.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, BellOff, CheckCircle2, CircleAlert, FileText, Library, Lock, Megaphone, Search, Share2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClipboard } from '@/core/lib/useClipboard';
import { useAcervoFollow, useSetAcervoFollow, useVisibleAcervo } from '@/modules/federations/hooks/useFederations';
import {
  DOC_VISIBILITY, DOC_VISIBILITY_LABELS, acervoPublicPath, docCategoriesIn, docCode, docPublicPath, docType, docYears, filterDocs, isDocCurrent, isDocNew,
  muralDocs, sortDocs, transparencyChecklist,
} from '@/modules/federations/domain/acervo';
import { V2Badge, V2Button, V2ErrorState, V2Input, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { t, tn } from '@/core/i18n';
import { quando } from '../federationUi';
import { MostrarMais, POR_VEZ } from '../manage/listTools';

/* ------------------------------------------------------------------ item -- */

/** Uma linha do acervo: código, título, tipo, data e as faixas que mudam a leitura. */
export function AcervoDocItem({ federation, doc, nowMs = Date.now() }) {
  const tipo = docType(doc.type);
  const code = docCode(doc);
  return (
    <li>
      <Link to={docPublicPath(federation, doc.id)} className="block rounded-2xl border border-gray-100 bg-paper-pure p-4 transition-colors hover:border-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {tipo && <span className="font-bold uppercase tracking-wider text-gray-500">{t(tipo.label)}</span>}
          {isDocNew(doc, nowMs) && <V2Badge tone="acid">{doc.version > 1 ? t('Retificado') : t('Novo')}</V2Badge>}
          {doc.revoked_by && <V2Badge tone="red">{t('Revogado')}</V2Badge>}
          {doc.visibility !== DOC_VISIBILITY.PUBLIC && <V2Badge tone="neutral"><Lock className="h-3 w-3" aria-hidden="true" />{t(DOC_VISIBILITY_LABELS[doc.visibility])}</V2Badge>}
        </div>
        <p className="mt-1 font-semibold text-ink">{code ? `${code} — ` : ''}{doc.title}</p>
        {doc.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{doc.summary}</p>}
        <p className="mt-1 text-xs text-gray-500">{doc.act_date ? t('Ato de {data}', { data: quando(doc.act_date) }) : t('Publicado em {data}', { data: quando(doc.published_at_ms) })}</p>
      </Link>
    </li>
  );
}

/* ---------------------------------------------------------------- seguir -- */

/** Seguir as publicações oficiais (acervo e calendário): `next` é para onde volta depois de entrar. */
export function AcervoFollowButton({ federation, next = '' }) {
  const { isAuthenticated } = useAuth();
  const q = useAcervoFollow(federation?.id, { enabled: isAuthenticated });
  const m = useSetAcervoFollow(federation?.id);
  if (!isAuthenticated) {
    return (
      <V2Button asChild variant="secondary" size="sm">
        <Link to={`/login?next=${encodeURIComponent(next || acervoPublicPath(federation))}`}><Bell className="h-4 w-4" />{t('Entrar para seguir')}</Link>
      </V2Button>
    );
  }
  if (q.isLoading || q.isError) return null;
  const sigo = Boolean(q.data);
  const alternar = () => m.mutate(!sigo, {
    onSuccess: () => toast.success(sigo ? t('Você deixou de seguir as publicações oficiais.') : t('Pronto: você recebe um aviso a cada ato publicado e a cada evento marcado, adiado ou cancelado.')),
    onError: () => toast.error(t('Não foi possível agora. Tente de novo.')),
  });
  return (
    <V2Button type="button" variant={sigo ? 'ghost' : 'secondary'} size="sm" onClick={alternar} disabled={m.isPending} aria-pressed={sigo} data-dica="federacao-acervo-seguir">
      {sigo ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}{sigo ? t('Deixar de seguir') : t('Seguir publicações')}
    </V2Button>
  );
}

/* ------------------------------------------------- bloco na página -- */

/** Os últimos atos na página da federação. Vitrine: sem nada publicado, o bloco diz isso e segue. */
export function FedAcervoBlock({ federation, limite = 4 }) {
  const a = useVisibleAcervo(federation);
  if (!a.ligado) return null;
  const ultimos = a.docs ? muralDocs(a.docs, limite) : [];
  return (
    <section id="federacao-acervo" aria-labelledby="fed-acervo" className="scroll-mt-4 space-y-3" data-dica="federacao-acervo-publico">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fed-acervo" className="font-display text-xl font-bold text-ink">{t('Mural e acervo oficial')}</h2>
        <V2Button asChild variant="ghost" size="sm"><Link to={acervoPublicPath(federation)}><Library className="h-4 w-4" />{t('Abrir o acervo')}</Link></V2Button>
      </div>
      {a.isError && <V2ErrorState inline title={t('Não carregou o acervo')} onRetry={a.refetch} />}
      {a.isLoading && <V2Skeleton lines={3} />}
      {a.docs && ultimos.length === 0 && <p className="text-sm text-gray-500">{t('A federação ainda não publicou documentos oficiais.')}</p>}
      {ultimos.length > 0 && <ul className="space-y-2">{ultimos.map((d) => <AcervoDocItem key={d.id} federation={federation} doc={d} />)}</ul>}
      {a.incompleto && <p className="text-xs text-amber-700">{t('Os documentos só para filiados ou para a equipe não carregaram agora.')}</p>}
    </section>
  );
}

/* --------------------------------------------------- página do acervo -- */

function Transparencia({ federation, docs }) {
  const itens = transparencyChecklist(docs);
  const ok = itens.filter((x) => x.ok).length;
  return (
    <section className="space-y-3" aria-label={t('Transparência')} data-dica="federacao-acervo-transparencia">
      <p className="text-sm text-gray-700">{t('O que a Lei Geral do Esporte (Lei 14.597/2023, art. 36) pede que a federação publique, e as boas práticas. {ok} de {total} publicados.', { ok, total: itens.length })}</p>
      <ul className="space-y-2">
        {itens.map((x) => (
          <li key={x.id} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-sm">
            {x.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{t(x.label)}</p>
              <p className="text-xs text-gray-500">{t(x.basis)}</p>
              {x.doc ? <Link className="mt-1 inline-block text-sm font-semibold text-ink underline" to={docPublicPath(federation, x.doc.id)}>{docCode(x.doc) || x.doc.title}</Link> : <p className="mt-1 text-sm text-amber-700">{t('não publicado')}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ABAS = ['mural', 'documentos', 'transparencia'];
const FILTRO_VAZIO = { q: '', category: '', year: '', onlyCurrent: false };

export function AcervoBrowser({ federation }) {
  const a = useVisibleAcervo(federation);
  const { copy } = useClipboard();
  const [aba, setAba] = useState(() => {
    const pedida = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('aba') : '';
    return ABAS.includes(pedida) ? pedida : 'mural';
  });
  const [filtro, setFiltroCru] = useState(FILTRO_VAZIO);
  const [quantos, setQuantos] = useState(POR_VEZ);
  // Mudou o filtro, a lista volta aos primeiros.
  const setFiltro = (fn) => { setFiltroCru(fn); setQuantos(POR_VEZ); };
  const algumFiltro = Boolean(filtro.q || filtro.category || filtro.year || filtro.onlyCurrent);
  const docs = useMemo(() => a.docs || [], [a.docs]);
  const filtrados = useMemo(() => sortDocs(filterDocs(docs, filtro)), [docs, filtro]);
  const anos = useMemo(() => docYears(docs), [docs]);
  const categorias = useMemo(() => docCategoriesIn(docs), [docs]);
  const link = typeof window !== 'undefined' ? `${window.location.origin}${acervoPublicPath(federation)}` : acervoPublicPath(federation);
  const compartilhar = async () => {
    if (navigator.share) { try { await navigator.share({ title: t('Acervo oficial — {federacao}', { federacao: federation.name }), url: link }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    copy(link, t('Link do acervo copiado.'));
  };
  const trocar = (x) => {
    setAba(x.value);
    try { const u = new URL(window.location.href); u.searchParams.set('aba', x.value); window.history.replaceState(null, '', u); } catch { /* sem URL: só a tela muda */ }
  };
  if (!a.ligado) return <p className="text-sm text-gray-500">{t('Esta federação não tem o acervo oficial ligado.')}</p>;
  return (
    <div className="space-y-4" data-dica="federacao-acervo-pagina">
      <div className="flex flex-wrap items-center gap-2">
        <AcervoFollowButton federation={federation} />
        <V2Button type="button" variant="ghost" size="sm" onClick={compartilhar}><Share2 className="h-4 w-4" />{t('Compartilhar o acervo')}</V2Button>
      </div>
      <V2SubTabs
        ariaLabel={t('Partes do acervo')}
        activeValue={aba}
        onSelect={trocar}
        tabs={[
          { value: 'mural', label: t('Mural'), icon: Megaphone },
          { value: 'documentos', label: t('Documentos'), icon: FileText },
          { value: 'transparencia', label: t('Transparência'), icon: CheckCircle2 },
        ]}
      />
      {a.isError && <V2ErrorState title={t('Não carregou o acervo')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={a.refetch} />}
      {a.isLoading && <V2Skeleton lines={6} />}
      {a.incompleto && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('Os documentos só para filiados ou para a equipe não carregaram agora. A lista mostra só os públicos.')}</p>}
      {a.docs && aba === 'mural' && (
        <section className="space-y-3" aria-label={t('Mural')}>
          <p className="text-sm text-gray-500">{t('As publicações oficiais mais recentes, como no mural da sede.')}</p>
          {docs.length === 0 ? <p className="text-sm text-gray-500">{t('A federação ainda não publicou documentos oficiais.')}</p>
            : <ul className="space-y-2">{muralDocs(docs, 30).map((d) => <AcervoDocItem key={d.id} federation={federation} doc={d} />)}</ul>}
        </section>
      )}
      {a.docs && aba === 'documentos' && (
        <section className="space-y-3" aria-label={t('Documentos')}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t('Buscar no acervo')}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <V2Input className="pl-9" type="search" value={filtro.q} onChange={(e) => setFiltro((f) => ({ ...f, q: e.target.value }))} placeholder={t('Título, número, palavra-chave…')} />
            </label>
            <V2Select aria-label={t('Categoria')} value={filtro.category} onChange={(e) => setFiltro((f) => ({ ...f, category: e.target.value }))}>
              <option value="">{t('Todas as categorias')}</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
            </V2Select>
            <V2Select aria-label={t('Ano')} value={filtro.year} onChange={(e) => setFiltro((f) => ({ ...f, year: e.target.value }))}>
              <option value="">{t('Todos os anos')}</option>
              {anos.map((y) => <option key={y} value={y}>{y}</option>)}
            </V2Select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={filtro.onlyCurrent} onChange={(e) => setFiltro((f) => ({ ...f, onlyCurrent: e.target.checked }))} />
            {t('Só o que está em vigor (sem os revogados)')}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-gray-500" aria-live="polite">{tn(filtrados.length, '{n} documento', '{n} documentos')}</p>
            {algumFiltro && <button type="button" onClick={() => setFiltro(() => FILTRO_VAZIO)} className="text-xs font-semibold text-ink underline">{t('Limpar filtros')}</button>}
          </div>
          {docs.length === 0 ? <p className="text-sm text-gray-500">{t('A federação ainda não publicou documentos oficiais.')}</p>
            : filtrados.length === 0 ? <p className="text-sm text-gray-500">{t('Nada com esses filtros.')}</p>
              : (
                <>
                  <ul className="space-y-2">{filtrados.slice(0, quantos).map((d) => <AcervoDocItem key={d.id} federation={federation} doc={d} />)}</ul>
                  <MostrarMais restam={filtrados.length - quantos} onClick={() => setQuantos((n) => n + POR_VEZ)} />
                </>
              )}
        </section>
      )}
      {a.docs && aba === 'transparencia' && <Transparencia federation={federation} docs={docs.filter(isDocCurrent)} />}
    </div>
  );
}

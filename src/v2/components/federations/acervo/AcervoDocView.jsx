/**
 * A página de UM documento do acervo oficial (`/f/:slug/acervo/:docId`):
 * ler (texto, PDF, imagem, áudio, vídeo e vídeo por link), baixar,
 * compartilhar (com QR), imprimir e CONFERIR um arquivo baixado contra o
 * SHA-256 que o servidor calculou ao publicar. Revogado não some: leva a
 * faixa "Revogado por …"; retificado mostra a versão e o motivo, com as
 * anteriores (e os arquivos delas) logo abaixo.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import {
  DOC_RELATION_INVERSE_LABELS, DOC_RELATION_LABELS, DOC_VISIBILITY, docCategory, docCode, docDisplayTitle,
  docType, docHasValidity } from '@/modules/federations/domain/acervo';
import { V2Badge } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import { Arquivo, Compartilhar, ConferirIntegridade, VideoPorLink } from './AcervoPecas';
import { AcervoFollowButton } from './AcervoPublic';
import CommentsSection from '../comments/CommentsSection';
import { acervoPathFor, acervoScopeIds, docPathFor, isClubDocs, visibilityLabelFor } from './acervoScope';

/* ---------------------------------------------------------------- página -- */

export default function AcervoDocView({ federation, doc, relacionados = [] }) {
  const tipo = docType(doc.type);
  const cat = docCategory(doc.category);
  const code = docCode(doc);
  const clube = isClubDocs(federation);
  const scope = acervoScopeIds(federation);
  const nomeDe = (id) => {
    const d = relacionados.find((x) => x.id === id);
    return d ? docDisplayTitle(d) : t('documento relacionado');
  };
  return (
    <article className="space-y-5" aria-labelledby="acervo-doc-titulo">
      <header className="space-y-3 rounded-4xl bg-paper-pure p-6 shadow-organic print:shadow-none">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          <Link to={acervoPathFor(federation)} className="underline print:no-underline">{federation.acronym || federation.name}</Link>
          {cat ? ` · ${t(cat.label)}` : ''}{tipo ? ` · ${t(tipo.label)}` : ''}
        </p>
        <h1 id="acervo-doc-titulo" className="font-display text-2xl font-bold text-ink sm:text-3xl">{code ? <span className="block text-base text-gray-500 sm:text-lg">{code}</span> : null}{doc.title}</h1>
        <div className="flex flex-wrap gap-2">
          {doc.visibility !== DOC_VISIBILITY.PUBLIC && <V2Badge tone="neutral">{t(visibilityLabelFor(federation, doc.visibility))}</V2Badge>}
          {doc.version > 1 && <V2Badge tone="amber">{t('Versão {n}', { n: doc.version })}</V2Badge>}
          {doc.revoked_by ? <V2Badge tone="red">{t('Revogado')}</V2Badge> : docHasValidity(doc) && <V2Badge tone="green">{t('Em vigor')}</V2Badge>}
        </div>
        {doc.revoked_by && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {t('Revogado por')} <Link className="font-semibold underline" to={docPathFor(federation, doc.revoked_by.doc_id)}>{doc.revoked_by.code || doc.revoked_by.title}</Link>{doc.revoked_by.at_ms ? ` · ${quando(doc.revoked_by.at_ms)}` : ''}
          </p>
        )}
        {doc.version > 1 && doc.version_reason && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('Retificado em {data}: {motivo}', { data: quando(doc.version_at_ms), motivo: doc.version_reason })}</p>}
        {doc.summary && <p className="text-sm leading-6 text-gray-700">{doc.summary}</p>}
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {doc.act_date && <div><dt className="text-xs text-gray-500">{t('Data do ato')}</dt><dd className="text-ink">{quando(doc.act_date)}</dd></div>}
          <div><dt className="text-xs text-gray-500">{t('Publicado em')}</dt><dd className="text-ink">{quando(doc.published_at_ms)}</dd></div>
          {doc.signed_by && <div><dt className="text-xs text-gray-500">{t('Assina')}</dt><dd className="text-ink">{doc.signed_by}</dd></div>}
        </dl>
        {(doc.tags || []).length > 0 && <p className="text-xs text-gray-500">{doc.tags.map((x) => `#${x}`).join(' ')}</p>}
        <Compartilhar entity={federation} doc={doc} />
      </header>

      {doc.body && <section aria-label={t('Texto do documento')} className="whitespace-pre-wrap rounded-4xl bg-paper-pure p-6 text-sm leading-7 text-ink shadow-organic print:shadow-none">{doc.body}</section>}

      {((doc.files || []).length > 0 || (doc.media_links || []).length > 0) && (
        <section aria-labelledby="acervo-arquivos" className="space-y-2">
          <h2 id="acervo-arquivos" className="font-display text-lg font-bold text-ink">{t('Arquivos')}</h2>
          <ul className="space-y-2">
            {(doc.files || []).map((file) => <Arquivo key={file.path} scope={scope} doc={doc} file={file} />)}
            {(doc.media_links || []).map((l) => <VideoPorLink key={l.url} link={l} />)}
          </ul>
        </section>
      )}

      {((doc.relations || []).length > 0 || (doc.related_by || []).length > 0) && (
        <section aria-labelledby="acervo-relacoes" className="space-y-2 rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm">
          <h2 id="acervo-relacoes" className="font-semibold text-ink">{t('Atos relacionados')}</h2>
          <ul className="space-y-1">
            {(doc.relations || []).map((r) => <li key={`r-${r.kind}-${r.doc_id}`}><span className="text-gray-500">{t(DOC_RELATION_LABELS[r.kind] || r.kind)}:</span> <Link className="font-semibold text-ink underline" to={docPathFor(federation, r.doc_id)}>{nomeDe(r.doc_id)}</Link></li>)}
            {(doc.related_by || []).map((r) => <li key={`b-${r.kind}-${r.doc_id}`}><span className="text-gray-500">{t(DOC_RELATION_INVERSE_LABELS[r.kind] || r.kind)}:</span> <Link className="font-semibold text-ink underline" to={docPathFor(federation, r.doc_id)}>{r.code ? `${r.code} — ${r.title}` : r.title}</Link></li>)}
          </ul>
        </section>
      )}

      {(doc.versions || []).length > 0 && (
        <details className="rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink"><History className="mr-1 inline h-4 w-4" aria-hidden="true" />{t('Versões anteriores ({n})', { n: doc.versions.length })}</summary>
          <ul className="mt-3 space-y-4">
            {[...doc.versions].reverse().map((v) => (
              <li key={v.version} className="space-y-2">
                <p className="font-semibold text-ink">{t('Versão {n}', { n: v.version })} · {quando(v.version_at_ms)}{v.version_reason ? ` · ${v.version_reason}` : ''}</p>
                {v.title !== doc.title && <p className="text-gray-700">{v.title}</p>}
                {v.body && <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-ink">{v.body}</div>}
                {(v.files || []).length > 0 && <ul className="space-y-2">{v.files.map((file) => <Arquivo key={file.path} scope={scope} doc={doc} file={file} />)}</ul>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConferirIntegridade doc={doc} />

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {clube ? <span /> : <AcervoFollowButton federation={federation} />}
        <Link to={acervoPathFor(federation)} className="text-sm font-semibold text-ink underline">{clube ? t('Ver todos os documentos') : t('Ver todo o acervo')}</Link>
      </div>
      <p className="hidden text-xs text-gray-500 print:block">{t('Documento oficial publicado em {url}', { url: `${window.location.host}${docPathFor(federation, doc.id)}` })}</p>
      {!clube && doc.status === 'published' && <div className="print:hidden"><CommentsSection federation={federation} kind="doc" targetId={doc.id} /></div>}
    </article>
  );
}

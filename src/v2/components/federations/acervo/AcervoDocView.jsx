/**
 * A página de UM documento do acervo oficial (`/f/:slug/acervo/:docId`):
 * ler (texto, PDF, imagem, áudio, vídeo e vídeo por link), baixar,
 * compartilhar (com QR), imprimir e CONFERIR um arquivo baixado contra o
 * SHA-256 que o servidor calculou ao publicar. Revogado não some: leva a
 * faixa "Revogado por …"; retificado mostra a versão e o motivo, com as
 * anteriores (e os arquivos delas) logo abaixo.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Download, Eye, FileText, History, Printer, QrCode, Share2, ShieldCheck, ShieldX } from 'lucide-react';
import { useClipboard } from '@/core/lib/useClipboard';
import { buildWhatsAppShareUrl } from '@/modules/sharing/domain/shareLinks';
import {
  DOC_RELATION_INVERSE_LABELS, DOC_RELATION_LABELS, DOC_VISIBILITY, DOC_VISIBILITY_LABELS, acervoPublicPath, docCategory, docCode, docDisplayTitle,
  docPublicPath, docType, fileSizeLabel, fileViewKind, findFileByHash, videoEmbed,
} from '@/modules/federations/domain/acervo';
import { V2Badge, V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando, useQrDataUrl } from '../federationUi';
import { baixarBlob, fetchAcervoBlob, sha256DoArquivo } from './acervoFiles';
import { AcervoFollowButton } from './AcervoPublic';
import CommentsSection from '../comments/CommentsSection';

/* --------------------------------------------------------------- arquivo -- */

/**
 * Um arquivo: o público abre direto (o PDF e o vídeo só quando a pessoa pede,
 * para não baixar 100 MB sem querer); o restrito vem do servidor ao tocar.
 */
function Arquivo({ federation, doc, file }) {
  const tipo = fileViewKind(file.content_type);
  const [blobUrl, setBlobUrl] = useState('');
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const blobRef = useRef(null);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  const src = file.url || blobUrl;

  const trazer = async () => {
    if (file.url || blobRef.current) return blobRef.current;
    setCarregando(true);
    try {
      const r = await fetchAcervoBlob({ federationId: federation.id, docId: doc.id, file });
      blobRef.current = r;
      setBlobUrl(URL.createObjectURL(r.blob));
      return r;
    } catch (e) {
      toast.error(e?.message || t('Não foi possível abrir o arquivo agora.'));
      return null;
    } finally { setCarregando(false); }
  };
  const ver = async () => { await trazer(); setAberto(true); };
  const baixar = async () => {
    if (file.url) { window.open(file.url, '_blank', 'noopener,noreferrer'); return; }
    const r = await trazer();
    if (r) baixarBlob(r.blob, r.name);
  };
  const imagemDireta = tipo === 'image' && file.url;
  const podeVer = tipo !== 'download';

  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <span className="min-w-0 flex-1 break-words font-semibold text-ink">{file.name}</span>
        <span className="text-xs text-gray-500">{fileSizeLabel(file.size)}</span>
        <span className="flex gap-2 print:hidden">
          {podeVer && !imagemDireta && !aberto && <V2Button type="button" size="sm" variant="secondary" disabled={carregando} onClick={ver}><Eye className="h-4 w-4" />{t('Ver aqui')}</V2Button>}
          <V2Button type="button" size="sm" variant="ghost" disabled={carregando} onClick={baixar}><Download className="h-4 w-4" />{file.url ? t('Abrir ou baixar') : t('Baixar')}</V2Button>
        </span>
      </div>
      {imagemDireta && <img src={file.url} alt={file.name} loading="lazy" className="max-h-[70vh] w-full rounded-xl object-contain" />}
      {aberto && src && tipo === 'pdf' && (
        <div className="space-y-1 print:hidden">
          <iframe title={file.name} src={src} className="h-[75vh] w-full rounded-xl border border-gray-100 bg-white" />
          <p className="text-xs text-gray-500">{t('O PDF não apareceu? Alguns celulares não mostram PDF dentro da página: use "Abrir ou baixar".')}</p>
        </div>
      )}
      {aberto && src && tipo === 'image' && <img src={src} alt={file.name} className="max-h-[70vh] w-full rounded-xl object-contain" />}
      {aberto && src && tipo === 'audio' && <audio controls preload="metadata" src={src} className="w-full">{t('Seu navegador não toca este áudio. Baixe o arquivo.')}</audio>}
      {aberto && src && tipo === 'video' && <video controls preload="metadata" src={src} className="max-h-[75vh] w-full rounded-xl bg-black">{t('Seu navegador não toca este vídeo. Baixe o arquivo.')}</video>}
      {file.sha256 && <p className="break-all font-mono text-xs text-gray-500" title={t('Código de integridade (SHA-256)')}>SHA-256 {file.sha256}</p>}
    </li>
  );
}

/** Vídeo por link: incorporado sem cookies (YouTube) ou pelo player do Vimeo, só depois do toque. */
function VideoPorLink({ link }) {
  const v = videoEmbed(link.url);
  const [tocar, setTocar] = useState(false);
  if (!v) return null;
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-sm">
      <p className="font-semibold text-ink">{link.title || t('Vídeo')}</p>
      {tocar ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black print:hidden">
          <iframe title={link.title || t('Vídeo')} src={v.embed} className="h-full w-full" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <V2Button type="button" size="sm" variant="secondary" className="print:hidden" onClick={() => setTocar(true)}><Eye className="h-4 w-4" />{t('Assistir aqui')}</V2Button>
      )}
      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-xs text-gray-500 underline">{link.url}</a>
    </li>
  );
}

/* ----------------------------------------------------------- integridade -- */

/** Confere, no próprio aparelho, um arquivo baixado contra o SHA-256 publicado. Nada é enviado. */
function ConferirIntegridade({ doc }) {
  const input = useRef(null);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const temCodigo = [...(doc.files || []), ...(doc.versions || []).flatMap((v) => v.files || [])].some((x) => x.sha256);
  if (!temCodigo) return null;
  const conferir = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setCalculando(true);
    try {
      const hash = await sha256DoArquivo(arquivo);
      setResultado({ nome: arquivo.name, hash, achado: findFileByHash(doc, hash) });
    } catch {
      setResultado({ nome: arquivo.name, erro: true });
    } finally { setCalculando(false); }
  };
  return (
    <section className="space-y-2 rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm print:hidden" aria-labelledby="acervo-integridade" data-dica="federacao-acervo-integridade">
      <h2 id="acervo-integridade" className="font-semibold text-ink">{t('Conferir um arquivo')}</h2>
      <p className="text-gray-500">{t('Recebeu este documento por outro caminho? Escolha o arquivo e o aparelho calcula o código e compara com o publicado. O arquivo não sai do seu aparelho.')}</p>
      <input ref={input} type="file" className="sr-only" onChange={conferir} aria-label={t('Escolher o arquivo para conferir')} />
      <V2Button type="button" size="sm" variant="secondary" disabled={calculando} onClick={() => input.current?.click()}><ShieldCheck className="h-4 w-4" />{calculando ? t('Calculando…') : t('Escolher o arquivo')}</V2Button>
      {resultado && (
        <div role="status" className={resultado.achado ? 'rounded-xl border border-green-200 bg-green-50 p-3 text-green-900' : 'rounded-xl border border-red-200 bg-red-50 p-3 text-red-900'}>
          {resultado.erro ? <p>{t('Não foi possível ler "{nome}".', { nome: resultado.nome })}</p>
            : resultado.achado ? (
              <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{resultado.achado.current
                ? t('"{nome}" é idêntico ao arquivo publicado "{publicado}".', { nome: resultado.nome, publicado: resultado.achado.file.name })
                : t('"{nome}" é idêntico a "{publicado}", da versão {n}, que já foi substituída.', { nome: resultado.nome, publicado: resultado.achado.file.name, n: resultado.achado.version })}</p>
            ) : (
              <p className="flex items-start gap-2"><ShieldX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('"{nome}" difere de todos os arquivos deste documento. Ele pode ter sido alterado, ou ser outro arquivo.', { nome: resultado.nome })}</p>
            )}
          {resultado.hash && <p className="mt-1 break-all font-mono text-xs">SHA-256 {resultado.hash}</p>}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ compartilhar -- */

function Compartilhar({ federation, doc }) {
  const { copy } = useClipboard();
  const [qr, setQr] = useState(false);
  const link = `${window.location.origin}${docPublicPath(federation, doc.id)}`;
  const qrUrl = useQrDataUrl(qr ? link : '', { width: 280 });
  const titulo = docDisplayTitle(doc);
  const compartilhar = async () => {
    const texto = t('{federacao}: {titulo}', { federacao: federation.acronym || federation.name, titulo });
    if (navigator.share) { try { await navigator.share({ title: titulo, text: texto, url: link }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    window.open(buildWhatsAppShareUrl(`${texto} ${link}`), '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" onClick={compartilhar} data-dica="federacao-acervo-compartilhar"><Share2 className="h-4 w-4" />{t('Compartilhar')}</V2Button>
        <V2Button type="button" size="sm" variant="secondary" onClick={() => copy(link, t('Link copiado.'))}><Copy className="h-4 w-4" />{t('Copiar o link')}</V2Button>
        <V2Button type="button" size="sm" variant="secondary" onClick={() => setQr((x) => !x)} aria-expanded={qr}><QrCode className="h-4 w-4" />{t('QR do documento')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('Imprimir')}</V2Button>
      </div>
      {doc.visibility !== DOC_VISIBILITY.PUBLIC && <p className="text-xs text-gray-500">{t('Quem receber o link precisa ter acesso: este documento é {quem}.', { quem: t(DOC_VISIBILITY_LABELS[doc.visibility]).toLowerCase() })}</p>}
      {qr && qrUrl && (
        <div className="inline-block rounded-2xl border border-gray-100 bg-white p-3 text-center">
          <img src={qrUrl} alt={t('QR com o link do documento')} width={200} height={200} />
          <a href={qrUrl} download={`${(docCode(doc) || doc.title || 'documento').replace(/[^\p{L}\p{N}]+/gu, '-')}-qr.png`} className="mt-2 block text-xs font-semibold text-ink underline">{t('Baixar o QR')}</a>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- página -- */

export default function AcervoDocView({ federation, doc, relacionados = [] }) {
  const tipo = docType(doc.type);
  const cat = docCategory(doc.category);
  const code = docCode(doc);
  const nomeDe = (id) => {
    const d = relacionados.find((x) => x.id === id);
    return d ? docDisplayTitle(d) : t('documento relacionado');
  };
  return (
    <article className="space-y-5" aria-labelledby="acervo-doc-titulo">
      <header className="space-y-3 rounded-4xl bg-paper-pure p-6 shadow-organic print:shadow-none">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          <Link to={acervoPublicPath(federation)} className="underline print:no-underline">{federation.acronym || federation.name}</Link>
          {cat ? ` · ${t(cat.label)}` : ''}{tipo ? ` · ${t(tipo.label)}` : ''}
        </p>
        <h1 id="acervo-doc-titulo" className="font-display text-2xl font-bold text-ink sm:text-3xl">{code ? <span className="block text-base text-gray-500 sm:text-lg">{code}</span> : null}{doc.title}</h1>
        <div className="flex flex-wrap gap-2">
          {doc.visibility !== DOC_VISIBILITY.PUBLIC && <V2Badge tone="neutral">{t(DOC_VISIBILITY_LABELS[doc.visibility])}</V2Badge>}
          {doc.version > 1 && <V2Badge tone="amber">{t('Versão {n}', { n: doc.version })}</V2Badge>}
          {doc.revoked_by ? <V2Badge tone="red">{t('Revogado')}</V2Badge> : <V2Badge tone="green">{t('Em vigor')}</V2Badge>}
        </div>
        {doc.revoked_by && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {t('Revogado por')} <Link className="font-semibold underline" to={docPublicPath(federation, doc.revoked_by.doc_id)}>{doc.revoked_by.code || doc.revoked_by.title}</Link>{doc.revoked_by.at_ms ? ` · ${quando(doc.revoked_by.at_ms)}` : ''}
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
        <Compartilhar federation={federation} doc={doc} />
      </header>

      {doc.body && <section aria-label={t('Texto do documento')} className="whitespace-pre-wrap rounded-4xl bg-paper-pure p-6 text-sm leading-7 text-ink shadow-organic print:shadow-none">{doc.body}</section>}

      {((doc.files || []).length > 0 || (doc.media_links || []).length > 0) && (
        <section aria-labelledby="acervo-arquivos" className="space-y-2">
          <h2 id="acervo-arquivos" className="font-display text-lg font-bold text-ink">{t('Arquivos')}</h2>
          <ul className="space-y-2">
            {(doc.files || []).map((file) => <Arquivo key={file.path} federation={federation} doc={doc} file={file} />)}
            {(doc.media_links || []).map((l) => <VideoPorLink key={l.url} link={l} />)}
          </ul>
        </section>
      )}

      {((doc.relations || []).length > 0 || (doc.related_by || []).length > 0) && (
        <section aria-labelledby="acervo-relacoes" className="space-y-2 rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm">
          <h2 id="acervo-relacoes" className="font-semibold text-ink">{t('Atos relacionados')}</h2>
          <ul className="space-y-1">
            {(doc.relations || []).map((r) => <li key={`r-${r.kind}-${r.doc_id}`}><span className="text-gray-500">{t(DOC_RELATION_LABELS[r.kind] || r.kind)}:</span> <Link className="font-semibold text-ink underline" to={docPublicPath(federation, r.doc_id)}>{nomeDe(r.doc_id)}</Link></li>)}
            {(doc.related_by || []).map((r) => <li key={`b-${r.kind}-${r.doc_id}`}><span className="text-gray-500">{t(DOC_RELATION_INVERSE_LABELS[r.kind] || r.kind)}:</span> <Link className="font-semibold text-ink underline" to={docPublicPath(federation, r.doc_id)}>{r.code ? `${r.code} — ${r.title}` : r.title}</Link></li>)}
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
                {(v.files || []).length > 0 && <ul className="space-y-2">{v.files.map((file) => <Arquivo key={file.path} federation={federation} doc={doc} file={file} />)}</ul>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConferirIntegridade doc={doc} />

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <AcervoFollowButton federation={federation} />
        <Link to={acervoPublicPath(federation)} className="text-sm font-semibold text-ink underline">{t('Ver todo o acervo')}</Link>
      </div>
      <p className="hidden text-xs text-gray-500 print:block">{t('Documento oficial publicado em {url}', { url: `${window.location.host}${docPublicPath(federation, doc.id)}` })}</p>
      {doc.status === 'published' && <div className="print:hidden"><CommentsSection federation={federation} kind="doc" targetId={doc.id} /></div>}
    </article>
  );
}

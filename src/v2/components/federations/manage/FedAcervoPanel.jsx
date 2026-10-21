/**
 * Acervo oficial da federação (Central → Acervo oficial; permissão `docs`
 * ou `admin`, módulo `official_docs`):
 *  - Documentos: rascunhos e publicados, com busca e filtros. Publicado não
 *    se edita: corrige-se por RETIFICAÇÃO (nova versão com motivo), ERRATA
 *    ou um ato novo que ALTERA ou REVOGA. Só o admin retira do ar.
 *  - Transparência: o que a Lei Geral do Esporte (art. 36) pede publicado,
 *    item a item, dizendo o que falta.
 * Tudo que grava passa pelo servidor (`federationAcervo`).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CircleAlert, Copy, Eye, EyeOff, ExternalLink, FilePen, FileText, History, Library, Pencil, Plus, Send, ShieldOff, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useClipboard } from '@/core/lib/useClipboard';
import { acervoAction } from '@/modules/federations/services/federationService';
import { abrirArquivoDoAcervo } from '../acervo/acervoFiles';
import AcervoPosterButton from '../acervo/AcervoPoster';
import { Link } from 'react-router-dom';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  DOC_CATEGORIES, DOC_REASON_MIN, DOC_RELATION, DOC_RELATION_INVERSE_LABELS, DOC_STATUS, DOC_STATUS_LABELS, DOC_VISIBILITY, DOC_VISIBILITY_HINTS,
  DOC_VISIBILITY_LABELS, DOC_WITHDRAW_REASON_MIN, acervoPublicPath, docActions, docCategory, docCode, docDisplayTitle, docPublicPath, docType, docYears, fileSizeLabel, filterDocs,
  isDocCurrent, transparencyChecklist,
} from '@/modules/federations/domain/acervo';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tk, tn } from '@/core/i18n';
import { quando } from '../federationUi';
import { AcervoUploader, DocForm, MediaLinksEditor } from './FedAcervoForm';

const STATUS_TONE = { draft: 'neutral', published: 'green', withdrawn: 'red' };

/* --------------------------------------------------------------- detalhe -- */

function ArquivosDoDoc({ federation, doc, files }) {
  const [abrindo, setAbrindo] = useState('');
  if (!files?.length) return null;
  const abrir = async (file) => { setAbrindo(file.path); try { await abrirArquivoDoAcervo({ federationId: federation.id, doc, file }); } catch (e) { toast.error(e.message); } finally { setAbrindo(''); } };
  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.path} className="rounded-xl border border-gray-100 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{file.name}</span>
            <span className="text-xs text-gray-500">{fileSizeLabel(file.size)}</span>
            <V2Button type="button" size="sm" variant="secondary" disabled={abrindo === file.path} onClick={() => abrir(file)}><ExternalLink className="h-4 w-4" />{file.url ? t('Abrir') : t('Baixar')}</V2Button>
          </div>
          {file.sha256 && <p className="mt-1 break-all font-mono text-xs text-gray-500" title={t('Código de integridade (SHA-256)')}>SHA-256 {file.sha256}</p>}
        </li>
      ))}
    </ul>
  );
}

function DocDetalhe({ federation, doc }) {
  const { copy } = useClipboard();
  const tipo = docType(doc.type);
  const link = `${window.location.origin}${docPublicPath(federation, doc.id)}`;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <V2Badge tone={STATUS_TONE[doc.status] || 'neutral'}>{t(DOC_STATUS_LABELS[doc.status] || doc.status)}</V2Badge>
        <V2Badge tone="ink">{t(DOC_VISIBILITY_LABELS[doc.visibility] || doc.visibility)}</V2Badge>
        {tipo && <V2Badge tone="neutral">{t(tipo.label)}</V2Badge>}
        {doc.version > 1 && <V2Badge tone="amber">{t('Versão {n}', { n: doc.version })}</V2Badge>}
      </div>
      {doc.revoked_by && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-900">{t('Revogado por {doc}.', { doc: doc.revoked_by.code || doc.revoked_by.title })}</p>}
      {doc.status === DOC_STATUS.WITHDRAWN && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-900">{t('Retirado do ar: {motivo}', { motivo: doc.withdrawn_reason || '—' })}</p>}
      {doc.summary && <p className="text-ink">{doc.summary}</p>}
      <dl className="grid gap-2 sm:grid-cols-2">
        {doc.act_date && <div><dt className="text-xs text-gray-500">{t('Data do ato')}</dt><dd className="text-ink">{quando(doc.act_date)}</dd></div>}
        {doc.published_at_ms && <div><dt className="text-xs text-gray-500">{t('Publicado em')}</dt><dd className="text-ink">{quando(doc.published_at_ms)}{doc.published_by_name ? ` · ${doc.published_by_name}` : ''}</dd></div>}
        {doc.signed_by && <div><dt className="text-xs text-gray-500">{t('Assina')}</dt><dd className="text-ink">{doc.signed_by}</dd></div>}
        {doc.version > 1 && <div><dt className="text-xs text-gray-500">{t('Motivo da versão atual')}</dt><dd className="text-ink">{doc.version_reason}</dd></div>}
      </dl>
      {doc.body && <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-3 text-ink">{doc.body}</div>}
      <ArquivosDoDoc federation={federation} doc={doc} files={doc.files} />
      {(doc.media_links || []).length > 0 && (
        <ul className="space-y-1">{doc.media_links.map((l) => <li key={l.url}><a className="font-semibold text-ink underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.url}</a></li>)}</ul>
      )}
      {(doc.related_by || []).length > 0 && (
        <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Atos ligados a este')}</p><ul className="mt-1 space-y-1">{doc.related_by.map((r) => <li key={r.doc_id} className="text-ink">{t(DOC_RELATION_INVERSE_LABELS[r.kind] || r.kind)}: {r.code || r.title}</li>)}</ul></div>
      )}
      {(doc.versions || []).length > 0 && (
        <details className="rounded-xl border border-gray-100 p-3">
          <summary className="cursor-pointer font-semibold text-ink"><History className="mr-1 inline h-4 w-4" aria-hidden="true" />{t('Versões anteriores ({n})', { n: doc.versions.length })}</summary>
          <ul className="mt-2 space-y-3">
            {[...doc.versions].reverse().map((v) => (
              <li key={v.version} className="space-y-1">
                <p className="font-semibold text-ink">{t('Versão {n}', { n: v.version })} · {quando(v.version_at_ms)}{v.version_reason ? ` · ${v.version_reason}` : ''}</p>
                <ArquivosDoDoc federation={federation} doc={doc} files={v.files} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {doc.status === DOC_STATUS.PUBLISHED && (
        <div className="flex flex-wrap items-center gap-2">
          <V2Button type="button" size="sm" variant="ghost" onClick={() => copy(link)}><Copy className="h-4 w-4" />{t('Copiar o link')}</V2Button>
          {doc.visibility !== DOC_VISIBILITY.PUBLIC && <span className="text-xs text-gray-500">{t(DOC_VISIBILITY_HINTS[doc.visibility])}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- ações -- */

function PublicarDialog({ federation, doc, onFechar }) {
  const m = useFederationMutation(() => acervoAction({ federationId: federation.id, action: 'publish', docId: doc.id }));
  const tipo = docType(doc.type);
  const publicar = () => m.mutate(undefined, {
    onSuccess: (r) => { toast.success(r?.code ? t('Publicado: {codigo}.', { codigo: r.code }) : t('Documento publicado.')); onFechar(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink">{t('Depois de publicado, o documento não se edita nem se apaga. Para corrigir, use retificação (nova versão com motivo), errata ou um ato novo que o altere ou revogue.')}</p>
      <ul className="space-y-1 text-gray-500">
        {tipo?.numbered && <li>{t('Ganha o próximo número de {tipo} deste ano.', { tipo: t(tipo.label) })}</li>}
        <li>{t('Quem vê: {quem}.', { quem: t(DOC_VISIBILITY_LABELS[doc.visibility]) })}</li>
        {(doc.files || []).length > 0 && <li>{t('Cada arquivo recebe um código de integridade (SHA-256) para conferir cópias.')}</li>}
        {(doc.relations || []).some((r) => r.kind === DOC_RELATION.REVOKES) && <li className="font-semibold text-ink">{t('O documento revogado continua no acervo, com a faixa "Revogado por".')}</li>}
      </ul>
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="button" disabled={m.isPending} onClick={publicar}><Send className="h-4 w-4" />{m.isPending ? t('Publicando…') : t('Publicar')}</V2Button></div>
    </div>
  );
}

function RetificarDialog({ federation, doc, onFechar }) {
  const [f, setF] = useState({ title: doc.title || '', summary: doc.summary || '', body: doc.body || '', media_links: doc.media_links || [], reason: '' });
  const [manter, setManter] = useState(() => new Set((doc.files || []).map((x) => x.path)));
  const [novos, setNovos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const m = useFederationMutation(() => acervoAction({
    federationId: federation.id, action: 'rectify', docId: doc.id, reason: f.reason, keep_files: [...manter],
    doc: { title: f.title, summary: f.summary, body: f.body, media_links: f.media_links, files: novos },
  }));
  const enviar = (e) => {
    e.preventDefault();
    if (f.reason.trim().length < DOC_REASON_MIN) { toast.error(t('Diga o motivo da retificação (mínimo {n} caracteres).', { n: DOC_REASON_MIN })); return; }
    m.mutate(undefined, { onSuccess: (r) => { toast.success(t('Versão {n} publicada.', { n: r?.version || '' })); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <p className="text-sm text-gray-500">{t('A versão atual vai para o histórico, com os arquivos e os códigos de integridade, e continua visível. Tipo, número, visibilidade e relações não mudam.')}</p>
      <V2Field label={t('Motivo da retificação')} htmlFor="rt-motivo" required hint={t('Fica público ao lado da nova versão.')}><V2Input id="rt-motivo" maxLength={500} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></V2Field>
      <V2Field label={t('Título')} htmlFor="rt-titulo"><V2Input id="rt-titulo" maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></V2Field>
      <V2Field label={t('Ementa ou resumo')} htmlFor="rt-resumo"><V2Textarea id="rt-resumo" rows={2} maxLength={600} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></V2Field>
      <V2Field label={t('Texto')} htmlFor="rt-texto"><V2Textarea id="rt-texto" rows={5} maxLength={30000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></V2Field>
      {(doc.files || []).length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">{t('Arquivos que continuam')}</legend>
          {doc.files.map((x) => (
            <label key={x.path} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={manter.has(x.path)} onChange={(e) => setManter((s) => { const n = new Set(s); if (e.target.checked) n.add(x.path); else n.delete(x.path); return n; })} />
              {x.name}
            </label>
          ))}
        </fieldset>
      )}
      <V2Field label={t('Arquivos novos')} htmlFor="rt-arquivos">
        <AcervoUploader id="rt-arquivos" value={novos} onAdd={(x) => setNovos((l) => [...l, x])} onRemove={(p) => setNovos((l) => l.filter((x) => x.path !== p))} onBusy={setEnviando} restricted={doc.visibility !== DOC_VISIBILITY.PUBLIC} />
      </V2Field>
      <div className="space-y-2"><p className="text-sm font-semibold text-ink">{t('Vídeos por link')}</p><MediaLinksEditor value={f.media_links} onChange={(media_links) => setF({ ...f, media_links })} /></div>
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={m.isPending || enviando}>{m.isPending ? t('Publicando…') : t('Publicar nova versão')}</V2Button></div>
    </form>
  );
}

function VisibilidadeDialog({ federation, doc, onFechar }) {
  const [v, setV] = useState(doc.visibility);
  const m = useFederationMutation(() => acervoAction({ federationId: federation.id, action: 'visibility', docId: doc.id, visibility: v }));
  return (
    <div className="space-y-4">
      <V2Field label={t('Quem vê')} htmlFor="vs-sel" hint={t(DOC_VISIBILITY_HINTS[v])}>
        <V2Select id="vs-sel" value={v} onChange={(e) => setV(e.target.value)}>{Object.values(DOC_VISIBILITY).map((x) => <option key={x} value={x}>{t(DOC_VISIBILITY_LABELS[x])}</option>)}</V2Select>
      </V2Field>
      {doc.visibility === DOC_VISIBILITY.PUBLIC && v !== DOC_VISIBILITY.PUBLIC && <p className="text-sm text-gray-500">{t('Os links públicos dos arquivos deixam de funcionar na hora. Quem já baixou continua com a cópia.')}</p>}
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="button" disabled={m.isPending || v === doc.visibility} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Visibilidade alterada.')); onFechar(); }, onError: (e) => toast.error(e.message) })}>{t('Salvar')}</V2Button></div>
    </div>
  );
}

function RetirarDialog({ federation, doc, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation(() => acervoAction({ federationId: federation.id, action: 'withdraw', docId: doc.id, reason: motivo }));
  const ok = motivo.trim().length >= DOC_WITHDRAW_REASON_MIN;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('Para ordem judicial, dado pessoal publicado por engano ou documento falso. Nada é apagado: o documento sai das páginas, os links morrem, e a equipe continua vendo com o motivo. Corrigir um erro comum é retificação, não isto.')}</p>
      <V2Field label={t('Motivo')} htmlFor="rd-motivo" required hint={t('Mínimo {n} caracteres. Fica no registro da federação.', { n: DOC_WITHDRAW_REASON_MIN })}><V2Textarea id="rd-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="button" variant="danger" disabled={!ok || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Documento retirado do ar.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><ShieldOff className="h-4 w-4" />{t('Retirar do ar')}</V2Button></div>
    </div>
  );
}

/* ------------------------------------------------------------ documentos -- */

function DocRow({ doc, acoes, onAbrir }) {
  const cat = docCategory(doc.category);
  const tipo = docType(doc.type);
  const titulo = docDisplayTitle({ ...doc, code: doc.code || docCode(doc) });
  return (
    <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
      <FileText className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
          <button type="button" className="text-left hover:underline" onClick={() => onAbrir('ver', doc)}>{titulo}</button>
          <V2Badge tone={STATUS_TONE[doc.status] || 'neutral'}>{t(DOC_STATUS_LABELS[doc.status] || doc.status)}</V2Badge>
          {doc.status === DOC_STATUS.PUBLISHED && <V2Badge tone="ink">{t(DOC_VISIBILITY_LABELS[doc.visibility] || doc.visibility)}</V2Badge>}
          {doc.revoked_by && <V2Badge tone="red">{t('Revogado')}</V2Badge>}
          {doc.version > 1 && <V2Badge tone="amber">{t('Versão {n}', { n: doc.version })}</V2Badge>}
        </p>
        <p className="text-xs text-gray-500">{[tipo ? t(tipo.label) : null, cat ? t(cat.label) : null, doc.act_date ? quando(doc.act_date) : doc.published_at_ms ? quando(doc.published_at_ms) : null, (doc.files || []).length ? tn(doc.files.length, '{n} arquivo', '{n} arquivos') : null].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {acoes.publish && <V2Button type="button" size="sm" onClick={() => onAbrir('publicar', doc)}><Send className="h-4 w-4" />{t('Publicar')}</V2Button>}
        {acoes.edit && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('editar', doc)} aria-label={t('Editar {titulo}', { titulo: doc.title })}><Pencil className="h-4 w-4" /></V2Button>}
        {acoes.remove && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('apagar', doc)} aria-label={t('Apagar {titulo}', { titulo: doc.title })}><Trash2 className="h-4 w-4" /></V2Button>}
        {acoes.rectify && <V2Button type="button" size="sm" variant="secondary" onClick={() => onAbrir('retificar', doc)}><FilePen className="h-4 w-4" />{t('Retificar')}</V2Button>}
        {acoes.errata && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('errata', doc)}>{t('Errata')}</V2Button>}
        {acoes.revoke && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('revogar', doc)}>{t('Revogar')}</V2Button>}
        {acoes.visibility && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('visibilidade', doc)} aria-label={t('Quem vê {titulo}', { titulo: doc.title })}>{doc.visibility === DOC_VISIBILITY.PUBLIC ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</V2Button>}
        {acoes.withdraw && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('retirar', doc)} aria-label={t('Retirar do ar {titulo}', { titulo: doc.title })}><ShieldOff className="h-4 w-4" /></V2Button>}
      </div>
    </V2Surface>
  );
}

const TITULOS = {
  novo: tk('Novo documento'), editar: tk('Editar rascunho'), errata: tk('Nova errata'), revogar: tk('Novo ato que revoga'), publicar: tk('Publicar documento'),
  retificar: tk('Retificar documento'), visibilidade: tk('Quem vê o documento'), retirar: tk('Retirar do ar'), ver: tk('Documento'), apagar: tk('Apagar rascunho'),
};

function ApagarDialog({ federation, doc, onFechar }) {
  const m = useFederationMutation(() => acervoAction({ federationId: federation.id, action: 'delete', docId: doc.id }));
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">{t('Apagar o rascunho "{titulo}" e os arquivos dele? Rascunho nunca foi público: some de vez.', { titulo: doc.title })}</p>
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="button" variant="danger" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Rascunho apagado.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><Trash2 className="h-4 w-4" />{t('Apagar')}</V2Button></div>
    </div>
  );
}

function DocumentosTab({ federation, docsQ, isAdmin }) {
  const [filtro, setFiltro] = useState({ q: '', category: '', status: '', year: '' });
  const [aberto, setAberto] = useState(null); // { modo, doc }
  const todos = docsQ.isSuccess ? docsQ.data : null;
  const lista = useMemo(() => (todos ? filterDocs(todos, filtro) : null), [todos, filtro]);
  const publicados = useMemo(() => (todos || []).filter((d) => d.status === DOC_STATUS.PUBLISHED), [todos]);
  const anos = useMemo(() => docYears(todos || []), [todos]);
  const rascunhos = (todos || []).filter((d) => d.status === DOC_STATUS.DRAFT).length;
  const fechar = () => setAberto(null);
  const abrir = (modo, doc) => setAberto({ modo, doc });
  const modo = aberto?.modo;
  const doc = aberto?.doc;
  const preset = modo === 'errata' ? { type: 'errata', visibility: doc.visibility, title: t('Errata — {titulo}', { titulo: doc.code || doc.title }).slice(0, 200), relations: [{ kind: DOC_RELATION.ERRATA, doc_id: doc.id }] }
    : modo === 'revogar' ? { type: 'resolution', visibility: doc.visibility, relations: [{ kind: DOC_RELATION.REVOKES, doc_id: doc.id }] } : null;
  return (
    <section className="space-y-4" aria-label={t('Documentos do acervo')} data-dica="federacao-acervo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Acervo oficial')}</h2>
          <p className="text-sm text-gray-500">{t('Estatuto, regulamentos, resoluções, editais, atas, súmulas, prestação de contas, áudio e vídeo. O rascunho só a equipe vê; publicado, ganha número (quando o tipo é numerado), código de integridade e endereço próprio, e não se edita mais.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" onClick={() => abrir('novo', null)} data-dica="federacao-acervo-novo"><Plus className="h-4 w-4" />{t('Novo documento')}</V2Button>
          <V2Button asChild variant="secondary"><Link to={acervoPublicPath(federation)}><ExternalLink className="h-4 w-4" />{t('Ver como o público vê')}</Link></V2Button>
          <AcervoPosterButton federation={federation} />
        </div>
      </div>
      {docsQ.isError && <V2ErrorState inline title={t('Não carregou o acervo')} onRetry={() => docsQ.refetch()} />}
      {docsQ.isLoading && <V2Skeleton lines={4} />}
      {todos && todos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <V2Field label={t('Buscar')} htmlFor="ac-busca" className="sm:col-span-4 lg:col-span-1"><V2Input id="ac-busca" type="search" placeholder={t('Título, número, palavra-chave')} value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} /></V2Field>
          <V2Field label={t('Assunto')} htmlFor="ac-cat"><V2Select id="ac-cat" value={filtro.category} onChange={(e) => setFiltro({ ...filtro, category: e.target.value })}><option value="">{t('Todos')}</option>{DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}</V2Select></V2Field>
          <V2Field label={t('Situação')} htmlFor="ac-status"><V2Select id="ac-status" value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })}><option value="">{t('Todas')}</option>{Object.values(DOC_STATUS).map((s) => <option key={s} value={s}>{t(DOC_STATUS_LABELS[s])}</option>)}</V2Select></V2Field>
          <V2Field label={t('Ano')} htmlFor="ac-ano"><V2Select id="ac-ano" value={filtro.year} onChange={(e) => setFiltro({ ...filtro, year: e.target.value })}><option value="">{t('Todos')}</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</V2Select></V2Field>
        </div>
      )}
      {rascunhos > 0 && <p className="text-sm text-gray-500">{tn(rascunhos, '{n} rascunho esperando publicação.', '{n} rascunhos esperando publicação.')}</p>}
      {todos && todos.length === 0 && <V2EmptyState icon={Library} title={t('O acervo está vazio')} description={t('Comece pelo estatuto e pelo regulamento de competições: são os primeiros que filiados e órgãos públicos procuram.')} />}
      {lista && todos.length > 0 && lista.length === 0 && <p className="text-sm text-gray-500">{t('Nenhum documento com esses filtros.')}</p>}
      {lista && lista.length > 0 && (
        <ul className="space-y-2">{lista.map((d) => <li key={d.id}><DocRow doc={d} acoes={docActions(d, { isAdmin })} onAbrir={abrir} /></li>)}</ul>
      )}
      <Dialog open={aberto != null} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogTitle>{modo ? (modo === 'ver' ? docDisplayTitle({ ...doc, code: doc.code || docCode(doc) }) : t(TITULOS[modo])) : ''}</DialogTitle>
          <DialogDescription>{modo === 'ver' ? t('Arquivos, códigos de integridade, versões e atos ligados.') : modo === 'novo' || modo === 'editar' ? t('Salve como rascunho; publique quando estiver conferido.') : modo === 'errata' || modo === 'revogar' ? t('Um ato novo, ligado ao documento "{titulo}".', { titulo: doc.code || doc.title }) : doc ? docDisplayTitle({ ...doc, code: doc.code || docCode(doc) }) : ''}</DialogDescription>
          {(modo === 'novo' || modo === 'editar' || modo === 'errata' || modo === 'revogar') && <DocForm federation={federation} doc={modo === 'editar' ? doc : null} preset={preset} publicados={publicados} onFechar={fechar} />}
          {modo === 'ver' && <DocDetalhe federation={federation} doc={doc} />}
          {modo === 'publicar' && <PublicarDialog federation={federation} doc={doc} onFechar={fechar} />}
          {modo === 'retificar' && <RetificarDialog federation={federation} doc={doc} onFechar={fechar} />}
          {modo === 'visibilidade' && <VisibilidadeDialog federation={federation} doc={doc} onFechar={fechar} />}
          {modo === 'retirar' && <RetirarDialog federation={federation} doc={doc} onFechar={fechar} />}
          {modo === 'apagar' && <ApagarDialog federation={federation} doc={doc} onFechar={fechar} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ----------------------------------------------------------- transparência -- */

function TransparenciaTab({ docsQ }) {
  const itens = docsQ.isSuccess ? transparencyChecklist(docsQ.data) : null;
  const ok = itens ? itens.filter((x) => x.ok).length : 0;
  return (
    <section className="space-y-4" aria-label={t('Transparência')} data-dica="federacao-transparencia">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Transparência')}</h2>
        <p className="text-sm text-gray-500">{t('O que a Lei Geral do Esporte (Lei 14.597/2023, art. 36) pede que a federação mantenha público, e o que é boa prática. Conta só documento publicado, em vigor e público; contas e calendário valem do ano passado para cá.')}</p>
      </div>
      {docsQ.isError && <V2ErrorState inline title={t('Não carregou o acervo')} onRetry={() => docsQ.refetch()} />}
      {docsQ.isLoading && <V2Skeleton lines={4} />}
      {itens && (
        <>
          <p className="text-sm font-semibold text-ink">{t('{ok} de {total} itens publicados.', { ok, total: itens.length })}</p>
          <ul className="space-y-2">
            {itens.map((x) => (
              <li key={x.id}>
                <V2Surface variant="compacto" className="flex items-start gap-3 p-4">
                  {x.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{t(x.label)} <span className="sr-only">{x.ok ? t('publicado') : t('não publicado')}</span></p>
                    <p className="text-xs text-gray-500">{t(x.basis)}</p>
                    <p className="text-sm text-gray-500">{x.ok ? docDisplayTitle({ ...x.doc, code: x.doc.code || docCode(x.doc) }) : t('Não publicado.')}</p>
                  </div>
                </V2Surface>
              </li>
            ))}
          </ul>
          {docsQ.data.some((d) => isDocCurrent(d) && d.visibility !== DOC_VISIBILITY.PUBLIC && ['statute', 'financial_statements', 'minutes'].includes(d.type)) && (
            <p className="text-sm text-gray-500">{t('Há documento de transparência publicado só para filiados ou para a equipe: ele não conta aqui. A lei pede acesso público.')}</p>
          )}
        </>
      )}
    </section>
  );
}

export default function FedAcervoPanel({ federation, docsQ, tab, isAdmin }) {
  if (tab === 'transparencia') return <TransparenciaTab docsQ={docsQ} />;
  return <DocumentosTab federation={federation} docsQ={docsQ} isAdmin={isAdmin} />;
}

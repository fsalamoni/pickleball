/**
 * O que o PÚBLICO vê da seleção e dos editais (aba Competições da página da
 * federação): as convocações publicadas com a delegação confirmada (só nome e
 * categoria) e os editais de apoio ao atleta (critérios, prazo, resultado e
 * pagamentos — transparência). Com conta, a pessoa se inscreve no edital
 * aberto ali mesmo; quem decide se pode (filiado em dia, prazo) é o servidor.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, FileSignature, Plane } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CALLUP_STATUS_LABELS, GRANT_KIND_LABELS, GRANT_STATUS, GRANT_STATUS_LABELS, grantAcceptsApplications, normalizeGrantDocs,
} from '@/modules/federations/domain/selection';
import { validateDocumentFile } from '@/modules/federations/domain/privateData';
import { isoDate } from '@/modules/federations/domain/membership';
import { usePublicCallups, usePublicGrants, useSelectionAction } from '@/modules/federations/hooks/useSelection';
import { uploadGrantFiles } from '@/modules/federations/services/selectionService';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { reais } from '../accounts/accountsUi';
import { TOM_CONVOCACAO, TOM_EDITAL, categoriaDoConvite, periodoDoEvento } from './selectionUi';

const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function Convocacao({ c }) {
  const [aberta, setAberta] = useState(c.status === 'open');
  const lista = c.roster || [];
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{c.title}</span>
            <span className="block text-xs text-gray-500">{[c.event_name, periodoDoEvento(c)].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="flex items-center gap-2">
            <V2Badge tone={TOM_CONVOCACAO[c.status] || 'neutral'}>{t(CALLUP_STATUS_LABELS[c.status] || c.status)}</V2Badge>
            {aberta ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </span>
        </button>
        {aberta && (
          <>
            {c.status === 'cancelled' && c.cancel_reason && <p className="text-sm text-gray-600">{t('Cancelada: {motivo}', { motivo: c.cancel_reason })}</p>}
            {c.notes && <p className="whitespace-pre-line text-sm text-gray-700">{c.notes}</p>}
            {lista.length === 0
              ? <p className="text-sm text-gray-500">{c.status === 'open' ? t('Os convocados ainda estão respondendo.') : t('Ninguém confirmou presença.')}</p>
              : (
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {lista.map((p) => <li key={p.key} className="text-ink">{p.name} <span className="text-gray-500">· {categoriaDoConvite(p)}</span></li>)}
                </ul>
              )}
          </>
        )}
      </V2Surface>
    </li>
  );
}

/** Convocações publicadas (módulo `selection`). */
export function FedCallupsBlock({ federation }) {
  const q = usePublicCallups(federation);
  if (!federation?.modules?.selection) return null;
  return (
    <section id="fed-selecao" aria-labelledby="fed-selecao-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-selecao">
      <h2 id="fed-selecao-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Plane className="h-5 w-5" aria-hidden />{t('Seleção e delegações')}</h2>
      {q.isError && <V2ErrorState inline title={t('Não carregaram as convocações')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && (q.data.length === 0
        ? <p className="text-sm text-gray-500">{t('Nenhuma convocação publicada ainda.')}</p>
        : <ul className="space-y-2">{q.data.map((c) => <Convocacao key={c.id} c={c} />)}</ul>)}
    </section>
  );
}

function Inscrever({ federation, grant, uid, onClose }) {
  const docs = normalizeGrantDocs(grant.required_docs);
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState({});
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const m = useSelectionAction(federation.id);
  const completo = texto.trim().length >= 10 && docs.every((d) => arquivos[d.key]);
  const enviar = async () => {
    setEnviando(true);
    try {
      const files = await uploadGrantFiles(uid, arquivos);
      await m.mutateAsync({ action: 'grant_apply', grantId: grant.id, text: texto, files });
      toast.success(t('Inscrição enviada. Você acompanha em Minha área → Federações.'));
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Inscrição: {titulo}', { titulo: grant.title })}</DialogTitle>
          <DialogDescription>{t('Conte por que você se encaixa nos critérios e anexe os documentos pedidos. Os arquivos ficam na sua pasta; só a equipe de competições os abre.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <V2Field label={t('Por que você se encaixa')} htmlFor="edital-texto" hint={t('Mínimo 10 caracteres.')} required>
            <V2Textarea id="edital-texto" rows={5} maxLength={3000} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </V2Field>
          {docs.map((d) => (
            <div key={d.key} className="space-y-1">
              <label htmlFor={`edital-doc-${d.key}`} className="text-sm font-semibold text-ink">{d.label} <span className="text-acid-dark">*</span></label>
              <input
                id={`edital-doc-${d.key}`}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  const msg = f ? validateDocumentFile(f) : '';
                  setErros((x) => ({ ...x, [d.key]: msg }));
                  setArquivos((x) => ({ ...x, [d.key]: msg ? null : f }));
                }}
              />
              <p className={erros[d.key] ? 'text-xs text-red-600' : 'text-xs text-gray-500'}>{erros[d.key] || t('PDF ou imagem até 5 MB.')}</p>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="button" disabled={!completo || enviando} onClick={enviar}>{enviando ? t('Enviando…') : t('Enviar inscrição')}</V2Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Edital({ federation, g, meUid }) {
  const [aberto, setAberto] = useState(g.status === GRANT_STATUS.OPEN || g.status === GRANT_STATUS.RESULT);
  const [inscrevendo, setInscrevendo] = useState(false);
  const pode = grantAcceptsApplications(g, isoDate());
  const docs = normalizeGrantDocs(g.required_docs);
  const pagos = g.payments || [];
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{g.title}</span>
            <span className="block text-xs text-gray-500">
              {[t(GRANT_KIND_LABELS[g.kind] || g.kind), g.notice_code, g.amount_cents ? t('{valor} por contemplado', { valor: reais(g.amount_cents) }) : '', t('{n} vaga(s)', { n: g.slots })].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <V2Badge tone={TOM_EDITAL[g.status] || 'neutral'}>{t(GRANT_STATUS_LABELS[g.status] || g.status)}</V2Badge>
            {aberto ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </span>
        </button>
        {aberto && (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-line text-gray-700">{g.description}</p>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Critérios')}</p>
              <p className="whitespace-pre-line text-gray-700">{g.criteria}</p>
            </div>
            <p className="text-gray-600">
              {[
                t('Inscrições até {data}', { data: br(g.closes_at) }),
                g.members_only ? t('só filiados em dia') : t('aberto a qualquer atleta com conta'),
                docs.length ? t('documentos: {lista}', { lista: docs.map((d) => d.label).join('; ') }) : '',
              ].filter(Boolean).join(' · ')}
            </p>
            {g.status === GRANT_STATUS.CANCELLED && g.cancel_reason && <p className="text-gray-600">{t('Cancelado: {motivo}', { motivo: g.cancel_reason })}</p>}
            {[GRANT_STATUS.RESULT, GRANT_STATUS.FINAL].includes(g.status) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Contemplados')}{g.result_code ? ` · ${g.result_code}` : ''}</p>
                {(g.result || []).length === 0
                  ? <p className="text-gray-500">{t('Nenhum contemplado.')}</p>
                  : <ul className="grid gap-0.5 sm:grid-cols-2">{g.result.map((r) => <li key={r.application_id} className="text-ink">{r.name}</li>)}</ul>}
                {g.status === GRANT_STATUS.RESULT && g.appeal_until && <p className="mt-1 text-xs text-gray-500">{t('Recurso até {data}, pelo aplicativo.', { data: br(g.appeal_until) })}</p>}
              </div>
            )}
            {pagos.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Pagamentos')}</p>
                <ul className="divide-y divide-gray-100">{pagos.map((p) => <li key={p.application_id} className="flex justify-between gap-2 py-1"><span>{p.name}</span><span className="tabular-nums text-gray-600">{reais(p.amount_cents)} · {br(p.paid_at)}</span></li>)}</ul>
              </div>
            )}
            {pode && (meUid
              ? <V2Button type="button" size="sm" onClick={() => setInscrevendo(true)} data-dica="federacao-edital-inscrever"><FileSignature className="h-4 w-4" aria-hidden />{t('Inscrever-se')}</V2Button>
              : <Link to="/login" className="text-sm font-semibold text-ink underline">{t('Entre na sua conta para se inscrever')}</Link>)}
          </div>
        )}
      </V2Surface>
      {inscrevendo && <Inscrever federation={federation} grant={g} uid={meUid} onClose={() => setInscrevendo(false)} />}
    </li>
  );
}

/** Editais de apoio ao atleta (módulo `grants`). */
export function FedGrantsBlock({ federation, meUid = null }) {
  const q = usePublicGrants(federation);
  if (!federation?.modules?.grants) return null;
  return (
    <section id="fed-editais" aria-labelledby="fed-editais-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-editais">
      <h2 id="fed-editais-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><FileSignature className="h-5 w-5" aria-hidden />{t('Editais de apoio ao atleta')}</h2>
      {q.isError && <V2ErrorState inline title={t('Não carregaram os editais')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && (q.data.length === 0
        ? <p className="text-sm text-gray-500">{t('Nenhum edital publicado ainda.')}</p>
        : <ul className="space-y-2">{q.data.map((g) => <Edital key={g.id} federation={federation} g={g} meUid={meUid} />)}</ul>)}
    </section>
  );
}

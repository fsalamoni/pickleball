/**
 * Secretaria da federação (permissão `members`), além dos filiados:
 *  - TRANSFERÊNCIAS: as pedidas aqui (troca de clube; saída para outra
 *    federação, com o prazo de liberação) para aprovar/recusar, e as que estão
 *    CHEGANDO de outra federação (só acompanhamento — quem decide é a antiga);
 *  - DOCUMENTOS enviados pelos filiados: ver o arquivo (pelo servidor, auditado)
 *    e aceitar ou recusar com motivo;
 *  - IMPORTAR filiados por planilha (CSV): prévia no navegador, gravação pelo
 *    servidor, relatório do que entrou, do que foi pulado e de quem ainda não
 *    tem conta.
 */
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, CheckCircle2, Download, Eye, FileUp, Upload, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fetchDocumentContent, importMembers, reviewDocument, transferAction } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { isReleaseOverdue, sortTransfers, transferSummary } from '@/modules/federations/domain/transfers';
import { parseMembersCsv } from '@/modules/federations/domain/importMembers';
import { DOC_KIND_LABELS, DOC_STATUS, DOC_STATUS_LABELS, IMPORT_MAX_ROWS, TRANSFER_KIND, TRANSFER_KIND_LABELS, TRANSFER_STATUS, TRANSFER_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { quando } from '../federationUi';

const TOM = { pending: 'amber', approved: 'green', rejected: 'red', cancelled: 'neutral' };

/* ---------------------------------------------------------- transferências -- */

function MotivoRecusa({ titulo, descricao, onConfirmar, onClose, pendente }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length < 3) { setErro(t('Diga o motivo (mínimo 3 caracteres).')); return; } onConfirmar(motivo.trim()); }}>
          <V2Field label={t('Motivo')} htmlFor="fed-motivo-recusa" error={erro}><V2Textarea id="fed-motivo-recusa" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus /></V2Field>
          <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button><V2Button type="submit" variant="danger" disabled={pendente}>{t('Recusar')}</V2Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferRow({ tr, federation, chegando = false }) {
  const [recusando, setRecusando] = useState(false);
  const m = useFederationMutation((payload) => transferAction(payload));
  const atrasada = isReleaseOverdue(tr);
  const aprovar = () => m.mutate({ action: 'approve', transferId: tr.id }, { onSuccess: () => toast.success(t('Transferência aprovada. A pessoa foi avisada.')), onError: (e) => toast.error(e.message) });
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{tr.user_name}<V2Badge tone={TOM[tr.status] || 'neutral'}>{t(TRANSFER_STATUS_LABELS[tr.status] || tr.status)}</V2Badge>{atrasada && !chegando && <V2Badge tone="red">{t('prazo vencido · libera sozinha')}</V2Badge>}</p>
            <p className="text-xs text-gray-500">
              {t(TRANSFER_KIND_LABELS[tr.kind] || tr.kind)} {transferSummary(tr)} · {t('pedida em {data}', { data: quando(tr.requested_at) })}
              {chegando ? ` · ${t('vinda da {sigla}', { sigla: tr.federation_acronym || '' })}` : ''}
              {tr.kind === TRANSFER_KIND.FEDERATION && tr.deadline && tr.status === TRANSFER_STATUS.PENDING ? ` · ${t('a antiga responde até {data}', { data: quando(tr.deadline) })}` : ''}
            </p>
            {tr.reason && <p className="mt-1 text-sm text-gray-700">“{tr.reason}”</p>}
            {tr.reject_reason && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: tr.reject_reason })}</p>}
          </div>
        </div>
        {!chegando && tr.status === TRANSFER_STATUS.PENDING && (
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={aprovar}><CheckCircle2 className="h-4 w-4" />{tr.kind === TRANSFER_KIND.FEDERATION ? t('Liberar') : t('Aprovar')}</V2Button>
            <V2Button type="button" size="sm" variant="danger" onClick={() => setRecusando(true)}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
          </div>
        )}
        {chegando && tr.status === TRANSFER_STATUS.PENDING && <p className="text-xs text-gray-500">{t('Quem libera é a federação de origem. Liberada, a pessoa pede a filiação na {sigla} normalmente.', { sigla: federation.acronym || '' })}</p>}
      </V2Surface>
      {recusando && (
        <MotivoRecusa titulo={t('Recusar a transferência')} descricao={t('{nome} lê o motivo. Transferência de federação recusada sem motivo justo pode ser levada à plataforma.', { nome: tr.user_name })} pendente={m.isPending} onClose={() => setRecusando(false)}
          onConfirmar={(motivo) => m.mutate({ action: 'reject', transferId: tr.id, reason: motivo }, { onSuccess: () => { toast.success(t('Transferência recusada.')); setRecusando(false); }, onError: (e) => toast.error(e.message) })} />
      )}
    </li>
  );
}

function TransferenciasTab({ federation, transfersQ, incomingQ }) {
  const [filtro, setFiltro] = useState('pending');
  if (transfersQ.isError) return <V2ErrorState title={t('Não carregaram as transferências')} onRetry={() => transfersQ.refetch()} />;
  if (transfersQ.isLoading) return <V2Skeleton lines={5} />;
  const todas = sortTransfers(transfersQ.data || []);
  const lista = filtro === 'todas' ? todas : todas.filter((x) => x.status === filtro);
  const chegando = sortTransfers((incomingQ.data || []).filter((x) => x.status === TRANSFER_STATUS.PENDING));
  return (
    <section className="space-y-4" aria-label={t('Transferências')} data-dica="federacao-transferencias">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Transferências')}</h2><p className="text-sm text-gray-500">{t('Troca de clube representado (você decide) e saída para outra federação (você libera; sem resposta em {dias} dias, libera sozinha).', { dias: federation?.rules?.transfer_release_days || 15 })}</p></div>
      <div className="flex flex-wrap gap-2">
        {[['pending', t('Aguardando')], ['approved', t('Aprovadas')], ['rejected', t('Recusadas')], ['todas', t('Todas')]].map(([id, label]) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{label}</V2FilterChip>)}
      </div>
      {!lista.length ? <V2EmptyState icon={ArrowLeftRight} title={t('Nenhuma transferência neste filtro')} description={filtro === 'pending' ? t('Quando um filiado pedir troca de clube ou de federação, aparece aqui.') : undefined} />
        : <ul className="space-y-3">{lista.map((x) => <TransferRow key={x.id} tr={x} federation={federation} />)}</ul>}
      {incomingQ.isError && <V2ErrorState inline title={t('Não carregaram as transferências que estão chegando')} onRetry={() => incomingQ.refetch()} />}
      {chegando.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold text-ink">{t('Chegando de outra federação')}</h3>
          <ul className="space-y-3">{chegando.map((x) => <TransferRow key={x.id} tr={x} federation={federation} chegando />)}</ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- documentos -- */

/** Abre o arquivo numa aba: o conteúdo vem do servidor (base64), porque a pasta é do dono. */
async function abrirDocumento(docu) {
  const r = await fetchDocumentContent(docu.id);
  const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: r.contentType }));
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function DocRow({ docu, nome }) {
  const { user } = useAuth();
  const [recusando, setRecusando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const m = useFederationMutation(({ action, reason }) => reviewDocument(docu, action, { uid: user?.uid, reason }));
  const ver = async () => { setAbrindo(true); try { await abrirDocumento(docu); } catch (e) { toast.error(e.message); } finally { setAbrindo(false); } };
  const tom = { pending: 'amber', approved: 'green', rejected: 'red' }[docu.status] || 'neutral';
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{nome || t('Filiado')}<V2Badge tone={tom}>{t(DOC_STATUS_LABELS[docu.status] || docu.status)}</V2Badge></p>
          <p className="text-xs text-gray-500">{t(DOC_KIND_LABELS[docu.kind] || DOC_KIND_LABELS.outro)} · {docu.file_name || ''} · {t('enviado em {data}', { data: quando(docu.created_at) })}</p>
          {docu.review?.reason && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: docu.review.reason })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="secondary" disabled={abrindo} onClick={ver}><Eye className="h-4 w-4" />{abrindo ? t('Abrindo…') : t('Ver o arquivo')}</V2Button>
          {docu.status === DOC_STATUS.PENDING && (
            <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate({ action: 'approve' }, { onSuccess: () => toast.success(t('Documento aceito.')), onError: (e) => toast.error(e.message) })}><CheckCircle2 className="h-4 w-4" />{t('Aceitar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setRecusando(true)}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>
          )}
        </div>
      </V2Surface>
      {recusando && <MotivoRecusa titulo={t('Recusar o documento')} descricao={t('A pessoa lê o motivo e envia outro arquivo.')} pendente={m.isPending} onClose={() => setRecusando(false)} onConfirmar={(reason) => m.mutate({ action: 'reject', reason }, { onSuccess: () => { toast.success(t('Documento recusado. A pessoa foi avisada.')); setRecusando(false); }, onError: (e) => toast.error(e.message) })} />}
    </li>
  );
}

function DocumentosTab({ documentsQ, membersQ }) {
  const [filtro, setFiltro] = useState(DOC_STATUS.PENDING);
  const nomes = useMemo(() => Object.fromEntries((membersQ.data || []).map((mb) => [mb.id, mb.user_name])), [membersQ.data]);
  if (documentsQ.isError) return <V2ErrorState title={t('Não carregaram os documentos')} onRetry={() => documentsQ.refetch()} />;
  if (documentsQ.isLoading) return <V2Skeleton lines={5} />;
  const todos = [...(documentsQ.data || [])].sort((a, b) => (a.status === DOC_STATUS.PENDING ? -1 : 1) - (b.status === DOC_STATUS.PENDING ? -1 : 1) || (b.created_at_ms || 0) - (a.created_at_ms || 0));
  const lista = filtro === 'todos' ? todos : todos.filter((d) => d.status === filtro);
  return (
    <section className="space-y-4" aria-label={t('Documentos enviados')} data-dica="federacao-documentos">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Documentos enviados')}</h2><p className="text-sm text-gray-500">{t('O que os filiados enviaram para os planos que exigem documento. Ver um arquivo fica registrado na auditoria.')}</p></div>
      <div className="flex flex-wrap gap-2">
        {[[DOC_STATUS.PENDING, t('Em análise')], [DOC_STATUS.APPROVED, t('Aceitos')], [DOC_STATUS.REJECTED, t('Recusados')], ['todos', t('Todos')]].map(([id, label]) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{label}</V2FilterChip>)}
      </div>
      {!lista.length ? <V2EmptyState icon={FileUp} title={t('Nenhum documento neste filtro')} /> : <ul className="space-y-3">{lista.map((d) => <DocRow key={d.id} docu={d} nome={nomes[d.member_id]} />)}</ul>}
    </section>
  );
}

/* --------------------------------------------------------------- importar -- */

const MODELO_CSV = 'nome;email;numero;validade\nMaria Silva;maria@exemplo.com;FED-2026-0001;31/12/2026\n';

function ImportarTab({ federation, plansQ, importsQ }) {
  const [texto, setTexto] = useState('');
  const [planId, setPlanId] = useState('');
  const [resultado, setResultado] = useState(null);
  const arquivo = useRef(null);
  const previa = useMemo(() => (texto.trim() ? parseMembersCsv(texto) : { rows: [], errors: [] }), [texto]);
  const planos = (plansQ.data || []).filter((p) => p.active !== false);
  const m = useFederationMutation(() => importMembers({ federationId: federation.id, planId, rows: previa.rows.map(({ name, email, member_number, valid_until }) => ({ name, email, member_number, valid_until })) }));
  const lerArquivo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => setTexto(String(leitor.result || ''));
    leitor.readAsText(f, 'utf-8');
  };
  const enviar = (e) => {
    e.preventDefault();
    if (!planId) { toast.error(t('Escolha o plano.')); return; }
    if (!previa.rows.length) { toast.error(t('Nada para importar.')); return; }
    m.mutate(undefined, { onSuccess: (r) => { setResultado(r); setTexto(''); toast.success(tn(r.imported, '{n} filiado importado.', '{n} filiados importados.')); }, onError: (er) => toast.error(er.message) });
  };
  const baixarModelo = () => {
    const url = URL.createObjectURL(new Blob([MODELO_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'filiados-modelo.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  return (
    <section className="space-y-4" aria-label={t('Importar filiados')} data-dica="federacao-importar">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Importar filiados')}</h2><p className="text-sm text-gray-500">{t('Para a federação que já existia: uma planilha CSV com nome, e-mail, número (opcional) e validade (opcional). Quem tem conta com o e-mail vira filiado ativo no plano escolhido; quem não tem fica numa lista para você convidar. Até {n} linhas por vez.', { n: IMPORT_MAX_ROWS })}</p></div>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <V2Surface className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <V2Button type="button" size="sm" variant="secondary" onClick={() => arquivo.current?.click()}><Upload className="h-4 w-4" />{t('Escolher arquivo CSV')}</V2Button>
            <input ref={arquivo} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={lerArquivo} aria-label={t('Arquivo CSV')} />
            <V2Button type="button" size="sm" variant="ghost" onClick={baixarModelo}><Download className="h-4 w-4" />{t('Baixar o modelo')}</V2Button>
          </div>
          <V2Field label={t('Ou cole o conteúdo')} htmlFor="imp-texto" hint={t('Primeira linha: nome;email;numero;validade (separado por ; ou ,).')}>
            <V2Textarea id="imp-texto" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} className="font-mono text-xs" />
          </V2Field>
          <V2Field label={t('Plano em que entram')} htmlFor="imp-plano" required>
            <V2Select id="imp-plano" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">{t('Escolha…')}</option>
              {planos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </V2Select>
          </V2Field>
          {previa.errors.length > 0 && <ul className="space-y-1 text-sm text-red-600">{previa.errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}{previa.errors.length > 10 && <li>{t('… e mais {n}', { n: previa.errors.length - 10 })}</li>}</ul>}
          {previa.rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">{tn(previa.rows.length, '{n} linha pronta para importar', '{n} linhas prontas para importar')}</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-gray-700">{previa.rows.slice(0, 50).map((r) => <li key={r.email}>{r.name} · {r.email}{r.member_number ? ` · ${r.member_number}` : ''}{r.valid_until ? ` · ${t('até {data}', { data: quando(r.valid_until) })}` : ''}</li>)}{previa.rows.length > 50 && <li>{t('… e mais {n}', { n: previa.rows.length - 50 })}</li>}</ul>
            </div>
          )}
          <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending || !previa.rows.length || !planId}>{m.isPending ? t('Importando…') : t('Importar')}</V2Button></div>
        </V2Surface>
      </form>
      {resultado && (
        <V2Surface className="space-y-2">
          <p className="font-bold text-ink">{t('Resultado da importação')}</p>
          <p className="text-sm text-gray-700">{tn(resultado.imported, '{n} filiado ativado.', '{n} filiados ativados.')} {tn(resultado.pending, '{n} sem conta na plataforma.', '{n} sem conta na plataforma.')} {tn(resultado.skipped.length, '{n} pulado.', '{n} pulados.')}</p>
          {resultado.skipped.length > 0 && <ul className="text-xs text-gray-500">{resultado.skipped.map((s) => <li key={s.email}>{s.email} — {s.reason}</li>)}</ul>}
        </V2Surface>
      )}
      {importsQ.isError && <V2ErrorState inline title={t('Não carregou o histórico das importações')} onRetry={() => importsQ.refetch()} />}
      {importsQ.isSuccess && (importsQ.data || []).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold text-ink">{t('Importações anteriores')}</h3>
          <ul className="space-y-3">
            {[...importsQ.data].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)).map((imp) => (
              <li key={imp.id}>
                <V2Surface variant="compacto" className="space-y-2 p-4">
                  <p className="text-sm text-ink"><span className="font-bold">{quando(imp.created_at_ms)}</span> · {imp.plan_name} · {tn(imp.imported_count, '{n} ativado', '{n} ativados')} · {tn((imp.pending || []).length, '{n} sem conta', '{n} sem conta')} · {tn((imp.skipped || []).length, '{n} pulado', '{n} pulados')}</p>
                  {(imp.pending || []).length > 0 && (
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer font-semibold">{t('Quem ainda não tem conta (convide por fora; ao criar a conta, importe de novo)')}</summary>
                      <ul className="mt-1 space-y-0.5">{imp.pending.map((p) => <li key={p.email}>{p.name} · {p.email}{p.member_number ? ` · ${p.member_number}` : ''}</li>)}</ul>
                    </details>
                  )}
                </V2Surface>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function FedSecretariatPanel({ federation, tab, membersQ, transfersQ, incomingQ, documentsQ, importsQ, plansQ }) {
  if (tab === 'transferencias') return <TransferenciasTab federation={federation} transfersQ={transfersQ} incomingQ={incomingQ} />;
  if (tab === 'documentos') return <DocumentosTab documentsQ={documentsQ} membersQ={membersQ} />;
  return <ImportarTab federation={federation} plansQ={plansQ} importsQ={importsQ} />;
}

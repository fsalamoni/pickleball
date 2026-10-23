/**
 * COFRE DE CERTIDÕES (Central → Certidões e incentivo → Certidões, módulo
 * `certificates`). O financeiro ou o admin anexa cada certidão negativa com a
 * validade; a ATUAL de cada tipo aparece no topo com a situação e as antigas
 * ficam de histórico. A federação é avisada 30, 7 e 1 dia antes de vencer e
 * quando vence; vencida aparece na Conformidade (repasse federal e de loteria
 * exige certidões em dia). O arquivo fica numa pasta fechada e só abre pela
 * função. O conselho fiscal lê; só a administração apaga.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, FileText, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isoDate } from '@/modules/federations/domain/membership';
import { CERT_KINDS, CERT_KIND_LABELS, CERT_NOTE_MAX, CERT_STATE_LABELS, certSlot, certificatesSummary, validateCertificate } from '@/modules/federations/domain/institutional';
import { useCertificates, useInstitutionalAction } from '@/modules/federations/hooks/useInstitutional';
import { institutionalAction } from '@/modules/federations/services/institutionalService';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { AccountFileInput, baixarArquivoDoServidor } from '../manage/accounts/accountsForms';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const TOM = { valid: 'green', expiring: 'amber', expired: 'red', superseded: 'gray' };
const ICONE = { valid: CheckCircle2, expiring: Clock, expired: AlertTriangle };
const nome = (c) => (c.kind === 'other' ? c.label : t(CERT_KIND_LABELS[c.kind] || c.kind));

function CertEditor({ federation, cert, preset, onClose }) {
  const [f, setF] = useState(() => ({
    kind: cert?.kind || preset?.kind || 'cnd_federal', label: cert?.label || preset?.label || '', number: cert?.number || '',
    issued_at: cert?.issued_at || '', valid_until: cert?.valid_until || '', note: cert?.note || '',
  }));
  const [file, setFile] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useInstitutionalAction(federation.id);
  const r = validateCertificate(f);
  const faltaArquivo = !cert && !file;
  const salvar = () => m.mutate({ action: 'cert_save', certId: cert?.id, cert: f, ...(file ? { file } : {}) }, ok(t('Certidão salva.'), onClose));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cert ? t('Editar certidão') : t('Anexar certidão')}</DialogTitle>
          <DialogDescription>{t('Renovou? Anexe a nova certidão: ela passa a ser a atual do tipo e a antiga fica no histórico.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Tipo')} htmlFor="cd-tipo" error={r.errors.kind}><V2Select id="cd-tipo" value={f.kind} disabled={Boolean(cert)} onChange={(e) => set('kind', e.target.value)} options={CERT_KINDS.map((k) => ({ value: k, label: t(CERT_KIND_LABELS[k]) }))} /></V2Field>
            {f.kind === 'other' && <V2Field label={t('Qual certidão')} htmlFor="cd-nome" error={r.errors.label}><V2Input id="cd-nome" value={f.label} maxLength={80} disabled={Boolean(cert)} onChange={(e) => set('label', e.target.value)} /></V2Field>}
            <V2Field label={t('Número ou código de controle (opcional)')} htmlFor="cd-num"><V2Input id="cd-num" value={f.number} maxLength={60} onChange={(e) => set('number', e.target.value)} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Emitida em')} htmlFor="cd-emissao" error={r.errors.issued_at}><V2Input id="cd-emissao" type="date" max={isoDate()} value={f.issued_at} onChange={(e) => set('issued_at', e.target.value)} /></V2Field>
            <V2Field label={t('Válida até')} htmlFor="cd-validade" error={r.errors.valid_until}><V2Input id="cd-validade" type="date" value={f.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></V2Field>
          </div>
          <AccountFileInput id="cd-arquivo" value={file} onChange={setFile} label={cert ? t('Trocar o arquivo (opcional)') : t('Arquivo da certidão')} hint={t('O PDF ou a imagem emitida pelo órgão, de até 9 MB. Fica guardado só para a equipe das contas.')} />
          <V2Field label={t('Observação (opcional)')} htmlFor="cd-obs"><V2Textarea id="cd-obs" rows={2} maxLength={CERT_NOTE_MAX} value={f.note} onChange={(e) => set('note', e.target.value)} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || faltaArquivo || m.isPending} onClick={salvar}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CertRow({ federation, cert: c, state, canEdit, admin, onEdit, onRenew }) {
  const [abrindo, setAbrindo] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const m = useInstitutionalAction(federation.id);
  const I = ICONE[state];
  const abrir = async () => {
    setAbrindo(true);
    try { baixarArquivoDoServidor(await institutionalAction(federation.id, 'cert_file', { certId: c.id })); } catch (e) { toast.error(e.message); } finally { setAbrindo(false); }
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
      <div className="flex min-w-0 items-start gap-2">
        {I ? <I className={`mt-0.5 h-4 w-4 shrink-0 ${state === 'expired' ? 'text-red-600' : state === 'expiring' ? 'text-amber-700' : 'text-green-600'}`} aria-hidden="true" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="font-semibold text-ink">{nome(c)}</p>
          <p className="text-xs text-gray-500">{[t('emitida em {data}', { data: br(c.issued_at) }), t('válida até {data}', { data: br(c.valid_until) }), c.number && t('nº {n}', { n: c.number })].filter(Boolean).join(' · ')}</p>
          {c.note && <p className="text-xs text-gray-600">{c.note}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <V2Badge tone={TOM[state]}>{t(CERT_STATE_LABELS[state])}</V2Badge>
        {c.file && <V2Button type="button" size="sm" variant="ghost" disabled={abrindo} onClick={abrir} aria-label={t('Abrir o arquivo de {nome}', { nome: nome(c) })}><Paperclip className="h-4 w-4" /></V2Button>}
        {canEdit && onRenew && <V2Button type="button" size="sm" variant="secondary" onClick={onRenew}>{t('Anexar a nova')}</V2Button>}
        {canEdit && <V2Button type="button" size="sm" variant="ghost" onClick={onEdit} aria-label={t('Editar {nome}', { nome: nome(c) })}><Pencil className="h-4 w-4" /></V2Button>}
        {admin && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setApagar(true); }} aria-label={t('Apagar {nome}', { nome: nome(c) })}><Trash2 className="h-4 w-4" /></V2Button>}
      </div>
      {apagar && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setApagar(false); }}
          loading={m.isPending}
          confirmDisabled={motivo.trim().length < 3}
          title={t('Apagar esta certidão?')}
          description={t('O registro e o arquivo somem. Use só para certidão lançada por engano: a renovada fica no histórico.')}
          confirmLabel={t('Apagar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'cert_delete', certId: c.id, reason: motivo }, ok(t('Certidão apagada.'), () => setApagar(false)))}
        >
          <V2Field label={t('Motivo')} htmlFor={`cd-apagar-${c.id}`}><V2Input id={`cd-apagar-${c.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
        </ConfirmDialog>
      )}
    </li>
  );
}

export default function CertificatesVault({ federation, canEdit, admin }) {
  const q = useCertificates(federation.id);
  const [editando, setEditando] = useState(null);
  const hoje = isoDate();
  const resumo = useMemo(() => certificatesSummary(q.data || [], hoje), [q.data, hoje]);
  const atuais = new Set(resumo.current.map((c) => c.id));
  const historico = (q.data || []).filter((c) => !atuais.has(c.id));
  const faltam = CERT_KINDS.filter((k) => k !== 'other' && !resumo.current.some((c) => certSlot(c) === k));
  return (
    <section className="space-y-4" aria-label={t('Certidões da federação')} data-dica="federacao-certidoes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><FileText className="h-5 w-5" aria-hidden="true" />{t('Certidões da federação')}</h2>
          <p className="text-sm text-gray-500">{t('Certidão vencida trava convênio e repasse público (Acórdão TCU 2331/2025). A equipe financeira e a administração são avisadas 30, 7 e 1 dia antes de vencer.')}</p>
        </div>
        {canEdit && <V2Button type="button" onClick={() => setEditando({ novo: true })} data-dica="federacao-certidao-nova"><Plus className="h-4 w-4" />{t('Anexar certidão')}</V2Button>}
      </div>
      {q.isError ? <V2ErrorState inline title={t('Não carregaram as certidões')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={FileText} title={t('Nenhuma certidão no cofre')} description={canEdit ? t('Comece pela CND federal, o FGTS e a CNDT: são as que os convênios pedem primeiro.') : t('A equipe financeira ainda não anexou certidões.')} />
            : (
              <>
                {(resumo.expired.length > 0 || resumo.expiring.length > 0) && (
                  <p role="status" className={`rounded-2xl border p-3 text-sm ${resumo.expired.length ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    {resumo.expired.length
                      ? tn(resumo.expired.length, '{n} certidão vencida: {lista}.', '{n} certidões vencidas: {lista}.', { lista: resumo.expired.map(nome).join(', ') })
                      : tn(resumo.expiring.length, '{n} certidão vence nos próximos 30 dias: {lista}.', '{n} certidões vencem nos próximos 30 dias: {lista}.', { lista: resumo.expiring.map(nome).join(', ') })}
                  </p>
                )}
                <ul className="rounded-2xl border border-gray-200 bg-white px-4" aria-label={t('Certidões atuais')}>
                  {resumo.current.map((c) => <CertRow key={c.id} federation={federation} cert={c} state={c.state} canEdit={canEdit} admin={admin} onEdit={() => setEditando({ cert: c })} onRenew={c.state !== 'valid' ? () => setEditando({ novo: true, preset: c }) : null} />)}
                </ul>
                {faltam.length > 0 && <p className="text-sm text-gray-500">{t('Sem certidão no cofre: {lista}.', { lista: faltam.map((k) => t(CERT_KIND_LABELS[k])).join(', ') })}</p>}
                {historico.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-ink">{tn(historico.length, 'Histórico ({n} certidão anterior)', 'Histórico ({n} certidões anteriores)')}</summary>
                    <ul className="mt-2 rounded-2xl border border-gray-200 bg-white px-4">
                      {historico.map((c) => <CertRow key={c.id} federation={federation} cert={c} state="superseded" canEdit={canEdit} admin={admin} onEdit={() => setEditando({ cert: c })} />)}
                    </ul>
                  </details>
                )}
              </>
            )}
      {editando && <CertEditor federation={federation} cert={editando.cert} preset={editando.preset} onClose={() => setEditando(null)} />}
    </section>
  );
}

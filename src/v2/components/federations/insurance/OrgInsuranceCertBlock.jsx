/**
 * O CERTIFICADO DE SEGURO no cartão "Federação" do clube e da arena (módulo
 * `insurance` da federação, `docs/50` §42). Para cada federação em que a
 * organização está FILIADA e que tem o seguro ligado, quem a gere pede o
 * certificado de um evento (alugar uma quadra, fazer um festival) e, emitido,
 * imprime ou mostra o QR. A federação emite.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isoDate } from '@/modules/federations/domain/membership';
import { CERT_STATUS, CERT_STATUS_LABELS, INSURANCE_LIMITS, certificateState, validateCertificateRequest } from '@/modules/federations/domain/insurance';
import { useInsuranceAction, useOrgInsuranceCertificates } from '@/modules/federations/hooks/useInsurance';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import InsuranceCertificateDialog from './InsuranceCertificate';

const VAZIO = { event_name: '', venue: '', city: '', date_from: '', date_to: '', participants: '', note: '' };
const TOM = { requested: 'blue', issued: 'green', expired: 'neutral', declined: 'red', cancelled: 'red', withdrawn: 'neutral' };

function RequestDialog({ federation, kind, org, onClose }) {
  const m = useInsuranceAction(federation.id);
  const [f, setF] = useState({ ...VAZIO, city: org?.city || '' });
  const [erros, setErros] = useState({});
  const set = (p) => { setF((x) => ({ ...x, ...p })); setErros({}); };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateCertificateRequest(f, isoDate());
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate({ action: 'cert_request', kind, orgId: org.id, ...r.value }, {
      onSuccess: () => { toast.success(t('Pedido enviado. A federação foi avisada.')); onClose(); },
      onError: (er) => toast.error(er.message),
    });
  };
  const L = INSURANCE_LIMITS;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Pedir certificado de seguro à {sigla}', { sigla: federation.acronym || federation.name })}</DialogTitle>
          <DialogDescription>{t('Para mostrar a quem aluga a quadra ou autoriza o evento. A federação confere se a apólice cobre as datas e emite com QR de verificação.')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={enviar} noValidate>
          <V2Field label={t('Nome do evento')} htmlFor="cs-nome" error={erros.event_name} required><V2Input id="cs-nome" maxLength={L.EVENT_NAME_MAX} value={f.event_name} onChange={(e) => set({ event_name: e.target.value })} /></V2Field>
          <V2Field label={t('Local')} htmlFor="cs-local" error={erros.venue} required hint={t('Quadra, arena ou endereço.')}><V2Input id="cs-local" maxLength={L.VENUE_MAX} value={f.venue} onChange={(e) => set({ venue: e.target.value })} /></V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Cidade')} htmlFor="cs-cidade" error={erros.city} required><V2Input id="cs-cidade" maxLength={L.CITY_MAX} value={f.city} onChange={(e) => set({ city: e.target.value })} /></V2Field>
            <V2Field label={t('Participantes')} htmlFor="cs-n" error={erros.participants} required><V2Input id="cs-n" type="number" inputMode="numeric" min={1} max={L.PARTICIPANTS_MAX} value={f.participants} onChange={(e) => set({ participants: e.target.value })} /></V2Field>
            <V2Field label={t('Começa em')} htmlFor="cs-de" error={erros.date_from} required><V2Input id="cs-de" type="date" value={f.date_from} onChange={(e) => set({ date_from: e.target.value })} /></V2Field>
            <V2Field label={t('Termina em (opcional)')} htmlFor="cs-ate" error={erros.date_to}><V2Input id="cs-ate" type="date" value={f.date_to} onChange={(e) => set({ date_to: e.target.value })} /></V2Field>
          </div>
          <V2Field label={t('Observação (opcional)')} htmlFor="cs-nota"><V2Textarea id="cs-nota" rows={2} maxLength={L.NOTE_MAX} value={f.note} onChange={(e) => set({ note: e.target.value })} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{t('Enviar pedido')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CertLine({ cert, federation }) {
  const m = useInsuranceAction(federation.id);
  const [dialogo, setDialogo] = useState('');
  const st = certificateState(cert, isoDate());
  const e = cert.event || {};
  return (
    <li className="space-y-1 rounded-xl border border-gray-100 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{e.event_name}<V2Badge tone={TOM[st] || 'neutral'}>{st === 'expired' ? t('Evento encerrado') : t(CERT_STATUS_LABELS[st] || st)}</V2Badge></p>
      <p className="text-xs text-gray-500">{[e.venue, e.city, e.date_to && e.date_to !== e.date_from ? `${quando(e.date_from)}–${quando(e.date_to)}` : quando(e.date_from)].filter(Boolean).join(' · ')}</p>
      {cert.decision_reason && [CERT_STATUS.DECLINED, CERT_STATUS.CANCELLED].includes(cert.status) && <p className="text-xs text-red-600">{t('Motivo: {m}', { m: cert.decision_reason })}</p>}
      <div className="flex flex-wrap gap-2">
        {cert.status === CERT_STATUS.ISSUED && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo('ver')}>{t('Ver certificado')}</V2Button>}
        {cert.status === CERT_STATUS.REQUESTED && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('retirar')}>{t('Retirar o pedido')}</V2Button>}
      </div>
      {dialogo === 'ver' && <InsuranceCertificateDialog cert={cert} onClose={() => setDialogo('')} />}
      {dialogo === 'retirar' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setDialogo(''); }}
          loading={m.isPending}
          title={t('Retirar o pedido de certificado?')}
          description={t('O pedido sai da fila da federação. Dá para pedir de novo.')}
          confirmLabel={t('Retirar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'cert_withdraw', certificateId: cert.id }, { onSuccess: () => { toast.success(t('Pedido retirado.')); setDialogo(''); }, onError: (er) => toast.error(er.message) })}
        />
      )}
    </li>
  );
}

/** `federations`: as federações em que a organização está filiada (documentos com `modules`). */
export default function OrgInsuranceCertBlock({ kind, org, federations = [] }) {
  const comSeguro = federations.filter((f) => fedModuleOn(f, 'insurance'));
  const q = useOrgInsuranceCertificates(kind, org?.id, { enabled: comSeguro.length > 0 });
  const [pedindo, setPedindo] = useState(null);
  if (!comSeguro.length) return null;
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram os certificados de seguro')} onRetry={q.refetch} />;
  if (!q.isSuccess) return null;
  return (
    <section className="space-y-2" aria-label={t('Certificados de seguro para eventos')} data-dica="org-certificado-seguro">
      {comSeguro.map((f) => {
        const certs = (q.data || []).filter((c) => c.federation_id === f.id);
        return (
          <div key={f.id} className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('Certificado de seguro · {sigla}', { sigla: f.acronym || f.name })}</p>
              <V2Button type="button" size="sm" variant="secondary" onClick={() => setPedindo(f)}>{t('Pedir certificado')}</V2Button>
            </div>
            {!certs.length ? <p className="text-sm text-gray-600">{t('Vai fazer um evento? Peça o certificado do seguro da federação para mostrar a quem aluga a quadra.')}</p>
              : <ul className="space-y-2">{certs.slice(0, 6).map((c) => <CertLine key={c.id} cert={c} federation={f} />)}</ul>}
          </div>
        );
      })}
      {pedindo && <RequestDialog federation={pedindo} kind={kind} org={org} onClose={() => setPedindo(null)} />}
    </section>
  );
}

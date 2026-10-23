/**
 * O CERTIFICADO DE SEGURO de um evento (módulo `insurance`, `docs/50` §42): a
 * folha que o clube ou a arena mostra a quem pediu (o dono da quadra, a
 * prefeitura), com o QR que confere em `/f/verificar/:codigo`. A mesma folha
 * de impressão da declaração de vínculo (`cartao-folha-raiz recibo-folha`).
 * Nada é gravado aqui.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { verifyPath } from '@/modules/federations/domain/card';
import { V2Button } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { quando, useQrDataUrl } from '../federationUi';

const periodo = (e) => (e?.date_to && e.date_to !== e.date_from ? t('de {de} a {ate}', { de: quando(e.date_from), ate: quando(e.date_to) }) : quando(e?.date_from));

export function InsuranceCertificateSheet({ cert, verifyUrl, qrDataUrl }) {
  const e = cert.event || {};
  const p = cert.policy || {};
  return (
    <article className="space-y-5 bg-white p-6 text-sm leading-relaxed text-ink sm:p-8" aria-label={t('Certificado de seguro')}>
      <header className="border-b border-gray-200 pb-4">
        <p className="font-display text-lg font-bold leading-tight">{cert.federation_name}</p>
        <p className="text-xs text-gray-600">{cert.federation_acronym}</p>
      </header>
      <h2 className="text-center font-display text-base font-bold uppercase tracking-wider">{t('Certificado de seguro esportivo')}</h2>
      <p className="text-justify">
        {t('A {federacao} certifica que o evento "{evento}", organizado por {org}, em {local} ({cidade}), {periodo}, para até {n} participantes, está coberto pela apólice de seguro esportivo da federação.', {
          federacao: cert.federation_acronym || cert.federation_name, evento: e.event_name, org: cert.org_name, local: e.venue, cidade: e.city, periodo: periodo(e), n: e.participants,
        })}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[10rem_1fr]">
        <dt className="font-semibold">{t('Seguradora')}</dt><dd>{p.insurer || '—'}</dd>
        <dt className="font-semibold">{t('Apólice')}</dt><dd>{p.policy || '—'}</dd>
        <dt className="font-semibold">{t('Vigência da apólice')}</dt><dd>{p.valid_from ? t('de {de} a {ate}', { de: quando(p.valid_from), ate: quando(p.valid_until) }) : t('até {data}', { data: quando(p.valid_until) })}</dd>
        {p.coverage && <><dt className="font-semibold">{t('Cobertura')}</dt><dd className="whitespace-pre-line">{p.coverage}</dd></>}
        {p.phone && <><dt className="font-semibold">{t('Telefone da seguradora')}</dt><dd>{p.phone}</dd></>}
      </dl>
      <p>{t('Emitido em {data}.', { data: quando(cert.issued_at_ms) })}</p>
      <footer className="flex items-end justify-between gap-4 border-t border-gray-200 pt-4">
        <p className="max-w-[75%] text-xs text-gray-600">{t('Documento emitido pela PickleRush em nome da {federacao}. Confira a autenticidade em {url} ou pelo QR (código {codigo}). Se a federação cancelar o certificado, a verificação passa a dizer.', { federacao: cert.federation_acronym || cert.federation_name, url: verifyUrl, codigo: cert.code })}</p>
        {qrDataUrl && <img src={qrDataUrl} alt={t('QR de verificação')} className="h-20 w-20 shrink-0" />}
      </footer>
    </article>
  );
}

/** Prévia + imprimir/salvar em PDF de um certificado emitido. */
export default function InsuranceCertificateDialog({ cert, onClose }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const verifyUrl = cert?.code ? `${origin}${verifyPath(cert.code)}` : '';
  const qr = useQrDataUrl(verifyUrl);
  function imprimir() {
    if (typeof document === 'undefined') return;
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" />{t('Certificado de seguro')}</DialogTitle>
          <DialogDescription>{tn(Number(cert.event?.participants) || 0, 'Para o evento "{evento}", com até {n} participante. Quem receber confere pelo QR, sem precisar de conta.', 'Para o evento "{evento}", com até {n} participantes. Quem receber confere pelo QR, sem precisar de conta.', { evento: cert.event?.event_name })}</DialogDescription>
        </DialogHeader>
        <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><InsuranceCertificateSheet cert={cert} verifyUrl={verifyUrl} qrDataUrl={qr} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <V2Button type="button" onClick={imprimir}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
        </div>
        {typeof document !== 'undefined' && createPortal(
          <div className="cartao-folha-raiz recibo-folha tema-claro hidden" aria-hidden="true"><InsuranceCertificateSheet cert={cert} verifyUrl={verifyUrl} qrDataUrl={qr} /></div>,
          document.body,
        )}
      </DialogContent>
    </Dialog>
  );
}

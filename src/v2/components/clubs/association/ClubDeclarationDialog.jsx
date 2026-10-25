/**
 * A declaração de associação: a folha que o clube "assina" (escola, empregador,
 * patrocínio), com o QR que confere a associação na verificação pública. O
 * texto sai de `buildClubDeclaration`; aqui só se desenha e imprime (a mesma
 * folha de impressão do recibo: `cartao-folha-raiz recibo-folha`). Nada é
 * gravado.
 */
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildClubDeclaration } from '@/modules/clubs/domain/declaration';
import { V2Button } from '@/v2/ui/primitives';
import { useQrDataUrl } from '@/v2/components/federations/federationUi';
import { t } from '@/core/i18n';

/** A folha (tela e papel desenham a MESMA). */
export function ClubDeclarationSheet({ decl, qrDataUrl }) {
  const c = decl.club;
  return (
    <article className="space-y-5 bg-white p-6 text-sm leading-relaxed text-ink sm:p-8" aria-label={t('Declaração de associação')}>
      <header className="flex items-center gap-4 border-b border-gray-200 pb-4">
        {c.logo ? <img src={c.logo} alt="" className="h-14 w-14 rounded-lg object-contain" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 font-display text-lg font-bold text-ink" aria-hidden="true">{(c.name || '?').slice(0, 3)}</span>}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{c.name}</p>
          {c.city && <p className="text-xs text-gray-600">{c.city}</p>}
        </div>
      </header>
      <h2 className="text-center font-display text-base font-bold uppercase tracking-wider">{t('Declaração de associação')}</h2>
      <p className="text-justify">{decl.body}</p>
      {decl.plan && <p className="text-gray-700">{t('Plano: {plano}.', { plano: decl.plan })}</p>}
      <p>{t('Por ser verdade, firmamos a presente. Emitida em {data}.', { data: decl.issuedOn })}</p>
      <footer className="flex items-end justify-between gap-4 border-t border-gray-200 pt-4">
        <p className="max-w-[75%] text-xs text-gray-600">
          {t('Documento emitido pela PickleRush em nome do {clube}. Confira a autenticidade em {url} ou pelo QR. O código {codigo} muda quando a associação é renovada ou suspensa: depois disso, emita uma declaração nova.', { clube: c.name, url: decl.verifyUrl, codigo: decl.code })}
        </p>
        {qrDataUrl && <img src={qrDataUrl} alt={t('QR de verificação')} className="h-20 w-20 shrink-0" />}
      </footer>
    </article>
  );
}

/** O diálogo: prévia + imprimir/salvar em PDF. `aff` é a associação (a minha, ou a de quem a secretaria escolheu). */
export default function ClubDeclarationDialog({ open, onOpenChange, aff, club }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const decl = useMemo(() => buildClubDeclaration({ aff, club, origin }), [aff, club, origin]);
  const qr = useQrDataUrl(decl.canIssue ? decl.verifyUrl : '');

  function imprimir() {
    if (typeof document === 'undefined') return;
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" aria-hidden="true" />{t('Declaração de associação')}</DialogTitle>
          <DialogDescription>{t('Para escola, empregador ou patrocinador. Quem receber confere pelo QR, sem precisar de conta.')}</DialogDescription>
        </DialogHeader>
        {!decl.canIssue ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{decl.block}</p>
        ) : (
          <>
            <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><ClubDeclarationSheet decl={decl} qrDataUrl={qr} /></div>
            <div className="flex flex-wrap items-center gap-2">
              <V2Button type="button" onClick={imprimir}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('A verificação pública mostra só nome, clube e validade.')}</p>
            {open && typeof document !== 'undefined' && createPortal(
              <div className="cartao-folha-raiz recibo-folha tema-claro hidden" aria-hidden="true"><ClubDeclarationSheet decl={decl} qrDataUrl={qr} /></div>,
              document.body,
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

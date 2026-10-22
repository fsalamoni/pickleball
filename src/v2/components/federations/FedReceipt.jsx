/**
 * O RECIBO de uma cobrança paga (filiação, curso, multa): a folha para
 * imprimir ou salvar em PDF, na mesma folha de impressão da declaração
 * (`cartao-folha-raiz recibo-folha`). O texto sai de `chargeReceipt`. Nada é
 * gravado.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, ReceiptText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chargeReceipt } from '@/modules/federations/domain/charges';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

function Linha({ rotulo, valor }) {
  if (!valor) return null;
  return <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5"><dt className="text-gray-600">{rotulo}</dt><dd className="text-right font-semibold">{valor}</dd></div>;
}

/** A folha (tela e papel desenham a MESMA). */
export function ReceiptSheet({ r }) {
  const f = r.federation;
  return (
    <article className="space-y-5 bg-white p-6 text-sm text-ink sm:p-8" aria-label={t('Recibo')}>
      <header className="flex items-center gap-4 border-b border-gray-200 pb-4">
        {f.logo ? <img src={f.logo} alt="" className="h-14 w-14 rounded-lg object-contain" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 font-display text-lg font-bold" aria-hidden="true">{(f.acronym || f.name).slice(0, 3)}</span>}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{f.name}</p>
          <p className="text-xs text-gray-600">{[f.acronym, f.cnpj ? t('CNPJ {n}', { n: f.cnpj }) : '', f.city].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-base font-bold uppercase tracking-wider">{t('Recibo')}</h2>
        <p className="font-mono text-xs text-gray-600">{r.number}</p>
      </div>
      <p className="text-justify">{t('Recebemos de {pessoa} o valor de {valor}, referente a {oque}.', { pessoa: r.payer, valor: r.amount, oque: [r.origin.toLowerCase(), r.description].filter(Boolean).join(': ') })}</p>
      <dl>
        <Linha rotulo={t('Filiado')} valor={r.member} />
        <Linha rotulo={t('Referente a')} valor={[r.origin, r.description].filter(Boolean).join(' · ')} />
        <Linha rotulo={t('Valor')} valor={r.amount} />
        <Linha rotulo={t('Pago em')} valor={r.paidOn} />
        <Linha rotulo={t('Confirmado por')} valor={r.confirmedBy} />
      </dl>
      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-600">
        {t('Recibo emitido pela PickleRush em nome da {federacao}, a partir do pagamento confirmado pelo financeiro dela.', { federacao: f.acronym || f.name })}
      </footer>
    </article>
  );
}

export default function FedReceiptDialog({ open, onOpenChange, charge, federation }) {
  const r = chargeReceipt(charge, federation);
  function imprimir() {
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" aria-hidden="true" />{t('Recibo')}</DialogTitle>
          <DialogDescription>{t('Para guardar ou mostrar a quem pedir comprovante. Imprima ou salve em PDF.')}</DialogDescription>
        </DialogHeader>
        {!r ? <p className="text-sm text-gray-500">{t('Só cobrança paga tem recibo.')}</p> : (
          <>
            <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><ReceiptSheet r={r} /></div>
            <V2Button type="button" onClick={imprimir}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
            {open && createPortal(<div className="cartao-folha-raiz recibo-folha tema-claro hidden" aria-hidden="true"><ReceiptSheet r={r} /></div>, document.body)}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

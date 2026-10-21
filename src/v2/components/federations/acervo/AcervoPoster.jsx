/**
 * Cartaz do mural da sede: a Lei Geral do Esporte (art. 36) pede o calendário
 * e as atas publicados no site E em mural na sede. O cartaz leva o QR do
 * acervo para quem passa pela sede abrir o mural oficial no celular.
 * Folha A4 pelo mesmo caminho de impressão do cartão e da declaração
 * (`imprimindo-cartao` no body, `.cartao-folha-raiz`). Nada é gravado.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { acervoPublicPath } from '@/modules/federations/domain/acervo';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { FedLogo, publicHost, useQrDataUrl } from '../federationUi';

function Folha({ federation, qr, url }) {
  return (
    <div className="cartao-imprimivel mx-auto flex flex-col items-center gap-5 bg-white p-8 text-center text-ink">
      <FedLogo federation={federation} size="xl" />
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-gray-500">{t('Mural oficial')}</p>
        <p className="font-display text-3xl font-bold">{federation.name}</p>
      </div>
      <p className="max-w-md text-base text-gray-700">{t('Normas, regulamentos, atos, atas, convocações e prestação de contas, sempre atualizados. Aponte a câmera do celular:')}</p>
      {qr ? <img src={qr} alt={t('QR do acervo oficial')} width={260} height={260} /> : <div className="h-[260px] w-[260px]" />}
      <p className="break-all font-mono text-lg font-bold">{url}</p>
    </div>
  );
}

export default function AcervoPosterButton({ federation }) {
  const [aberto, setAberto] = useState(false);
  const url = `${publicHost()}${acervoPublicPath(federation)}`;
  const qr = useQrDataUrl(aberto ? `https://${url}` : '', { width: 520 });
  const imprimir = () => {
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  };
  return (
    <>
      <V2Button type="button" variant="secondary" onClick={() => setAberto(true)} data-dica="federacao-acervo-cartaz"><QrCode className="h-4 w-4" />{t('Cartaz para a sede')}</V2Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
          <DialogTitle>{t('Cartaz do mural da sede')}</DialogTitle>
          <DialogDescription>{t('A lei pede as publicações no site e em mural na sede. Imprima e fixe: o QR abre o mural oficial no celular.')}</DialogDescription>
          <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><Folha federation={federation} qr={qr} url={url} /></div>
          <V2Button type="button" onClick={imprimir} disabled={!qr}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
          {aberto && createPortal(
            <div className="cartao-folha-raiz tema-claro hidden" aria-hidden="true"><Folha federation={federation} qr={qr} url={url} /></div>,
            document.body,
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

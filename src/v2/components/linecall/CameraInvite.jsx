/**
 * CameraInvite — chamar um aparelho para uma posição: QR + link que abrem o
 * controle de linhas já como câmera NAQUELA posição. Quem abre precisa estar
 * logado com uma conta que pode ser câmera (participa do dia ou organiza) —
 * a tela diz isso, porque é o que trava na quadra.
 */

import React, { useEffect, useState } from 'react';
import { Copy, QrCode } from 'lucide-react';
import { V2Button } from '@/v2/ui/primitives';
import { useClipboard } from '@/core/lib/useClipboard';
import { t } from '@/core/i18n';

export function cameraLink(gameDayId, position) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/dia-de-jogo/${gameDayId}/linhas?modo=camera&posicao=${encodeURIComponent(position)}`;
}

export default function CameraInvite({ gameDayId, position, positionLabel }) {
  const [aberto, setAberto] = useState(false);
  const [png, setPng] = useState(null);
  const url = cameraLink(gameDayId, position);
  useEffect(() => {
    if (!aberto || png) return undefined;
    let vivo = true;
    import('qrcode')
      .then((m) => m.default.toDataURL(url, { margin: 1, width: 220 }))
      .then((d) => { if (vivo) setPng(d); })
      .catch(() => { if (vivo) setPng(false); });
    return () => { vivo = false; };
  }, [aberto, png, url]);

  const { copy } = useClipboard();
  const copiar = () => copy(url, t('Link copiado.'));

  if (!aberto) {
    return (
      <V2Button size="sm" variant="secondary" onClick={() => setAberto(true)} data-dica="linhas-chamar-camera">
        <QrCode className="mr-1.5 h-4 w-4" /> {t('Chamar um aparelho')}
      </V2Button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="flex flex-wrap items-start gap-3">
        {png ? (
          <img src={png} alt={t('QR para abrir a câmera {p}', { p: positionLabel })} className="h-36 w-36 rounded-xl bg-white" />
        ) : png === false ? null : (
          <div className="h-36 w-36 animate-pulse rounded-xl bg-paper" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1 space-y-2 text-sm text-ink">
          <p className="font-semibold">{t('Aponte a câmera do celular para o QR')}</p>
          <p className="text-gray-600">{t('Abre já como câmera: {p}. O aparelho precisa estar logado com uma conta que participa deste dia de jogo (ou a de quem organiza, num celular separado só para isso).', { p: positionLabel })}</p>
          <div className="flex flex-wrap gap-2">
            <V2Button size="sm" variant="secondary" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" /> {t('Copiar link')}</V2Button>
            <V2Button size="sm" variant="ghost" onClick={() => setAberto(false)}>{t('Fechar')}</V2Button>
          </div>
        </div>
      </div>
    </div>
  );
}

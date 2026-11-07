/**
 * `/linhas/convidado#h=…&t=…` — o celular que leu o QR de quem organiza a
 * quadra vira a CÂMERA daquela posição, sem conta (docs/53 §5c).
 *
 * Fora do layout do app e sem login de propósito: na beira da quadra o
 * aparelho extra é de qualquer um. O servidor (`lineGuest`) confere o convite
 * a cada sinal e a cada marcação; vencido, apagado ou quadra desligada, a
 * tela diz que o QR não vale mais. A calibração fica só neste aparelho.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { V2ErrorState, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { CAMERA_POSITIONS, layoutById } from '@/modules/linecall/domain/cameraLayouts';
import { guestSink, parseGuestHash, peekGuest } from '@/modules/linecall/services/lineGuestService';
import CameraStation from '@/v2/components/linecall/CameraStation';
import { t, fmtData } from '@/core/i18n';

function Moldura({ children }) {
  return (
    <div className="v2-root min-h-[100dvh] bg-paper font-inter text-ink">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">{children}</div>
    </div>
  );
}

function NaoVale({ texto }) {
  return (
    <Moldura>
      <V2Surface>
        <div className="flex flex-col items-center gap-3 text-center">
          <Camera className="h-8 w-8 text-gray-500" aria-hidden="true" />
          <p className="text-sm text-gray-600">{texto}</p>
        </div>
      </V2Surface>
    </Moldura>
  );
}

export default function V2LineGuestCamera() {
  // O token fica no fragmento: lido uma vez, nunca vai para o servidor da página.
  const [convite] = useState(() => parseGuestHash(typeof window !== 'undefined' ? window.location.hash : ''));
  const peek = useQuery({
    queryKey: ['linhas', 'convidado', convite?.host, convite?.token],
    queryFn: () => peekGuest(convite),
    enabled: Boolean(convite),
    retry: false,
  });
  const sink = useMemo(() => (convite ? guestSink(convite) : null), [convite]);

  if (!convite) return <NaoVale texto={t('Este link está incompleto. Leia o QR de novo.')} />;
  if (peek.isError) {
    const naoVale = ['functions/not-found', 'functions/invalid-argument'].includes(peek.error?.code);
    if (naoVale) return <NaoVale texto={t('Este QR não vale mais. Peça um novo a quem organiza a quadra.')} />;
    return <Moldura><V2ErrorState title={t('Não deu para conferir o QR')} description={peek.error?.message} onRetry={() => peek.refetch()} /></Moldura>;
  }
  if (!peek.isSuccess) return <Moldura><V2Skeleton className="h-64" /></Moldura>;

  const { position, layout: layoutId, exp_ms: expMs, title } = peek.data;
  const layout = layoutById(layoutId);
  const rotulo = t(CAMERA_POSITIONS[position]?.label || position);
  return (
    <Moldura>
      <V2PageIntro
        title={t('Câmera: {p}', { p: rotulo })}
        subtitle={t('{q} · sem conta, vale até {h}', { q: title || t('Controle de linhas'), h: fmtData(expMs, { hour: '2-digit', minute: '2-digit' }) })}
        className="mb-2"
      />
      <CameraStation gameDayId={convite.host} position={position} layout={layout.id} layoutPositions={layout.positions} sink={sink} />
    </Moldura>
  );
}

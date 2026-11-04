/**
 * CallFlash — o lance NOVO em tela cheia por um instante: a tela toda pisca na
 * cor do lance com a palavra enorme ("FORA"), para ser lida de longe, da quadra.
 * Não bloqueia nada (passa o toque para a tela de baixo) e some sozinho. Com
 * "menos movimento" ligado no aparelho, aparece sem animação.
 */

import React, { useEffect, useRef, useState } from 'react';
import { callLabel } from './callLabels';

const BG = {
  out: 'bg-red-600', fault: 'bg-red-600', review: 'bg-amber-500', in: 'bg-green-600', clean: 'bg-green-600',
};
const SHOW_MS = { out: 1600, fault: 1600, review: 1400, in: 700, clean: 700 };

/** @param {{ latest: object|null }} props  o lance do último aviso (`useAnnounce`) */
export default function CallFlash({ latest }) {
  const seen = useRef(latest?.id ?? null);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!latest?.id || latest.id === seen.current) return;
    seen.current = latest.id;
    setShown(latest);
  }, [latest]);
  // O relógio é do lance MOSTRADO: pausar a câmera no meio do aviso (`latest`
  // vira `null`) não o prende na tela.
  useEffect(() => {
    if (!shown) return undefined;
    const tm = setTimeout(() => setShown(null), SHOW_MS[shown.call] || 1200);
    return () => clearTimeout(tm);
  }, [shown]);

  if (!shown) return null;
  const strong = !['in', 'clean'].includes(shown.call);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
    >
      <div className={`absolute inset-0 motion-safe:animate-pulse ${BG[shown.call] || BG.review} ${strong ? 'opacity-90' : 'opacity-40'}`} aria-hidden="true" />
      <p className="relative px-6 text-center text-5xl font-black uppercase tracking-tight text-white drop-shadow sm:text-7xl">
        {callLabel(shown)}
      </p>
    </div>
  );
}

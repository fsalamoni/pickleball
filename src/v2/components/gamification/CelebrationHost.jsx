import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { planCelebrations } from '@/modules/progression/domain/marks';
import { cn } from '@/core/lib/utils';

const TONE = {
  gold: 'border-amber-300 bg-amber-50',
  blue: 'border-blue-200 bg-blue-50',
  green: 'border-green-200 bg-green-50',
  purple: 'border-purple-200 bg-purple-50',
};

/**
 * Comemora os marcos alcançados, UMA vez cada, e só o mais alto de cada família
 * (quem chega com história não leva uma chuva de confete). O que foi visto —
 * comemorado ou silenciado — vai para `prefs.celebrated`. Com a comemoração
 * desligada, nada aparece, mas tudo é registrado.
 *
 * @param {{ marks: Array<object>, prefs: object, ready: boolean, update: Function, enabled?: boolean }} props
 */
export default function CelebrationHost({ marks, prefs, ready, update, enabled = true }) {
  const [fila, setFila] = useState([]);
  const gravado = useRef('');

  useEffect(() => {
    if (!ready || !marks?.length) return;
    const plano = planCelebrations(marks, prefs.celebrated, {
      enabled: enabled && prefs.display?.celebrations !== false,
    });
    const chaves = Object.keys(plano.record);
    if (!chaves.length) return;
    const sig = chaves.sort().join(',');
    if (gravado.current === sig) return;
    gravado.current = sig;
    setFila(plano.show);
    update({ celebrated: plano.record }).then((r) => { if (!r) gravado.current = ''; });
  }, [ready, marks, prefs.celebrated, prefs.display?.celebrations, enabled, update]);

  const atual = fila[0];
  useEffect(() => {
    if (!atual) return undefined;
    const t = setTimeout(() => setFila((f) => f.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [atual]);

  if (!atual) return null;
  return (
    <div
      role="status" aria-live="polite" data-testid="celebration-toast"
      className={cn('fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 items-start gap-3 rounded-3xl border p-4 shadow-2xl', TONE[atual.tone] || TONE.green)}
    >
      <span className="text-3xl" aria-hidden="true">{atual.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-bold text-ink">{atual.title}</p>
        <p className="text-sm text-gray-600">{atual.message}</p>
      </div>
      <button type="button" onClick={() => setFila((f) => f.slice(1))} aria-label="Fechar" className="rounded-full p-1 text-gray-500 hover:bg-white/60">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

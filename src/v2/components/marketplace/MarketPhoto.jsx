/**
 * MERCADO — a foto do anúncio desenhada com o enquadramento do vendedor.
 *
 * `mode="cover"` (cards, miniaturas): o recorte, o zoom e a rotação
 * escolhidos. `mode="contain"` (galeria, foto ampliada): a foto INTEIRA,
 * só girada. O pai define o tamanho; este componente preenche o pai
 * (`absolute inset-0`), então o pai precisa de `relative` e `overflow-hidden`.
 *
 * Foto antiga, sem proporção medida, sai como sempre saiu (`object-cover`).
 */
import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { innerImageSize, normalizeAspect, normalizeFrame, photoBox } from '@/modules/marketplace/domain/mediaFrame';
import { t } from '@/core/i18n';

export default function MarketPhoto({
  src, alt = '', aspect, frame, mode = 'cover', boxAspect = 1, loading, className, imgClassName,
}) {
  if (!src) return null;
  const a = normalizeAspect(aspect);
  const f = normalizeFrame(frame);
  if (!a) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn('absolute inset-0 h-full w-full', mode === 'contain' ? 'object-contain' : 'object-cover', imgClassName, className)}
      />
    );
  }
  const box = photoBox(a, f, { mode, boxAspect });
  const inner = innerImageSize(box, f.rotate, boxAspect);
  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={cn('pointer-events-none absolute block', className)}
      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        draggable={false}
        className={cn('absolute left-1/2 top-1/2 max-w-none', imgClassName)}
        style={{
          width: `${inner.width}%`,
          height: `${inner.height}%`,
          transform: `translate(-50%, -50%) rotate(${f.rotate}deg)`,
        }}
      />
    </span>
  );
}

/** O carimbo "Gerado por IA", por cima da foto ou do vídeo. */
export function AiStamp({ className, size = 'sm' }) {
  return (
    <span
      className={cn(
        'pointer-events-none inline-flex items-center gap-1 rounded-full bg-ink/85 font-bold uppercase tracking-wide text-white shadow',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-3 py-1 text-xs',
        className,
      )}
    >
      <Sparkles className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {t('Gerado por IA')}
    </span>
  );
}

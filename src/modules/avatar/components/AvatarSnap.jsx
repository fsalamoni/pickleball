/**
 * Uma FOTO parada do avatar (miniaturas do estúdio, prévia do admin). Tirada
 * pelo palco 3D fora da tela, uma por vez (`avatarSnapshots`); a anterior fica
 * na tela até a nova chegar, então trocar uma cor não pisca.
 * Onde o aparelho não desenha em 3D, o quadro fica vazio (o rótulo ao lado
 * continua dizendo qual é a opção).
 */
import React, { memo, useEffect, useRef } from 'react';
import { cn } from '@/core/lib/utils';
import { cachedSnap, requestSnap, snapKey } from '../services/avatarSnapshots.js';

const SQUARE = { width: 176, height: 176 };
const SIZES = { bust: SQUARE, face: SQUARE, paddle: SQUARE, full: { width: 170, height: 260 } };

function paint(el, src) {
  if (!el || !src) return;
  const ctx = el.getContext('2d');
  ctx.clearRect(0, 0, el.width, el.height);
  ctx.drawImage(src, 0, 0, el.width, el.height);
}

/** @param {{ recipe:object, view?:'bust'|'face'|'paddle'|'full', brandItems?:Array, className?:string }} props */
export const AvatarSnap = memo(function AvatarSnap({ recipe, view = 'bust', brandItems, className }) {
  const ref = useRef(null);
  const size = SIZES[view] || SIZES.bust;
  const key = snapKey(recipe, { view, ...size, brandItems });
  const latest = useRef(null);
  latest.current = { recipe, brandItems };

  useEffect(() => {
    const hit = cachedSnap(key);
    if (hit) {
      paint(ref.current, hit);
      return undefined;
    }
    let alive = true;
    const req = requestSnap(latest.current.recipe, { view, ...size, brandItems: latest.current.brandItems || [] });
    req.promise.then((src) => { if (alive) paint(ref.current, src); }).catch(() => {});
    return () => {
      alive = false;
      req.cancel();
    };
    // `key` já resume receita, enquadramento, tamanho e raquete de marca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <canvas ref={ref} width={size.width} height={size.height} aria-hidden="true" className={cn('block h-full w-full', className)} />;
});

export default AvatarSnap;

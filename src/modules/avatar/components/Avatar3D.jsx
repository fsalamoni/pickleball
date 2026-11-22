/**
 * ⭐ O avatar VIVO, em 3D: respira e pisca sozinho, GIRA com o dedo (ou com as
 * setas do teclado) e, ao toque, faz o movimento da pose (saque, comemoração,
 * aceno, golpe). Com "reduzir movimento" ligado no aparelho ele fica parado.
 *
 * A three.js e o palco entram por import dinâmico, só quando este componente
 * aparece. Enquanto baixam — e onde o aparelho não desenha em 3D — fica o
 * `fallback` (a foto salva, por exemplo): nada pisca e ninguém fica sem ver.
 * Fora da tela ou com a aba escondida, o desenho para (bateria).
 */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';
import { normalizeRecipe } from '../domain/recipe.js';
import { webglAvailable } from '../three/support.js';

const DRAG_START = 6; // px: abaixo disso é toque, não giro
const YAW_PER_PX = 0.012;
const YAW_PER_KEY = 0.35;

/**
 * @param {{ recipe:object, view?:'full'|'bust', brandItems?:Array, label?:string, className?:string,
 *   playOnMount?:boolean, interactive?:boolean, background?:boolean, fallback?:React.ReactNode }} props
 * A ref expõe `{ play(motionId?), resetView() }`.
 */
export const Avatar3D = forwardRef(function Avatar3D(
  { recipe, view = 'full', brandItems, label, className, playOnMount = false, interactive = true, background = true, fallback = null },
  ref,
) {
  // Com as raquetes de marca na mão, a escolhida segue valendo; sem elas, volta a própria.
  const brandKey = JSON.stringify(brandItems || []);
  const normal = useMemo(
    () => normalizeRecipe(recipe, { brandIds: (brandItems || []).map((b) => b.id) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(recipe), brandKey],
  );
  const wrap = useRef(null);
  const canvas = useRef(null);
  const stage = useRef(null);
  const latest = useRef(null);
  latest.current = { normal, brandItems: brandItems || [], view };
  const drag = useRef(null);
  const [status, setStatus] = useState(() => (webglAvailable() ? 'loading' : 'off'));

  useEffect(() => {
    if (status === 'off') return undefined;
    const el = canvas.current;
    let dead = false;
    let s = null;
    let ro = null;
    let io = null;
    let seen = true;
    const sync = () => {
      if (!s) return;
      if (seen && !document.hidden) s.start();
      else s.stop();
    };
    const lost = (e) => {
      e.preventDefault();
      setStatus('off');
    };
    el.addEventListener('webglcontextlost', lost);
    import('../three/stage.js').then(({ AvatarStage }) => {
      if (dead) return;
      try {
        s = new AvatarStage(el, { view: latest.current.view, background });
      } catch {
        setStatus('off');
        return;
      }
      stage.current = s;
      s.setRecipe(latest.current.normal, latest.current.brandItems);
      const fit = () => {
        const box = wrap.current?.getBoundingClientRect();
        if (box && box.width > 0 && box.height > 0) s.resize(box.width, box.height);
      };
      fit();
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(fit);
        ro.observe(wrap.current);
      }
      if (typeof IntersectionObserver === 'function') {
        io = new IntersectionObserver(([entry]) => {
          seen = entry.isIntersecting;
          sync();
        });
        io.observe(wrap.current);
      }
      document.addEventListener('visibilitychange', sync);
      s.render(performance.now());
      sync();
      setStatus('ready');
      if (playOnMount) s.play();
    }).catch(() => {
      if (!dead) setStatus('off');
    });
    return () => {
      dead = true;
      el.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', sync);
      ro?.disconnect();
      io?.disconnect();
      s?.dispose();
      stage.current = null;
    };
    // O palco nasce uma vez; receita e enquadramento chegam pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'off']);

  useEffect(() => {
    stage.current?.setRecipe(normal, latest.current.brandItems);
  }, [normal, brandKey]);

  useEffect(() => {
    const s = stage.current;
    if (!s || s.view === view) return;
    s.setView(view);
    const box = wrap.current?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) s.resize(box.width, box.height);
  }, [view]);

  useImperativeHandle(ref, () => ({
    play: (motionId) => stage.current?.play(motionId) || 0,
    resetView: () => stage.current?.resetYaw(),
  }), []);

  const layers = (
    <>
      {status !== 'ready' && fallback && <span className="absolute inset-0 flex items-center justify-center">{fallback}</span>}
      {status !== 'off' && (
        <canvas
          ref={canvas}
          aria-hidden="true"
          className={cn('absolute inset-0 block h-full w-full transition-opacity duration-300', status === 'ready' ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </>
  );

  if (!interactive) {
    return <div ref={wrap} className={cn('relative', className)} role="img" aria-label={label || t('Avatar')}>{layers}</div>;
  }

  const onPointerDown = (e) => {
    if (!stage.current) return;
    drag.current = { x: e.clientX, yaw: stage.current.yaw, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || !stage.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > DRAG_START) d.moved = true;
    if (d.moved) stage.current.setYaw(d.yaw + dx * YAW_PER_PX);
  };
  const onPointerEnd = () => {
    // O clique vem logo depois e pergunta se foi giro; por isso a marca fica até lá.
    if (drag.current && !drag.current.moved) drag.current = null;
  };
  const onClick = () => {
    const turned = drag.current?.moved;
    drag.current = null;
    if (!turned) stage.current?.play();
  };
  const onKeyDown = (e) => {
    if (!stage.current) return;
    if (e.key === 'ArrowLeft') stage.current.setYaw(stage.current.yaw - YAW_PER_KEY);
    else if (e.key === 'ArrowRight') stage.current.setYaw(stage.current.yaw + YAW_PER_KEY);
    else return;
    e.preventDefault();
  };

  return (
    <button type="button"
      ref={wrap}
      className={cn('relative cursor-grab touch-pan-y select-none active:cursor-grabbing', className)}
      aria-label={label
        ? t('{nome} — arraste para girar, toque para animar', { nome: label })
        : t('Avatar — arraste para girar, toque para animar')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={() => { drag.current = null; }}
      onClick={onClick}
      onDoubleClick={() => stage.current?.resetYaw()}
      onKeyDown={onKeyDown}
    >
      {layers}
    </button>
  );
});

export default Avatar3D;

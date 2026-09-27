/**
 * Rolar até uma âncora — o que protege:
 *
 *  1. ⭐ só o contêiner que ROLA (o `<main>`) se move; a raiz do app, de
 *     `overflow: hidden`, NUNCA (era ela que deslocava o aplicativo inteiro);
 *  2. o `scroll-margin-top` do elemento é respeitado;
 *  3. sem contêiner que role, vale o `scrollIntoView` de sempre;
 *  4. ⭐ `useHashScroll` espera um quadro: o layout volta o conteúdo ao topo
 *     DEPOIS dos efeitos da página, e rolar antes era desfeito na hora.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { conteinerQueRola, rolarAte } from './rolarAte';
import { useHashScroll } from './useHashScroll';

const medidas = (el, { scrollHeight, clientHeight, top }) => {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  el.getBoundingClientRect = () => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
};

let raiz; let main; let alvo;
beforeEach(() => {
  raiz = document.createElement('div');
  raiz.style.overflow = 'hidden';
  main = document.createElement('main');
  main.style.overflowY = 'auto';
  alvo = document.createElement('section');
  alvo.id = 'pagina-inicial';
  main.appendChild(alvo);
  raiz.appendChild(main);
  document.body.appendChild(raiz);
  medidas(raiz, { scrollHeight: 1100, clientHeight: 900, top: 0 });
  medidas(main, { scrollHeight: 3000, clientHeight: 800, top: 80 });
  medidas(alvo, { scrollHeight: 0, clientHeight: 0, top: 900 });
  main.scrollTop = 100;
  main.scrollTo = vi.fn();
  raiz.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  raiz.remove();
  delete Element.prototype.scrollIntoView;
  vi.restoreAllMocks();
});

describe('rolarAte', () => {
  it('⭐ rola só o <main>; a raiz de overflow hidden não se move', () => {
    expect(conteinerQueRola(alvo)).toBe(main);
    rolarAte(alvo, { suave: false });
    // 900 (alvo) − 80 (topo do main) + 100 (já rolado) = 920
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 920, behavior: 'auto' });
    expect(raiz.scrollTo).not.toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('respeita o scroll-margin-top', () => {
    alvo.style.scrollMarginTop = '24px';
    rolarAte(alvo);
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 896, behavior: 'smooth' });
  });

  it('alinhar ao centro põe o elemento no meio da área visível', () => {
    alvo.getBoundingClientRect = () => ({ top: 900, left: 0, right: 0, bottom: 0, width: 0, height: 100 });
    rolarAte(alvo, { suave: false, alinhar: 'centro' });
    // 900 − 80 + 100 − (800 − 100) / 2 = 570
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 570, behavior: 'auto' });
  });

  it('⭐ a reserva inferior tira do meio o que a faixa do guia cobre', () => {
    alvo.getBoundingClientRect = () => ({ top: 900, left: 0, right: 0, bottom: 0, width: 0, height: 100 });
    rolarAte(alvo, { suave: false, alinhar: 'centro', reservaInferior: 200 });
    // área útil 800 − 200 = 600: 900 − 80 + 100 − (600 − 100) / 2 = 670
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 670, behavior: 'auto' });
  });

  it('sem contêiner que role, cai no scrollIntoView', () => {
    medidas(main, { scrollHeight: 800, clientHeight: 800, top: 80 });
    expect(conteinerQueRola(alvo)).toBeNull();
    rolarAte(alvo, { suave: false });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('sem elemento, não faz nada', () => {
    expect(rolarAte(null)).toBe(false);
  });
});

describe('⭐ useHashScroll espera um quadro', () => {
  function Pagina() {
    useHashScroll();
    return null;
  }

  it('não rola dentro do efeito (o layout desfaria); rola no quadro seguinte', async () => {
    const quadros = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { quadros.push(fn); return quadros.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/configuracoes#pagina-inicial']}><Pagina /></MemoryRouter>);
    });
    expect(main.scrollTo).not.toHaveBeenCalled();
    expect(quadros).toHaveLength(1);
    quadros[0]();
    expect(main.scrollTo).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    div.remove();
  });
});

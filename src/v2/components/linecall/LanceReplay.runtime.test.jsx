/**
 * O replay de um lance, no aparelho que filmou. Lance sem nenhum quadro não
 * tem replay — nem barra de posição vazia —, e a tela diz a verdade sobre o
 * porquê: o replay que SAIU da memória (o aparelho guarda só os mais
 * recentes) é uma coisa; o que nunca foi guardado, ou ainda está sendo
 * recortado, é outra.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const { default: LanceReplay } = await import('./LanceReplay.jsx');

const noop = () => {};
let container;
let root;
let getContext;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  getContext = HTMLCanvasElement.prototype.getContext;
  // O jsdom não desenha: um contexto que aceita tudo e não faz nada.
  HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, arc: noop, fill: noop,
  });
});
afterEach(() => {
  root.unmount();
  container.remove();
  HTMLCanvasElement.prototype.getContext = getContext;
});

const lance = (clip) => ({
  id: 'e1', type: 'bounce', call: 'out', reason: 'long', marginM: -0.05, uncertaintyM: 0.02,
  image: 'data:,', point: { x: 2, y: 13.6 }, ...(clip === undefined ? {} : { clip }),
});
const open = (event) => new Promise((resolve) => {
  root.render(<LanceReplay event={event} Hinv={null} onClose={noop} />);
  setTimeout(resolve, 30);
});
const dialog = () => document.body.querySelector('[role="dialog"]');
const slider = () => dialog().querySelector('input[type="range"]');

describe('LanceReplay', () => {
  it('com quadros: o replay, com a barra de posição', async () => {
    await open(lance({ eventT: 1, scale: 1, vw: 640, vh: 360, frames: [{ t: 0.9, url: 'blob:a' }, { t: 1, url: 'blob:b' }] }));
    expect(slider()).toBeTruthy();
    expect(dialog().textContent).not.toMatch(/não está mais guardado/);
  });

  it.each([
    ['sem nenhum quadro', { eventT: 1, scale: 1, vw: 640, vh: 360, frames: [] }],
    ['marcado como sem replay', false],
  ])('⭐ %s: a foto, sem barra vazia, e sem dizer que o replay "não está mais guardado"', async (_n, clip) => {
    await open(lance(clip));
    expect(slider()).toBeFalsy();
    expect(dialog().textContent).not.toMatch(/não está mais guardado/);
    expect(dialog().textContent).toMatch(/ficou sem replay/);
  });

  it('o replay que saiu da memória (os mais recentes ficam) diz isso', async () => {
    await open(lance(null));
    expect(slider()).toBeFalsy();
    expect(dialog().textContent).toMatch(/não está mais guardado/);
  });

  it('o replay ainda sendo recortado diz isso', async () => {
    await open(lance(undefined));
    expect(slider()).toBeFalsy();
    expect(dialog().textContent).toMatch(/ainda está sendo recortado/);
  });
});

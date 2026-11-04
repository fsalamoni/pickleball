/**
 * A marca ampliada (`CourtMark`) é o que quem organiza olha para decidir um
 * "revisar": a bola (ou o pé) tem de aparecer do lado certo da TINTA. A linha
 * é de quem ela limita (8.B): o fundo, a lateral e a central são da quadra ou
 * da área; a linha da cozinha é da cozinha, e no saque isso é CURTO (7.E,
 * 8.C); no pé do saque, os prolongamentos da lateral e da central são da área
 * de saque — pisar neles vale (7.A, 3.A.4.g); no voleio, a linha da cozinha
 * é falta (11.A).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CourtMark from './CourtMark.jsx';

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { root.unmount(); container.remove(); });

const num = (el, a) => Number(el.getAttribute(a));
/** A tinta da linha, a marca da bola (o toque no chão) e a ponta do pé, em cm. */
function geometry(props) {
  flushSync(() => root.render(<CourtMark uncertaintyM={0.03} {...props} />));
  const svg = container.querySelector('svg');
  const rect = svg.querySelector('rect[fill="#f8fafc"]');
  const line = { top: num(rect, 'y'), bottom: num(rect, 'y') + num(rect, 'height') };
  const patch = [...svg.querySelectorAll('circle')].find((c) => c.getAttribute('r') === '1' && c.getAttribute('fill') !== 'none');
  const foot = svg.querySelector('ellipse');
  return {
    line,
    patch: patch && { top: num(patch, 'cy') - 1, bottom: num(patch, 'cy') + 1 },
    tip: foot && num(foot, 'cy') + num(foot, 'ry'),
  };
}
const touches = (a, b) => a.bottom > b.top && a.top < b.bottom;
const ballOnLine = (props) => {
  const g = geometry({ kind: 'bounce', ...props });
  return touches(g.patch, g.line);
};
const tipOnLine = (props) => {
  const g = geometry(props);
  return g.tip > g.line.top && g.tip < g.line.bottom;
};

describe('CourtMark: a bola do lado certo da tinta', () => {
  it('⭐ saque curto: a marca 2 cm além da linha da cozinha não toca a tinta; a que pegou 2 cm, toca', () => {
    expect(ballOnLine({ call: 'review', reason: 'short', marginM: 0.02 })).toBe(false);
    expect(ballOnLine({ call: 'out', reason: 'short', marginM: -0.02 })).toBe(true);
  });

  it.each(['long', 'wide', 'wrong_box'])('%s: dentro por 1 cm toca a linha; fora por 1 cm, não', (reason) => {
    expect(ballOnLine({ call: 'review', reason, marginM: 0.01 })).toBe(true);
    expect(ballOnLine({ call: 'review', reason, marginM: -0.01 })).toBe(false);
  });

  it('a marca que mal encosta fica rente à tinta, do lado de fora da linha do fundo', () => {
    const g = geometry({ kind: 'bounce', call: 'review', reason: 'long', marginM: 0.0001 });
    expect(g.patch.bottom).toBeGreaterThan(g.line.top);
    expect(g.patch.top).toBeLessThan(g.line.top);
  });
});

describe('CourtMark: o pé do lado certo da tinta', () => {
  it.each(['sideline', 'centerline'])('⭐ pé no saque, %s: 2 cm sobre o prolongamento (vale) pisa a tinta; 2 cm além (falta) passa dela', (reason) => {
    expect(tipOnLine({ kind: 'serve_foot', call: 'review', reason, marginM: -0.02 })).toBe(true);
    const g = geometry({ kind: 'serve_foot', call: 'review', reason, marginM: 0.02 });
    expect(g.tip).toBeGreaterThan(g.line.bottom);
  });

  it('pé no saque na linha de fundo: 2 cm sobre a linha (falta) pisa a tinta; 2 cm atrás (vale), não', () => {
    expect(tipOnLine({ kind: 'serve_foot', call: 'review', reason: 'baseline', marginM: 0.02 })).toBe(true);
    const g = geometry({ kind: 'serve_foot', call: 'review', reason: 'baseline', marginM: -0.02 });
    expect(g.tip).toBeLessThan(g.line.top);
  });

  it('voleio: o pé 2 cm na linha da cozinha pisa a tinta; 2 cm antes, não', () => {
    expect(tipOnLine({ kind: 'volley', call: 'review', reason: 'contact', marginM: 0.02 })).toBe(true);
    const g = geometry({ kind: 'volley', call: 'review', reason: 'contact', marginM: -0.02 });
    expect(g.tip).toBeLessThan(g.line.top);
  });
});

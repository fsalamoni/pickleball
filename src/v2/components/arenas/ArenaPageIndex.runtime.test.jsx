/**
 * "Nesta página" — o índice da página da arena.
 *
 * O que protege:
 *  1. ⭐ só entra no índice a seção que RENDERIZOU — envoltório vazio (módulo
 *     desligado, nada para mostrar) não vira atalho para o nada;
 *  2. a ordem é a da página;
 *  3. seção que chega depois (a consulta do módulo) entra no índice;
 *  4. com menos de 3 seções, o índice some;
 *  5. tocar num atalho rola até a seção, sem mexer no histórico;
 *  6. link com âncora (`#arena-loja`) rola até a seção quando ela aparece;
 *  7. ⭐ a página da arena marca as seções dos módulos (guarda de fonte).
 */
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { default: ArenaPageIndex } = await import('./ArenaPageIndex.jsx');

let container, root, rolou;
beforeEach(() => {
  rolou = [];
  Element.prototype.scrollIntoView = vi.fn(function registrar() { rolou.push(this.id); });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete Element.prototype.scrollIntoView;
});

const Secao = ({ id, rotulo, children }) => (
  <div id={id} data-secao-arena={rotulo}>{children}</div>
);

let mostrarLoja;
function Pagina({ lojaDepois = false, poucas = false }) {
  const ref = useRef(null);
  const [loja, setLoja] = useState(!lojaDepois);
  mostrarLoja = () => setLoja(true);
  return (
    <div ref={ref}>
      <ArenaPageIndex containerRef={ref} />
      <Secao id="arena-reservar" rotulo="Reservar"><p>Calendário</p></Secao>
      <Secao id="arena-jogos-abertos" rotulo="Jogos abertos">{null}</Secao>
      <Secao id="arena-torneios-da-casa" rotulo="Torneios da casa"><div className="mt-6" /></Secao>
      {!poucas && <Secao id="arena-aulas" rotulo="Aulas e professores"><h3>Aulas</h3></Secao>}
      <Secao id="arena-loja" rotulo="Loja">{loja ? <h3>Loja</h3> : null}</Secao>
      <Secao id="arena-avaliacoes" rotulo="Avaliações"><h3>Avaliações</h3></Secao>
    </div>
  );
}

async function render(props = {}, rota = '/arenas/a1') {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[rota]}><Pagina {...props} /></MemoryRouter>);
  });
}
const atalhos = () => [...container.querySelectorAll('nav[aria-label="Seções desta arena"] a')].map((a) => a.textContent);
const umQuadro = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

describe('Nesta página — o índice da arena', () => {
  it('⭐ só as seções que renderizaram, na ordem da página', async () => {
    await render();
    expect(atalhos()).toEqual(['Reservar', 'Aulas e professores', 'Loja', 'Avaliações']);
  });

  it('seção que chega depois entra no índice', async () => {
    await render({ lojaDepois: true });
    expect(atalhos()).not.toContain('Loja');
    await act(async () => { mostrarLoja(); });
    await umQuadro();
    expect(atalhos()).toEqual(['Reservar', 'Aulas e professores', 'Loja', 'Avaliações']);
  });

  it('com menos de 3 seções, o índice some', async () => {
    await render({ poucas: true, lojaDepois: true });
    expect(container.querySelector('nav[aria-label="Seções desta arena"]')).toBeNull();
  });

  it('tocar num atalho rola até a seção, sem navegar', async () => {
    await render();
    const loja = [...container.querySelectorAll('nav a')].find((a) => a.textContent === 'Loja');
    expect(loja.getAttribute('href')).toBe('#arena-loja');
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => { loja.dispatchEvent(evento); });
    expect(evento.defaultPrevented).toBe(true);
    expect(rolou).toEqual(['arena-loja']);
  });

  it('link com âncora rola até a seção quando ela aparece — uma vez só', async () => {
    await render({ lojaDepois: true }, '/arenas/a1#arena-loja');
    expect(rolou).toEqual([]);
    await act(async () => { mostrarLoja(); });
    await umQuadro();
    expect(rolou).toEqual(['arena-loja']);
    await umQuadro();
    expect(rolou).toEqual(['arena-loja']);
  });
});

describe('âncora nova na mesma página', () => {
  it('um link com OUTRA âncora rola de novo', async () => {
    const { useNavigate } = await import('react-router-dom');
    let ir;
    function ComNavegacao() { ir = useNavigate(); return <Pagina />; }
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/arenas/a1#arena-loja']}><ComNavegacao /></MemoryRouter>);
    });
    await umQuadro();
    expect(rolou).toEqual(['arena-loja']);
    await act(async () => { ir('/arenas/a1#arena-aulas'); });
    await umQuadro();
    expect(rolou).toEqual(['arena-loja', 'arena-aulas']);
  });
});

describe('⭐ a página da arena marca as seções dos módulos', () => {
  const src = readFileSync('src/v2/pages/V2ArenaDetail.jsx', 'utf8');
  it('monta o índice', () => {
    expect(src).toMatch(/<ArenaPageIndex containerRef=\{paginaRef\} \/>/);
    expect(src).toMatch(/ref=\{paginaRef\}/);
  });
  for (const rotulo of ['Dia de jogo', 'Jogos abertos', 'Reservar', 'Torneios da casa', 'Aulas e professores', 'Preços', 'Promoções', 'Planos', 'Loja', 'Avaliações']) {
    it(`marca "${rotulo}"`, () => {
      expect(src).toContain(`data-secao-arena="${rotulo}"`);
    });
  }
  it('todo id de seção é único', () => {
    const ids = [...src.matchAll(/id="(arena-[a-z-]+)" data-secao-arena=/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

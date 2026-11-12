/**
 * Posição no ranking: apagar pergunta antes e diz quando falha; o gráfico diz
 * de quando a quando; "Anotar nova posição" na série já vem com os nomes dela
 * (nome digitado diferente abriria outra linha, de um ponto só).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { toast } from 'sonner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerRanks: () => ({ isPending: false, isError: false, data: est.digitadas, refetch: vi.fn() }),
  useOfficialRanks: () => ({ isPending: false, isError: false, data: { points: [] }, refetch: vi.fn() }),
  useDeleteCareerRank: () => ({ mutate: est.apagar, isPending: false }),
  useSaveCareerRank: () => ({ mutate: est.salvar, isPending: false }),
}));

import CareerRankPanel from './CareerRankPanel';

const ponto = (id, date, position) => ({ id, federation_name: 'FGP', ranking_label: 'Duplas mistas 4.0', date, position, points_total: 1500 });

let raiz;
let el;
const montar = (digitadas = [ponto('r1', '2026-03-10', 12), ponto('r2', '2026-06-20', 8)]) => {
  Object.assign(est, { digitadas, apagar: vi.fn(), salvar: vi.fn() });
  el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerRankPanel federationPoints={[]} />); });
  return el;
};
const botao = (rotulo, onde = document.body) => [...onde.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const tocar = (b) => act(() => { b.click(); });
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('CareerRankPanel', () => {
  it('🔴 apagar a posição pergunta antes; a falha é dita', () => {
    montar();
    tocar(botao('Ver em tabela'));
    tocar(el.querySelector('button[aria-label^="Apagar a posição de"]'));
    expect(est.apagar).not.toHaveBeenCalled();
    const pergunta = document.querySelector('[role="alertdialog"]');
    expect(pergunta.textContent).toContain('FGP · Duplas mistas 4.0');
    tocar(botao('Apagar de vez', pergunta));
    expect(est.apagar).toHaveBeenCalledWith('r1', expect.any(Object));
    act(() => { est.apagar.mock.calls[0][1].onError(new Error('Sem conexão.')); });
    expect(toast.error).toHaveBeenCalledWith('Sem conexão.');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('o gráfico escreve a primeira e a última data no eixo (no toque não há "passar o mouse")', () => {
    montar();
    const textos = [...el.querySelectorAll('svg > text')].map((x) => x.textContent);
    expect(textos.some((x) => x.includes('mar'))).toBe(true);
    expect(textos.some((x) => x.includes('jun'))).toBe(true);
  });

  it('🔴 "Anotar nova posição" na série abre o formulário com a federação e o ranking dela', () => {
    montar();
    tocar(botao('Anotar nova posição'));
    expect(document.getElementById('rank-fed').value).toBe('FGP');
    expect(document.getElementById('rank-nome').value).toBe('Duplas mistas 4.0');
    expect(document.activeElement).toBe(document.getElementById('rank-pos'));
  });

  it('o formulário solto abre em branco e, ao cancelar, o foco volta ao botão que o abriu', () => {
    montar();
    tocar(botao('Anotar posição'));
    expect(document.getElementById('rank-nome').value).toBe('');
    tocar(botao('Cancelar'));
    expect(document.activeElement.textContent.trim()).toBe('Anotar posição');
  });
});

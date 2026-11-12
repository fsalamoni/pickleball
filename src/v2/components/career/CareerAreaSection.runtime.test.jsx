/**
 * Seção Carreira da Minha área: quem tem evento mas nada a contar (só um
 * cancelado) vê o convite a registrar — nunca um parágrafo em branco.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerEvents: () => ({ isPending: false, isError: false, data: est.eventos, refetch: vi.fn() }),
}));
vi.mock('@/modules/training/hooks/useDebriefs', () => ({
  useMyDebriefs: () => ({ isSuccess: true, isError: false, data: [], refetch: vi.fn() }),
}));

import CareerAreaSection from './CareerAreaSection';

let raiz;
const montar = (eventos) => {
  est.eventos = eventos;
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<MemoryRouter><CareerAreaSection /></MemoryRouter>); });
  return el.querySelector('p').textContent;
};
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

describe('CareerAreaSection — resumo', () => {
  it('só um evento cancelado: mostra o convite, não um parágrafo vazio', () => {
    expect(montar([{ id: 'e1', name: 'Open', status: 'cancelled', start_date: '2026-03-10' }])).toMatch(/^Registre os torneios/);
  });
  it('sem evento nenhum: o convite', () => {
    expect(montar([])).toMatch(/^Registre os torneios/);
  });
  it('com torneio de fora jogado: a contagem', () => {
    expect(montar([{ id: 'e1', name: 'Open', status: 'played', start_date: '2026-03-10', placement: 'champion' }])).toMatch(/^1 torneio de fora registrado/);
  });
});

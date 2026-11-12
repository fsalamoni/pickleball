/**
 * Teste de RUNTIME do bloco "Carreira" do perfil público (PR 7).
 *
 * O bloco é secundário e quase nenhum perfil tem vitrine: carregando, não
 * desenha nada (o esqueleto piscava em todo perfil); perfil oculto pela
 * moderação (permission-denied) some; falha de conexão é DITA.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const est = { q: {}, uid: 'visita' };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: est.uid } }) }));
vi.mock('@/modules/career/hooks/useCareer', () => ({ useCareerPublic: () => est.q }));
vi.mock('@/v2/components/trophies/CongratulateButton', () => ({ default: () => <span>parabenizar</span> }));

import CareerPublicBlock from './CareerPublicBlock.jsx';

const ITEM = { event_id: 'e1', name: 'Copa Sul', seal: 'declared', start_date: '2026-10-10', date_precision: 'day', entries: [], photos: [] };
let container; let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  est.uid = 'visita';
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(q) {
  est.q = q;
  act(() => { root.render(<MemoryRouter><CareerPublicBlock uid="ana" nome="Ana" /></MemoryRouter>); });
}

describe('CareerPublicBlock', () => {
  it('carregando não desenha nada (sem esqueleto piscando em todo perfil)', () => {
    render({ isPending: true });
    expect(container.innerHTML).toBe('');
  });

  it('🔴 perfil oculto pela moderação (permission-denied): o bloco some, sem "tentar de novo"', () => {
    render({ isPending: false, isError: true, error: { code: 'permission-denied' } });
    expect(container.innerHTML).toBe('');
  });

  it('falha de conexão é dita, nunca "não tem carreira"', () => {
    render({ isPending: false, isError: true, error: { code: 'unavailable' }, refetch: vi.fn() });
    expect(container.textContent).toContain('Não carregou a carreira');
  });

  it('nada publicado: o bloco não aparece', () => {
    render({ isPending: false, isError: false, data: [] });
    expect(container.innerHTML).toBe('');
  });

  it('o dono tem o atalho para gerir; a visita, não', () => {
    render({ isPending: false, isError: false, data: [ITEM] });
    expect(container.textContent).toContain('Copa Sul');
    expect(container.querySelector('a[href="/carreira"]')).toBeNull();
    est.uid = 'ana';
    render({ isPending: false, isError: false, data: [ITEM] });
    expect(container.querySelector('a[href="/carreira"]').textContent).toContain('Gerir na Carreira');
  });
});

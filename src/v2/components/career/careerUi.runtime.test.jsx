/**
 * A estimativa ("quantos torneios você já jogou fora?") é UMA para a tela
 * inteira: a linha do tempo e o modo lista montam o hook cada um, e responder
 * num lugar tem de aparecer no outro sem remontar a página.
 */
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));

const { useCareerEstimate } = await import('./careerUi.jsx');

let root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; window.localStorage.clear(); });
afterEach(() => { act(() => root.unmount()); });

describe('useCareerEstimate', () => {
  it('⭐ gravar numa instância atualiza a outra (linha do tempo × modo lista)', () => {
    const a = { current: null };
    const b = { current: null };
    function Sonda({ alvo }) { alvo.current = useCareerEstimate(); return null; }
    root = createRoot(document.createElement('div'));
    act(() => { root.render(<><Sonda alvo={a} /><Sonda alvo={b} /></>); });
    expect([a.current.valor, b.current.valor]).toEqual([null, null]);
    act(() => { b.current.gravar(20); });
    expect([a.current.valor, b.current.valor]).toEqual(['20', '20']);
    act(() => { a.current.gravar(null); });
    expect([a.current.valor, b.current.valor]).toEqual([null, null]);
  });
});

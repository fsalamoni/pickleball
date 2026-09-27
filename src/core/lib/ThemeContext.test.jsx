/**
 * O provedor do modo escuro, montado de verdade. O que protege:
 *
 *  1. ⭐ enquanto login e flags carregam, NADA muda (o script de index.html já
 *     pintou a primeira tela; decidir antes seria piscar);
 *  2. ⭐ flag desligada ou visitante: claro, e o espelho do aparelho APAGADO —
 *     inclusive para quem tinha escolhido o escuro;
 *  3. a escolha de cada pessoa vale, e trocar de conta relê a escolha;
 *  4. o automático acompanha o aparelho AO VIVO;
 *  5. `setEscolha` aplica na hora, grava por uid e atualiza o espelho;
 *  6. ⭐ `AparenciaClara` (telão, totem, impressão) põe o documento no claro
 *     enquanto está montada — sem esperar login e flags, e sem apagar a
 *     escolha da pessoa — e devolve o escuro ao sair.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  auth: { user: { uid: 'ana' }, isAuthenticated: true, isLoadingAuth: false },
  flags: { flags: { dark_mode: true }, isLoading: false },
};
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => estado.flags }));

import { AparenciaClara, ThemeProvider, useTheme } from './ThemeContext';

const ESPELHO = 'picklerush:tema';
const pref = (uid) => `v2:view:${uid}:aparencia:tema`;
const escuro = () => document.documentElement.classList.contains('dark');

let ouvintes = [];
let sistemaEscuro = false;
function instalarMatchMedia() {
  ouvintes = [];
  window.matchMedia = vi.fn((q) => ({
    media: q,
    get matches() { return q.includes('dark') ? sistemaEscuro : false; },
    addEventListener: (_e, fn) => ouvintes.push(fn),
    removeEventListener: (_e, fn) => { ouvintes = ouvintes.filter((f) => f !== fn); },
  }));
}

let container; let root; let tema;
function Sonda() {
  tema = useTheme();
  return null;
}
function montar() {
  act(() => { root.render(<ThemeProvider><Sonda /></ThemeProvider>); });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  document.head.innerHTML = '<meta name="theme-color" content="#065f46">';
  sistemaEscuro = false;
  instalarMatchMedia();
  estado.auth = { user: { uid: 'ana' }, isAuthenticated: true, isLoadingAuth: false };
  estado.flags = { flags: { dark_mode: true }, isLoading: false };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('⭐ não decide antes da hora', () => {
  it('login carregando: mantém o que o script de index.html pintou', () => {
    document.documentElement.classList.add('dark');
    window.localStorage.setItem(ESPELHO, 'escuro');
    estado.auth = { user: null, isAuthenticated: false, isLoadingAuth: true };
    montar();
    expect(escuro()).toBe(true);
    expect(window.localStorage.getItem(ESPELHO)).toBe('escuro');
  });

  it('flags carregando: idem', () => {
    document.documentElement.classList.add('dark');
    estado.flags = { flags: {}, isLoading: true };
    montar();
    expect(escuro()).toBe(true);
  });
});

describe('⭐ quando o escuro não pode valer', () => {
  it('flag desligada: claro e espelho apagado, mesmo com o escuro escolhido', () => {
    window.localStorage.setItem(pref('ana'), 'escuro');
    window.localStorage.setItem(ESPELHO, 'escuro');
    document.documentElement.classList.add('dark');
    estado.flags = { flags: { dark_mode: false }, isLoading: false };
    montar();
    expect(escuro()).toBe(false);
    expect(window.localStorage.getItem(ESPELHO)).toBeNull();
    expect(tema.disponivel).toBe(false);
    // A escolha da pessoa NÃO é apagada: religada a flag, ela volta.
    expect(window.localStorage.getItem(pref('ana'))).toBe('escuro');
  });

  it('visitante: claro, e o seletor não aparece', () => {
    window.localStorage.setItem(ESPELHO, 'escuro');
    document.documentElement.classList.add('dark');
    estado.auth = { user: null, isAuthenticated: false, isLoadingAuth: false };
    montar();
    expect(escuro()).toBe(false);
    expect(window.localStorage.getItem(ESPELHO)).toBeNull();
    expect(tema.disponivel).toBe(false);
  });
});

describe('a escolha de cada pessoa', () => {
  it('padrão: claro', () => {
    montar();
    expect(tema).toMatchObject({ disponivel: true, escolha: 'claro', efetivo: 'claro' });
    expect(escuro()).toBe(false);
  });

  it('a escolha salva vale, e o espelho é escrito', () => {
    window.localStorage.setItem(pref('ana'), 'escuro');
    montar();
    expect(escuro()).toBe(true);
    expect(window.localStorage.getItem(ESPELHO)).toBe('escuro');
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#070B13');
  });

  it('⭐ trocar de conta no mesmo navegador relê a escolha', () => {
    window.localStorage.setItem(pref('ana'), 'escuro');
    montar();
    expect(escuro()).toBe(true);
    estado.auth = { user: { uid: 'bia' }, isAuthenticated: true, isLoadingAuth: false };
    montar();
    expect(tema.escolha).toBe('claro');
    expect(escuro()).toBe(false);
    expect(window.localStorage.getItem(ESPELHO)).toBeNull();
  });

  it('o automático acompanha o aparelho ao vivo', () => {
    window.localStorage.setItem(pref('ana'), 'automatico');
    montar();
    expect(escuro()).toBe(false);
    expect(window.localStorage.getItem(ESPELHO)).toBe('automatico');
    act(() => {
      sistemaEscuro = true;
      ouvintes.forEach((fn) => fn({ matches: true }));
    });
    expect(escuro()).toBe(true);
    expect(tema.efetivo).toBe('escuro');
  });

  it('setEscolha aplica na hora e grava por uid', () => {
    montar();
    act(() => tema.setEscolha('escuro'));
    expect(escuro()).toBe(true);
    expect(tema.escolha).toBe('escuro');
    expect(window.localStorage.getItem(pref('ana'))).toBe('escuro');
    expect(window.localStorage.getItem(ESPELHO)).toBe('escuro');
    act(() => tema.setEscolha('claro'));
    expect(escuro()).toBe(false);
    expect(window.localStorage.getItem(pref('ana'))).toBe('claro');
    expect(window.localStorage.getItem(ESPELHO)).toBeNull();
  });

  it('valor inválido é ignorado', () => {
    montar();
    act(() => tema.setEscolha('roxo'));
    expect(tema.escolha).toBe('claro');
    expect(window.localStorage.getItem(pref('ana'))).toBeNull();
  });
});

describe('⭐ AparenciaClara (telão, totem, impressão)', () => {
  function montarCom(claro) {
    act(() => {
      root.render(
        <ThemeProvider>
          <Sonda />
          {claro && <AparenciaClara><p id="telao">telão</p></AparenciaClara>}
        </ThemeProvider>,
      );
    });
  }

  it('põe o documento no claro e devolve o escuro ao sair', () => {
    window.localStorage.setItem(pref('ana'), 'escuro');
    montarCom(true);
    expect(escuro()).toBe(false);
    expect(tema.efetivo).toBe('claro');
    // A escolha e o espelho continuam: a próxima abertura do app sai escura.
    expect(window.localStorage.getItem(ESPELHO)).toBe('escuro');
    expect(document.getElementById('telao').parentElement.className).toContain('tema-claro');
    montarCom(false);
    expect(escuro()).toBe(true);
  });

  it('vale mesmo antes de login e flags carregarem', () => {
    document.documentElement.classList.add('dark');
    estado.auth = { user: null, isAuthenticated: false, isLoadingAuth: true };
    montarCom(true);
    expect(escuro()).toBe(false);
  });
});

/**
 * Aplicar a aparência no documento — e o script de `index.html` que pinta a
 * primeira tela. O que protege:
 *
 *  1. ⭐ o script pinta o escuro ANTES do aplicativo (sem clarão) só quando o
 *     espelho diz — e com armazenamento bloqueado abre no claro, sem erro;
 *  2. aplicar é idempotente (o efeito roda muitas vezes);
 *  3. ⭐ a troca desliga as transições e religa depois;
 *  4. a troca pedida pela pessoa esmaece — nunca com "menos movimento";
 *  5. o espelho é gravado e apagado sem nunca lançar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { aplicarTema, gravarEspelho, documentoEscuro, CLASSE_TROCANDO } from './themeDom.js';
import { COR_DA_BARRA, TEMA_DISPOSITIVO_KEY } from './themePreference.js';

const raiz = () => document.documentElement;
const barra = () => document.querySelector('meta[name="theme-color"]');

beforeEach(() => {
  window.localStorage.clear();
  raiz().className = '';
  document.head.innerHTML = `<meta name="theme-color" content="${COR_DA_BARRA.claro}">`;
});
afterEach(() => { vi.restoreAllMocks(); delete document.startViewTransition; });

/** O script inline de `index.html`, executado como o navegador executaria. */
function rodarScriptDoIndex() {
  const html = readFileSync('index.html', 'utf8');
  const bloco = /<script>\s*([\s\S]*?)<\/script>/.exec(html);
  expect(bloco, 'o script anti-clarão existe em index.html').toBeTruthy();
  // eslint-disable-next-line no-new-func
  new Function(bloco[1])();
}

const sistema = (escuro) => {
  window.matchMedia = vi.fn((q) => ({ matches: q.includes('dark') ? escuro : false, media: q }));
};

describe('⭐ o script de index.html (a primeira pintura)', () => {
  it('sem espelho: claro, barra intacta', () => {
    rodarScriptDoIndex();
    expect(documentoEscuro()).toBe(false);
    expect(barra().getAttribute('content')).toBe(COR_DA_BARRA.claro);
  });

  it('espelho "escuro": pinta o escuro e a barra', () => {
    window.localStorage.setItem(TEMA_DISPOSITIVO_KEY, 'escuro');
    rodarScriptDoIndex();
    expect(documentoEscuro()).toBe(true);
    expect(barra().getAttribute('content')).toBe(COR_DA_BARRA.escuro);
  });

  it('espelho "automático": segue o aparelho', () => {
    window.localStorage.setItem(TEMA_DISPOSITIVO_KEY, 'automatico');
    sistema(false);
    rodarScriptDoIndex();
    expect(documentoEscuro()).toBe(false);
    sistema(true);
    rodarScriptDoIndex();
    expect(documentoEscuro()).toBe(true);
  });

  it('⭐ armazenamento bloqueado: abre no claro, sem erro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(() => rodarScriptDoIndex()).not.toThrow();
    expect(documentoEscuro()).toBe(false);
  });

  it('⭐ telão, totem e impressão abrem claros mesmo com o espelho escuro', () => {
    window.localStorage.setItem(TEMA_DISPOSITIVO_KEY, 'escuro');
    for (const rota of ['/dia-de-jogo/x/telao', '/torneios/y/telao', '/arenas/z/totem', '/torneios/y/imprimir']) {
      raiz().className = '';
      window.history.pushState({}, '', rota);
      rodarScriptDoIndex();
      expect(documentoEscuro(), rota).toBe(false);
    }
    window.history.pushState({}, '', '/torneios/y');
    rodarScriptDoIndex();
    expect(documentoEscuro()).toBe(true);
    window.history.pushState({}, '', '/');
  });

  it('valor estranho no espelho não liga nada', () => {
    window.localStorage.setItem(TEMA_DISPOSITIVO_KEY, 'claro');
    rodarScriptDoIndex();
    expect(documentoEscuro()).toBe(false);
  });
});

describe('aplicarTema', () => {
  it('liga e desliga o escuro, com a barra junto', () => {
    expect(aplicarTema('escuro')).toBe(true);
    expect(raiz().classList.contains('dark')).toBe(true);
    expect(barra().getAttribute('content')).toBe(COR_DA_BARRA.escuro);
    expect(aplicarTema('claro')).toBe(true);
    expect(raiz().classList.contains('dark')).toBe(false);
    expect(barra().getAttribute('content')).toBe(COR_DA_BARRA.claro);
  });

  it('idempotente: aplicar o que já está não faz nada', () => {
    aplicarTema('escuro');
    expect(aplicarTema('escuro')).toBe(false);
    expect(aplicarTema('claro')).toBe(true);
    expect(aplicarTema('claro')).toBe(false);
  });

  it('⭐ desliga as transições durante a troca e religa depois', () => {
    const quadros = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { quadros.push(fn); return quadros.length; });
    aplicarTema('escuro');
    expect(raiz().classList.contains(CLASSE_TROCANDO)).toBe(true);
    // Dois quadros: o primeiro pinta sem transição, o segundo religa.
    quadros.shift()();
    expect(raiz().classList.contains(CLASSE_TROCANDO)).toBe(true);
    quadros.shift()();
    expect(raiz().classList.contains(CLASSE_TROCANDO)).toBe(false);
  });

  it('troca pedida pela pessoa esmaece (View Transitions), quando o navegador tem', () => {
    sistema(false);
    document.startViewTransition = vi.fn((cb) => { cb(); return {}; });
    aplicarTema('escuro', { animar: true });
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(documentoEscuro()).toBe(true);
  });

  it('⭐ nunca esmaece com "menos movimento", nem em troca do sistema', () => {
    document.startViewTransition = vi.fn((cb) => cb());
    window.matchMedia = vi.fn((q) => ({ matches: q.includes('reduced-motion'), media: q }));
    aplicarTema('escuro', { animar: true });
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(documentoEscuro()).toBe(true);
    sistema(false);
    aplicarTema('claro');
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });

  it('se o esmaecer falhar, troca seco', () => {
    sistema(false);
    document.startViewTransition = vi.fn(() => { throw new Error('não'); });
    aplicarTema('escuro', { animar: true });
    expect(documentoEscuro()).toBe(true);
  });

  it('sem documento, não faz nada (e não lança)', () => {
    expect(aplicarTema('escuro', { doc: null })).toBe(false);
  });
});

describe('gravarEspelho', () => {
  it('grava e apaga', () => {
    gravarEspelho('escuro');
    expect(window.localStorage.getItem(TEMA_DISPOSITIVO_KEY)).toBe('escuro');
    gravarEspelho(null);
    expect(window.localStorage.getItem(TEMA_DISPOSITIVO_KEY)).toBeNull();
  });

  it('nunca lança com o armazenamento bloqueado', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cota'); });
    expect(() => gravarEspelho('escuro')).not.toThrow();
  });
});

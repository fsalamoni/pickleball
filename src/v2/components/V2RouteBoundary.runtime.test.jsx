/**
 * 🐞 UM ERRO NUMA TELA DERRUBAVA O APLICATIVO INTEIRO.
 *
 * O `ErrorBoundary` global fica ACIMA do Router (`main.jsx`) e nunca reseta:
 * um defeito numa aba de torneio ou no organizador do dia de jogo substituía
 * tudo por "Algo deu errado" — sem barra lateral, sem navegação, sem volta a
 * não ser recarregar a página.
 *
 * Estes testes provam o contrário: a falha fica CONTIDA na tela, o resto
 * continua montado, e dá para voltar sem recarregar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const registrado = [];
vi.mock('@/core/services/observabilityService', () => ({
  recordClientError: (error, ctx) => registrado.push({ error, ctx }),
}));

const { default: V2RouteBoundary } = await import('./V2RouteBoundary.jsx');

let container, root, silencio;

function Explode({ quando = true, erro = null }) {
  if (quando) throw (erro || new TypeError("Cannot read properties of undefined (reading 'map')"));
  return <div>TELA OK</div>;
}

beforeEach(() => {
  registrado.length = 0;
  // React imprime o erro capturado no console; aqui isso é ruído esperado.
  silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  silencio.mockRestore();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const clicar = (texto) => {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent.includes(texto));
  expect(b, `botão "${texto}" não encontrado`).toBeTruthy();
  act(() => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('⭐ a falha fica contida na tela', () => {
  it('⭐ o resto da página continua montado', () => {
    act(() => {
      root.render(
        <div>
          <nav>BARRA LATERAL</nav>
          <V2RouteBoundary name="teste"><Explode /></V2RouteBoundary>
        </div>,
      );
    });
    const txt = container.textContent;
    expect(txt, 'a barra lateral sumiu junto com a tela').toContain('BARRA LATERAL');
    expect(txt).toContain('Esta parte da tela falhou');
    expect(txt).toContain('O resto da plataforma continua funcionando');
  });

  it('⭐ o erro é REPORTADO, e não como fatal — o app sobreviveu', () => {
    act(() => { root.render(<V2RouteBoundary name="torneio"><Explode /></V2RouteBoundary>); });
    expect(registrado).toHaveLength(1);
    expect(registrado[0].ctx.fatal).toBe(false);
    expect(registrado[0].ctx.source).toBe('V2RouteBoundary:torneio');
  });

  it('⭐ "Tentar de novo" remonta a tela — e ela volta se o defeito passou', () => {
    // ⚠️ O gatilho é controlado DE FORA. Um componente que "se cura" sozinho
    // na segunda renderização não serve aqui: ao capturar um erro, o React
    // re-renderiza uma vez antes de acionar o boundary, e o defeito
    // desapareceria nessa tentativa interna — o boundary nunca entraria.
    const cenario = { falhar: true };
    function Instavel() {
      if (cenario.falhar) throw new Error('X');
      return <div>TELA OK</div>;
    }
    act(() => { root.render(<V2RouteBoundary name="t"><Instavel /></V2RouteBoundary>); });
    expect(container.textContent).toContain('Esta parte da tela falhou');

    cenario.falhar = false; // o dado se resolveu
    clicar('Tentar de novo');
    expect(container.textContent).toContain('TELA OK');
  });

  it('oferece Voltar quando a tela informa um caminho de saída', () => {
    const voltar = vi.fn();
    act(() => {
      root.render(<V2RouteBoundary name="t" onBack={voltar}><Explode /></V2RouteBoundary>);
    });
    clicar('Voltar');
    expect(voltar).toHaveBeenCalledOnce();
  });

  it('sem erro, o boundary é transparente', () => {
    act(() => {
      root.render(<V2RouteBoundary name="t"><Explode quando={false} /></V2RouteBoundary>);
    });
    expect(container.textContent).toBe('TELA OK');
    expect(registrado).toHaveLength(0);
  });
});

describe('⭐ versão velha depois de um deploy não é tratada como defeito', () => {
  it('⭐ manda RECARREGAR, e não "tentar de novo"', () => {
    const chunk = new Error('Failed to fetch dynamically imported module: /assets/x-123.js');
    act(() => { root.render(<V2RouteBoundary name="t"><Explode erro={chunk} /></V2RouteBoundary>); });
    const txt = container.textContent;
    expect(txt).toContain('Uma versão nova foi publicada');
    expect(txt).toContain('Recarregar');
    expect(txt).not.toContain('Tentar de novo');
  });
});

describe('⭐ o telão se recupera sozinho', () => {
  it('⭐ sem ninguém para clicar, ele tenta de novo por conta própria', () => {
    vi.useFakeTimers();
    const cenario = { falhar: true };
    function Instavel() {
      if (cenario.falhar) throw new Error('X');
      return <div>TELÃO OK</div>;
    }
    act(() => {
      root.render(<V2RouteBoundary name="telao" unattended><Instavel /></V2RouteBoundary>);
    });
    expect(container.textContent).toContain('Tentando de novo sozinho');
    // Nenhum botão para clicar — é exatamente o ponto: não há ninguém ali.
    expect([...container.querySelectorAll('button')]).toHaveLength(0);

    // A primeira tentativa ainda encontra o defeito.
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(container.textContent).toContain('Tentando de novo sozinho');

    // Na segunda, a rede voltou.
    cenario.falhar = false;
    act(() => { vi.advanceTimersByTime(6_000); });
    expect(container.textContent).toContain('TELÃO OK');
  });

  it('⭐ desiste depois do limite, em vez de entrar em laço de falha', () => {
    vi.useFakeTimers();
    act(() => {
      root.render(<V2RouteBoundary name="telao" unattended><Explode /></V2RouteBoundary>);
    });
    // Três tentativas com espera crescente: 3 s, 6 s, 12 s.
    [3_000, 6_000, 12_000].forEach((ms) => {
      act(() => { vi.advanceTimersByTime(ms); });
    });
    expect(container.textContent).not.toContain('Tentando de novo sozinho');
    // Aí sim aparece o caminho manual, para quem chegar na frente da TV.
    expect(container.textContent).toContain('Tentar de novo');
  });
});

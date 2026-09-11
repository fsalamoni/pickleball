/**
 * Teste de RUNTIME do ranking de duplas.
 *
 * Duas coisas que só um teste de tela pega:
 *  1. a CLASSIFICAÇÃO que o usuário lê é a que veio do banco — a tela numera
 *     por `position`, não reordena por conta própria;
 *  2. a paginação (20/50/100 + navegação) funciona de verdade, guarda o estado
 *     na URL e não deixa ninguém preso numa página vazia ao buscar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dados = { ranking: [], isLoading: false };

vi.mock('@/modules/rating/hooks/useRating', () => ({
  useDoublesRanking: () => ({ data: dados.ranking, isLoading: dados.isLoading }),
}));

const { default: V2DoublesRanking } = await import('./V2DoublesRanking.jsx');

/** Linha do ranking como o banco a entrega (já classificada, com `position`). */
const dupla = (position, nomeA, nomeB, extra = {}) => ({
  pair_key: `${nomeA}__${nomeB}`,
  position,
  player_ids: [nomeA, nomeB],
  players: [
    { id: nomeA, name: nomeA, photo: '' },
    { id: nomeB, name: nomeB, photo: '' },
  ],
  games: 10,
  wins: 7,
  losses: 3,
  win_rate: 0.7,
  points_for: 200,
  points_against: 180,
  points_balance: 20,
  ...extra,
});

/** N duplas numeradas, na ordem em que o banco as devolveria. */
const muitasDuplas = (n) => Array.from({ length: n }, (_, i) => (
  dupla(i + 1, `Atleta${String(i + 1).padStart(3, '0')}A`, `Atleta${String(i + 1).padStart(3, '0')}B`)
));

let container, root, qc;

beforeEach(() => {
  dados.ranking = [];
  dados.isLoading = false;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  qc.clear();
  vi.clearAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

async function render(url = '/ranking/duplas') {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/ranking/duplas" element={<V2DoublesRanking />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

const linhas = () => [...container.querySelectorAll('tbody tr')];
const botao = (trecho) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === trecho);
const porRotulo = (rotulo) => [...container.querySelectorAll('button')]
  .find((b) => b.getAttribute('aria-label') === rotulo);

describe('ranking de duplas — a classificação que o usuário lê', () => {
  it('numera pela POSIÇÃO vinda do banco, não pela ordem da tela', () => {
    // O banco entrega 3ª, 1ª, 2ª fora de ordem: a tela tem de mostrar o número
    // que veio, não 1-2-3 pela ordem do array.
    dados.ranking = [dupla(3, 'Cida', 'Caio'), dupla(1, 'Ana', 'Bia'), dupla(2, 'Duda', 'Edu')];
    return render().then(() => {
      const primeiras = linhas().map((tr) => tr.querySelector('td').textContent.trim());
      // 1, 2 e 3 viram medalhas; o importante é que a 3ª linha do array
      // apareça com a medalha de bronze, e não com a de ouro.
      expect(primeiras[0]).toBe('🥉');
      expect(primeiras[1]).toBe('🥇');
      expect(primeiras[2]).toBe('🥈');
    });
  });

  it('mostra o aproveitamento em porcentagem', async () => {
    dados.ranking = [dupla(1, 'Ana', 'Bia', { win_rate: 0.875 })];
    await render();
    expect(container.textContent).toContain('88%');
  });

  it('explica a regra de desempate no cabeçalho da página', async () => {
    dados.ranking = [dupla(1, 'Ana', 'Bia')];
    await render();
    expect(container.textContent).toContain('aproveitamento');
    expect(container.textContent).toContain('mais vitórias, menos derrotas e saldo de pontos');
  });

  it('sem duplas, mostra o vazio em vez de tabela', async () => {
    await render();
    expect(container.textContent).toContain('Sem duplas ranqueadas ainda');
    expect(container.querySelector('table')).toBeNull();
  });
});

describe('ranking de duplas — paginação', () => {
  it('⭐ mostra 20 por padrão, mesmo com 137 duplas', async () => {
    dados.ranking = muitasDuplas(137);
    await render();
    expect(linhas()).toHaveLength(20);
    expect(container.textContent).toContain('Mostrando 1–20 de 137 duplas');
  });

  it('navega para a próxima página e mostra a faixa seguinte', async () => {
    dados.ranking = muitasDuplas(137);
    await render();
    click(porRotulo('Próxima página'));
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('Mostrando 21–40 de 137');
    expect(linhas()).toHaveLength(20);
  });

  it('⭐ o tamanho da página (20/50/100) muda quantas linhas aparecem', async () => {
    dados.ranking = muitasDuplas(137);
    await render();
    const seletor = container.querySelector('#duplas-por-pagina');
    expect([...seletor.options].map((o) => o.value)).toEqual(['20', '50', '100']);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(seletor, '100');
      seletor.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(linhas()).toHaveLength(100);
    expect(container.textContent).toContain('Mostrando 1–100 de 137');
  });

  it('a última página vem incompleta e o botão "próxima" fica desabilitado', async () => {
    dados.ranking = muitasDuplas(137);
    await render('/ranking/duplas?pag=7');
    expect(linhas()).toHaveLength(17);
    expect(container.textContent).toContain('Mostrando 121–137 de 137');
    expect(porRotulo('Próxima página').disabled).toBe(true);
  });

  it('na primeira página o botão "anterior" fica desabilitado', async () => {
    dados.ranking = muitasDuplas(137);
    await render();
    expect(porRotulo('Página anterior').disabled).toBe(true);
  });

  it('⭐ página impossível na URL cai na última, não em tela vazia', async () => {
    dados.ranking = muitasDuplas(137);
    await render('/ranking/duplas?pag=9999');
    expect(linhas()).toHaveLength(17);
    expect(container.textContent).toContain('Mostrando 121–137 de 137');
  });

  it('⭐ tamanho de página inventado na URL cai no padrão', async () => {
    dados.ranking = muitasDuplas(137);
    await render('/ranking/duplas?tam=999999');
    expect(linhas()).toHaveLength(20);
  });

  it('a URL leva o estado: ?tam=50&pag=2 abre já na faixa certa', async () => {
    dados.ranking = muitasDuplas(137);
    await render('/ranking/duplas?tam=50&pag=2');
    expect(linhas()).toHaveLength(50);
    expect(container.textContent).toContain('Mostrando 51–100 de 137');
  });

  it('com poucas duplas não aparece navegação de páginas', async () => {
    dados.ranking = muitasDuplas(5);
    await render();
    expect(porRotulo('Próxima página')).toBeUndefined();
    // O seletor de tamanho continua, porque a contagem ainda é informação útil.
    expect(container.textContent).toContain('Mostrando 1–5 de 5 duplas');
  });

  it('clicar num número vai direto para aquela página', async () => {
    dados.ranking = muitasDuplas(137);
    await render();
    click(botao('3'));
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('Mostrando 41–60 de 137');
  });
});

describe('ranking de duplas — busca', () => {
  it('filtra pelo nome de qualquer atleta da dupla', async () => {
    dados.ranking = [dupla(1, 'Ana', 'Bia'), dupla(2, 'Caio', 'Duda')];
    await render('/ranking/duplas?q=duda');
    expect(linhas()).toHaveLength(1);
    expect(container.textContent).toContain('Caio & Duda');
  });

  it('⭐ buscar na página 7 não deixa o usuário numa tela vazia', async () => {
    dados.ranking = muitasDuplas(137);
    // Página 7 existe sem filtro; com o filtro sobra 1 resultado só.
    await render('/ranking/duplas?pag=7&q=Atleta005A');
    expect(linhas()).toHaveLength(1);
    expect(container.textContent).toContain('Mostrando 1–1 de 1 duplas');
  });

  it('busca sem resultado explica o que aconteceu', async () => {
    dados.ranking = [dupla(1, 'Ana', 'Bia')];
    await render('/ranking/duplas?q=zzzz');
    expect(container.textContent).toContain('Nenhuma dupla encontrada');
  });
});

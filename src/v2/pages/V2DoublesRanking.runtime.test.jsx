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
const auth = { user: { uid: 'ana' } };

vi.mock('@/modules/rating/hooks/useRating', () => ({
  useDoublesRanking: () => ({ data: dados.ranking, isLoading: dados.isLoading }),
}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

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
  window.localStorage.clear();
  dados.ranking = [];
  dados.isLoading = false;
  auth.user = { uid: 'ana' };
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

/* ---------------------------------------------------------------------------
 * AMOSTRA MÍNIMA — o recorte que cada pessoa escolhe para a sua visualização
 *
 * Três coisas a provar: que o recorte funciona e RENUMERA; que a escolha fica
 * salva por usuário e volta na visita seguinte; e que ela sobrevive à
 * navegação (páginas, busca) sem o usuário ter de reescolher.
 * ------------------------------------------------------------------------- */
describe('ranking de duplas — amostra mínima', () => {
  /** Duplas com números de jogos variados, já classificadas pelo banco. */
  const variadas = () => [
    dupla(1, 'Ana', 'Bia', { games: 1, wins: 1, losses: 0, win_rate: 1 }),
    dupla(2, 'Caio', 'Duda', { games: 12, wins: 10, losses: 2, win_rate: 10 / 12 }),
    dupla(3, 'Elis', 'Fábio', { games: 4, wins: 3, losses: 1, win_rate: 0.75 }),
    dupla(4, 'Gabi', 'Hugo', { games: 30, wins: 20, losses: 10, win_rate: 2 / 3 }),
    dupla(5, 'Ivo', 'Joana', { games: 2, wins: 1, losses: 1, win_rate: 0.5 }),
  ];
  const seletor = () => container.querySelector('#duplas-min-jogos');
  const escolher = (valor) => act(() => {
    const el = seletor();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(el, String(valor));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  it('o seletor existe e oferece os mínimos, começando por "Todas"', async () => {
    dados.ranking = variadas();
    await render();
    expect([...seletor().options].map((o) => o.value)).toEqual(['1', '3', '5', '10', '20']);
    expect(seletor().options[0].textContent).toBe('Todas as duplas');
    expect(seletor().value).toBe('1');
  });

  it('⭐ escolher um mínimo recorta a lista', async () => {
    dados.ranking = variadas();
    await render();
    expect(linhas()).toHaveLength(5);
    escolher(10);
    await act(async () => { await Promise.resolve(); });
    // Só Caio/Duda (12) e Gabi/Hugo (30).
    expect(linhas()).toHaveLength(2);
    expect(container.textContent).toContain('Caio & Duda');
    expect(container.textContent).toContain('Gabi & Hugo');
    expect(container.textContent).not.toContain('Ana & Bia');
  });

  it('⭐ o recorte RENUMERA: o topo é 1º, não a posição geral', async () => {
    dados.ranking = variadas();
    await render('/ranking/duplas?min=10');
    const primeiraCelula = linhas()[0].querySelector('td').textContent;
    expect(primeiraCelula).toContain('🥇');   // 1º do recorte
    expect(primeiraCelula).toContain('#2');   // e era o 2º no geral
  });

  it('⭐ a posição no ranking geral continua visível', async () => {
    dados.ranking = variadas();
    await render('/ranking/duplas?min=10');
    const celulas = linhas().map((tr) => tr.querySelector('td').textContent);
    expect(celulas[0]).toContain('#2');
    expect(celulas[1]).toContain('#4');
  });

  it('explica o recorte em vez de deixar a numeração confusa', async () => {
    dados.ranking = variadas();
    await render('/ranking/duplas?min=5');
    expect(container.textContent).toContain('5 jogos ou mais');
    expect(container.textContent).toContain('entre elas');
  });

  it('recortar NÃO reordena — a ordem relativa é a mesma', async () => {
    dados.ranking = variadas();
    await render('/ranking/duplas?min=3');
    // Sem recorte a ordem é Ana, Caio, Elis, Gabi, Ivo; com 3+ somem Ana e Ivo.
    const nomes = linhas().map((tr) => tr.textContent);
    expect(nomes[0]).toContain('Caio & Duda');
    expect(nomes[1]).toContain('Elis & Fábio');
    expect(nomes[2]).toContain('Gabi & Hugo');
  });

  it('mínimo que exclui todo mundo explica o motivo (não "plataforma vazia")', async () => {
    dados.ranking = variadas();
    await render('/ranking/duplas?min=20');
    // Gabi/Hugo tem 30 → sobra 1. Subindo para um caso realmente vazio:
    dados.ranking = [dupla(1, 'Ana', 'Bia', { games: 2 })];
    await render('/ranking/duplas?min=20');
    expect(container.textContent).toContain('Nenhuma dupla com 20+ jogos');
    expect(container.textContent).toContain('Reduza a amostra mínima');
    expect(container.textContent).not.toContain('Sem duplas ranqueadas ainda');
  });
});

describe('ranking de duplas — a escolha fica salva', () => {
  const variadas = () => [
    dupla(1, 'Ana', 'Bia', { games: 1 }),
    dupla(2, 'Caio', 'Duda', { games: 12 }),
    dupla(3, 'Gabi', 'Hugo', { games: 30 }),
  ];
  const seletor = () => container.querySelector('#duplas-min-jogos');
  const escolher = (valor) => act(() => {
    const el = seletor();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(el, String(valor));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const chave = (uid) => `v2:view:${uid}:ranking:duplas:min-jogos`;

  it('⭐ escolher grava a preferência DESTE usuário', async () => {
    dados.ranking = variadas();
    await render();
    escolher(10);
    await act(async () => { await Promise.resolve(); });
    expect(window.localStorage.getItem(chave('ana'))).toBe('10');
  });

  it('⭐ na visita seguinte, a escolha volta sozinha', async () => {
    dados.ranking = variadas();
    window.localStorage.setItem(chave('ana'), '10');
    await render(); // URL limpa, como quem abre o menu de novo
    expect(seletor().value).toBe('10');
    expect(linhas()).toHaveLength(2);
  });

  it('⭐ a escolha se mantém ao navegar entre páginas', async () => {
    // 60 duplas com 12 jogos + 60 com 1 jogo: com "10+" sobram 60, em 3 páginas.
    dados.ranking = [
      ...Array.from({ length: 60 }, (_, i) => dupla(i + 1, `Vet${i}A`, `Vet${i}B`, { games: 12 })),
      ...Array.from({ length: 60 }, (_, i) => dupla(61 + i, `Nov${i}A`, `Nov${i}B`, { games: 1 })),
    ];
    window.localStorage.setItem(chave('ana'), '10');
    await render('/ranking/duplas?pag=2');
    expect(seletor().value).toBe('10');
    expect(container.textContent).toContain('Mostrando 21–40 de 60 duplas');
    expect(container.textContent).not.toContain('Nov');
  });

  it('⭐ a escolha se mantém ao buscar', async () => {
    dados.ranking = variadas();
    window.localStorage.setItem(chave('ana'), '10');
    await render('/ranking/duplas?q=gabi');
    expect(seletor().value).toBe('10');
    expect(linhas()).toHaveLength(1);
    expect(container.textContent).toContain('Gabi & Hugo');
  });

  it('trocar o mínimo volta para a primeira página', async () => {
    dados.ranking = Array.from({ length: 60 }, (_, i) => (
      dupla(i + 1, `P${i}A`, `P${i}B`, { games: 12 })
    ));
    await render('/ranking/duplas?pag=3');
    expect(container.textContent).toContain('Mostrando 41–60');
    escolher(10);
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('Mostrando 1–20');
  });

  it('⭐ voltar para "Todas" APAGA a preferência (não grava "1")', async () => {
    dados.ranking = variadas();
    window.localStorage.setItem(chave('ana'), '10');
    await render();
    escolher(1);
    await act(async () => { await Promise.resolve(); });
    expect(window.localStorage.getItem(chave('ana'))).toBeNull();
    expect(linhas()).toHaveLength(3);
  });

  it('⭐ dois usuários no MESMO navegador não herdam a escolha um do outro', async () => {
    dados.ranking = variadas();
    window.localStorage.setItem(chave('ana'), '10');
    auth.user = { uid: 'bia' };
    await render();
    expect(seletor().value).toBe('1'); // Bia nunca escolheu
    expect(linhas()).toHaveLength(3);
  });

  it('⭐ um link com ?min= manda na visualização, MAS não reescreve a preferência', async () => {
    dados.ranking = variadas();
    window.localStorage.setItem(chave('ana'), '10');
    await render('/ranking/duplas?min=3');
    expect(seletor().value).toBe('3');           // o link manda
    expect(window.localStorage.getItem(chave('ana'))).toBe('10'); // a escolha dela fica
  });

  it('min inválido na URL cai na preferência salva', async () => {
    dados.ranking = variadas();
    window.localStorage.setItem(chave('ana'), '10');
    await render('/ranking/duplas?min=9999');
    expect(seletor().value).toBe('10');
  });

  it('visitante sem conta também tem a sua escolha guardada (escopo anônimo)', async () => {
    dados.ranking = variadas();
    auth.user = null;
    await render();
    escolher(10);
    await act(async () => { await Promise.resolve(); });
    expect(window.localStorage.getItem(chave('anon'))).toBe('10');
  });
});

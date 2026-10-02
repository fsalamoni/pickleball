import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = { mine: { reviews: [], isLoading: false, isError: false, refetch: vi.fn() }, submit: vi.fn() };
vi.mock('@/modules/progression/hooks/useSocialGamification', () => ({
  useMyReviews: () => state.mine,
  useSubmitReviews: () => ({ mutateAsync: (...a) => state.submit(...a), isPending: false }),
}));
vi.mock('@/modules/progression/hooks/usePeople', () => ({
  usePeople: () => ({ people: new Map([['p1', { name: 'Paulo', photoUrl: '' }], ['o1', { name: 'Olga', photoUrl: '' }]]), isLoading: false }),
}));

import ReviewsPanel from './ReviewsPanel.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.mine = { reviews: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.submit = vi.fn(() => Promise.resolve(2));
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = (props) => act(async () => { root.render(<ReviewsPanel uid="eu" windowDays={14} {...props} />); });

const jogo = (over = {}) => ({ matchKey: 'gd:1', at: Date.now() - 86_400_000, label: 'Dia de jogo', partnerUids: ['p1'], opponentUids: ['o1'], ...over });

describe('ReviewsPanel', () => {
  it('lista o jogo recente com alguém a avaliar', async () => {
    await render({ records: [jogo()] });
    expect(container.textContent).toContain('1 pendente');
    expect(container.textContent).toContain('2 pessoas para avaliar');
  });

  it('jogo antigo (fora da janela) ou sem conta para avaliar não entra', async () => {
    await render({ records: [jogo({ at: Date.now() - 40 * 86_400_000 }), jogo({ matchKey: 'gd:2', partnerUids: [], opponentUids: [] })] });
    expect(container.textContent).toContain('Nada para avaliar agora');
  });

  it('o que já foi avaliado sai da lista', async () => {
    state.mine.reviews = [{ matchKey: 'gd:1', toUid: 'p1' }, { matchKey: 'gd:1', toUid: 'o1' }];
    await render({ records: [jogo()] });
    expect(container.textContent).toContain('Nada para avaliar agora');
  });

  it('falha de leitura não vira "nada para avaliar"', async () => {
    state.mine.isError = true;
    await render({ records: [jogo()] });
    expect(container.textContent).toContain('Não deu para carregar as avaliações');
    expect(container.textContent).not.toContain('Nada para avaliar');
  });

  it('fluxo: abre, dá estrelas e elogios ao companheiro, e envia só quem foi avaliado', async () => {
    await render({ records: [jogo()] });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Avaliar').click(); });
    const dialogo = document.body;
    expect(dialogo.textContent).toContain('Como foi jogar com eles?');
    expect(dialogo.textContent).toContain('Só você e a equipe de moderação veem quem deu qual nota');
    // 5 estrelas ao Paulo
    const alvoPaulo = dialogo.querySelector('[data-target="p1"]');
    await act(async () => { alvoPaulo.querySelector('[aria-label="5 estrelas"]').click(); });
    await act(async () => { Array.from(alvoPaulo.querySelectorAll('button')).find((b) => b.textContent.includes('Bom companheiro')).click(); });
    // o botão de enviar conta 1 (a Olga ficou sem nota: avaliar é opcional por pessoa)
    const enviar = Array.from(dialogo.querySelectorAll('button')).find((b) => b.textContent.startsWith('Enviar'));
    expect(enviar.textContent).toContain('(1)');
    await act(async () => { enviar.click(); });
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit.mock.calls[0][0]).toEqual({
      matchKey: 'gd:1',
      items: [{ toUid: 'p1', relation: 'partner', rating: 5, tags: ['companheiro'], issues: [] }],
    });
  });

  it('nota baixa pede o motivo (categorias, sem texto livre) e some os elogios', async () => {
    await render({ records: [jogo()] });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Avaliar').click(); });
    const alvo = document.body.querySelector('[data-target="o1"]');
    await act(async () => { alvo.querySelector('[aria-label="1 estrela"]').click(); });
    expect(alvo.textContent).toContain('só a moderação lê');
    expect(alvo.textContent).not.toContain('Bom companheiro');
    expect(document.body.querySelector('textarea')).toBeNull(); // sem comentário livre
  });

  it('sem nenhuma nota, não há o que enviar', async () => {
    await render({ records: [jogo()] });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Avaliar').click(); });
    const enviar = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent.startsWith('Enviar'));
    expect(enviar.disabled).toBe(true);
  });
});

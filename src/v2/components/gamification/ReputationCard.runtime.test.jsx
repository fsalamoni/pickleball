import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

const state = { rep: { reputation: null, isLoading: false }, priv: { privateReputation: null } };
vi.mock('@/modules/progression/hooks/useSocialGamification', () => ({
  useReputation: () => state.rep,
  useMyPrivateReputation: () => state.priv,
}));

import ReputationCard from './ReputationCard.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.rep = { reputation: null, isLoading: false }; state.priv = { privateReputation: null };
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (props) => act(async () => { root.render(<ReputationCard uid="eu" {...props} />); });

describe('ReputationCard', () => {
  it('com poucas avaliações a nota NÃO aparece — e diz quantas faltam', async () => {
    state.rep.reputation = { count: 2, average: null, publicScore: false, topTags: [] };
    await render({ minForPublicScore: 5 });
    expect(container.textContent).toContain('faltam');
    expect(container.textContent).toContain('3');
    expect(container.textContent).not.toMatch(/\d\.\d/);
  });

  it('sem nenhuma avaliação ainda também explica', async () => {
    await render({ minForPublicScore: 5 });
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('Antes disso ela não é exibida');
  });

  it('com amostra suficiente mostra a média, o total e os elogios mais votados', async () => {
    state.rep.reputation = { count: 12, average: 4.6, publicScore: true, topTags: [{ tag: 'companheiro', count: 7 }, { tag: 'pontual', count: 4 }] };
    await render();
    expect(container.textContent).toContain('4.6');
    expect(container.textContent).toContain('12 avaliações');
    expect(container.textContent).toContain('Bom companheiro');
    expect(container.textContent).toContain('×7');
  });

  it('as categorias de problema são SÓ da própria pessoa, sem dizer quem apontou', async () => {
    state.rep.reputation = { count: 10, average: 3.9, publicScore: true, topTags: [] };
    state.priv.privateReputation = { issues: { pontualidade: 2, conduta: 0 } };
    await render({ self: true });
    expect(container.textContent).toContain('Só você vê isto');
    expect(container.textContent).toContain('atraso ou falta');
    expect(container.textContent).not.toContain('conduta');
    expect(container.textContent).toContain('Não mostramos quem');
  });

  it('vendo a reputação de OUTRA pessoa, o bloco privado nunca aparece', async () => {
    state.rep.reputation = { count: 10, average: 3.9, publicScore: true, topTags: [] };
    state.priv.privateReputation = { issues: { pontualidade: 2 } };
    await render({ self: false });
    expect(container.textContent).not.toContain('Só você vê isto');
  });
});

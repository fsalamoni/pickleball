import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const NOW = Date.now();
const DIA = 86_400_000;
const state = {
  active: { challenges: [], isLoading: false, isError: false, refetch: vi.fn() },
  finished: { challenges: [], isLoading: false, isError: false },
  mine: { entries: [], byChallenge: new Map(), isLoading: false, isError: false, refetch: vi.fn() },
  entries: { entries: [], isLoading: false, isError: false, refetch: vi.fn() },
  join: vi.fn(),
};
vi.mock('@/modules/progression/hooks/useChallenges', () => ({
  useActiveChallenges: () => state.active,
  useFinishedChallenges: () => state.finished,
  useMyEntries: () => state.mine,
  useChallengeEntries: () => state.entries,
  useChallengeActions: () => ({ join: { mutateAsync: (...a) => state.join(...a), isPending: false } }),
}));
vi.mock('@/modules/progression/hooks/usePeople', () => ({
  usePeople: () => ({ people: new Map([['eu', { name: 'Eu' }], ['b', { name: 'Bia' }]]), isLoading: false }),
  useClubNames: () => new Map([['c1', 'Clube Norte']]),
}));

import ChallengesPanel from './ChallengesPanel.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.active = { challenges: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.finished = { challenges: [], isLoading: false, isError: false };
  state.mine = { entries: [], byChallenge: new Map(), isLoading: false, isError: false, refetch: vi.fn() };
  state.entries = { entries: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.join = vi.fn(() => Promise.resolve('id'));
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = () => act(async () => { root.render(<ChallengesPanel uid="eu" />); });

const desafio = (over = {}) => ({
  id: 'c1', title: 'Semana das Duplas', emoji: '🎾', issuerType: 'arena', issuerName: 'Arena Sol', metric: 'games_played', subject: 'athlete',
  status: 'active', startsAt: NOW - DIA, endsAt: NOW + 5 * DIA, prizes: [{ place: 1, label: 'Hora grátis', xp: 0 }], ...over,
});

describe('ChallengesPanel', () => {
  it('sem desafio: estado vazio que explica quem abre desafio', async () => {
    await render();
    expect(container.textContent).toContain('Nenhum desafio aberto agora');
  });

  it('mostra o desafio com o que mede, o prazo e o prêmio, e permite entrar', async () => {
    state.active.challenges = [desafio()];
    await render();
    expect(container.textContent).toContain('Semana das Duplas');
    expect(container.textContent).toContain('Jogos disputados');
    expect(container.textContent).toMatch(/termina em \d+ dias/);
    expect(container.textContent).toContain('1º: Hora grátis');
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Entrar no desafio').click(); });
    expect(state.join).toHaveBeenCalledWith('c1');
  });

  it('quem já está dentro não vê "Entrar" e o progresso é automático', async () => {
    state.active.challenges = [desafio()];
    state.mine.byChallenge = new Map([['c1', { id: 'c1_eu', challengeId: 'c1' }]]);
    await render();
    expect(container.textContent).toContain('você está dentro');
    expect(container.textContent).toContain('contado automaticamente');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Entrar no desafio')).toBe(false);
  });

  it('desafio entre clubes não tem entrada individual', async () => {
    state.active.challenges = [desafio({ subject: 'club', issuerType: 'platform' })];
    await render();
    expect(container.textContent).toContain('entre clubes');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Entrar no desafio')).toBe(false);
  });

  it('o que está por terminar já não aceita entrada, e diz por quê', async () => {
    state.active.challenges = [desafio({ endsAt: NOW + 3_600_000 })];
    await render();
    expect(container.textContent).toContain('a inscrição já fechou');
  });

  it('o placar mostra nomes (não ids), a minha posição e quanto falta para o pódio', async () => {
    state.active.challenges = [desafio()];
    state.entries.entries = [
      { id: '1', subjectId: 'b', subjectType: 'athlete', value: 9, joinedAt: 1 },
      { id: '2', subjectId: 'x1', subjectType: 'athlete', value: 8, joinedAt: 2 },
      { id: '3', subjectId: 'x2', subjectType: 'athlete', value: 7, joinedAt: 3 },
      { id: '4', subjectId: 'eu', subjectType: 'athlete', value: 3, joinedAt: 4 },
    ];
    await render();
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Ver placar').click(); });
    const dialogo = document.body;
    expect(dialogo.textContent).toContain('Bia');
    const eu = dialogo.querySelector('[data-testid="my-standing"]');
    expect(eu.textContent).toContain('4º');
    expect(eu.textContent).toContain('faltam 5 para o pódio');
    expect(dialogo.textContent).toContain('calculado pelo servidor');
  });

  it('a aba Resultados traz os encerrados', async () => {
    state.finished.challenges = [desafio({ id: 'c9', title: 'Mês do Iniciante', status: 'finished', endsAt: NOW - DIA })];
    await render();
    await act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.includes('Resultados')).click(); });
    expect(container.textContent).toContain('Mês do Iniciante');
    expect(container.textContent).toContain('terminou');
  });

  it('falha de leitura tem texto próprio e botão', async () => {
    state.active.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar os desafios');
    expect(container.textContent).not.toContain('Nenhum desafio aberto agora');
  });
});

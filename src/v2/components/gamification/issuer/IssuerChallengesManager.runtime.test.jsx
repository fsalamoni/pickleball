import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const NOW = Date.now();
const state = {
  list: { challenges: [], isLoading: false, isError: false, refetch: vi.fn() },
  create: vi.fn(), update: vi.fn(), cancel: vi.fn(), remove: vi.fn(),
};
vi.mock('@/modules/progression/hooks/useChallenges', () => ({
  useIssuerChallenges: () => ({
    ...state.list,
    create: { mutateAsync: (...a) => state.create(...a), isPending: false },
    update: { mutateAsync: (...a) => state.update(...a), isPending: false },
    cancel: { mutate: (...a) => state.cancel(...a) },
    remove: { mutate: (...a) => state.remove(...a) },
  }),
  useChallengeEntries: () => ({ entries: [{ id: 'e1', subjectId: 'b', subjectType: 'athlete', value: 4, joinedAt: 1 }], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/progression/hooks/usePeople', () => ({ usePeople: () => ({ people: new Map([['b', { name: 'Bia' }]]), isLoading: false }) }));

import IssuerChallengesManager from './IssuerChallengesManager.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.list = { challenges: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.create = vi.fn(() => Promise.resolve('id')); state.update = vi.fn(() => Promise.resolve());
  state.cancel = vi.fn(); state.remove = vi.fn();
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = (issuer = { type: 'arena', id: 'a1', name: 'Arena Sol' }) => act(async () => { root.render(<IssuerChallengesManager issuer={issuer} actor={{ uid: 'g' }} />); });
const preencher = async (el, valor) => {
  await act(async () => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const botao = (rotulo, raiz = document.body) => Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent.trim() === rotulo);

const d = (over = {}) => ({ id: 'c1', title: 'Quem mais joga', emoji: '🏆', metric: 'games_played', subject: 'athlete', status: 'active', startsAt: NOW - 86_400_000, endsAt: NOW + 6 * 86_400_000, prizes: [], createdBy: 'g', ...over });

describe('IssuerChallengesManager', () => {
  it('sem desafios: estado vazio com uma ideia', async () => {
    await render();
    expect(container.textContent).toContain('Nenhum desafio ainda');
  });

  it('lista com estado, o que mede e o prazo; placar sob demanda com NOME', async () => {
    state.list.challenges = [d()];
    await render();
    expect(container.textContent).toContain('Quem mais joga');
    expect(container.textContent).toContain('Ativo');
    await act(async () => { botao('Ver placar', container).click(); });
    expect(container.textContent).toContain('1 participante');
    expect(container.textContent).toContain('1º Bia');
  });

  it('criar: valida o nome ANTES de gravar e mostra o motivo', async () => {
    await render();
    await act(async () => { botao('Novo desafio', container).click(); });
    await act(async () => { botao('Salvar').click(); });
    expect(document.body.querySelector('[role="alert"]').textContent).toContain('Dê um nome ao desafio');
    expect(state.create).not.toHaveBeenCalled();
  });

  it('criar: grava a entrada validada, com o dia final valendo', async () => {
    await render();
    await act(async () => { botao('Novo desafio', container).click(); });
    await preencher(document.body.querySelector('#ch-title'), 'Semana das Duplas');
    await preencher(document.body.querySelector('#ch-ini'), '2026-11-02');
    await preencher(document.body.querySelector('#ch-fim'), '2026-11-08');
    await act(async () => { botao('Salvar').click(); });
    expect(state.create).toHaveBeenCalledTimes(1);
    const entrada = state.create.mock.calls[0][0];
    expect(entrada).toMatchObject({ title: 'Semana das Duplas', metric: 'games_played', status: 'active' });
    expect((entrada.endsAt - entrada.startsAt) / 86_400_000).toBe(7);
  });

  it('arena não vê XP de prêmio nem escolher "clubes" — só a plataforma concede XP', async () => {
    await render({ type: 'arena', id: 'a1' });
    await act(async () => { botao('Novo desafio', container).click(); });
    expect(document.body.querySelector('input[aria-label="XP do 1º lugar"]')).toBeNull();
    expect(document.body.querySelector('#ch-subject')).toBeNull();
    expect(document.body.textContent).toContain('Só a plataforma concede XP');
    // e a medida de reservas é da arena
    const opcoes = Array.from(document.body.querySelectorAll('#ch-metric option')).map((o) => o.textContent);
    expect(opcoes).toContain('Reservas jogadas na arena');
    expect(opcoes).not.toContain('Aulas concluídas');
  });

  it('a plataforma vê XP, clubes e estado; o professor, aulas', async () => {
    await render({ type: 'platform', id: 'platform' });
    await act(async () => { botao('Novo desafio', container).click(); });
    expect(document.body.querySelector('input[aria-label="XP do 1º lugar"]')).toBeTruthy();
    expect(document.body.querySelector('#ch-subject')).toBeTruthy();
    expect(document.body.querySelector('#ch-uf')).toBeTruthy();
  });

  it('editar abre o desafio preenchido e salva por cima', async () => {
    state.list.challenges = [d()];
    await render();
    await act(async () => { botao('Editar', container).click(); });
    expect(document.body.querySelector('#ch-title').value).toBe('Quem mais joga');
    await act(async () => { botao('Salvar').click(); });
    expect(state.update.mock.calls[0][0].id).toBe('c1');
  });

  it('encerrado ou cancelado não se edita; rascunho e cancelado se apagam', async () => {
    state.list.challenges = [d({ id: 'f', status: 'finished', endsAt: NOW - 1000 }), d({ id: 'x', status: 'cancelled' }), d({ id: 'r', status: 'draft' })];
    await render();
    const itens = container.querySelectorAll('li');
    expect(botao('Editar', itens[0])).toBeUndefined();
    expect(botao('Apagar', itens[0])).toBeUndefined();
    expect(botao('Apagar', itens[1])).toBeTruthy();
    expect(botao('Editar', itens[2])).toBeTruthy();
  });

  it('cancelar pede confirmação', async () => {
    state.list.challenges = [d()];
    await render();
    await act(async () => { botao('Cancelar', container).click(); });
    expect(document.body.textContent).toContain('Cancelar este desafio?');
    expect(state.cancel).not.toHaveBeenCalled();
    await act(async () => { botao('Cancelar o desafio').click(); });
    expect(state.cancel.mock.calls[0][0]).toBe('c1');
  });

  it('falha de leitura não deixa criar (e não diz "nenhum desafio")', async () => {
    state.list.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar os desafios');
    expect(container.textContent).not.toContain('Nenhum desafio ainda');
    expect(botao('Novo desafio', container)).toBeUndefined();
  });
});

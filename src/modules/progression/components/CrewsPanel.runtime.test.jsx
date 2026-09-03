import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CrewsPanel from './CrewsPanel.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render(props = {}) {
  await act(async () => { root.render(<CrewsPanel uid="eu" {...props} />); });
}

const minhaCrew = { crewId: 'c1', name: 'Turma da manhã', membersCount: 4, createdBy: 'eu', totalXp: 1200 };
const crewDeOutro = { crewId: 'c2', name: 'Saque e Voleio', membersCount: 3, createdBy: 'outro', totalXp: 0 };
const publica = { crewId: 'c3', name: 'Iniciantes SP', membersCount: 10, createdBy: 'alguem' };

describe('CrewsPanel · minhas crews', () => {
  it('lista as crews do atleta', async () => {
    await render({ myCrews: [minhaCrew] });
    expect(container.querySelectorAll('[data-testid="my-crew-item"]')).toHaveLength(1);
    expect(container.textContent).toContain('Turma da manhã');
    expect(container.textContent).toContain('4/50 membros');
  });

  it('quem criou a crew NÃO vê o botão de sair (o service recusaria)', async () => {
    await render({ myCrews: [minhaCrew] });
    expect(container.querySelector('[data-testid="crew-leave-btn"]')).toBeNull();
  });

  it('membro comum vê o botão de sair', async () => {
    await render({ myCrews: [crewDeOutro] });
    expect(container.querySelector('[data-testid="crew-leave-btn"]')).toBeTruthy();
  });

  it('sair chama o callback com o id da crew', async () => {
    const onLeave = vi.fn();
    await render({ myCrews: [crewDeOutro], onLeave });
    await act(async () => { container.querySelector('[data-testid="crew-leave-btn"]').click(); });
    expect(onLeave).toHaveBeenCalledWith('c2');
  });

  it('estado vazio convida a criar ou entrar', async () => {
    await render({ myCrews: [] });
    expect(container.textContent).toContain('ainda não está numa crew');
  });
});

describe('CrewsPanel · criar', () => {
  it('o formulário só aparece ao pedir', async () => {
    await render({ myCrews: [] });
    expect(container.querySelector('[data-testid="crew-form"]')).toBeNull();
    await act(async () => { container.querySelector('[data-testid="crew-new-btn"]').click(); });
    expect(container.querySelector('[data-testid="crew-form"]')).toBeTruthy();
  });

  it('não cria crew sem nome', async () => {
    const onCreate = vi.fn();
    await render({ myCrews: [], onCreate });
    await act(async () => { container.querySelector('[data-testid="crew-new-btn"]').click(); });
    const submit = container.querySelector('[data-testid="crew-form"] button[type="submit"]');
    expect(submit.disabled).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('CrewsPanel · crews abertas', () => {
  it('mostra crews públicas para entrar', async () => {
    await render({ myCrews: [], publicCrews: [publica] });
    expect(container.querySelectorAll('[data-testid="public-crew-item"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="crew-join-btn"]')).toBeTruthy();
  });

  it('não oferece entrar numa crew em que já estou', async () => {
    await render({ myCrews: [minhaCrew], publicCrews: [minhaCrew, publica] });
    const itens = container.querySelectorAll('[data-testid="public-crew-item"]');
    expect(itens).toHaveLength(1);
    expect(itens[0].getAttribute('data-crew-id')).toBe('c3');
  });

  it('crew lotada não oferece entrar', async () => {
    await render({ myCrews: [], publicCrews: [{ ...publica, membersCount: 50 }] });
    expect(container.querySelector('[data-testid="crew-join-btn"]')).toBeNull();
    expect(container.textContent).toContain('Lotada');
  });

  it('entrar chama o callback com o id', async () => {
    const onJoin = vi.fn();
    await render({ myCrews: [], publicCrews: [publica], onJoin });
    await act(async () => { container.querySelector('[data-testid="crew-join-btn"]').click(); });
    expect(onJoin).toHaveBeenCalledWith('c3');
  });
});

describe('CrewsPanel · erro', () => {
  it('mostra a mensagem do service em vez de falhar em silêncio', async () => {
    await render({ myCrews: [], error: 'crew lotada (50 membros)' });
    const alerta = container.querySelector('[role="alert"]');
    expect(alerta).toBeTruthy();
    expect(alerta.textContent).toContain('crew lotada');
  });
});

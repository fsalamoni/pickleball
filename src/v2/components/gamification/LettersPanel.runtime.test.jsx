import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const state = {
  received: { letters: [], unread: 0, isLoading: false, isError: false, refetch: vi.fn() },
  sent: { sent: [], isLoading: false, isError: false },
  send: vi.fn(), read: vi.fn(), report: vi.fn(), remove: vi.fn(),
};
vi.mock('@/modules/progression/hooks/useSocialGamification', () => ({
  useReceivedLetters: () => state.received,
  useSentLetters: () => state.sent,
  useLetterActions: () => ({
    send: { mutateAsync: (...a) => state.send(...a), isPending: false },
    read: { mutate: (...a) => state.read(...a) },
    report: { mutate: (...a) => state.report(...a) },
    remove: { mutate: (...a) => state.remove(...a) },
  }),
}));
vi.mock('@/modules/progression/hooks/usePeople', () => ({
  usePeople: () => ({ people: new Map([['p1', { name: 'Paulo', photoUrl: '' }]]), isLoading: false }),
}));

import LettersPanel from './LettersPanel.jsx';

let container; let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.received = { letters: [], unread: 0, isLoading: false, isError: false, refetch: vi.fn() };
  state.sent = { sent: [], isLoading: false, isError: false };
  [state.send, state.read, state.report, state.remove].forEach((f) => f.mockReset());
  state.send.mockResolvedValue('id');
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; vi.useRealTimers(); });
const render = (props) => act(async () => { root.render(<LettersPanel uid="eu" fromName="Eu" {...props} />); });

const jogo = (over = {}) => ({ matchKey: 'gd:1', at: Date.now() - 86_400_000, partnerUids: ['p1'], opponentUids: ['o1'], ...over });

describe('LettersPanel', () => {
  it('sem cartas: estado vazio gentil', async () => {
    await render({ records: [] });
    expect(container.textContent).toContain('Nenhuma carta ainda');
  });

  it('anônima por padrão: o destinatário lê "Um parceiro de dupla"; assinada mostra o nome', async () => {
    state.received = { unread: 0, isLoading: false, isError: false, refetch: vi.fn(), letters: [
      { id: '1', text: 'Valeu pela parceria!', showName: false, createdAt: 2, readAt: 1 },
      { id: '2', text: 'Adorei jogar contigo', showName: true, fromName: 'Bia', createdAt: 1, readAt: 1 },
    ] };
    await render({ records: [] });
    expect(container.textContent).toContain('Um parceiro de dupla');
    expect(container.textContent).toContain('Bia');
    expect(container.textContent).toContain('“Valeu pela parceria!”');
  });

  it('as não lidas são marcadas como lidas depois de alguns segundos com a aba aberta', async () => {
    state.received = { unread: 1, isLoading: false, isError: false, refetch: vi.fn(), letters: [{ id: '1', text: 'Oi', showName: false, createdAt: 1, readAt: null }] };
    await render({ records: [] });
    expect(state.read).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(4500); });
    expect(state.read).toHaveBeenCalledWith('1');
    expect(container.textContent).toContain('1 nova');
  });

  it('denunciar e apagar', async () => {
    state.received = { unread: 0, isLoading: false, isError: false, refetch: vi.fn(), letters: [{ id: '1', text: 'Oi', createdAt: 1, readAt: 1 }] };
    await render({ records: [] });
    await act(async () => { container.querySelector('[aria-label="Denunciar carta"]').click(); });
    expect(state.report).toHaveBeenCalledWith('1');
    await act(async () => { container.querySelector('[aria-label="Apagar carta"]').click(); });
    expect(state.remove).toHaveBeenCalledWith('1');
  });

  it('sugere escrever só ao PARCEIRO de dupla de jogo recente (nunca ao adversário), uma vez por pessoa', async () => {
    await render({ records: [jogo(), jogo({ matchKey: 'gd:2' })] });
    const sugestoes = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent.includes('Paulo'));
    expect(sugestoes.length).toBe(1);
    expect(container.textContent).not.toContain('o1');
  });

  it('quem já recebeu a carta daquele jogo não é sugerido de novo', async () => {
    state.sent = { sent: [{ id: 'gd-1__eu__p1' }], isLoading: false, isError: false };
    await render({ records: [jogo()] });
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent.includes('Paulo'))).toBe(false);
  });

  it('escrever: o texto é limitado, sem link, e assinar é escolha', async () => {
    await render({ records: [jogo()] });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Paulo')).click(); });
    const area = document.body.querySelector('textarea');
    expect(area.getAttribute('maxlength')).toBe('280');
    const enviar = () => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'Enviar carta');
    expect(enviar().disabled).toBe(true);
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(area, 'Obrigado pela parceria!');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(enviar().disabled).toBe(false);
    await act(async () => { document.body.querySelector('#letter-name').click(); }); // assinar
    await act(async () => { enviar().click(); });
    expect(state.send.mock.calls[0][0]).toEqual({ fromName: 'Eu', toUid: 'p1', matchKey: 'gd:1', text: 'Obrigado pela parceria!', showName: true });
  });

  it('falha de leitura tem texto próprio', async () => {
    state.received.isError = true;
    await render({ records: [] });
    expect(container.textContent).toContain('Não deu para carregar as cartas');
  });
});

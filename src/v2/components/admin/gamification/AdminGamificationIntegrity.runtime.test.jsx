import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'adm', email: 'a@x.com' } }) }));
vi.mock('@/modules/progression/hooks/usePeople', () => ({
  usePeople: () => ({ people: new Map([['u1', { name: 'Ana' }], ['u2', { name: 'Bia' }]]), isLoading: false }),
}));

const s = {
  flags: { flags: [], isLoading: false, isError: false, refetch: vi.fn() }, review: vi.fn(),
  mod: { moderated: [], isLoading: false, isError: false, refetch: vi.fn() }, setMod: vi.fn(), reset: vi.fn(),
  letters: { letters: [], isLoading: false, isError: false, refetch: vi.fn() }, removeLetter: vi.fn(),
};
vi.mock('@/modules/progression/hooks/useGamificationAdmin', () => ({
  useAdminFlags: () => ({ ...s.flags, review: { mutate: (...a) => s.review(...a) } }),
  useAdminModeration: () => ({ ...s.mod, set: { mutate: (...a) => s.setMod(...a) }, reset: { mutate: (...a) => s.reset(...a) } }),
  useReportedLetters: () => ({ ...s.letters, remove: { mutate: (...a) => s.removeLetter(...a) } }),
}));

import AdminGamificationIntegrity from './AdminGamificationIntegrity.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  s.flags = { flags: [], isLoading: false, isError: false, refetch: vi.fn() };
  s.mod = { moderated: [], isLoading: false, isError: false, refetch: vi.fn() };
  s.letters = { letters: [], isLoading: false, isError: false, refetch: vi.fn() };
  [s.review, s.setMod, s.reset, s.removeLetter].forEach((f) => f.mockReset());
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = () => act(async () => { root.render(<AdminGamificationIntegrity />); });
const aba = async (rotulo) => act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.includes(rotulo)).click(); });
const botao = (rotulo, raiz = container) => Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent.trim() === rotulo);

const flag = (over = {}) => ({ id: 'f1', type: 'xp_unverified', severity: 'high', subjectUid: 'u1', status: 'open', createdAt: 5, detail: { xpTotal: 9000, verifiedGames: 3, verifiedWins: 1, ceiling: 150 }, ...over });

describe('AdminGamificationIntegrity', () => {
  it('o servidor MARCA, nunca pune: o texto diz isso e quem está retido fica fora do público', async () => {
    await render();
    expect(container.textContent).toContain('O servidor marca');
    expect(container.textContent).toContain('Nenhum sinal aberto');
  });

  it('o sinal mostra a pessoa pelo NOME, o motivo e os números que o motivaram', async () => {
    s.flags.flags = [flag()];
    await render();
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).toContain('XP acima do que os jogos verificados sustentam');
    expect(container.textContent).toContain('jogos verificados pelo servidor: 3');
    expect(container.textContent).toContain('alta');
  });

  it('anel de kudos mostra os dois lados', async () => {
    s.flags.flags = [flag({ id: 'f2', type: 'kudos_ring', severity: 'medium', subjectUid: 'u1', otherUid: 'u2', detail: { ab: 6, ba: 5 } })];
    await render();
    expect(container.textContent).toContain('Ana × Bia');
    expect(container.textContent).toContain('6 kudos num sentido, 5 no outro');
  });

  it('o veredito: "tudo certo", "dispensar" ou "tomei providência" — com o autor do veredito', async () => {
    s.flags.flags = [flag()];
    await render();
    await act(async () => { botao('Está tudo certo').click(); });
    expect(s.review.mock.calls[0][0]).toMatchObject({ id: 'f1', status: 'reviewed', actor: { uid: 'adm', email: 'a@x.com' } });
    await act(async () => { botao('Dispensar').click(); });
    expect(s.review.mock.calls[1][0].status).toBe('dismissed');
    await act(async () => { botao('Tomei providência').click(); });
    expect(s.review.mock.calls[2][0].status).toBe('actioned');
  });

  it('os já revisados ficam na outra aba, sem botões', async () => {
    s.flags.flags = [flag(), flag({ id: 'f3', status: 'reviewed', reviewNote: 'ok' })];
    await render();
    expect(container.querySelectorAll('[data-flag]').length).toBe(1);
    await aba('Revisados');
    expect(container.querySelectorAll('[data-flag]').length).toBe(1);
    expect(botao('Está tudo certo')).toBeUndefined();
    expect(container.textContent).toContain('Estado: reviewed');
  });

  it('moderar: esconder do público e tirar do placar levam uid e motivo; zerar pede confirmação', async () => {
    await render();
    await aba('Contas moderadas');
    const set = async (el, v) => act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(botao('Esconder do público').disabled).toBe(true); // sem uid, nada a fazer
    await set(container.querySelector('input[aria-label="ID da conta (uid)"]'), 'u9');
    await set(container.querySelector('input[aria-label="Motivo"]'), 'conta de teste');
    await act(async () => { botao('Esconder do público').click(); });
    expect(s.setMod.mock.calls[0][0]).toEqual({ uid: 'u9', state: { hiddenFromPublic: true, reason: 'conta de teste' }, actor: { uid: 'adm', email: 'a@x.com' } });
    await set(container.querySelector('input[aria-label="ID da conta (uid)"]'), 'u9');
    await act(async () => { botao('Tirar do placar').click(); });
    expect(s.setMod.mock.calls[1][0].state.excluded).toBe(true);
    await set(container.querySelector('input[aria-label="ID da conta (uid)"]'), 'u9');
    await act(async () => { botao('Zerar a progressão').click(); });
    expect(document.body.textContent).toContain('Zerar a progressão desta conta?');
    expect(s.reset).not.toHaveBeenCalled();
    await act(async () => { botao('Zerar', document.body).click(); });
    expect(s.reset.mock.calls[0][0].uid).toBe('u9');
  });

  it('contas moderadas: lista com o motivo e devolve ao normal', async () => {
    s.mod.moderated = [{ uid: 'u2', excluded: true, reason: 'fraude' }];
    await render();
    await aba('Contas moderadas');
    expect(container.textContent).toContain('Bia');
    expect(container.textContent).toContain('Fora do placar · fraude');
    await act(async () => { botao('Devolver ao normal').click(); });
    expect(s.setMod.mock.calls[0][0].state).toEqual({ reason: '' });
  });

  it('cartas denunciadas: apagar pede confirmação', async () => {
    s.letters.letters = [{ id: 'l1', text: 'texto ofensivo' }];
    await render();
    await aba('Cartas denunciadas');
    expect(container.textContent).toContain('texto ofensivo');
    await act(async () => { botao('Apagar carta').click(); });
    expect(document.body.textContent).toContain('Apagar esta carta?');
    await act(async () => { botao('Apagar', document.body).click(); });
    expect(s.removeLetter).toHaveBeenCalledWith('l1');
  });

  it('falha de leitura tem texto próprio em cada aba', async () => {
    s.flags.isError = true; s.mod.isError = true; s.letters.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar os sinais');
    await aba('Contas moderadas');
    expect(container.textContent).toContain('Não deu para carregar a moderação');
    await aba('Cartas denunciadas');
    expect(container.textContent).toContain('Não deu para carregar as cartas denunciadas');
  });
});

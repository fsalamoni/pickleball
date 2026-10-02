/**
 * Unificar o histórico de uma conta excluída — o diálogo.
 *
 * Protege: (1) sugere a mesma pessoa e pede a PRÉVIA ao servidor ao escolher;
 * (2) mostra quem era a conta excluída e quem fica, lado a lado; (3) conflito
 * não deixa executar; (4) sem motivo e sem UNIFICAR o botão não libera;
 * (5) só o dono vê o botão.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'dono', email: 'fsalamoni@gmail.com' } };
const estado = { report: null };
const pedirPrevia = vi.fn();
const unificar = vi.fn(async () => ({ status: 'merged', documentos: 7, ranking: true }));

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({
  usePreviewAccountMerge: () => ({
    mutate: pedirPrevia, reset: vi.fn(), data: estado.report ? { report: estado.report } : null,
    isPending: false, isError: false,
  }),
  useMergeAccountHistory: () => ({ mutateAsync: unificar, isPending: false }),
}));

const { default: AdminAccountMergeDialog } = await import('./AdminAccountMergeDialog.jsx');

const EXCLUIDA = { uid: 'velho', name: 'Leonardo Silva', email: 'leo.silva@x.com' };
const USERS = [
  { uid: 'novo', full_name: 'Leonardo Silva', email: 'leonardosilva@gmail.com' },
  { uid: 'ana', full_name: 'Ana Costa', email: 'ana@x.com' },
];
const relatorio = (over = {}) => ({
  excluida: { name: 'Leonardo Silva', email: 'leo.silva@x.com' },
  destino: { name: 'Leonardo Silva', email: 'leonardosilva@gmail.com' },
  bloqueios: [], conflitos: [], conflitosTotal: 0,
  itens: [{ label: 'Jogos publicados no ranking', count: 14 }], total: 30, truncado: false, podeUnificar: true,
  ...over,
});

let container, root;
beforeEach(() => {
  pedirPrevia.mockClear(); unificar.mockClear();
  auth.user = { uid: 'dono', email: 'fsalamoni@gmail.com' };
  estado.report = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

const render = async () => { await act(async () => { root.render(<AdminAccountMergeDialog deleted={EXCLUIDA} users={USERS} onClose={() => {}} />); }); };
const botao = (t) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const clicar = async (el) => { await act(async () => { el.click(); }); };
const digitar = async (el, valor) => {
  await act(async () => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('unificar o histórico', () => {
  it('⭐ sugere a mesma pessoa e, ao escolher, pede a prévia ao servidor', async () => {
    await render();
    expect(document.body.textContent).toContain('Provavelmente é a mesma pessoa');
    expect(document.body.textContent).not.toContain('Ana Costa');
    await clicar(botao('leonardosilva@gmail.com'));
    expect(pedirPrevia).toHaveBeenCalledWith({ fromUid: 'velho', intoUid: 'novo' });
  });

  it('⭐ com a prévia: lado a lado, e o botão só libera com motivo e UNIFICAR', async () => {
    estado.report = relatorio();
    await render();
    await clicar(botao('leonardosilva@gmail.com'));
    expect(document.body.textContent).toContain('Conta excluída');
    expect(document.body.textContent).toContain('Conta que fica');
    expect(document.body.textContent).toContain('Jogos publicados no ranking: 14');
    expect(botao('Unificar').disabled).toBe(true);
    await digitar(document.body.querySelector('textarea'), 'segunda conta do Leonardo');
    const inputs = [...document.body.querySelectorAll('input')];
    await digitar(inputs[inputs.length - 1], 'unificar');
    expect(botao('Unificar').disabled).toBe(false);
    await clicar(botao('Unificar'));
    expect(unificar).toHaveBeenCalledWith(expect.objectContaining({ fromUid: 'velho', intoUid: 'novo', confirm: 'unificar' }));
    expect(document.body.textContent).toContain('Histórico unificado');
  });

  it('⭐ conflito: diz onde e não oferece executar', async () => {
    estado.report = relatorio({ podeUnificar: false, conflitosTotal: 1, conflitos: [{ path: 'club_event_games/x', motivo: 'As duas contas estão na mesma partida publicada.' }] });
    await render();
    await clicar(botao('leonardosilva@gmail.com'));
    expect(document.body.textContent).toContain('1 conflito(s)');
    expect(botao('Unificar')).toBeUndefined();
  });

  it('⭐ outro admin vê a prévia, mas não o botão', async () => {
    auth.user = { uid: 'admin2', email: 'outro@x.com' };
    estado.report = relatorio();
    await render();
    await clicar(botao('leonardosilva@gmail.com'));
    expect(document.body.textContent).toContain('Só o dono da plataforma executa');
    expect(botao('Unificar')).toBeUndefined();
  });
});

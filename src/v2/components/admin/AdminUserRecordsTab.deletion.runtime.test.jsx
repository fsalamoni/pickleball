/**
 * A aba "Cadastros": EXCLUIR cadastro.
 *
 * O que este arquivo protege:
 *  1. ⭐ a própria conta, admin e dono NÃO podem ser escolhidos;
 *  2. ⭐ o filtro "Parecem de teste" mostra o PORQUÊ da suspeita;
 *  3. ⭐ a seleção respeita o limite por execução;
 *  4. ⭐ nada é apagado sem a PRÉVIA do servidor na tela;
 *  5. ⭐ conta impedida fica de fora sozinha;
 *  6. ⭐ sem motivo e sem EXCLUIR, o botão não libera;
 *  7. ⭐ só o dono da plataforma vê o botão de executar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'admin_uid', email: 'fsalamoni@gmail.com' }, isPlatformAdmin: true };
const dados = { users: [], previa: null, resultado: null };
const pedirPrevia = vi.fn();
const excluir = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({
  useAllPlatformUsers: () => ({ data: dados.users, isLoading: false }),
  useUpdateUserRecordAsAdmin: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewAccountDeletion: () => ({
    mutate: pedirPrevia,
    data: dados.previa,
    isPending: false,
    isError: false,
  }),
  useDeleteAccounts: () => ({
    mutate: excluir,
    data: dados.resultado,
    isPending: false,
    isError: false,
  }),
}));

// Carrega o diálogo antes: ele entra por `lazy`, e assim a promessa resolve
// na primeira volta do laço de eventos.
await import('./AdminAccountDeletionDialog.jsx');
const { default: AdminUserRecordsTab } = await import('./AdminUserRecordsTab.jsx');

const TESTE = { uid: 't1', email: 'mock1@example.com', full_name: 'Usuário Teste 1' };
const REAL = { uid: 'r1', email: 'ana.souza@gmail.com', full_name: 'Ana Souza' };
const ADMIN_EXTRA = { uid: 'a2', email: 'outro@gmail.com', full_name: 'Outro Admin', role: 'platform_admin' };
const EU = { uid: 'admin_uid', email: 'fsalamoni@gmail.com', full_name: 'Dono', role: 'platform_admin' };

const relatorio = (over = {}) => ({
  uid: 't1', name: 'Usuário Teste 1', email: 'mock1@example.com', exists: true, authExists: true,
  storageFiles: 0, blockers: [], canDelete: true,
  deletes: [{ label: 'Notificações', count: 3 }],
  pseudonyms: [{ label: 'Inscrições em torneio', count: 2 }],
  retained: [{ label: 'Reservas de quadra', count: 1 }],
  totals: { apagar: 4, pseudonimizar: 2, reter: 1 }, truncated: false,
  ...over,
});

let container, root;

beforeEach(() => {
  pedirPrevia.mockClear();
  excluir.mockClear();
  auth.user = { uid: 'admin_uid', email: 'fsalamoni@gmail.com' };
  dados.users = [TESTE, REAL, ADMIN_EXTRA, EU];
  dados.previa = null;
  dados.resultado = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async () => { await act(async () => { root.render(<AdminUserRecordsTab />); }); };
const esperar = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); };
const botao = (texto, raiz = document.body) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const linhaDe = (nome) => [...container.querySelectorAll('input[type="checkbox"]')]
  .find((c) => c.getAttribute('aria-label')?.includes(nome));
const digitar = async (el, valor) => {
  await act(async () => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('quem pode ser escolhido', () => {
  it('⭐ conta comum tem caixa e botão de excluir', async () => {
    await render();
    expect(linhaDe('Ana Souza').disabled).toBe(false);
    expect(container.querySelector('[aria-label="Excluir Ana Souza"]')).toBeTruthy();
  });

  it('⭐ admin, dono e a própria conta NÃO', async () => {
    await render();
    expect(linhaDe('Outro Admin').disabled).toBe(true);
    expect(linhaDe('Dono').disabled).toBe(true);
    expect(container.querySelector('[aria-label="Excluir Outro Admin"]')).toBeNull();
    expect(container.querySelector('[aria-label="Excluir Dono"]')).toBeNull();
  });
});

describe('o filtro "Parecem de teste"', () => {
  it('⭐ mostra só as suspeitas, com o motivo à vista', async () => {
    await render();
    await clicar(botao('Parecem de teste', container));
    const txt = container.textContent;
    expect(txt).toContain('Usuário Teste 1');
    expect(txt).not.toContain('Ana Souza');
    expect(txt).toContain('E-mail de domínio de exemplo (@example.com)');
    expect(txt).toContain('Confira antes de excluir');
  });
});

describe('a seleção', () => {
  it('⭐ respeita o limite de 25', async () => {
    dados.users = Array.from({ length: 30 }, (_, i) => ({ uid: `m${i}`, email: `m${i}@gmail.com`, full_name: `Pessoa ${i}` }));
    await render();
    await clicar(botao('Selecionar os que aparecem', container));
    expect(container.textContent).toContain('25 selecionados');
    expect(container.textContent).toContain('limite de 25');
  });
});

describe('a exclusão', () => {
  it('⭐ abrir pede a PRÉVIA ao servidor, e não exclui nada', async () => {
    await render();
    await clicar(container.querySelector('[aria-label="Excluir Usuário Teste 1"]'));
    await esperar();
    expect(pedirPrevia).toHaveBeenCalledWith({ uids: ['t1'] });
    expect(excluir).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Levantando o que cada conta tem');
  });

  it('⭐ a prévia mostra o que some, o que fica no histórico e o que fica guardado', async () => {
    dados.previa = { results: [{ uid: 't1', status: 'preview', report: relatorio() }] };
    await render();
    await clicar(container.querySelector('[aria-label="Excluir Usuário Teste 1"]'));
    await esperar();
    const txt = document.body.textContent;
    expect(txt).toContain('Será apagado');
    expect(txt).toContain('Conta de login');
    expect(txt).toContain('Notificações (3)');
    expect(txt).toContain('Inscrições em torneio (2)');
    expect(txt).toContain('Reservas de quadra');
  });

  it('⭐ sem motivo e sem EXCLUIR, o botão não libera; com os dois, envia', async () => {
    dados.previa = { results: [{ uid: 't1', status: 'preview', report: relatorio() }] };
    await render();
    await clicar(container.querySelector('[aria-label="Excluir Usuário Teste 1"]'));
    await esperar();
    const enviar = () => botao('Excluir 1 cadastro');
    expect(enviar().disabled).toBe(true);
    await digitar(document.getElementById('motivo-exclusao'), 'contas de exemplo');
    expect(enviar().disabled).toBe(true);
    await digitar(document.getElementById('confirma-exclusao'), 'excluir');
    expect(enviar().disabled).toBe(false);
    await clicar(enviar());
    expect(excluir).toHaveBeenCalledWith({ uids: ['t1'], reason: 'contas de exemplo', confirm: 'excluir' });
  });

  it('⭐ conta impedida fica de fora sozinha', async () => {
    dados.previa = {
      results: [
        { uid: 't1', report: relatorio() },
        { uid: 'r1', report: relatorio({ uid: 'r1', name: 'Ana Souza', canDelete: false, blockers: [{ label: 'Dona da arena "Central"', detail: 'Transfira a arena.' }] }) },
      ],
    };
    await render();
    await clicar(linhaDe('Usuário Teste 1'));
    await clicar(linhaDe('Ana Souza'));
    await clicar(botao('Excluir selecionados', container));
    await esperar();
    expect(document.body.textContent).toContain('Dona da arena "Central"');
    expect(document.body.textContent).toContain('1 conta está impedida');
    await digitar(document.getElementById('motivo-exclusao'), 'contas de exemplo');
    await digitar(document.getElementById('confirma-exclusao'), 'EXCLUIR');
    await clicar(botao('Excluir 1 cadastro'));
    expect(excluir.mock.calls[0][0].uids).toEqual(['t1']);
  });

  it('⭐ outro admin vê a prévia, mas não o botão de executar', async () => {
    auth.user = { uid: 'admin_uid', email: 'outro-admin@gmail.com' };
    dados.previa = { results: [{ uid: 't1', report: relatorio() }] };
    await render();
    await clicar(container.querySelector('[aria-label="Excluir Usuário Teste 1"]'));
    await esperar();
    expect(document.body.textContent).toContain('Só o dono da plataforma executa');
    expect(botao('Excluir 1 cadastro')).toBeUndefined();
    expect(document.getElementById('confirma-exclusao')).toBeNull();
  });

  it('mostra o resultado conta a conta', async () => {
    dados.previa = { results: [{ uid: 't1', report: relatorio() }] };
    dados.resultado = { results: [{ uid: 't1', status: 'deleted', report: relatorio() }] };
    await render();
    await clicar(container.querySelector('[aria-label="Excluir Usuário Teste 1"]'));
    await esperar();
    expect(document.body.textContent).toContain('Resultado da exclusão');
    expect(document.body.textContent).toContain('Excluída');
  });
});

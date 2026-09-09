/**
 * A aba "Acessos e poderes" no cenário que a originou: quatro contas com
 * `platform_admin` em produção, três delas ocultas.
 *
 * O que este arquivo protege, além de a tela abrir:
 *  - o problema aparece em VOZ ALTA (não escondido numa lista);
 *  - o botão de revogar NÃO aparece na própria conta do dono, mesmo a regra do
 *    Firestore permitindo (é a escotilha de emergência) — quem impede o tiro
 *    no pé é a interface;
 *  - nada é revogado sem a confirmação digitada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const DONO = 'fsalamoni@gmail.com';
const auth = { user: { uid: 'dono_uid', email: DONO }, isPlatformAdmin: true };
const dados = { users: [] };
const revogar = vi.fn(async () => ({}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({
  useAllPlatformUsers: () => ({ data: dados.users, isLoading: false }),
  useRevokeAccountPowers: () => ({ mutateAsync: revogar, isPending: false }),
}));

const { default: AdminAccessTab } = await import('./AdminAccessTab.jsx');

let container, root;

beforeEach(() => {
  revogar.mockClear();
  auth.user = { uid: 'dono_uid', email: DONO };
  dados.users = [
    { uid: 'dono_uid', email: DONO, role: 'platform_admin', can_create_pools: true, full_name: 'Dono' },
    { uid: 'sobra1', email: '', role: 'platform_admin', hidden: true, full_name: '' },
    { uid: 'sobra2', email: '', role: 'platform_admin', hidden: true, full_name: '' },
    { uid: 'sobra3', email: '', role: 'platform_admin', hidden: true, full_name: '' },
    { uid: 'atleta', email: 'atleta@x.com', role: 'user' },
  ];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async () => { await act(async () => { root.render(<AdminAccessTab />); }); };
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (t) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(t));

describe('aba Acessos — o achado real', () => {
  it('⭐ mostra os 4 administradores e ACUSA os 3 inesperados', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Administradores (4)');
    expect(txt).toContain('3 conta(s) com poder de administrador sem e-mail de dono');
  });

  it('⭐ diz em voz alta que OCULTAR não removeu o poder', async () => {
    await render();
    expect(container.textContent).toContain('3 conta(s) OCULTA(s) ainda com poder');
    expect(container.textContent).toContain('continua com poder');
  });

  it('⭐ o botão de revogar NÃO aparece na própria conta do dono', async () => {
    await render();
    // A regra do Firestore deixaria o dono escrever o próprio documento; quem
    // impede o clique errado é a interface.
    expect(container.textContent).toContain('Esta é a sua conta.');
  });

  it('oferece revogar exatamente para as três contas inesperadas', async () => {
    await render();
    const botoes = [...container.querySelectorAll('button')]
      .filter((b) => b.textContent.includes('Revogar poder'));
    expect(botoes).toHaveLength(3);
  });

  it('⭐ NÃO revoga sem a confirmação digitada', async () => {
    await render();
    const b = [...container.querySelectorAll('button')]
      .find((x) => x.textContent.includes('Revogar poder'));
    await click(b);
    // O botão da LINHA e o do DIÁLOGO têm o mesmo rótulo: escopar ao diálogo,
    // senão o teste confere o botão errado e passa por acidente.
    const dialogo = document.querySelector('[role="dialog"]');
    expect(dialogo).toBeTruthy();
    const confirmar = [...dialogo.querySelectorAll('button')]
      .find((x) => x.textContent.includes('Revogar poder'));
    expect(confirmar).toBeTruthy();
    expect(confirmar.disabled).toBe(true);
    expect(revogar).not.toHaveBeenCalled();
    // E o aviso sobre a sessão que continua aberta tem de estar à vista.
    expect(dialogo.textContent).toContain('continua valendo até expirar');
  });

  it('⭐ com a confirmação digitada, revoga a conta CERTA', async () => {
    await render();
    const linhas = [...container.querySelectorAll('button')]
      .filter((b) => b.textContent.includes('Revogar poder'));
    await click(linhas[0]);
    const dialogo = document.querySelector('[role="dialog"]');
    const campos = [...dialogo.querySelectorAll('input')];
    const confirmacao = campos[campos.length - 1];
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value',
      ).set;
      setter.call(confirmacao, 'REVOGAR');
      confirmacao.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const confirmar = [...dialogo.querySelectorAll('button')]
      .find((x) => x.textContent.includes('Revogar poder'));
    expect(confirmar.disabled).toBe(false);
    await click(confirmar);
    expect(revogar).toHaveBeenCalledTimes(1);
    // A conta revogada é uma das inesperadas — nunca a do dono.
    const arg = revogar.mock.calls[0][0];
    expect(['sobra1', 'sobra2', 'sobra3']).toContain(arg.uid);
    expect(arg.previousRole).toBe('platform_admin');
  });

  it('quem NÃO é dono não vê ação nenhuma de revogar', async () => {
    auth.user = { uid: 'admin_qualquer', email: 'outro@x.com' };
    await render();
    const botoes = [...container.querySelectorAll('button')]
      .filter((b) => b.textContent.includes('Revogar poder'));
    expect(botoes).toHaveLength(0);
    expect(container.textContent).toContain('Só o dono da plataforma revoga poderes.');
  });

  it('explica o que só se faz no console', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Promover alguém a administrador');
    expect(txt).toContain('revokeRefreshTokens');
    expect(txt).toContain('não apaga a conta');
  });
});

describe('aba Acessos — quando está tudo certo', () => {
  it('⭐ com só o dono como admin, o quadro fica verde', async () => {
    dados.users = [
      { uid: 'dono_uid', email: DONO, role: 'platform_admin', can_create_pools: true },
      { uid: 'atleta', email: 'atleta@x.com', role: 'user' },
    ];
    await render();
    expect(container.textContent).toContain('Só o dono tem poder de administrador');
    expect(container.textContent).not.toContain('inesperado');
  });
});

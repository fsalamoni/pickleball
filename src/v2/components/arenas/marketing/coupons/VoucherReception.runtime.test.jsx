/**
 * A recepção do vale.
 *
 * O que protege:
 *  1. ⭐ conferir o código mostra O QUE o vale dá antes de registrar;
 *  2. ⭐ vale que não vale mais (esgotado, desligado) não deixa registrar — e diz
 *     por quê;
 *  3. desconto na reserva digitado na recepção é explicado, não registrado;
 *  4. código inexistente é dito como resultado da busca;
 *  5. registrar manda quem usou (quando escolhido) e fecha pelo cartão.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { achado: null };
const buscar = vi.fn(async () => estado.achado);
const registrar = vi.fn(async () => ({}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: [{ id: 'u1', platform_name: 'Ana Souza' }], isError: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useFindArenaCoupon: () => ({ mutateAsync: buscar, isPending: false }),
  useRedeemVoucher: () => ({ mutateAsync: registrar, isPending: false }),
}));

const { default: VoucherReception } = await import('./VoucherReception.jsx');

const COCO = { id: 'v1', kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true, used_count: 1, max_uses: 5 };

let container, root;
beforeEach(() => {
  estado.achado = null;
  buscar.mockClear();
  registrar.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(props = {}) {
  await act(async () => { root.render(<VoucherReception arenaId="a1" {...props} />); });
}
async function digitarEConferir(codigo) {
  const input = container.querySelector('#vale-codigo');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, codigo);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}
const botao = (txt) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(txt));

describe('recepção do vale', () => {
  it('⭐ conferir mostra o que o vale dá, e registrar manda o cupom', async () => {
    estado.achado = COCO;
    await render();
    await digitarEConferir('coco');
    expect(buscar).toHaveBeenCalledWith({ arenaId: 'a1', code: 'COCO' });
    expect(container.textContent).toContain('1 água de coco');
    expect(container.textContent).toContain('1 de 5 usos');
    await act(async () => { botao('registrar uso').click(); });
    expect(registrar).toHaveBeenCalledWith({ arenaId: 'a1', couponId: 'v1', userId: null, userName: '' });
  });

  it('⭐ vale esgotado não deixa registrar, e diz por quê', async () => {
    estado.achado = { ...COCO, used_count: 5 };
    await render();
    await digitarEConferir('COCO');
    expect(container.textContent).toMatch(/limite de usos/);
    expect(botao('registrar uso').disabled).toBe(true);
  });

  it('desconto na reserva digitado aqui é explicado, não registrado', async () => {
    estado.achado = { id: 'd1', code: 'DEZ', type: 'percent', value: 10, active: true };
    await render();
    await digitarEConferir('DEZ');
    expect(container.textContent).toMatch(/entra sozinho no preço/);
    expect(botao('registrar uso').disabled).toBe(true);
  });

  it('código inexistente é dito como resultado da busca', async () => {
    await render();
    await digitarEConferir('NADA');
    expect(container.textContent).toMatch(/Nenhum cupom com este código/);
  });

  it('pelo cartão: já vem com o vale, e fecha ao registrar', async () => {
    const onDone = vi.fn();
    await render({ cupom: COCO, onDone });
    expect(container.querySelector('#vale-codigo')).toBeNull();
    expect(container.textContent).toContain('1 água de coco');
    await act(async () => { botao('registrar uso').click(); });
    expect(registrar).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });
});

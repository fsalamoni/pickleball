/**
 * A arte do cupom e o "copiar o código" (Onda CD).
 *
 * O que protege:
 *  1. ⭐ o tíquete mostra o benefício do CUPOM quando a arte não tem título, e
 *     o código de verdade no canhoto;
 *  2. ⭐ o código é o botão de copiar: nome acessível, copia o código e diz
 *     que copiou; se nada funcionar, a mensagem de erro traz o código;
 *  3. ⭐ a imagem enviada vira o tíquete com a descrição como texto
 *     alternativo — e o código continua fora da imagem, copiável;
 *  4. ⭐ no formulário: os cinco modelos da plataforma, e o escolhido vai para
 *     o cupom;
 *  5. ⭐ editar um cupom antigo SEM mexer na arte não grava arte nenhuma;
 *  6. a indicação não tem arte;
 *  7. salvar como meu modelo grava um modelo da ARENA;
 *  8. imagem sem arquivo não deixa salvar — e diz por quê.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const criar = vi.fn(async () => 'novo');
const editar = vi.fn(async () => ({}));
const salvarModelos = vi.fn(async () => []);
const estado = { modelos: [] };

vi.mock('sonner', () => ({ toast }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'gestor' } }) }));
vi.mock('@/core/services/storageService', () => ({ uploadImage: vi.fn() }));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useCreateCoupon: () => ({ mutateAsync: criar, isPending: false }),
  useUpdateCoupon: () => ({ mutateAsync: editar, isPending: false }),
}));
vi.mock('@/modules/arenas/hooks/useCouponArt', () => ({
  useArenaCouponTemplates: () => ({ data: estado.modelos, isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveArenaCouponTemplates: () => ({ mutateAsync: salvarModelos, isPending: false }),
}));

const { default: CouponArt } = await import('./CouponArt.jsx');
const { default: CouponForm } = await import('./CouponForm.jsx');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/cupom.jpg';

let container, root;
const escrever = vi.fn(async () => {});
beforeEach(() => {
  estado.modelos = [];
  [criar, editar, salvarModelos, escrever, toast.success, toast.error].forEach((f) => f.mockClear());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render(el) {
  await act(async () => { root.render(el); });
}
const botao = (texto) => [...document.body.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto || b.getAttribute('aria-label') === texto);
async function clicar(texto) {
  const b = botao(texto);
  if (!b) throw new Error(`botão "${texto}" não encontrado`);
  await act(async () => { b.click(); });
}
async function digitar(id, valor) {
  const el = document.getElementById(id);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function enviar() {
  const form = container.querySelector('form');
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

describe('⭐ o tíquete', () => {
  it('sem título na arte, vale o benefício do cupom; o código está no canhoto', async () => {
    await render(<CouponArt code="VERAO10" benefit="10% de desconto" description="Na primeira reserva" />);
    expect(container.textContent).toContain('10% de desconto');
    expect(container.textContent).toContain('Na primeira reserva');
    expect(container.textContent).toContain('VERAO10');
  });

  it('o título que a arena escreveu vence', async () => {
    await render(<CouponArt code="X" benefit="10% de desconto" art={{ source: 'design', design: { style: 'neon', title: 'Terça amiga' } }} />);
    expect(container.textContent).toContain('Terça amiga');
    expect(container.textContent).not.toContain('10% de desconto');
  });

  it('⭐ copiável: o código é o botão, copia e avisa', async () => {
    await render(<CouponArt code="VERAO10" benefit="10%" copyable copyMessage="Código copiado. Use no pedido." />);
    const b = container.querySelector('button[aria-label="Copiar o código VERAO10"]');
    expect(b).toBeTruthy();
    await act(async () => { b.click(); });
    expect(escrever).toHaveBeenCalledWith('VERAO10');
    expect(toast.success).toHaveBeenCalledWith('Código copiado. Use no pedido.');
    expect(container.textContent).toContain('Copiado');
  });

  it('⭐ copiar falhando de todo jeito: o erro traz o código', async () => {
    escrever.mockRejectedValueOnce(new Error('negado'));
    document.execCommand = vi.fn(() => false);
    await render(<CouponArt code="COCO" benefit="1 água de coco" copyable />);
    await act(async () => { container.querySelector('button[aria-label="Copiar o código COCO"]').click(); });
    expect(toast.error).toHaveBeenCalledWith('Não foi possível copiar. O código é: COCO');
  });

  it('a API moderna recusando, o caminho antigo ainda copia', async () => {
    escrever.mockRejectedValueOnce(new Error('sem foco'));
    document.execCommand = vi.fn(() => true);
    await render(<CouponArt code="COCO" benefit="x" copyable />);
    await act(async () => { container.querySelector('button[aria-label="Copiar o código COCO"]').click(); });
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('sem copiar, o código é só texto (a prévia do editor)', async () => {
    await render(<CouponArt code="VERAO10" benefit="10%" />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('VERAO10');
  });

  it('⭐ imagem enviada: a descrição é o texto alternativo, e o código segue fora dela', async () => {
    await render(<CouponArt code="COCO" copyable art={{ source: 'upload', image_url: URL_OK, alt: 'Água de coco grátis' }} />);
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe(URL_OK);
    expect(img.getAttribute('alt')).toBe('Água de coco grátis');
    expect(container.querySelector('button[aria-label="Copiar o código COCO"]')).toBeTruthy();
  });
});

describe('⭐ a arte no formulário do cupom', () => {
  const novoDesconto = async () => {
    await render(<CouponForm arenaId="a1" arena={{ id: 'a1', name: 'Arena Sol' }} initialKind="discount" onClose={() => {}} />);
    await digitar('cup-code', 'VERAO10');
  };

  it('os cinco modelos da plataforma, com o Clássico escolhido', async () => {
    await novoDesconto();
    const modelos = [...container.querySelectorAll('button[aria-label^="Modelo "]')];
    expect(modelos.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Modelo Clássico', 'Modelo Neon', 'Modelo Quadra', 'Modelo Festa', 'Modelo Sol',
    ]);
    expect(modelos[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('⭐ o modelo escolhido vai para o cupom', async () => {
    await novoDesconto();
    await clicar('Modelo Neon');
    await enviar();
    expect(criar).toHaveBeenCalledTimes(1);
    const { input } = criar.mock.calls[0][0];
    expect(input.art).toMatchObject({ source: 'design', template_id: 'neon' });
    expect(input.art.design.style).toBe('neon');
  });

  it('cupom novo sem mexer na arte: grava `art: null` (o Clássico, explícito)', async () => {
    await novoDesconto();
    await enviar();
    expect(criar.mock.calls[0][0].input.art).toBeNull();
  });

  it('⭐ editar um cupom antigo sem mexer na arte não grava arte nenhuma', async () => {
    const antigo = { id: 'c1', code: 'DEZ', type: 'percent', value: 10, active: true };
    await render(<CouponForm arenaId="a1" cupom={antigo} onClose={() => {}} />);
    await enviar();
    expect(editar).toHaveBeenCalledTimes(1);
    expect('art' in editar.mock.calls[0][0].input).toBe(false);
  });

  it('a indicação não tem arte', async () => {
    await render(<CouponForm arenaId="a1" initialKind="referral" referralOn onClose={() => {}} />);
    expect(container.textContent).not.toContain('Arte do cupom');
  });

  it('salvar como meu modelo grava um modelo da ARENA', async () => {
    await novoDesconto();
    await clicar('Personalizar textos e cores');
    await clicar('Salvar como meu modelo');
    await digitar('cup-art-modelo', 'Vale da recepção');
    await clicar('Salvar');
    expect(salvarModelos).toHaveBeenCalledTimes(1);
    const { arenaId, list } = salvarModelos.mock.calls[0][0];
    expect(arenaId).toBe('a1');
    expect(list[0].id.startsWith('arena:')).toBe(true);
    expect(list[0].name).toBe('Vale da recepção');
  });

  it('os modelos da arena aparecem ao lado dos da plataforma', async () => {
    estado.modelos = [{ id: 'arena:m1', name: 'Meu vale', design: { style: 'sol', bg: '#f97316', fg: '#0b0b0c', accent: '#fff7ed' } }];
    await novoDesconto();
    expect(container.textContent).toContain('Meus modelos');
    expect(botao('Modelo Meu vale')).toBeTruthy();
    expect(container.querySelectorAll('button[aria-label^="Modelo "]')).toHaveLength(6);
  });

  it('enviar a imagem: a especificação vem antes, e sem imagem não salva', async () => {
    await novoDesconto();
    await clicar('Enviar a minha imagem');
    expect(container.textContent).toContain('1200 × 600 px');
    expect(container.textContent).toMatch(/NÃO escreva o código na imagem/);
    await enviar();
    expect(criar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Envie a imagem do cupom.');
  });
});

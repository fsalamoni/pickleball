/**
 * "Promoções" na página da arena.
 *
 * O que protege:
 *  1. ⭐ só aparece o cupom que a arena DIVULGOU — o código que ela entrega a
 *     dedo nunca vaza para a página pública;
 *  2. ⭐ cupom divulgado que não vale mais (desligado, vencido, esgotado) some;
 *  3. sem promoção nenhuma, a seção some — não vira "sem promoções";
 *  4. com o módulo desligado, nem a consulta sai;
 *  5. o botão de copiar tem nome acessível com o código.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const LIGADOS = new Set();
const estado = { cupons: [] };
const consultas = [];

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCoupons: (arenaId) => {
    consultas.push(arenaId);
    return { data: arenaId ? estado.cupons : undefined };
  },
}));

const { default: ArenaPromosSection } = await import('./ArenaPromosSection.jsx');
const { ARENA_MODULE_ID } = await import('@/modules/arenas/domain/modules');

const promo = (over = {}) => ({
  id: 'p1', code: 'TARDE10', type: 'percent', value: 10, active: true, show_public: true, ...over,
});

let container, root;
beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.MARKETING);
  LIGADOS.add(ARENA_MODULE_ID.MARKETING_COUPONS);
  estado.cupons = [];
  consultas.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => { root.render(<ArenaPromosSection arena={{ id: 'a1' }} />); });
}

describe('Promoções na página da arena', () => {
  it('⭐ mostra a promoção divulgada, com a regra e o código', async () => {
    estado.cupons = [promo({ description: 'Quinta à tarde', min_amount: 80 })];
    await render();
    expect(container.textContent).toContain('Promoções');
    expect(container.textContent).toContain('10% de desconto');
    expect(container.textContent).toContain('Quinta à tarde');
    expect(container.textContent).toContain('TARDE10');
    expect(container.textContent.replace(/\u00a0/g, ' ')).toContain('a partir de R$ 80,00');
  });

  it('⭐ o código que a arena NÃO divulgou nunca aparece', async () => {
    estado.cupons = [promo(), promo({ id: 'p2', code: 'AMIGO5', show_public: false })];
    await render();
    expect(container.textContent).toContain('TARDE10');
    expect(container.textContent).not.toContain('AMIGO5');
  });

  it('⭐ divulgado mas desligado, vencido ou esgotado: some', async () => {
    estado.cupons = [
      promo({ id: 'd', code: 'DESLIGADO', active: false }),
      promo({ id: 'v', code: 'VENCIDO', expires_at: Date.now() - 86_400_000 }),
      promo({ id: 'e', code: 'ESGOTADO', max_uses: 3, used_count: 3 }),
    ];
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('sem promoção divulgada, a seção some (não afirma "sem promoções")', async () => {
    estado.cupons = [promo({ show_public: false })];
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('com o módulo de cupons desligado, nem a consulta sai', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MARKETING_COUPONS);
    estado.cupons = [promo()];
    await render();
    expect(container.innerHTML).toBe('');
    expect(consultas.every((id) => id === null)).toBe(true);
  });

  it('o botão de copiar diz qual código copia', async () => {
    estado.cupons = [promo()];
    await render();
    const botao = container.querySelector('button[aria-label="Copiar o código TARDE10"]');
    expect(botao).toBeTruthy();
  });
});

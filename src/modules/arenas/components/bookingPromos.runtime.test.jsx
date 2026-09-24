/**
 * As PROMOÇÕES da arena no pedido de reserva.
 *
 * O que protege:
 *  1. ⭐ a promoção DIVULGADA aparece com um toque para aplicar — a pessoa não
 *     precisa saber o código de cor;
 *  2. ⭐ o código que a arena não divulgou NUNCA aparece;
 *  3. tocar confere o cupom de verdade (contra o banco), com o valor da conta;
 *  4. com o módulo de cupons desligado, nada disso existe.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const LIGADOS = new Set();
const estado = { cupons: [] };
const conferir = vi.fn(async (_arenaId, code) => ({ coupon: { id: 'c1', code, type: 'percent', value: 10 }, discount: 10, error: null }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userProfile: { platform_name: 'Ana' } }) }));
vi.mock('../hooks/useBookings.js', () => ({
  useArenaBookings: () => ({ data: [] }),
  useCreateBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateBookingsForSelection: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../hooks/useArenas.js', () => ({
  useArenaCourts: () => ({ data: [{ id: 'c1', name: 'Quadra 1' }] }),
  useArenaCourtSchedules: () => ({
    data: [{ id: 's1', court_id: null, weekdays: [0, 1, 2, 3, 4, 5, 6], start_time: '08:00', end_time: '23:00', is_active: true }],
  }),
}));
vi.mock('@/modules/athletes/components/AthleteMultiPicker', () => ({ default: () => <div>CONVIDADOS</div> }));
vi.mock('../hooks/useArenaModules.js', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('../hooks/useArenaV3.js', () => ({
  useArenaMember: () => ({ data: null }),
  useArenaWallet: () => ({ data: null }),
  useArenaCoupons: (arenaId) => ({ data: arenaId ? estado.cupons : undefined }),
}));
vi.mock('../services/marketingService.js', () => ({ validateCouponCode: (...a) => conferir(...a) }));

const { default: BookingRequestDialog } = await import('./BookingRequestDialog.jsx');
const { ARENA_MODULE_ID } = await import('../domain/modules.js');

const arena = { id: 'a1', name: 'Arena Teste', base_price: 100 };
const selecao = [{ court_id: 'c1', date: '2026-10-02', start: '19:00', end: '20:00' }];
const promo = (over = {}) => ({ id: 'p1', code: 'TARDE10', type: 'percent', value: 10, active: true, show_public: true, ...over });

let container, root;
beforeEach(() => {
  LIGADOS.clear();
  estado.cupons = [];
  conferir.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async () => {
  await act(async () => {
    root.render(<BookingRequestDialog arena={arena} open onOpenChange={() => {}} selection={selecao} />);
  });
};
const texto = () => document.body.textContent;
const botaoQueContem = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));

describe('promoções no pedido de reserva', () => {
  it('⭐ a promoção divulgada aparece, e um toque confere o cupom com o valor da conta', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MARKETING_COUPONS);
    estado.cupons = [promo()];
    await render();
    expect(texto()).toContain('Promoções:');
    await act(async () => { botaoQueContem('TARDE10 · 10% de desconto').click(); });
    expect(conferir).toHaveBeenCalledWith('a1', 'TARDE10', expect.objectContaining({ userId: 'u1', amount: 100 }));
    expect(texto()).toContain('Cupom aplicado.');
  });

  it('⭐ o código que a arena NÃO divulgou nunca aparece', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MARKETING_COUPONS);
    estado.cupons = [promo({ code: 'SEGREDO', show_public: false })];
    await render();
    expect(texto()).not.toContain('Promoções:');
    expect(texto()).not.toContain('SEGREDO');
  });

  it('com o módulo de cupons desligado, nada disso existe', async () => {
    estado.cupons = [promo()];
    await render();
    expect(texto()).not.toContain('Tem um cupom?');
    expect(texto()).not.toContain('Promoções:');
  });
});

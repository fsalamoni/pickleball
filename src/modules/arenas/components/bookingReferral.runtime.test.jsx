/**
 * "Foi indicado por alguém?" no pedido de reserva (Onda BY).
 *
 * O que protege:
 *  1. ⭐ com programa valendo e na PRIMEIRA reserva, o campo aparece e diz o
 *     que quem chega ganha — e que a arena confere ao confirmar;
 *  2. ⭐ o código digitado VAI no pedido (`referral_code`), normalizado;
 *  3. o próprio código é apontado, e o pedido não segue com ele;
 *  4. quem já reservou aqui (programa "só quem nunca reservou") não vê o campo;
 *  5. sem programa, ou sem saber as reservas da pessoa, o campo não aparece.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const LIGADOS = new Set();
const estado = { cupons: [], minhas: [] };
const conferir = vi.fn(async (_arenaId, code) => ({ coupon: { id: 'c1', code, type: 'percent', value: 10 }, discount: 10, error: null }));
const criarSelecao = vi.fn(async () => ({}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'anaUid99' }, userProfile: { platform_name: 'Ana' } }) }));
vi.mock('../hooks/useBookings.js', () => ({
  useArenaBookings: () => ({ data: [] }),
  useMyBookings: () => ({ data: estado.minhas }),
  useCreateBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateBookingsForSelection: () => ({ mutateAsync: criarSelecao, isPending: false }),
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
  estado.minhas = [];
  conferir.mockClear();
  criarSelecao.mockClear();
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


const PROGRAMA = {
  id: 'p1', kind: 'referral', code: 'INDICACAO', active: true,
  referrer_reward: 20, referred_reward_kind: 'percent', referred_reward_value: 10, first_booking_only: true,
};
const ligarIndicacoes = () => {
  LIGADOS.add(ARENA_MODULE_ID.MARKETING);
  LIGADOS.add(ARENA_MODULE_ID.MARKETING_REFERRAL);
};
async function digitar(valor) {
  const input = document.querySelector('#indicacao-reserva');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('indicação no pedido de reserva', () => {
  it('⭐ primeira reserva com programa: o campo aparece e diz o que ganha', async () => {
    ligarIndicacoes();
    estado.cupons = [PROGRAMA];
    await render();
    expect(texto()).toContain('Foi indicado por alguém?');
    expect(texto()).toContain('Quem chega por indicação ganha 10% na primeira reserva.');
    expect(texto()).toContain('A arena confere o código quando confirmar a sua reserva.');
  });

  it('⭐ o código digitado vai no pedido, normalizado', async () => {
    ligarIndicacoes();
    estado.cupons = [PROGRAMA];
    await render();
    await digitar('ana1234567');
    await act(async () => { botaoQueContem('Solicitar reserva').click(); });
    expect(criarSelecao.mock.calls[0][0].input.referral_code).toBe('ANA1234567');
  });

  it('o próprio código é apontado, e o pedido não segue com ele', async () => {
    ligarIndicacoes();
    estado.cupons = [PROGRAMA];
    await render();
    await digitar('ANAUID7XQ2');
    expect(texto()).toContain('Esse é o seu próprio código');
    expect(botaoQueContem('Solicitar reserva').disabled).toBe(true);
    await digitar('AB');
    expect(texto()).toMatch(/Confira o código/);
    expect(botaoQueContem('Solicitar reserva').disabled).toBe(true);
  });

  it('quem já reservou aqui não vê o campo (programa só para quem nunca reservou)', async () => {
    ligarIndicacoes();
    estado.cupons = [PROGRAMA];
    estado.minhas = [{ arena_id: 'a1', status: 'completed' }];
    await render();
    expect(texto()).not.toContain('Foi indicado por alguém?');
  });

  it('sem programa, ou sem saber as reservas da pessoa, o campo não aparece', async () => {
    ligarIndicacoes();
    await render();
    expect(texto()).not.toContain('Foi indicado por alguém?');
    estado.cupons = [PROGRAMA];
    estado.minhas = undefined;
    await render();
    expect(texto()).not.toContain('Foi indicado por alguém?');
  });

  it('sem o módulo de indicações, nada', async () => {
    estado.cupons = [PROGRAMA];
    await render();
    expect(texto()).not.toContain('Foi indicado por alguém?');
  });
});

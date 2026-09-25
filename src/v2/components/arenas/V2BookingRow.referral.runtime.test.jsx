/**
 * A indicação na linha da reserva (Onda BY).
 *
 * O que protege:
 *  1. pendente: o atleta lê que a arena confere ao confirmar; a arena lê que
 *     chegou por indicação;
 *  2. ⭐ aplicada: o que foi dado (e, para a arena, o que quem indicou ganhou);
 *  3. ⭐ recusada: o MOTIVO;
 *  4. sem indicação, nada muda na linha.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useUpdateBookingStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProposeBookingPrice: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetBookingPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useArena: () => ({ data: null }) }));
vi.mock('@/modules/arenas/components/BookingEditDialog', () => ({ default: () => null }));
vi.mock('@/modules/tournament/components/AddToCalendarButton', () => ({ default: () => null }));

const { default: V2BookingRow } = await import('./V2BookingRow.jsx');

let container, root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const reserva = (referral) => ({
  id: 'b1', arena_id: 'a1', arena_name: 'Arena Sol', athlete_name: 'Bia', status: 'requested',
  slots: [{ date: '2026-10-02', start: '19:00', end: '20:00' }], proposed_price: 100, referral,
});
const render = async (booking, perspective = 'athlete') => {
  await act(async () => { root.render(<V2BookingRow booking={booking} perspective={perspective} />); });
};

describe('indicação na linha da reserva', () => {
  it('pendente: cada lado lê o seu', async () => {
    await render(reserva({ code: 'ana1234567', status: 'pending' }));
    expect(container.textContent).toContain('Código de indicação ANA1234567 — a arena confere ao confirmar a reserva');
    await render(reserva({ code: 'ana1234567', status: 'pending' }), 'arena');
    expect(container.textContent).toContain('Chegou por indicação (ANA1234567)');
  });

  it('⭐ aplicada: o que foi dado', async () => {
    const ref = { code: 'ANA1234567', status: 'aplicada', discount_value: 10, referrer_reward: 20 };
    await render(reserva(ref));
    expect(container.textContent).toContain('Indicação registrada (ANA1234567) · R$ 10,00 de desconto');
    expect(container.textContent).not.toContain('para quem indicou');
    await render(reserva(ref), 'arena');
    expect(container.textContent).toContain('R$ 20,00 para quem indicou');
  });

  it('⭐ recusada: o motivo', async () => {
    await render(reserva({ code: 'ANA1234567', status: 'recusada', reason: 'Esta pessoa já foi creditada com este código.' }));
    expect(container.textContent).toContain('Indicação não aplicada (ANA1234567): Esta pessoa já foi creditada com este código.');
  });

  it('sem indicação, nada muda', async () => {
    await render(reserva(undefined));
    expect(container.textContent).not.toMatch(/indicação/i);
  });
});

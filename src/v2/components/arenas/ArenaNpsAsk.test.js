/**
 * Quando a plataforma pode perguntar "como foi?" — e a partir de quê.
 *
 * A regra de QUANDO já é testada em `marketing.test.js` (`shouldAskNps`).
 * O que este arquivo trava é a outra metade: de onde sai a data da última
 * visita. Errar isso é perguntar a quem nunca veio — ou nunca perguntar.
 */
import { describe, it, expect } from 'vitest';

import { lastVisitAt } from './ArenaNpsAsk.jsx';

const HOJE = '2026-09-13';

describe('a data da minha última visita a esta arena', () => {
  it('sem reserva nenhuma, não há visita', () => {
    expect(lastVisitAt([], 'a1', HOJE)).toBeNull();
  });

  it('⭐ reserva de OUTRA arena não conta', () => {
    const reservas = [
      { arena_id: 'a2', status: 'completed', slots: [{ date: '2026-09-01' }] },
    ];
    expect(lastVisitAt(reservas, 'a1', HOJE)).toBeNull();
  });

  it('⭐ pedido recusado ou pendente não é visita', () => {
    const reservas = [
      { arena_id: 'a1', status: 'requested', slots: [{ date: '2026-09-01' }] },
      { arena_id: 'a1', status: 'rejected', slots: [{ date: '2026-09-02' }] },
      { arena_id: 'a1', status: 'cancelled', slots: [{ date: '2026-09-03' }] },
    ];
    expect(lastVisitAt(reservas, 'a1', HOJE)).toBeNull();
  });

  it('pega a MAIS RECENTE entre várias', () => {
    const reservas = [
      { arena_id: 'a1', status: 'completed', slots: [{ date: '2026-08-01' }] },
      { arena_id: 'a1', status: 'confirmed', slots: [{ date: '2026-09-05' }] },
      { arena_id: 'a1', status: 'completed', slots: [{ date: '2026-07-20' }] },
    ];
    expect(lastVisitAt(reservas, 'a1', HOJE)).toBe('2026-09-05');
  });

  it('⭐ reserva FUTURA não é visita — o jogo ainda não aconteceu', () => {
    const reservas = [
      { arena_id: 'a1', status: 'confirmed', slots: [{ date: '2026-09-30' }] },
      { arena_id: 'a1', status: 'completed', slots: [{ date: '2026-09-02' }] },
    ];
    expect(lastVisitAt(reservas, 'a1', HOJE)).toBe('2026-09-02');
  });

  it('uma reserva com vários horários conta pelo último dia dela', () => {
    const reservas = [
      { arena_id: 'a1', status: 'confirmed', slots: [{ date: '2026-09-01' }, { date: '2026-09-08' }] },
    ];
    expect(lastVisitAt(reservas, 'a1', HOJE)).toBe('2026-09-08');
  });

  it('reserva sem slots não derruba a conta', () => {
    const reservas = [
      { arena_id: 'a1', status: 'completed' },
      { arena_id: 'a1', status: 'completed', slots: [{ date: '2026-09-04' }] },
    ];
    expect(lastVisitAt(reservas, 'a1', HOJE)).toBe('2026-09-04');
  });
});

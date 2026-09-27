import { describe, it, expect } from 'vitest';
import {
  openGamesForMe, pickHomeArena, upcomingFreeTimes, arenaFreeTimesForDays,
} from './homePlay.js';

const HOJE = '2026-09-26';

describe('openGamesForMe', () => {
  const g = (id, over = {}) => ({ id, status: 'open', created_by: 'x', ...over });

  it('só convites abertos que ainda valem, sem os meus, perto de mim primeiro', () => {
    const r = openGamesForMe([
      g('longe', { date: '2026-09-27', city: 'Curitiba', state: 'PR' }),
      g('perto', { date: '2026-09-29', city: 'Porto Alegre', state: 'RS' }),
      g('passado', { date: '2026-09-20', city: 'Porto Alegre', state: 'RS' }),
      g('fechado', { status: 'closed', date: '2026-09-28' }),
      g('meu', { created_by: 'eu', date: '2026-09-27' }),
    ], { hoje: HOJE, perfil: { city: 'Porto Alegre', state: 'RS' }, uid: 'eu' });
    expect(r.map((x) => x.game.id)).toEqual(['perto', 'longe']);
  });

  it('respeita o limite', () => {
    const lista = Array.from({ length: 10 }, (_, i) => g(`g${i}`, { date: '2026-09-28' }));
    expect(openGamesForMe(lista, { hoje: HOJE, limite: 3 })).toHaveLength(3);
  });
});

describe('pickHomeArena', () => {
  it('a da reserva confirmada mais recente vence a favorita', () => {
    const r = pickHomeArena({
      reservas: [
        { arena_id: 'a1', arena_name: 'Velha', status: 'completed', slots: [{ date: '2026-08-01' }] },
        { arena_id: 'a2', arena_name: 'Recente', status: 'confirmed', slots: [{ date: '2026-09-20' }] },
        { arena_id: 'a3', arena_name: 'Recusada', status: 'declined', slots: [{ date: '2026-09-25' }] },
      ],
      favoritas: [{ arena_id: 'f1', arena_name: 'Fav' }],
    });
    expect(r).toEqual({ id: 'a2', name: 'Recente', motivo: 'reserva' });
  });

  it('sem reserva, a favorita; sem nada, null', () => {
    expect(pickHomeArena({ favoritas: [{ arena_id: 'f1', arena_name: 'Fav' }] })).toMatchObject({ id: 'f1', motivo: 'favorita' });
    expect(pickHomeArena({ favoritas: ['f2'] })).toEqual({ id: 'f2', name: null, motivo: 'favorita' });
    expect(pickHomeArena({})).toBeNull();
  });
});

describe('upcomingFreeTimes', () => {
  it('hoje só o que ainda não começou; depois os dias seguintes, até o limite', () => {
    const agora = new Date(2026, 8, 26, 18, 30).getTime();
    const r = upcomingFreeTimes([
      { date: HOJE, times: [{ time: '18:00', freeCourts: 1 }, { time: '19:00', freeCourts: 2 }] },
      { date: '2026-09-27', times: [{ time: '08:00', freeCourts: 3 }, { time: '09:00', freeCourts: 3 }] },
    ], { agora, limite: 2 });
    expect(r).toEqual([
      { date: HOJE, time: '19:00', freeCourts: 2 },
      { date: '2026-09-27', time: '08:00', freeCourts: 3 },
    ]);
  });
});

describe('arenaFreeTimesForDays — a mesma conta do calendário da arena', () => {
  // 2026-09-26 é sábado (6).
  const schedules = [{ weekdays: [6, 0], start_time: '18:00', end_time: '21:00', is_active: true }];
  const courts = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3', is_active: false }];

  it('reserva ativa ocupa; recusada não; quadra inativa não conta', () => {
    const bookings = [
      { status: 'confirmed', court_id: 'q1', slots: [{ date: HOJE, start: '18:00', end: '19:00' }] },
      { status: 'confirmed', court_id: 'q2', slots: [{ date: HOJE, start: '18:00', end: '19:00' }] },
      { status: 'declined', court_id: 'q1', slots: [{ date: HOJE, start: '19:00', end: '20:00' }] },
    ];
    const [dia] = arenaFreeTimesForDays([HOJE], { courts, schedules, bookings });
    expect(dia.times).toEqual([
      { time: '19:00', freeCourts: 2 },
      { time: '20:00', freeCourts: 2 },
    ]);
  });

  it('⭐ o dia de jogo da arena fecha a quadra mesmo sem cópia gravada (derivado)', () => {
    const diasDeJogo = [{
      id: 'gd', arena_id: 'a', date: HOJE, status: 'active',
      arena_slots: [{ court_id: 'q1', start_time: '20:00', end_time: '21:00' }, { court_id: 'q2', start_time: '20:00', end_time: '21:00' }],
    }];
    const [dia] = arenaFreeTimesForDays([HOJE], { courts, schedules, diasDeJogo });
    expect(dia.times.map((t) => t.time)).not.toContain('20:00');
  });
});

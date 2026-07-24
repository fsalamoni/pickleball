import { describe, it, expect } from 'vitest';
import { buildArenaClients, arenaCrmSummary } from './arena_crm.js';

const bookings = [
  { athlete_id: 'a', athlete_name: 'Ana', status: 'confirmed', agreed_price: 100, slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] },
  { athlete_id: 'a', athlete_name: 'Ana', status: 'completed', agreed_price: 120, slots: [{ date: '2026-08-10', start: '18:00', end: '19:00' }], no_show: true },
  { athlete_id: null, athlete_name: 'João avulso', status: 'confirmed', agreed_price: 80, slots: [{ date: '2026-08-05', start: '10:00', end: '11:00' }] },
  { athlete_id: 'b', athlete_name: 'Bia', status: 'cancelled', agreed_price: 100, slots: [{ date: '2026-08-02', start: '09:00', end: '10:00' }] },
];

describe('buildArenaClients', () => {
  it('agrupa por atleta e por nome (avulso)', () => {
    const clients = buildArenaClients(bookings);
    const ana = clients.find((c) => c.athlete_id === 'a');
    expect(ana.bookings).toBe(2);
    expect(ana.confirmed).toBe(2);
    expect(ana.total_value).toBe(220);
    expect(ana.no_shows).toBe(1);
    expect(ana.last_date).toBe('2026-08-10');
    expect(clients.find((c) => c.name === 'João avulso')).toBeTruthy();
  });

  it('não soma valor de reservas canceladas', () => {
    const bia = buildArenaClients(bookings).find((c) => c.athlete_id === 'b');
    expect(bia.cancelled).toBe(1);
    expect(bia.total_value).toBe(0);
  });

  it('ordena por nº de reservas desc', () => {
    const clients = buildArenaClients(bookings);
    expect(clients[0].athlete_id).toBe('a'); // 2 reservas
  });

  it('ignora reservas sem id e sem nome', () => {
    expect(buildArenaClients([{ status: 'confirmed' }])).toHaveLength(0);
  });
});

describe('arenaCrmSummary', () => {
  it('soma clientes, reservas, receita e no-shows', () => {
    const s = arenaCrmSummary(buildArenaClients(bookings));
    expect(s.clients).toBe(3);
    expect(s.bookings).toBe(4);
    expect(s.revenue).toBe(300); // 220 + 80 (canceladas não contam)
    expect(s.no_shows).toBe(1);
  });
});

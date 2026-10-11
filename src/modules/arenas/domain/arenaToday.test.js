import { describe, it, expect } from 'vitest';
import { arenaTodayAgenda, parseFavoriteTabs, toggleFavoriteTab, MAX_FAVORITAS } from './arenaToday.js';

const hoje = '2026-10-11';
const r = (over) => ({ id: 'b', status: 'confirmed', athlete_name: 'Ana', court_id: 'q1', slots: [{ date: hoje, start: '19:00', end: '20:00' }], ...over });

describe('arenaTodayAgenda', () => {
  it('fonte que não chegou é undefined, nunca lista vazia', () => {
    expect(arenaTodayAgenda(undefined, { hoje })).toBeUndefined();
  });
  it('só reservas confirmadas/concluídas com horário HOJE, em ordem, com o nome da quadra', () => {
    const out = arenaTodayAgenda([
      r({ id: 'tarde', slots: [{ date: hoje, start: '21:00', end: '22:00' }] }),
      r({ id: 'pedido', status: 'requested' }),
      r({ id: 'amanha', slots: [{ date: '2026-10-12', start: '08:00', end: '09:00' }] }),
      r({ id: 'cedo', court_id: 'q2', checked_in_at: 1 }),
    ], { hoje, courts: [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }] });
    expect(out.map((l) => l.id)).toEqual(['cedo_19:00', 'tarde_21:00']);
    expect(out[0]).toMatchObject({ courtName: 'Quadra 2', athleteName: 'Ana', checkedIn: true });
    expect(out[1].courtName).toBe('Quadra 1');
  });
  it('reserva recorrente conta só o horário de hoje', () => {
    const out = arenaTodayAgenda([r({ slots: [{ date: '2026-10-04', start: '19:00', end: '20:00' }, { date: hoje, start: '19:00', end: '20:00' }] })], { hoje });
    expect(out).toHaveLength(1);
  });
});

describe('favoritas', () => {
  it('lê só abas válidas, sem repetir, até o máximo', () => {
    expect(parseFavoriteTabs('["a","b","a","x"]', ['a', 'b'])).toEqual(['a', 'b']);
    expect(parseFavoriteTabs('lixo', ['a'])).toEqual([]);
    expect(parseFavoriteTabs(JSON.stringify(['1', '2', '3', '4', '5', '6']), ['1', '2', '3', '4', '5', '6'])).toHaveLength(MAX_FAVORITAS);
  });
  it('liga, desliga e recusa a sexta', () => {
    expect(toggleFavoriteTab([], 'a')).toEqual(['a']);
    expect(toggleFavoriteTab(['a'], 'a')).toEqual([]);
    const cheia = ['1', '2', '3', '4', '5'];
    expect(toggleFavoriteTab(cheia, '6')).toBe(cheia);
  });
});

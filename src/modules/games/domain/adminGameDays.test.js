import { describe, it, expect } from 'vitest';
import {
  adminGameDayRows, adminGameDayOrigin, adminGameDayStart, adminGameDayMissingTime,
  ADMIN_GAME_DAY_FILTER, ADMIN_GAME_DAY_ORIGIN,
} from './adminGameDays.js';

const HOJE = '2026-11-03';
const dias = [
  { id: 'a', title: 'Sábado da Vila', creator_name: 'Ana', date: '2026-11-07', time: '09:00', created_at_ms: 3 },
  { id: 'b', title: 'Arena noite', arena_id: 'ar1', date: '2026-11-04', arena_slots: [{ start_time: '20:00' }, { start_time: '18:30' }], created_at_ms: 2 },
  { id: 'c', title: 'Clube', club_id: 'cl1', date: '2026-10-01', time: '19:00', created_at_ms: 1 },
  { id: 'd', title: 'Antigo sem hora', date: '2026-09-01', created_at_ms: 0 },
  { id: 'e', title: 'Arquivado', date: '2026-11-10', time: '10:00', status: 'archived' },
];

describe('adminGameDays', () => {
  it('origem e horário de início (o da arena vem da primeira quadra)', () => {
    expect(adminGameDayOrigin(dias[0])).toBe(ADMIN_GAME_DAY_ORIGIN.ATHLETE);
    expect(adminGameDayOrigin(dias[1])).toBe(ADMIN_GAME_DAY_ORIGIN.ARENA);
    expect(adminGameDayOrigin(dias[2])).toBe(ADMIN_GAME_DAY_ORIGIN.CLUB);
    expect(adminGameDayStart(dias[1])).toBe('18:30');
    expect(adminGameDayMissingTime(dias[3])).toBe(true);
    expect(adminGameDayMissingTime({ time: '10:00' })).toBe(true);
    expect(adminGameDayMissingTime(dias[0])).toBe(false);
  });

  it('próximos do mais cedo ao mais tarde, sem arquivados', () => {
    const r = adminGameDayRows(dias, { filtro: ADMIN_GAME_DAY_FILTER.UPCOMING, hoje: HOJE });
    expect(r.map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('todos: mais recente primeiro; arquivado só no filtro dele', () => {
    expect(adminGameDayRows(dias, { hoje: HOJE }).map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(adminGameDayRows(dias, { filtro: ADMIN_GAME_DAY_FILTER.ARCHIVED, hoje: HOJE }).map((g) => g.id)).toEqual(['e']);
  });

  it('sem horário, passados, origem e busca sem acento', () => {
    expect(adminGameDayRows(dias, { filtro: ADMIN_GAME_DAY_FILTER.MISSING_TIME, hoje: HOJE }).map((g) => g.id)).toEqual(['d']);
    expect(adminGameDayRows(dias, { filtro: ADMIN_GAME_DAY_FILTER.PAST, hoje: HOJE }).map((g) => g.id)).toEqual(['c', 'd']);
    expect(adminGameDayRows(dias, { origem: 'arena', hoje: HOJE }).map((g) => g.id)).toEqual(['b']);
    expect(adminGameDayRows(dias, { busca: 'sabado', hoje: HOJE }).map((g) => g.id)).toEqual(['a']);
    expect(adminGameDayRows(dias, { busca: 'ana', hoje: HOJE }).map((g) => g.id)).toEqual(['a']);
  });
});

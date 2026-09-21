import { describe, it, expect } from 'vitest';
import {
  isClubGameDay, isModularEventDate, splitEventDateTime, shortDateBR,
  clubGameDayTitle, normalizeClubGameDayInput, CLUB_GAME_DAY_TITLE_MAX,
  canUpgradeLegacyDate,
} from './clubGameDay.js';
import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';
import { GAME_DAY_MANAGE_MODE } from './gameDayRoles.js';

describe('isClubGameDay', () => {
  it('só é do clube quando há club_id preenchido', () => {
    expect(isClubGameDay({ club_id: 'c1' })).toBe(true);
    expect(isClubGameDay({ club_id: '' })).toBe(false);
    expect(isClubGameDay({})).toBe(false);
    expect(isClubGameDay(null)).toBe(false);
  });

  it('não confunde com o dia de jogo da arena', () => {
    expect(isClubGameDay({ arena_id: 'a1' })).toBe(false);
  });
});

describe('isModularEventDate', () => {
  it('a data do legado não tem game_day_id', () => {
    expect(isModularEventDate({ id: 'd1' })).toBe(false);
    expect(isModularEventDate({ id: 'd1', game_day_id: '' })).toBe(false);
    expect(isModularEventDate({ id: 'd1', game_day_id: null })).toBe(false);
  });

  it('a data nova aponta para o dia de jogo', () => {
    expect(isModularEventDate({ id: 'd1', game_day_id: 'gd1' })).toBe(true);
  });
});

describe('splitEventDateTime', () => {
  it('quebra o datetime-local sem passar por fuso', () => {
    expect(splitEventDateTime('2026-09-25T19:00')).toEqual({ date: '2026-09-25', time: '19:00' });
  });

  it('aceita espaço no lugar do T e segundos sobrando', () => {
    expect(splitEventDateTime('2026-09-25 19:00:00')).toEqual({ date: '2026-09-25', time: '19:00' });
  });

  it('data sem hora', () => {
    expect(splitEventDateTime('2026-09-25')).toEqual({ date: '2026-09-25', time: null });
  });

  it('vazio ou lixo não vira data', () => {
    expect(splitEventDateTime('')).toEqual({ date: null, time: null });
    expect(splitEventDateTime(null)).toEqual({ date: null, time: null });
    expect(splitEventDateTime('amanhã')).toEqual({ date: null, time: null });
  });

  it('meia-noite continua sendo do mesmo dia (o fuso mudaria isto)', () => {
    expect(splitEventDateTime('2026-09-25T00:30')).toEqual({ date: '2026-09-25', time: '00:30' });
  });
});

describe('shortDateBR', () => {
  it('formata dia/mês', () => {
    expect(shortDateBR('2026-09-25')).toBe('25/09');
  });
  it('vazio quando não é data', () => {
    expect(shortDateBR('25/09/2026')).toBe('');
    expect(shortDateBR(null)).toBe('');
  });
});

describe('clubGameDayTitle', () => {
  it('junta o nome do evento com a data — um evento semanal gera dezenas', () => {
    expect(clubGameDayTitle('Rachão de quinta', '2026-09-25T19:00')).toBe('Rachão de quinta — 25/09');
  });

  it('sem data, fica só o nome', () => {
    expect(clubGameDayTitle('Rachão de quinta', '')).toBe('Rachão de quinta');
  });

  it('sem nome, tem um padrão', () => {
    expect(clubGameDayTitle('', '2026-09-25T19:00')).toBe('Dia de jogo — 25/09');
  });

  it('respeita o teto do título', () => {
    const longo = 'x'.repeat(200);
    expect(clubGameDayTitle(longo, '2026-09-25T19:00').length).toBe(CLUB_GAME_DAY_TITLE_MAX);
  });
});

describe('normalizeClubGameDayInput', () => {
  const event = { title: 'Rachão de quinta' };

  it('monta o valor a partir da data do evento', () => {
    const { valid, value } = normalizeClubGameDayInput(
      { date_time: '2026-09-25T19:00', location: 'Quadra 2', note: 'levar bola', format: GAME_DAY_FORMAT.PLAY, play_courts: 3 },
      { event },
    );
    expect(valid).toBe(true);
    expect(value.title).toBe('Rachão de quinta — 25/09');
    expect(value.date).toBe('2026-09-25');
    expect(value.time).toBe('19:00');
    expect(value.location).toBe('Quadra 2');
    expect(value.notes).toBe('levar bola');
    expect(value.format).toBe(GAME_DAY_FORMAT.PLAY);
  });

  it('formato desconhecido cai no americano', () => {
    const { value } = normalizeClubGameDayInput({ date_time: '2026-09-25T19:00', format: 'xadrez' }, { event });
    expect(value.format).toBe(GAME_DAY_FORMAT.AMERICANO);
  });

  it('o clube nasce colaborativo — era o que o evento legado já permitia', () => {
    const { value } = normalizeClubGameDayInput({ date_time: '2026-09-25T19:00' }, { event });
    expect(value.manage_mode).toBe(GAME_DAY_MANAGE_MODE.PARTICIPANTS);
  });

  it('mas dá para fechar a gestão explicitamente', () => {
    const { value } = normalizeClubGameDayInput(
      { date_time: '2026-09-25T19:00', manage_mode: GAME_DAY_MANAGE_MODE.OWNER_ONLY },
      { event },
    );
    expect(value.manage_mode).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
  });

  it('sem data não é válido', () => {
    const { valid, errors } = normalizeClubGameDayInput({ date_time: '' }, { event });
    expect(valid).toBe(false);
    expect(errors.date_time).toBeTruthy();
  });

  it('campos vazios viram null, não string vazia', () => {
    const { value } = normalizeClubGameDayInput({ date_time: '2026-09-25T19:00', location: '   ', note: '' }, { event });
    expect(value.location).toBeNull();
    expect(value.notes).toBeNull();
  });
});

/* ------------------------------------------------------------------------- *
 * ⭐ CONVERTER UMA DATA LEGADA — só quando não há NADA para mover.
 * ------------------------------------------------------------------------- */
describe('canUpgradeLegacyDate', () => {
  it('data vazia pode ser convertida: não existe documento para esconder', () => {
    const r = canUpgradeLegacyDate({ dateId: 'd1', participants: [], games: [] });
    expect(r.ok).toBe(true);
    expect(r.motivo).toBeNull();
  });

  it('⭐ com PARTIDA na data, recusa — e diz por quê', () => {
    const r = canUpgradeLegacyDate({
      dateId: 'd1', participants: [], games: [{ id: 'g1', date_id: 'd1' }],
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/partidas/i);
    expect(r.jogos).toBe(1);
  });

  it('⭐ com ATLETA inserido na data, recusa', () => {
    const r = canUpgradeLegacyDate({
      dateId: 'd1', participants: [{ id: 'p1', date_id: 'd1' }], games: [],
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/atletas/i);
    expect(r.participantes).toBe(1);
  });

  it('⭐ o recorte é por DATA: outra data do mesmo evento não reprova esta', () => {
    // Um evento semanal tem dezenas de datas no mesmo `club_events/{id}`.
    const r = canUpgradeLegacyDate({
      dateId: 'd2',
      participants: [{ id: 'p1', date_id: 'd1' }],
      games: [{ id: 'g1', date_id: 'd1' }],
    });
    expect(r.ok).toBe(true);
  });

  it('a data ÚNICA (sem date_id) conta os documentos sem date_id', () => {
    const r = canUpgradeLegacyDate({
      dateId: null, participants: [{ id: 'p1' }], games: [],
    });
    expect(r.ok).toBe(false);
  });

  it('lista ausente é tratada como vazia, nunca como erro', () => {
    expect(canUpgradeLegacyDate({ dateId: 'd1' }).ok).toBe(true);
    expect(canUpgradeLegacyDate().ok).toBe(true);
  });
});

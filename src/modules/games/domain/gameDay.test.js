import { describe, it, expect } from 'vitest';
import {
  normalizeGameDayInput, computeMemberUids, canViewGameDay, isGameDayOwner,
  isPublicGameDay, gameDayWhenText, GAME_DAY_VISIBILITY,
} from './gameDay.js';
import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';

describe('normalizeGameDayInput', () => {
  it('exige um título', () => {
    const { valid, errors } = normalizeGameDayInput({ title: '   ' });
    expect(valid).toBe(false);
    expect(errors.title).toBeTruthy();
  });

  it('normaliza campos e usa privado como padrão', () => {
    const { valid, value } = normalizeGameDayInput({ title: '  Sábado  ', state: 'sp' });
    expect(valid).toBe(true);
    expect(value.title).toBe('Sábado');
    expect(value.visibility).toBe(GAME_DAY_VISIBILITY.PRIVATE);
    expect(value.state).toBe('SP');
    expect(value.format).toBe(GAME_DAY_FORMAT.AMERICANO);
  });

  it('aceita visibilidade pública e formato válido', () => {
    const { value } = normalizeGameDayInput({
      title: 'X', visibility: 'public', format: GAME_DAY_FORMAT.MEXICANO,
    });
    expect(value.visibility).toBe(GAME_DAY_VISIBILITY.PUBLIC);
    expect(value.format).toBe(GAME_DAY_FORMAT.MEXICANO);
  });

  it('descarta formato inválido para americano', () => {
    const { value } = normalizeGameDayInput({ title: 'X', format: 'invalido' });
    expect(value.format).toBe(GAME_DAY_FORMAT.AMERICANO);
  });
});

describe('computeMemberUids', () => {
  it('inclui criador, convidados e participantes com user_id, deduplicando', () => {
    const uids = computeMemberUids({
      createdBy: 'owner',
      invitedUids: ['a', 'b', 'owner'],
      participants: [{ user_id: 'b' }, { user_id: 'c' }, { name: 'Guest' }],
    });
    expect(uids.sort()).toEqual(['a', 'b', 'c', 'owner']);
  });

  it('funciona só com o criador', () => {
    expect(computeMemberUids({ createdBy: 'x' })).toEqual(['x']);
  });
});

describe('visibilidade e acesso', () => {
  const gd = { created_by: 'owner', member_uids: ['owner', 'a'], visibility: 'public' };

  it('isGameDayOwner', () => {
    expect(isGameDayOwner(gd, 'owner')).toBe(true);
    expect(isGameDayOwner(gd, 'a')).toBe(false);
  });

  it('isPublicGameDay trata ausência como privado', () => {
    expect(isPublicGameDay(gd)).toBe(true);
    expect(isPublicGameDay({})).toBe(false);
  });

  it('canViewGameDay: criador e membros veem; estranhos não', () => {
    expect(canViewGameDay(gd, 'owner')).toBe(true);
    expect(canViewGameDay(gd, 'a')).toBe(true);
    expect(canViewGameDay(gd, 'z')).toBe(false);
  });
});

describe('gameDayWhenText', () => {
  it('monta data/hora/local', () => {
    const t = gameDayWhenText({ date: '2026-08-01', time: '19:00', location: 'Arena X', city: 'São Paulo', state: 'SP' });
    expect(t).toContain('2026-08-01');
    expect(t).toContain('19:00');
    expect(t).toContain('Arena X');
    expect(t).toContain('São Paulo/SP');
  });
});

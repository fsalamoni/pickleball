import { describe, it, expect } from 'vitest';
import {
  missionDateKey, missionDaySeed, PLATFORM_TIME_ZONE,
  platformWeekKey, scopeKey, missionDocId, dayStartMs,
  scopeWindowBR, msUntilReset, formatTimeLeft, addDaysToDateKey,
} from './missionDay.js';

describe('missionDateKey', () => {
  it('usa o dia de Brasília, não o de UTC', () => {
    // 2026-09-03T23:30Z = 2026-09-03 20:30 em São Paulo → ainda é dia 3
    expect(missionDateKey(new Date('2026-09-03T23:30:00Z'))).toBe('2026-09-03');
  });

  it('não vira o dia às 21h locais (o bug do fuso)', () => {
    // 2026-09-04T00:30Z = 2026-09-03 21:30 em São Paulo → AINDA é dia 3.
    // Com toISOString() isto retornava '2026-09-04' e o jogador perdia as
    // missões da noite três horas antes da meia-noite.
    expect(missionDateKey(new Date('2026-09-04T00:30:00Z'))).toBe('2026-09-03');
  });

  it('vira o dia na meia-noite de Brasília', () => {
    expect(missionDateKey(new Date('2026-09-04T02:59:00Z'))).toBe('2026-09-03');
    expect(missionDateKey(new Date('2026-09-04T03:01:00Z'))).toBe('2026-09-04');
  });

  it('formata sempre como YYYY-MM-DD', () => {
    expect(missionDateKey(new Date('2026-01-05T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(missionDateKey(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05');
  });

  it('cai para "agora" se receber data inválida', () => {
    expect(missionDateKey(new Date('nada disso'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('aceita outro fuso explicitamente', () => {
    expect(missionDateKey(new Date('2026-09-04T00:30:00Z'), 'UTC')).toBe('2026-09-04');
    expect(PLATFORM_TIME_ZONE).toBe('America/Sao_Paulo');
  });
});

describe('missionDaySeed', () => {
  it('é estável para o mesmo dia', () => {
    const a = missionDaySeed(new Date('2026-09-03T12:00:00Z'));
    const b = missionDaySeed(new Date('2026-09-03T22:00:00Z'));
    expect(a).toBe(b);
  });

  it('muda de um dia para o outro', () => {
    expect(missionDaySeed(new Date('2026-09-03T12:00:00Z')))
      .not.toBe(missionDaySeed(new Date('2026-09-04T12:00:00Z')));
  });

  it('NÃO muta a Date recebida', () => {
    const now = new Date('2026-09-03T18:45:30Z');
    const antes = now.getTime();
    missionDaySeed(now);
    expect(now.getTime()).toBe(antes);
  });

  it('é um inteiro', () => {
    expect(Number.isInteger(missionDaySeed(new Date('2026-09-03T12:00:00Z')))).toBe(true);
  });
});

describe('semana e mês de Brasília', () => {
  it('a semana começa na segunda (domingo ainda é da semana anterior)', () => {
    expect(platformWeekKey(new Date('2026-10-02T15:00:00Z'))).toBe('2026-09-28'); // sexta
    expect(platformWeekKey(new Date('2026-09-28T15:00:00Z'))).toBe('2026-09-28'); // segunda
    expect(platformWeekKey(new Date('2026-10-04T15:00:00Z'))).toBe('2026-09-28'); // domingo
    expect(platformWeekKey(new Date('2026-10-05T15:00:00Z'))).toBe('2026-10-05');
  });

  it('segunda 00:30 em Brasília (03:30Z) é a semana nova; domingo 23:30 (02:30Z de segunda) ainda é a antiga', () => {
    expect(platformWeekKey(new Date('2026-10-05T03:30:00Z'))).toBe('2026-10-05');
    expect(platformWeekKey(new Date('2026-10-05T02:30:00Z'))).toBe('2026-09-28');
  });

  it('as chaves de escopo e o id do documento não colidem', () => {
    const d = new Date('2026-10-02T15:00:00Z');
    expect(scopeKey('daily', d)).toBe('2026-10-02');
    expect(scopeKey('weekly', d)).toBe('2026-09-28');
    expect(scopeKey('monthly', d)).toBe('2026-10-01');
    expect(missionDocId('u', 'daily', '2026-10-01')).toBe('u_2026-10-01');
    expect(missionDocId('u', 'monthly', '2026-10-01')).toBe('u_m_2026-10-01');
    expect(missionDocId('u', 'weekly', '2026-09-28')).toBe('u_w_2026-09-28');
  });

  it('o dia começa à meia-noite de Brasília', () => {
    expect(new Date(dayStartMs('2026-10-02')).toISOString()).toBe('2026-10-02T03:00:00.000Z');
  });

  it('janela semanal tem 7 dias e a mensal acompanha o mês', () => {
    const s = scopeWindowBR('weekly', new Date('2026-10-02T15:00:00Z'));
    expect(s.endMs - s.startMs).toBe(7 * 24 * 3600_000);
    const m = scopeWindowBR('monthly', new Date('2026-12-15T15:00:00Z'));
    expect(new Date(m.endMs).toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('o contador diz o que falta, sem número negativo', () => {
    expect(formatTimeLeft(30 * 60_000)).toBe('faltam 30 min');
    expect(formatTimeLeft(5 * 3600_000)).toBe('faltam 5 h');
    expect(formatTimeLeft(2 * 24 * 3600_000 + 1000)).toBe('faltam 2 dias');
    expect(formatTimeLeft(-5)).toBe('encerra agora');
    expect(msUntilReset('daily', new Date('2026-10-02T14:30:00Z'))).toBe(12.5 * 3600_000); // 11h30 em Brasília
    expect(addDaysToDateKey('2026-02-28', 1)).toBe('2026-03-01');
  });
});

import { describe, it, expect } from 'vitest';
import { missionDateKey, missionDaySeed, PLATFORM_TIME_ZONE } from './missionDay.js';

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

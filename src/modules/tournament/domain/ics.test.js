import { describe, it, expect } from 'vitest';
import {
  escapeICSText, toICSDate, brtDateTime, buildICS, icsFilename,
} from './ics.js';

describe('escapeICSText', () => {
  it('escapa vírgula, ponto-e-vírgula, barra e quebra de linha', () => {
    expect(escapeICSText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
  it('trata null/undefined como vazio', () => {
    expect(escapeICSText(null)).toBe('');
  });
});

describe('toICSDate', () => {
  it('formata em UTC YYYYMMDDTHHMMSSZ', () => {
    expect(toICSDate(new Date(Date.UTC(2026, 7, 1, 18, 30, 0)))).toBe('20260801T183000Z');
  });
  it('aceita timestamp em ms', () => {
    expect(toICSDate(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('20260102T030405Z');
  });
  it('retorna null para data inválida', () => {
    expect(toICSDate('não é data')).toBeNull();
  });
});

describe('brtDateTime', () => {
  it('converte horário de Brasília (UTC-3) para UTC', () => {
    // 18:00 BRT === 21:00 UTC
    expect(toICSDate(brtDateTime('2026-08-01', '18:00'))).toBe('20260801T210000Z');
  });
  it('retorna null com data malformada', () => {
    expect(brtDateTime('01/08/2026', '18:00')).toBeNull();
  });
});

describe('buildICS', () => {
  it('gera um VCALENDAR/VEVENT válido com os campos', () => {
    const ics = buildICS({
      uid: 'b1@arena',
      start: brtDateTime('2026-08-01', '18:00'),
      end: brtDateTime('2026-08-01', '19:00'),
      title: 'Jogo de pickleball',
      location: 'Arena Central',
      url: 'https://x/p/1',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:b1@arena');
    expect(ics).toContain('DTSTART:20260801T210000Z');
    expect(ics).toContain('DTEND:20260801T220000Z');
    expect(ics).toContain('SUMMARY:Jogo de pickleball');
    expect(ics).toContain('LOCATION:Arena Central');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.split('\r\n').length).toBeGreaterThan(5);
  });

  it('assume +1h quando não há fim', () => {
    const ics = buildICS({ start: brtDateTime('2026-08-01', '10:00'), title: 'X' });
    expect(ics).toContain('DTSTART:20260801T130000Z');
    expect(ics).toContain('DTEND:20260801T140000Z');
  });

  it('retorna null quando o início é inválido', () => {
    expect(buildICS({ start: 'xx', title: 'X' })).toBeNull();
  });
});

describe('icsFilename', () => {
  it('normaliza acentos e caracteres para um nome seguro .ics', () => {
    expect(icsFilename('Torneio de Verão — Duplas!')).toBe('torneio-de-verao-duplas.ics');
  });
  it('cai em evento.ics quando vazio', () => {
    expect(icsFilename('')).toBe('evento.ics');
  });
});

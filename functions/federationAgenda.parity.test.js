/**
 * PARIDADE cliente × servidor do calendário oficial: a tela valida com a
 * mesma régua que o servidor aplica (tipos, tetos, datas, horários de
 * Brasília) e o arquivo de calendário (ICS) sai igual — o que a pessoa baixa
 * na página e o que a agenda assinada entrega.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/agenda.js';

const require = createRequire(import.meta.url);
const s = require('./federationAgendaPolicy.js');

const ENTRADAS = [
  { kind: 'assembly_ordinary', title: 'AGO 2027', date: '2027-03-20', start_time: '09:00', end_time: '12:00', place: { name: 'Sede', city: 'Porto Alegre', state: 'rs' }, organ: 'Assembleia geral', visibility: 'members', related_docs: [{ doc_id: 'abc123' }, 'abc123', { doc_id: 'x/y' }] },
  { kind: 'competition', title: 'Etapa 1, Copa; sul', date: '2027-04-10', end_date: '2027-04-12', all_day: true, online_url: 'https://youtu.be/x', description: 'linha 1\nlinha 2' },
  { kind: 'board', title: 'Diretoria', date: '2027-02-01', start_time: '19:00' },
  { kind: 'board', title: 'Fim antes do início', date: '2027-02-01', start_time: '19:00', end_time: '18:00' },
  { kind: 'nada', title: 'x', date: '2027-13-40', online_url: 'http://inseguro.com', visibility: 'secreto' },
  { kind: 'event', title: 'Longo demais', date: '2027-01-01', end_date: '2028-06-01', all_day: true },
];

describe('paridade: calendário oficial', () => {
  it('os mesmos tetos e enums', () => {
    expect(s.TITLE_MAX).toBe(c.EVENT_TITLE_MAX);
    expect(s.DESCRIPTION_MAX).toBe(c.EVENT_DESCRIPTION_MAX);
    expect(s.PLACE_MAX).toBe(c.EVENT_PLACE_MAX);
    expect(s.ADDRESS_MAX).toBe(c.EVENT_ADDRESS_MAX);
    expect(s.CITY_MAX).toBe(c.EVENT_CITY_MAX);
    expect(s.ORGAN_MAX).toBe(c.EVENT_ORGAN_MAX);
    expect(s.URL_MAX).toBe(c.EVENT_URL_MAX);
    expect(s.RELATED_MAX).toBe(c.EVENT_RELATED_MAX);
    expect(s.REASON_MIN).toBe(c.EVENT_REASON_MIN);
    expect(s.SPAN_MAX_DAYS).toBe(c.EVENT_SPAN_MAX_DAYS);
    expect(s.HISTORY_MAX).toBe(c.EVENT_HISTORY_MAX);
    expect(s.STATUS).toEqual(c.EVENT_STATUS);
    expect([...s.VISIBILITY].sort()).toEqual(Object.values(c.EVENT_VISIBILITY).sort());
    expect([...s.GROUPS].sort()).toEqual(c.EVENT_GROUPS.map((g) => g.id).sort());
  });

  it('a mesma tabela de tipos (grupo e reunião)', () => {
    expect(Object.keys(s.KINDS).sort()).toEqual(c.EVENT_KINDS.map((k) => k.id).sort());
    c.EVENT_KINDS.forEach((k) => expect(s.KINDS[k.id], k.id).toMatchObject({ group: k.group, meeting: k.meeting }));
  });

  it('a mesma validação (resultado e campos com erro)', () => {
    ENTRADAS.forEach((e) => {
      const a = s.validateEvent(e);
      const b = c.validateEventInput(e);
      expect(a.ok, e.title).toBe(b.ok);
      expect(Object.keys(a.errors).sort(), e.title).toEqual(Object.keys(b.errors).sort());
      expect(a.value, e.title).toEqual(b.value);
    });
  });

  it('a mesma hora de Brasília e a mesma mudança de data', () => {
    expect(s.brMs('2027-03-20', '09:00')).toBe(c.brMs('2027-03-20', '09:00'));
    expect(new Date(c.brMs('2027-03-20', '09:00')).toISOString()).toBe('2027-03-20T12:00:00.000Z');
    const a = { date: '2027-03-20', start_time: '09:00' };
    expect(s.whenChanged(a, { ...a, start_time: '10:00' })).toBe(c.whenChanged(a, { ...a, start_time: '10:00' }));
    expect(s.whenChanged(a, { ...a })).toBe(false);
  });

  it('o mesmo arquivo de calendário (ICS), dobrado em 75 octetos', () => {
    const evs = ENTRADAS.slice(0, 3).map((e, i) => ({ id: `ev${i}`, ...s.validateEvent(e).value, status: i === 2 ? 'cancelled' : 'scheduled' }));
    const opts = { name: 'FGP — Agenda oficial', host: 'picklerush.web.app', urlOf: (ev) => `https://picklerush.web.app/f/fgp/agenda/${ev.id}`, stampMs: Date.UTC(2027, 0, 1) };
    const ics = s.buildIcs(evs, opts);
    expect(c.buildIcs(evs, opts)).toBe(ics);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270410');
    expect(ics).toContain('DTSTART:20270320T120000Z');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('Etapa 1\\, Copa\\; sul');
    ics.split('\r\n').forEach((linha) => expect(Buffer.byteLength(linha, 'utf8')).toBeLessThanOrEqual(75));
  });

  it('o mesmo torneio chancelado na agenda', () => {
    const tt = { id: 't1', name: 'Open RS', starts_at: '2027-05-01T09:00', ends_at: '2027-05-02', venue: 'Clube X', city: 'Canoas', state: 'rs', status: 'open', visibility: 'public', federation_sanction: { status: 'approved' } };
    expect(s.isAgendaTournament(tt)).toBe(c.isAgendaTournament(tt));
    expect(s.tournamentAgendaItem(tt)).toEqual(c.tournamentAgendaItem(tt));
    ['draft', 'cancelled'].forEach((status) => expect(s.isAgendaTournament({ ...tt, status })).toBe(false));
    expect(s.isAgendaTournament({ ...tt, federation_sanction: { status: 'pending' } })).toBe(false);
    expect(c.tournamentAgendaItem({ ...tt, visibility: 'private' })).toBe(null);
  });
});

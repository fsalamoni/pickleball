import { describe, it, expect } from 'vitest';
import {
  agendaFeedPath, agendaPublicPath, canManageKind, canUseAgenda, eventActions, eventPublicPath, eventState, filterAgenda, googleCalendarUrl, groupByMonth,
  kindsFor, mapUrl, mergeEventLists, saveNeedsReason, splitAgenda, validateEventInput,
} from './agenda';

const NOW = Date.UTC(2026, 9, 21, 15, 0);
const ev = (id, date, extra = {}) => ({ id, ...validateEventInput({ kind: 'board', title: `Evento ${id}`, date, start_time: '19:00', ...extra }).value, status: 'scheduled', ...extra });

describe('calendário: situação e ordem', () => {
  const lista = [
    ev('passado', '2026-10-01'),
    ev('futuro2', '2026-12-01'),
    ev('futuro1', '2026-11-01'),
    ev('adiado', '2026-10-25', { status: 'postponed' }),
    ev('cancelado', '2026-11-15', { status: 'cancelled' }),
    ev('agora', '2026-10-21', { start_time: '11:00', end_time: '14:00' }),
  ];

  it('a situação de agora (Brasília)', () => {
    const porId = Object.fromEntries(lista.map((e) => [e.id, eventState(e, NOW)]));
    expect(porId).toEqual({ passado: 'past', futuro2: 'upcoming', futuro1: 'upcoming', adiado: 'postponed', cancelado: 'cancelled', agora: 'ongoing' });
  });

  it('próximos do mais cedo ao mais tarde, adiado no fim; anteriores do mais recente; cancelado fica onde a data o põe', () => {
    const { upcoming, past } = splitAgenda(lista, NOW);
    expect(upcoming.map((e) => e.id)).toEqual(['agora', 'futuro1', 'cancelado', 'futuro2', 'adiado']);
    expect(past.map((e) => e.id)).toEqual(['passado']);
  });

  it('agrupa por mês, com o adiado à parte', () => {
    const { upcoming } = splitAgenda(lista, NOW);
    expect(groupByMonth(upcoming).map((g) => [g.key, g.items.length])).toEqual([['2026-10', 1], ['2026-11', 2], ['2026-12', 1], ['', 1]]);
  });

  it('busca sem acento e filtro de agenda', () => {
    const itens = [ev('a', '2026-11-01', { title: 'Reunião da diretoria', place: { city: 'São Paulo' } }), ev('b', '2026-11-02', { kind: 'competition', title: 'Etapa', all_day: true })];
    expect(filterAgenda(itens, { q: 'reuniao' }).map((e) => e.id)).toEqual(['a']);
    expect(filterAgenda(itens, { q: 'sao paulo' }).map((e) => e.id)).toEqual(['a']);
    expect(filterAgenda(itens, { group: 'sport' }).map((e) => e.id)).toEqual(['b']);
  });

  it('junta as listas de cada visibilidade sem repetir', () => {
    expect(mergeEventLists([{ id: 'x' }], [{ id: 'x' }, { id: 'y' }], undefined).map((e) => e.id)).toEqual(['x', 'y']);
  });
});

describe('calendário: quem pode o quê', () => {
  it('docs e admin tudo; competições só a agenda esportiva', () => {
    expect(canManageKind(['docs'], 'assembly_ordinary')).toBe(true);
    expect(canManageKind(['competitions'], 'competition')).toBe(true);
    expect(canManageKind(['competitions'], 'board')).toBe(false);
    expect(canManageKind(['finance'], 'competition')).toBe(false);
    expect(kindsFor(['competitions']).every((k) => k.group === 'sport')).toBe(true);
    expect(canUseAgenda(['finance'])).toBe(false);
  });

  it('as ações seguem a situação; divulgado não se apaga; torneio derivado só se vê', () => {
    const divulgado = { ...ev('d', '2026-11-01'), ever_visible: true };
    expect(eventActions(divulgado, ['docs'], NOW)).toEqual({ edit: true, postpone: true, cancel: true, remove: false });
    expect(eventActions({ ...ev('s', '2026-11-01'), ever_visible: false }, ['docs'], NOW).remove).toBe(true);
    expect(eventActions({ ...divulgado, status: 'cancelled' }, ['docs'], NOW)).toMatchObject({ postpone: false, cancel: false, edit: true });
    expect(eventActions(ev('p', '2026-10-01'), ['docs'], NOW)).toMatchObject({ postpone: false, cancel: false });
    expect(eventActions({ id: 'torneio_1', derived: true, kind: 'tournament' }, ['admin'], NOW).edit).toBe(false);
  });

  it('pede motivo só quando o divulgado muda de data ou sai de adiado/cancelado', () => {
    const prev = { ...ev('d', '2026-11-01'), ever_visible: true };
    expect(saveNeedsReason(prev, { ...prev, title: 'Outro título' })).toBe(false);
    expect(saveNeedsReason(prev, { ...prev, date: '2026-11-08' })).toBe(true);
    expect(saveNeedsReason({ ...prev, status: 'postponed' }, prev)).toBe(true);
    expect(saveNeedsReason({ ...prev, ever_visible: false }, { ...prev, date: '2026-11-08' })).toBe(false);
  });
});

describe('calendário: endereços', () => {
  const fed = { id: 'fed1', slug: 'fpp' };
  it('página, evento, torneio derivado e agenda assinável', () => {
    expect(agendaPublicPath(fed)).toBe('/f/fpp/agenda');
    expect(eventPublicPath(fed, { id: 'e1' })).toBe('/f/fpp/agenda/e1');
    expect(eventPublicPath(fed, { id: 'torneio_t1', derived: true, tournament_id: 't1' })).toBe('/p/t1');
    expect(eventPublicPath(fed, { id: 'torneio_t1', derived: true, tournament_id: 't1' }, { inApp: true })).toBe('/torneios/t1');
    expect(agendaFeedPath({ id: 'fed1' })).toBe('/api/agenda/fed1.ics');
  });

  it('Google Agenda em UTC (ou dia inteiro com fim exclusivo) e mapa pelo texto do local', () => {
    const e = ev('g', '2026-11-20', { end_time: '21:00', place: { name: 'Sede', city: 'Porto Alegre', state: 'RS' } });
    const u = new URL(googleCalendarUrl(e, { url: 'https://x/e' }));
    expect(u.searchParams.get('dates')).toBe('20261120T220000Z/20261121T000000Z');
    expect(u.searchParams.get('location')).toBe('Sede, Porto Alegre - RS');
    const dia = ev('h', '2026-11-20', { all_day: true, end_date: '2026-11-22' });
    expect(new URL(googleCalendarUrl(dia)).searchParams.get('dates')).toBe('20261120/20261123');
    expect(mapUrl({ name: 'Sede' })).toContain('query=Sede');
    expect(mapUrl({})).toBe('');
  });
});

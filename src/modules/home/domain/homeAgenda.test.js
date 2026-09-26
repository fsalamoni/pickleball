import { describe, it, expect } from 'vitest';
import {
  AGENDA_KIND, agendaFromTournamentMatches, agendaFromGameDays, agendaFromBookings,
  agendaFromLessons, agendaFromArenaEnrollments, agendaFromOpenSlots, agendaFromClubEvents,
  mergeAgenda, groupAgendaByDay, agendaDayLabel, countToday,
} from './homeAgenda.js';

// Sábado, 26/09/2026, 15:00 (hora local).
const AGORA = new Date(2026, 8, 26, 15, 0).getTime();
const HOJE = '2026-09-26';
const ctx = { agora: AGORA };

describe('jogos de torneio', () => {
  it('entra o que vem pela frente e o que está acontecendo; sai o que já passou', () => {
    const r = agendaFromTournamentMatches([
      { matchId: 'm1', tournamentId: 't1', tournamentName: 'Open', scheduledAt: new Date(2026, 8, 27, 9, 30).getTime(), opponent: 'Ana', court: 'Quadra 2' },
      { matchId: 'm2', tournamentId: 't1', scheduledAt: new Date(2026, 8, 26, 14, 0).getTime(), opponent: 'Bia' },
      { matchId: 'm3', tournamentId: 't1', scheduledAt: new Date(2026, 8, 25, 9, 0).getTime() },
      { matchId: 'm4', scheduledAt: null },
    ], ctx);
    expect(r.map((i) => i.key)).toEqual(['torneio:m1', 'torneio:m2']);
    expect(r[0]).toMatchObject({ dia: '2026-09-27', hora: '09:30', title: 'vs Ana', subtitle: 'Open · Quadra 2', link: '/torneios/t1' });
  });
});

describe('dias de jogo', () => {
  it('arquivado e passado não entram; o de hoje sem hora fica o dia todo', () => {
    const r = agendaFromGameDays([
      { id: 'g1', title: 'Rachão', date: '2026-09-28', time: '19:00' },
      { id: 'g2', title: 'Ontem', date: '2026-09-25' },
      { id: 'g3', title: 'Arquivado', date: '2026-09-30', status: 'archived' },
      { id: 'g4', title: 'Hoje sem hora', date: HOJE },
      { id: 'g5', title: 'Sem data' },
    ], ctx);
    expect(r.map((i) => i.key)).toEqual(['dia:g1', 'dia:g4']);
  });

  it('dia de jogo da arena usa o horário das quadras reservadas — e sai quando termina', () => {
    const acabou = { id: 'a1', title: 'Manhã', date: HOJE, arena_name: 'Arena X', arena_slots: [{ start_time: '08:00', end_time: '10:00' }] };
    const rolando = { id: 'a2', title: 'Tarde', date: HOJE, arena_slots: [{ start_time: '14:00', end_time: '18:00' }, { start_time: '13:00', end_time: '16:00' }] };
    const r = agendaFromGameDays([acabou, rolando], ctx);
    expect(r.map((i) => i.key)).toEqual(['dia:a2']);
    expect(r[0].hora).toBe('13:00');
  });

  it('dia de jogo de hoje com hora e sem fim sai depois de 6 horas', () => {
    expect(agendaFromGameDays([{ id: 'g', date: HOJE, time: '08:00' }], ctx)).toEqual([]);
    expect(agendaFromGameDays([{ id: 'g', date: HOJE, time: '10:00' }], ctx)).toHaveLength(1);
  });
});

describe('reservas', () => {
  it('só pedidas/confirmadas, pelo PRÓXIMO horário que não terminou', () => {
    const r = agendaFromBookings([
      { id: 'b1', status: 'confirmed', arena_name: 'Arena Sul', slots: [{ date: HOJE, start: '10:00', end: '11:00' }, { date: HOJE, start: '18:00', end: '19:00' }] },
      { id: 'b2', status: 'requested', arena_name: 'Arena Norte', slots: [{ date: '2026-09-29', start: '07:00', end: '08:00' }] },
      { id: 'b3', status: 'declined', slots: [{ date: '2026-09-29', start: '07:00', end: '08:00' }] },
      { id: 'b4', status: 'cancelled', slots: [{ date: '2026-09-29', start: '07:00', end: '08:00' }] },
      { id: 'b5', status: 'confirmed', slots: [{ date: '2026-09-20', start: '07:00', end: '08:00' }] },
    ], ctx);
    expect(r.map((i) => i.key)).toEqual(['reserva:b1', 'reserva:b2']);
    expect(r[0]).toMatchObject({ hora: '18:00', status: 'Confirmada' });
    expect(r[1].status).toBe('Aguardando a arena');
  });

  it('aceita reserva no formato antigo (data/hora soltas no documento)', () => {
    const r = agendaFromBookings([{ id: 'x', status: 'confirmed', date: '2026-09-27', start: '08:00', end: '09:00' }], ctx);
    expect(r).toHaveLength(1);
  });
});

describe('aulas', () => {
  const aula = (over) => ({ id: 'l1', status: 'requested', format: 'private', student_name: 'Carla', slots: [{ date: '2026-09-27', start: '08:00', end: '09:00' }], ...over });

  it('para o PROFESSOR, o pedido pede ação; para o aluno, é espera', () => {
    const prof = agendaFromLessons([aula()], { papel: 'professor', agora: AGORA });
    expect(prof[0]).toMatchObject({ kind: AGENDA_KIND.AULA_PROFESSOR, acao: true, title: 'Aula com Carla', link: '/aulas' });
    const aluno = agendaFromLessons([aula()], { papel: 'aluno', agora: AGORA });
    expect(aluno[0]).toMatchObject({ kind: AGENDA_KIND.AULA, acao: false, status: 'Aguardando o professor', link: '/minhas-aulas' });
  });

  it('recusada, cancelada e concluída não entram', () => {
    ['declined', 'cancelled', 'completed'].forEach((status) => {
      expect(agendaFromLessons([aula({ status })], ctx)).toEqual([]);
    });
  });

  it('aulas de arena: cancelada, dada ou matrícula cancelada não entram', () => {
    const r = agendaFromArenaEnrollments([
      { key: 'e1', aula: { date: '2026-09-27', start: '08:00', end: '09:00', title: 'Clínica', status: 'scheduled' }, arenaName: 'Arena' },
      { key: 'e2', aula: { date: '2026-09-27', status: 'cancelled' } },
      { key: 'e3', aula: { date: '2026-09-27', status: 'completed' } },
      { key: 'e4', aula: { date: '2026-09-27' }, booking: { status: 'cancelled' } },
      { key: 'e5', cancelled: true, aula: { date: '2026-09-27' } },
    ], ctx);
    expect(r.map((i) => i.key)).toEqual(['aula-arena:e1']);
  });
});

describe('jogos abertos', () => {
  it('⭐ o jogo aberto que já é dia de jogo aparece UMA vez (pelo dia de jogo)', () => {
    const r = agendaFromOpenSlots([
      { id: 's1', status: 'open', date: '2026-09-27', start: '19:00', end: '21:00', arena_id: 'a', game_day_id: 'g1' },
      { id: 's2', status: 'full', date: '2026-09-27', start: '19:00', end: '21:00', arena_id: 'a', arena_name: 'Arena' },
      { id: 's3', status: 'cancelled', date: '2026-09-27' },
    ], { agora: AGORA, gameDayIds: new Set(['g1']) });
    expect(r.map((i) => i.key)).toEqual(['aberto:s2']);
    expect(r[0].link).toBe('/arenas/a');
  });
});

describe('eventos de clube', () => {
  it('entra quem vai, talvez e o convite sem resposta (que pede ação)', () => {
    const r = agendaFromClubEvents([
      { id: 'e1', club_id: 'c', title: 'Social', starts_at: '2026-09-27T18:00', my_invite_status: 'going' },
      { id: 'e2', club_id: 'c', title: 'Convite', starts_at: '2026-09-28T18:00', my_invite_status: 'invited' },
      { id: 'e3', club_id: 'c', starts_at: '2026-09-28T18:00', my_invite_status: 'not_going' },
      { id: 'e4', club_id: 'c', starts_at: '2026-09-28T18:00' },
      { id: 'e5', club_id: 'c', starts_at: '2026-09-20T18:00', my_invite_status: 'going' },
    ], ctx);
    expect(r.map((i) => i.key)).toEqual(['evento:e1', 'evento:e2']);
    expect(r[1]).toMatchObject({ acao: true, link: '/clubes/c/eventos/e2' });
  });
});

describe('mergeAgenda / groupAgendaByDay', () => {
  it('junta sem repetir, pela data, e o que pede ação na frente dentro do dia', () => {
    const a = { key: 'x', dia: '2026-09-27', inicioMs: 2, acao: false, title: 'B' };
    const b = { key: 'y', dia: '2026-09-27', inicioMs: 9, acao: true, title: 'A' };
    const c = { key: 'z', dia: HOJE, inicioMs: 5, acao: false, title: 'C' };
    const r = mergeAgenda([[a, c], [b, a]]);
    expect(r.map((i) => i.key)).toEqual(['z', 'y', 'x']);
    expect(mergeAgenda([[a, b, c]], { limite: 2 })).toHaveLength(2);
    const g = groupAgendaByDay(r, HOJE);
    expect(g.map((x) => x.label)).toEqual(['Hoje', 'Amanhã']);
    expect(g[1].itens).toHaveLength(2);
    expect(countToday(r, HOJE)).toBe(1);
  });

  it('rótulo do dia: hoje, amanhã, depois a data por extenso curto', () => {
    expect(agendaDayLabel(HOJE, HOJE)).toBe('Hoje');
    expect(agendaDayLabel('2026-09-27', HOJE)).toBe('Amanhã');
    expect(agendaDayLabel('2026-09-29', HOJE)).toBe('Ter, 29/09');
  });
});

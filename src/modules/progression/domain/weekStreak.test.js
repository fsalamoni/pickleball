import { describe, it, expect } from 'vitest';
import {
  STREAK_STATUS, STREAK_VACATION_COOLDOWN_DAYS, STREAK_VACATION_MAX_DAYS,
  canStartVacation, computeWeekStreak, mondayKeyOfWeek, vacationPeriodsOf,
  weekIndexOf, weekIndexOfKey, withVacationEnded, withVacationStarted,
} from './weekStreak.js';
import { STREAK_MILESTONES } from './streakProtection.js';

const DIA = 24 * 3600_000;
/** Quarta-feira, 07/10/2026, 12:00 em Brasília. A semana é a de segunda 05/10. */
const AGORA = new Date('2026-10-07T15:00:00Z');
const CUR = weekIndexOf(AGORA.getTime());
/** Um jogo (quarta, meio-dia) na semana `CUR + delta`. */
const jogo = (delta) => new Date(`${mondayKeyOfWeek(CUR + delta)}T15:00:00Z`).getTime() + 2 * DIA;
const jogos = (...deltas) => deltas.map(jogo);

describe('weekStreak — a semana de Brasília', () => {
  it('a segunda-feira é o começo da semana, o domingo à noite ainda é da semana anterior', () => {
    // domingo 04/10 23:59 em Brasília = 05/10 02:59Z → semana de 28/09
    expect(mondayKeyOfWeek(weekIndexOf(Date.parse('2026-10-05T02:59:00Z')))).toBe('2026-09-28');
    // segunda 05/10 00:30 em Brasília = 03:30Z → semana nova
    expect(mondayKeyOfWeek(weekIndexOf(Date.parse('2026-10-05T03:30:00Z')))).toBe('2026-10-05');
  });

  it('o índice e a chave da segunda andam juntos (e semanas vizinhas diferem em 1)', () => {
    expect(mondayKeyOfWeek(CUR)).toBe('2026-10-05');
    expect(weekIndexOfKey('2026-10-05')).toBe(CUR);
    expect(weekIndexOfKey('2026-09-28')).toBe(CUR - 1);
    expect(weekIndexOfKey('2026-01-05')).toBe(CUR - 39);
  });
});

describe('computeWeekStreak — a sequência', () => {
  it('sem nenhum jogo: zero, sem histórico, e o primeiro marco como próxima meta', () => {
    const s = computeWeekStreak([], { now: AGORA });
    expect(s.weeks).toBe(0);
    expect(s.best).toBe(0);
    expect(s.status).toBe(STREAK_STATUS.NONE);
    expect(s.nextStep.weeks).toBe(STREAK_MILESTONES[0].weeks);
    expect(s.lastPlayAt).toBeNull();
  });

  it('jogou nesta semana e nas três anteriores: 4 semanas, ativa', () => {
    const s = computeWeekStreak(jogos(0, -1, -2, -3), { now: AGORA });
    expect(s.weeks).toBe(4);
    expect(s.status).toBe(STREAK_STATUS.ACTIVE);
    expect(s.playedThisWeek).toBe(true);
    expect(s.nextStep.weeks).toBe(8);
  });

  it('a semana atual ainda está aberta: não jogar nela NÃO quebra, deixa "em risco"', () => {
    const s = computeWeekStreak(jogos(-1, -2, -3), { now: AGORA });
    expect(s.weeks).toBe(3);
    expect(s.status).toBe(STREAK_STATUS.AT_RISK);
    expect(s.playedThisWeek).toBe(false);
    // sobra menos de 7 dias e mais de zero até domingo à meia-noite
    expect(s.msLeftInWeek).toBeGreaterThan(3 * DIA);
    expect(s.msLeftInWeek).toBeLessThan(7 * DIA);
  });

  it('🐞 quem parou NÃO continua com a sequência antiga: zera, e o recorde guarda a história', () => {
    const s = computeWeekStreak(jogos(-20, -21, -22, -23, -24), { now: AGORA });
    expect(s.weeks).toBe(0);
    expect(s.status).toBe(STREAK_STATUS.BROKEN);
    expect(s.best).toBe(5);
    expect(s.weeksSinceLast).toBe(20);
  });

  it('o recorde é o da melhor sequência, mesmo com uma sequência atual menor', () => {
    const s = computeWeekStreak(jogos(0, -1, -10, -11, -12, -13, -14, -15), { now: AGORA });
    expect(s.weeks).toBe(2);
    expect(s.best).toBe(6);
  });

  it('jogo marcado para o futuro não conta', () => {
    const s = computeWeekStreak([...jogos(-1), jogo(0) + 6 * DIA, jogo(1)], { now: AGORA });
    expect(s.weeks).toBe(1);
    expect(s.playedThisWeek).toBe(false);
  });

  it('datas inválidas são ignoradas', () => {
    const s = computeWeekStreak([NaN, 0, -5, null, undefined, 'x', ...jogos(0)], { now: AGORA });
    expect(s.weeks).toBe(1);
  });
});

describe('computeWeekStreak — a folga automática (uma semana por mês)', () => {
  it('uma semana sem jogar no meio não quebra, mas também não soma', () => {
    // semana -2 em branco (setembro)
    const s = computeWeekStreak(jogos(0, -1, -3, -4), { now: AGORA });
    expect(s.weeks).toBe(4);
    expect(s.status).toBe(STREAK_STATUS.ACTIVE);
    expect(s.folgaUsedThisMonth).toBe(false); // foi a folga de setembro, não a de outubro
  });

  it('a folga do mês corrente aparece como usada', () => {
    const agora = new Date('2026-10-21T15:00:00Z'); // semana de 19/10
    const cur = weekIndexOf(agora.getTime());
    const j = (d) => new Date(`${mondayKeyOfWeek(cur + d)}T15:00:00Z`).getTime() + 2 * DIA;
    const s = computeWeekStreak([j(0), j(-1), j(-3)], { now: agora }); // semana de 05/10 em branco
    expect(s.weeks).toBe(3);
    expect(s.folgaUsedThisMonth).toBe(true);
  });

  it('duas semanas em branco no MESMO mês quebram', () => {
    // em branco: -2 (21/09) e -4 (07/09) — as duas em setembro
    const s = computeWeekStreak(jogos(0, -1, -3, -5), { now: AGORA });
    expect(s.weeks).toBe(3);
  });

  it('duas semanas em branco SEGUIDAS quebram, mesmo em meses diferentes', () => {
    const agora = new Date('2026-10-14T15:00:00Z'); // semana de 12/10
    const cur = weekIndexOf(agora.getTime());
    const j = (d) => new Date(`${mondayKeyOfWeek(cur + d)}T15:00:00Z`).getTime() + 2 * DIA;
    // em branco: 28/09 (set) e 05/10 (out), seguidas, e a semana atual ainda aberta
    const s = computeWeekStreak([j(-3), j(-4)], { now: agora });
    expect(s.weeks).toBe(0);
    expect(s.status).toBe(STREAK_STATUS.BROKEN);
  });

  it('a folga cobre também a semana passada, com a atual ainda aberta', () => {
    const s = computeWeekStreak(jogos(-2, -3, -4), { now: AGORA });
    expect(s.weeks).toBe(3);
    expect(s.status).toBe(STREAK_STATUS.AT_RISK);
  });

  it('folga no fim da fila (sem jogo antes) não entra na conta', () => {
    const s = computeWeekStreak(jogos(0), { now: AGORA });
    expect(s.weeks).toBe(1);
    expect(s.folgaUsedThisMonth).toBe(false);
  });
});

describe('computeWeekStreak — férias', () => {
  const emSetembro = [{ from: Date.parse('2026-09-21T15:00:00Z'), to: Date.parse('2026-10-04T15:00:00Z') }];

  it('as semanas de férias não quebram e não somam', () => {
    // jogou esta semana e nas duas de antes das férias (21/09 e 28/09 em férias)
    const s = computeWeekStreak(jogos(0, -3, -4), { now: AGORA, vacations: emSetembro });
    expect(s.weeks).toBe(3);
    expect(s.status).toBe(STREAK_STATUS.ACTIVE);
  });

  it('sem as férias, a mesma história quebra', () => {
    const s = computeWeekStreak(jogos(0, -3, -4), { now: AGORA });
    expect(s.weeks).toBe(1);
  });

  it('com as férias em andamento, o estado é "férias" e a sequência é preservada', () => {
    const abertas = [{ from: Date.parse('2026-10-05T15:00:00Z'), to: null }];
    const s = computeWeekStreak(jogos(-1, -2), { now: AGORA, vacations: abertas });
    expect(s.status).toBe(STREAK_STATUS.VACATION);
    expect(s.vacationOpen).toBe(true);
    expect(s.vacationCovering).toBe(true);
    expect(s.vacationEndsAt).toBe(abertas[0].from + 28 * DIA);
    expect(s.weeks).toBe(2);
  });

  it('férias não protegem para sempre: passadas as 4 semanas deixam de cobrir', () => {
    const de = Date.parse('2026-08-03T15:00:00Z'); // 65 dias antes de AGORA
    const s = computeWeekStreak(jogos(-9, -10), { now: AGORA, vacations: [{ from: de, to: null }] });
    expect(s.vacationOpen).toBe(true);
    expect(s.vacationCovering).toBe(false);
    expect(s.status).toBe(STREAK_STATUS.BROKEN);
    expect(STREAK_VACATION_MAX_DAYS).toBe(28);
  });
});

describe('vacationPeriodsOf — o documento antigo e o novo', () => {
  it('formato novo: lista, descartando o que não faz sentido', () => {
    expect(vacationPeriodsOf({ vacations: [{ from: 10, to: 20 }, { from: 'x' }, { from: 0, to: 5 }, { from: 30, to: null }] }))
      .toEqual([{ from: 10, to: 20 }, { from: 30, to: null }]);
  });

  it('formato antigo: em andamento fica aberta; encerrada vale até a última atualização', () => {
    expect(vacationPeriodsOf({ vacationMode: true, vacationStartedAt: 1000 })).toEqual([{ from: 1000, to: null }]);
    expect(vacationPeriodsOf({ vacationMode: false, vacationStartedAt: 1000, updatedAt: 5000 })).toEqual([{ from: 1000, to: 5000 }]);
    expect(vacationPeriodsOf({ vacationMode: false, vacationStartedAt: null })).toEqual([]);
  });

  it('documento ausente ou estranho vira lista vazia', () => {
    expect(vacationPeriodsOf(null)).toEqual([]);
    expect(vacationPeriodsOf('x')).toEqual([]);
    expect(vacationPeriodsOf({})).toEqual([]);
  });
});

describe('começar e encerrar férias', () => {
  it('a primeira vez é livre', () => {
    expect(canStartVacation([], AGORA)).toEqual({ ok: true, reason: null, availableAt: null });
  });

  it('não dá para começar com outra em aberto', () => {
    expect(canStartVacation([{ from: 1, to: null }], AGORA).reason).toBe('open');
  });

  it('depois de uma pausa, só passados 90 dias — e diz quando libera', () => {
    const from = AGORA.getTime() - 30 * DIA;
    const r = canStartVacation([{ from, to: from + 5 * DIA }], AGORA);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cooldown');
    expect(r.availableAt).toBe(from + STREAK_VACATION_COOLDOWN_DAYS * DIA);
    const antiga = AGORA.getTime() - 100 * DIA;
    expect(canStartVacation([{ from: antiga, to: antiga + 5 * DIA }], AGORA).ok).toBe(true);
  });

  it('withVacationStarted/Ended não mudam a lista original e guardam só as mais recentes', () => {
    const base = [{ from: 1, to: 2 }];
    const ini = withVacationStarted(base, AGORA);
    expect(base).toEqual([{ from: 1, to: 2 }]);
    expect(ini.at(-1)).toEqual({ from: AGORA.getTime(), to: null });
    expect(withVacationEnded(ini, new Date(AGORA.getTime() + DIA)).at(-1).to).toBe(AGORA.getTime() + DIA);
    const muitas = Array.from({ length: 12 }, (_, i) => ({ from: i + 1, to: i + 2 }));
    expect(withVacationStarted(muitas, AGORA)).toHaveLength(8);
    expect(withVacationEnded([{ from: 5, to: 9 }], AGORA)).toEqual([{ from: 5, to: 9 }]);
  });
});

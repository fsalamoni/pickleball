import { describe, it, expect } from 'vitest';
import {
  REG_WINDOW, registrationWindow, isRegistrationOpen, isPaymentOpen, effectiveTournamentStatus,
  statusFromSchedule, dueScheduleChange, publishOutcome, scheduleProblems,
  msToLocalInput, localInputToMs, msToLocalDate, statusPatchForManualChange, registrationBlockReason,
} from './registrationWindow.js';
import { TOURNAMENT_STATUS as S } from './constants.js';

const H = 3_600_000;
const AGORA = Date.UTC(2026, 10, 7, 15, 0);
const t = (status, extra = {}) => ({ status, ...extra });

describe('registrationWindow', () => {
  it('rascunho não abre para ninguém, com ou sem datas', () => {
    expect(registrationWindow(t(S.DRAFT, { registration_opens_ms: AGORA - H }), AGORA)).toBe(REG_WINDOW.DRAFT);
  });
  it('publicado abre na hora marcada, sem esperar o servidor', () => {
    const p = t(S.PUBLISHED, { registration_opens_ms: AGORA + H });
    expect(registrationWindow(p, AGORA)).toBe(REG_WINDOW.SOON);
    expect(registrationWindow(p, AGORA + H)).toBe(REG_WINDOW.OPEN);
    expect(effectiveTournamentStatus(p, AGORA + H)).toBe(S.REGISTRATIONS_OPEN);
  });
  it('publicado sem data de abertura espera a organização abrir', () => {
    expect(registrationWindow(t(S.PUBLISHED), AGORA)).toBe(REG_WINDOW.SOON);
  });
  it('aberto encerra na hora marcada', () => {
    const a = t(S.REGISTRATIONS_OPEN, { registration_closes_ms: AGORA + H });
    expect(isRegistrationOpen(a, AGORA)).toBe(true);
    expect(registrationWindow(a, AGORA + H)).toBe(REG_WINDOW.CLOSED);
    expect(effectiveTournamentStatus(a, AGORA + H)).toBe(S.REGISTRATIONS_CLOSED);
  });
  it('torneio antigo, sem datas, segue o status', () => {
    expect(isRegistrationOpen(t(S.REGISTRATIONS_OPEN), AGORA)).toBe(true);
    expect(registrationWindow(t(S.REGISTRATIONS_CLOSED), AGORA)).toBe(REG_WINDOW.CLOSED);
    expect(registrationWindow(t(S.IN_PROGRESS), AGORA)).toBe(REG_WINDOW.OVER);
    expect(registrationWindow(t(S.REGISTRATIONS_OPEN, { archived: true }), AGORA)).toBe(REG_WINDOW.OVER);
  });
});

describe('isPaymentOpen', () => {
  it('fica à vista das inscrições até o prazo de pagamento, mesmo encerradas', () => {
    const x = t(S.REGISTRATIONS_OPEN, { registration_closes_ms: AGORA, payment_deadline_ms: AGORA + 2 * H });
    expect(isPaymentOpen(x, AGORA - H)).toBe(true);
    expect(isPaymentOpen(x, AGORA + H)).toBe(true);
    expect(isPaymentOpen({ ...x, status: S.REGISTRATIONS_CLOSED }, AGORA + H)).toBe(true);
    expect(isPaymentOpen({ ...x, status: S.IN_PROGRESS }, AGORA + H)).toBe(true);
    expect(isPaymentOpen(x, AGORA + 2 * H)).toBe(false);
  });
  it('não aparece antes das inscrições abrirem nem no cancelado', () => {
    expect(isPaymentOpen(t(S.PUBLISHED, { registration_opens_ms: AGORA + H }), AGORA)).toBe(false);
    expect(isPaymentOpen(t(S.DRAFT), AGORA)).toBe(false);
    expect(isPaymentOpen(t(S.CANCELLED), AGORA)).toBe(false);
  });
  it('sem prazo gravado (torneio antigo), como sempre', () => {
    expect(isPaymentOpen(t(S.IN_PROGRESS), AGORA)).toBe(true);
  });
});

describe('statusFromSchedule', () => {
  it('as datas mandam antes do jogo', () => {
    expect(statusFromSchedule(t(S.REGISTRATIONS_OPEN, { registration_opens_ms: AGORA + H }), AGORA)).toBe(S.PUBLISHED);
    expect(statusFromSchedule(t(S.REGISTRATIONS_CLOSED, { registration_closes_ms: AGORA + H }), AGORA)).toBe(S.REGISTRATIONS_OPEN);
    expect(statusFromSchedule(t(S.PUBLISHED, { registration_closes_ms: AGORA - H }), AGORA)).toBe(S.REGISTRATIONS_CLOSED);
  });
  it('não mexe no rascunho, no andamento nem no encerrado à mão sem data', () => {
    expect(statusFromSchedule(t(S.DRAFT), AGORA)).toBe(S.DRAFT);
    expect(statusFromSchedule(t(S.IN_PROGRESS, { registration_closes_ms: AGORA + H }), AGORA)).toBe(S.IN_PROGRESS);
    expect(statusFromSchedule(t(S.REGISTRATIONS_CLOSED), AGORA)).toBe(S.REGISTRATIONS_CLOSED);
  });
});

describe('dueScheduleChange', () => {
  it('abre e encerra pela data, uma vez', () => {
    expect(dueScheduleChange(t(S.PUBLISHED, { registration_opens_ms: AGORA }), AGORA)).toBe('open');
    expect(dueScheduleChange(t(S.REGISTRATIONS_OPEN, { registration_closes_ms: AGORA }), AGORA)).toBe('close');
    expect(dueScheduleChange(t(S.PUBLISHED, { registration_opens_ms: AGORA - 2 * H, registration_closes_ms: AGORA - H }), AGORA)).toBe('close');
    expect(dueScheduleChange(t(S.REGISTRATIONS_CLOSED, { registration_closes_ms: AGORA - H }), AGORA)).toBe(null);
  });
  it('nunca abre rascunho nem reabre o que a organização encerrou', () => {
    expect(dueScheduleChange(t(S.DRAFT, { registration_opens_ms: AGORA - H }), AGORA)).toBe(null);
    expect(dueScheduleChange(t(S.REGISTRATIONS_CLOSED, { registration_opens_ms: AGORA - H }), AGORA)).toBe(null);
    expect(dueScheduleChange(t(S.PUBLISHED, { registration_opens_ms: AGORA + H }), AGORA)).toBe(null);
  });
});

describe('publishOutcome', () => {
  it('sem data de abertura, publicar abre agora', () => {
    expect(publishOutcome(t(S.DRAFT), AGORA)).toEqual({ status: S.REGISTRATIONS_OPEN, opensNow: true });
  });
  it('com abertura futura, fica publicado esperando', () => {
    expect(publishOutcome(t(S.DRAFT, { registration_opens_ms: AGORA + H }), AGORA).status).toBe(S.PUBLISHED);
  });
  it('com o encerramento vencido, publica encerrado', () => {
    expect(publishOutcome(t(S.DRAFT, { registration_closes_ms: AGORA - H }), AGORA).status).toBe(S.REGISTRATIONS_CLOSED);
  });
});

describe('scheduleProblems', () => {
  it('aceita datas coerentes e o vazio', () => {
    expect(scheduleProblems({})).toEqual([]);
    expect(scheduleProblems({ opens: AGORA, closes: AGORA + H, payment: AGORA + H })).toEqual([]);
  });
  it('recusa encerramento antes da abertura e pagamento antes do encerramento', () => {
    expect(scheduleProblems({ opens: AGORA, closes: AGORA })).toHaveLength(1);
    expect(scheduleProblems({ closes: AGORA, payment: AGORA - 1 })).toHaveLength(1);
    expect(scheduleProblems({ payment: AGORA })).toHaveLength(1);
  });
});

describe('campo datetime-local', () => {
  it('ida e volta pela hora do aparelho', () => {
    const v = '2026-11-07T19:30';
    const ms = localInputToMs(v);
    expect(msToLocalInput(ms)).toBe(v);
    expect(msToLocalDate(ms)).toBe('2026-11-07');
  });
  it('vazio e lixo viram nada', () => {
    expect(localInputToMs('')).toBe(null);
    expect(localInputToMs('amanhã')).toBe(null);
    expect(msToLocalInput(null)).toBe('');
    expect(msToLocalDate(undefined)).toBe(null);
  });
});

describe('abrir e encerrar à mão', () => {
  it('abrir agora puxa a abertura marcada no futuro para agora', () => {
    expect(statusPatchForManualChange(t(S.PUBLISHED, { registration_opens_ms: AGORA + H }), S.REGISTRATIONS_OPEN, AGORA))
      .toEqual({ status: S.REGISTRATIONS_OPEN, registration_opens_ms: AGORA });
    expect(statusPatchForManualChange(t(S.PUBLISHED, { registration_opens_ms: AGORA - H }), S.REGISTRATIONS_OPEN, AGORA))
      .toEqual({ status: S.REGISTRATIONS_OPEN });
  });
  it('não reabre com o encerramento vencido', () => {
    expect(statusPatchForManualChange(t(S.REGISTRATIONS_CLOSED, { registration_closes_ms: AGORA - 1 }), S.REGISTRATIONS_OPEN, AGORA).erro).toBeTruthy();
  });
  it('encerrar agora grava o encerramento e o dia antigo', () => {
    const p = statusPatchForManualChange(t(S.REGISTRATIONS_OPEN, { registration_closes_ms: AGORA + H }), S.REGISTRATIONS_CLOSED, AGORA);
    expect(p).toMatchObject({ status: S.REGISTRATIONS_CLOSED, registration_closes_ms: AGORA, registration_deadline: msToLocalDate(AGORA) });
    expect(statusPatchForManualChange(t(S.REGISTRATIONS_OPEN, { registration_closes_ms: AGORA - H }), S.REGISTRATIONS_CLOSED, AGORA))
      .toEqual({ status: S.REGISTRATIONS_CLOSED });
  });
});

describe('registrationBlockReason', () => {
  it('só a janela aberta deixa passar, e cada caso diz o motivo', () => {
    expect(registrationBlockReason(t(S.REGISTRATIONS_OPEN), AGORA)).toBe(null);
    expect(registrationBlockReason(t(S.DRAFT), AGORA)).toMatch(/publicado/);
    expect(registrationBlockReason(t(S.PUBLISHED, { registration_opens_ms: AGORA + H }), AGORA)).toMatch(/não abriram/);
    expect(registrationBlockReason(t(S.REGISTRATIONS_OPEN, { registration_closes_ms: AGORA - 1 }), AGORA)).toMatch(/encerradas/);
  });
});

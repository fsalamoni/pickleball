import { describe, expect, it } from 'vitest';
import { computeTournamentOps } from './ops.js';
import { MATCH_STATUS, REGISTRATION_STATUS, TOURNAMENT_STATUS } from './constants.js';

const MODALITIES = [
  { id: 'm1', name: 'Duplas Mistas' },
  { id: 'm2', name: 'Simples Masculino' },
];

function reg(modality, status, extra = {}) {
  return { modality_id: modality, status, ...extra };
}

function match(modality, status, extra = {}) {
  return { modality_id: modality, status, ...extra };
}

describe('computeTournamentOps', () => {
  it('retorna zeros para entradas vazias', () => {
    const ops = computeTournamentOps({});
    expect(ops.registrations.total).toBe(0);
    expect(ops.matches.total).toBe(0);
    expect(ops.matches.completionPct).toBe(0);
    expect(ops.perModality).toEqual([]);
    expect(ops.alerts).toEqual([]);
  });

  it('conta inscrições por status e trata check-in como confirmada', () => {
    const ops = computeTournamentOps({
      modalities: MODALITIES,
      registrations: [
        reg('m1', REGISTRATION_STATUS.CONFIRMED),
        reg('m1', REGISTRATION_STATUS.CHECKED_IN),
        reg('m1', REGISTRATION_STATUS.PENDING_PAYMENT, { payment_declared_at: { seconds: 1 } }),
        reg('m2', REGISTRATION_STATUS.PENDING_PAYMENT),
        reg('m2', REGISTRATION_STATUS.WAITLIST),
        reg('m2', REGISTRATION_STATUS.CANCELLED),
      ],
    });
    expect(ops.registrations.total).toBe(6);
    expect(ops.registrations.confirmed).toBe(2);
    expect(ops.registrations.checkedIn).toBe(1);
    expect(ops.registrations.pendingPayment).toBe(2);
    expect(ops.registrations.paymentDeclared).toBe(1);
    expect(ops.registrations.waitlist).toBe(1);
    expect(ops.registrations.cancelled).toBe(1);
  });

  it('ignora inscrições fictícias (placeholder)', () => {
    const ops = computeTournamentOps({
      registrations: [
        reg('m1', REGISTRATION_STATUS.CONFIRMED, { is_placeholder: true }),
        reg('m1', REGISTRATION_STATUS.CONFIRMED),
      ],
    });
    expect(ops.registrations.total).toBe(1);
  });

  it('conta jogos, % de conclusão e não agendados; WO conta como concluído', () => {
    const ops = computeTournamentOps({
      matches: [
        match('m1', MATCH_STATUS.FINISHED, { scheduled_at: 'x' }),
        match('m1', MATCH_STATUS.WALKOVER, { scheduled_at: 'x' }),
        match('m1', MATCH_STATUS.IN_PROGRESS, { scheduled_at: 'x' }),
        match('m1', MATCH_STATUS.SCHEDULED),
        match('m1', MATCH_STATUS.CANCELLED),
      ],
    });
    expect(ops.matches.total).toBe(4);
    expect(ops.matches.done).toBe(2);
    expect(ops.matches.inProgress).toBe(1);
    expect(ops.matches.pending).toBe(1);
    expect(ops.matches.unscheduled).toBe(1);
    expect(ops.matches.completionPct).toBe(50);
  });

  it('quebra os contadores por modalidade', () => {
    const ops = computeTournamentOps({
      modalities: MODALITIES,
      registrations: [reg('m1', REGISTRATION_STATUS.CONFIRMED), reg('m2', REGISTRATION_STATUS.CONFIRMED)],
      matches: [match('m1', MATCH_STATUS.FINISHED, { scheduled_at: 'x' })],
    });
    const m1 = ops.perModality.find((m) => m.id === 'm1');
    const m2 = ops.perModality.find((m) => m.id === 'm2');
    expect(m1.matches.total).toBe(1);
    expect(m2.matches.total).toBe(0);
    expect(m1.registrations.confirmed).toBe(1);
  });

  it('gera alertas de pagamento pendente, lista de espera e jogos sem horário', () => {
    const ops = computeTournamentOps({
      registrations: [
        reg('m1', REGISTRATION_STATUS.PENDING_PAYMENT, { payment_declared_at: { seconds: 1 } }),
        reg('m1', REGISTRATION_STATUS.WAITLIST),
      ],
      matches: [match('m1', MATCH_STATUS.SCHEDULED)],
    });
    const texts = ops.alerts.map((a) => a.text).join(' | ');
    expect(texts).toContain('aguardando confirmação de pagamento');
    expect(texts).toContain('já declararam ter pago');
    expect(texts).toContain('lista de espera');
    expect(texts).toContain('sem data/horário');
  });

  it('alerta modalidade sem sorteio apenas com torneio em andamento', () => {
    const base = {
      modalities: MODALITIES,
      registrations: [reg('m1', REGISTRATION_STATUS.CONFIRMED)],
      matches: [],
    };
    const before = computeTournamentOps({ ...base, tournament: { status: TOURNAMENT_STATUS.REGISTRATIONS_OPEN } });
    expect(before.alerts.some((a) => a.text.includes('sem sorteio'))).toBe(false);
    const during = computeTournamentOps({ ...base, tournament: { status: TOURNAMENT_STATUS.IN_PROGRESS } });
    expect(during.alerts.some((a) => a.text.includes('Duplas Mistas'))).toBe(true);
  });
});

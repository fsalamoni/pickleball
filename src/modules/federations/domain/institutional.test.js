import { describe, it, expect } from 'vitest';
import {
  certificateState, certificateWarnStep, certificatesSummary, incentiveIncome, incentiveProjectState, incentiveTransition, safeguardingAnnualReport, validateCertificate,
} from './institutional';
import { complianceChecklist } from './compliance';

describe('certidões', () => {
  it('estado e passo de aviso pela validade', () => {
    const c = { kind: 'fgts', valid_until: '2026-11-22' };
    expect(certificateState(c, '2026-10-01')).toEqual({ state: 'valid', daysLeft: 52 });
    expect(certificateState(c, '2026-10-23')).toEqual({ state: 'expiring', daysLeft: 30 });
    expect(certificateState(c, '2026-11-23').state).toBe('expired');
    expect(certificateWarnStep(c, '2026-10-01')).toBeNull();
    expect(certificateWarnStep(c, '2026-10-30')).toBe(30);
    expect(certificateWarnStep(c, '2026-11-20')).toBe(7);
    expect(certificateWarnStep({ ...c, warned_steps: [30, 7] }, '2026-11-21')).toBe(1);
    expect(certificateWarnStep({ ...c, warned_steps: [0] }, '2026-12-01')).toBeNull();
  });

  it('a atual de cada tipo é a de validade mais longa; "outra" vale pelo nome', () => {
    const s = certificatesSummary([
      { id: 'a', kind: 'cnd_federal', valid_until: '2026-01-01' },
      { id: 'b', kind: 'cnd_federal', valid_until: '2027-01-01' },
      { id: 'c', kind: 'other', label: 'Alvará', valid_until: '2026-10-01' },
      { id: 'd', kind: 'other', label: 'Bombeiros', valid_until: '2027-10-01' },
    ], '2026-10-23');
    expect(s.current.map((x) => x.id)).toEqual(['c', 'b', 'd']);
    expect(s.expired.map((x) => x.id)).toEqual(['c']);
  });

  it('valida tipo, nome da "outra" e datas', () => {
    expect(validateCertificate({ kind: 'other', label: 'a', issued_at: '2026-10-10', valid_until: '2026-10-01' }).errors).toMatchObject({ label: expect.any(String), valid_until: expect.any(String) });
    expect(validateCertificate({ kind: 'fgts', label: 'ignorado', issued_at: '2026-10-01', valid_until: '2026-11-01' })).toMatchObject({ ok: true, value: { label: '' } });
  });
});

describe('Lei de Incentivo', () => {
  const P = { id: 'p', title: 'Escolas', status: 'capturing', approved_cents: 100000, capture_until: '2026-11-15', receipts: [
    { id: 'r1', donor_name: 'A', amount_cents: 30000, date: '2026-10-01' },
    { id: 'r2', donor_name: 'B', amount_cents: 999, date: '2026-10-03', voided_at: '2026-10-04' },
  ] };
  it('captado sem o estornado, faltando e aviso de fim de captação', () => {
    expect(incentiveProjectState(P, '2026-10-23')).toMatchObject({ captured_cents: 30000, remaining_cents: 70000, pct: 30, donors: 1, captureDaysLeft: 23, captureEnding: true });
    expect(incentiveProjectState({ ...P, status: 'executing' }, '2026-10-23').captureEnding).toBe(false);
  });
  it('uma etapa de cada vez; com aporte não cancela', () => {
    expect(incentiveTransition(P, 'executing')).toEqual({ ok: true, back: false });
    expect(incentiveTransition({ ...P, status: 'reporting' }, 'executing')).toEqual({ ok: true, back: true });
    expect(incentiveTransition(P, 'reporting').ok).toBe(false);
    expect(incentiveTransition(P, 'cancelled').ok).toBe(false);
    expect(incentiveTransition({ ...P, receipts: [] }, 'cancelled')).toEqual({ ok: true, back: false });
  });
  it('a receita derivada ignora estorno e projeto cancelado', () => {
    expect(incentiveIncome([P, { ...P, id: 'q', status: 'cancelled' }])).toEqual([expect.objectContaining({ ref: 'incentive:p:r1', amount_cents: 30000, category: 'grants' })]);
  });
});

describe('relatório de proteção da infância', () => {
  it('só números; fonte que falhou é nula, nunca zero', () => {
    const rows = [
      { roles: ['coach'], required: true, ok: true, training_ok: true, background: { valid: true } },
      { roles: ['referee', 'coach'], required: true, ok: false, training_ok: true, background: { valid: false }, pending: { issued_at: 'x' } },
      { roles: ['staff'], required: false, ok: false },
    ];
    const reports = [
      { kind: 'minor_protection', status: 'open', anonymous: true, created_at_ms: Date.UTC(2026, 3, 1) },
      { kind: 'minor_protection', status: 'closed', created_at_ms: Date.UTC(2026, 5, 1) },
      { kind: 'minor_protection', status: 'closed', created_at_ms: Date.UTC(2025, 5, 1) },
      { kind: 'conduct', status: 'open', created_at_ms: Date.UTC(2026, 5, 1) },
    ];
    const r = safeguardingAnnualReport({ rows, reports, year: 2026 });
    expect(r.staff).toEqual({ people: 3, required: 2, cleared: 1, pendingReview: 1, trainingOk: 2, backgroundOk: 1, byRole: { coach: 2, referee: 1, director: 0, staff: 1, ambassador: 0 } });
    expect(r.reports).toEqual({ received: 2, open: 1, inReview: 0, closed: 1, anonymous: 1 });
    expect(JSON.stringify(r)).not.toMatch(/name/);
    expect(safeguardingAnnualReport({ year: 2026 })).toEqual({ year: 2026, staff: null, reports: null });
  });
});

describe('conformidade: certidões', () => {
  const fed = { modules: { certificates: true } };
  const item = (certificates) => complianceChecklist({ federation: fed, certificates, nowMs: Date.UTC(2026, 9, 23, 15) }).find((x) => x.id === 'certificates');
  it('só com o módulo; sem leitura é "não deu para conferir"; vencida ou faltando pede atenção', () => {
    expect(complianceChecklist({ federation: {}, certificates: [] }).find((x) => x.id === 'certificates')).toBeUndefined();
    expect(item(undefined).status).toBe('unknown');
    expect(item([]).status).toBe('attention');
    const tres = ['cnd_federal', 'fgts', 'cndt'].map((kind) => ({ kind, valid_until: '2027-06-01' }));
    expect(item(tres).status).toBe('ok');
    expect(item([...tres, { kind: 'fgts', valid_until: '2026-01-01' }]).status).toBe('ok');
    expect(item([{ ...tres[0], valid_until: '2026-10-01' }, tres[1], tres[2]]).status).toBe('attention');
  });
});

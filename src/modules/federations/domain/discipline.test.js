import { describe, it, expect } from 'vitest';
import { activeSanctions, canAppeal, endOfDayBrMs, isDisciplineSuspended, protocolToId, reportProtocol, sanctionInForce, sortSanctions, validateReportInput, validateSanctionInput } from './discipline.js';

describe('validateSanctionInput', () => {
  it('suspensão exige fim; multa exige valor; motivo mínimo', () => {
    expect(validateSanctionInput({ kind: 'suspension', reason: 'Agressão verbal ao árbitro', starts_at: '2026-06-01' }).errors.ends_at).toBeTruthy();
    expect(validateSanctionInput({ kind: 'fine', reason: 'Agressão verbal ao árbitro' }).errors.fine_cents).toBeTruthy();
    expect(validateSanctionInput({ kind: 'warning', reason: 'curto' }).errors.reason).toBeTruthy();
    const r = validateSanctionInput({ kind: 'suspension', reason: 'Agressão verbal ao árbitro', starts_at: '2026-06-01', ends_at: '2026-07-01', fine_cents: 999 });
    expect(r.ok).toBe(true);
    expect(r.value.fine_cents).toBe(0);
    expect(validateSanctionInput({ kind: 'warning', reason: 'Agressão verbal ao árbitro', ends_at: '2030-01-01' }, { hoje: '2026-06-01' }).value).toMatchObject({ starts_at: '2026-06-01', ends_at: '' });
  });
});

describe('efeito', () => {
  it('fim do dia em Brasília', () => {
    expect(new Date(endOfDayBrMs('2026-06-01')).toISOString()).toBe('2026-06-02T02:59:59.999Z');
    expect(endOfDayBrMs('')).toBe(0);
  });
  it('suspensão vale no intervalo; exclusão sempre; advertência nunca bloqueia', () => {
    const s = { kind: 'suspension', status: 'active', starts_at: '2026-06-01', ends_at: '2026-06-30' };
    expect(sanctionInForce(s, '2026-06-15')).toBe(true);
    expect(sanctionInForce(s, '2026-07-01')).toBe(false);
    expect(sanctionInForce({ ...s, status: 'overturned' }, '2026-06-15')).toBe(false);
    expect(sanctionInForce({ kind: 'exclusion', status: 'active' })).toBe(true);
    expect(sanctionInForce({ kind: 'warning', status: 'active' })).toBe(false);
    expect(activeSanctions([s, { kind: 'warning', status: 'active' }], '2026-06-15').length).toBe(1);
  });
  it('o campo da filiação decide a suspensão agora', () => {
    expect(isDisciplineSuspended({ discipline_until_ms: 10 }, 5)).toBe(true);
    expect(isDisciplineSuspended({ discipline_until_ms: 10 }, 10)).toBe(false);
    expect(isDisciplineSuspended({}, 5)).toBe(false);
  });
  it('recurso uma vez, enquanto em vigor', () => {
    expect(canAppeal({ status: 'active' })).toBe(true);
    expect(canAppeal({ status: 'active', appeal: 'x' })).toBe(false);
    expect(canAppeal({ status: 'upheld' })).toBe(false);
  });
  it('em vigor primeiro', () => {
    const r = sortSanctions([{ kind: 'warning', status: 'active', created_at_ms: 9 }, { kind: 'exclusion', status: 'active', created_at_ms: 1 }]);
    expect(r[0].kind).toBe('exclusion');
  });
});

describe('ouvidoria', () => {
  it('corpo mínimo e anônimo', () => {
    expect(validateReportInput({ body: 'curto' }).errors.body).toBeTruthy();
    const r = validateReportInput({ kind: 'referee', body: 'O árbitro da quadra 2 não aplicou a regra do saque.', anonymous: true });
    expect(r.ok).toBe(true);
    expect(r.value.anonymous).toBe(true);
    expect(validateReportInput({ kind: 'xpto', body: 'O árbitro da quadra 2 não aplicou a regra do saque.' }).value.kind).toBe('other');
  });
  it('protocolo ida e volta', () => {
    expect(reportProtocol('abcdefghij')).toBe('ABCD-EFGH-IJ');
    expect(protocolToId('ABCD-EFGH-IJ')).toBe('ABCDEFGHIJ');
    expect(protocolToId('ab')).toBe('');
  });
});

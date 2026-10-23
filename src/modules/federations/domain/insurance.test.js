import { describe, it, expect } from 'vitest';
import {
  INSURANCE_LIMITS, termVersion, validateInsuranceTerm, termRequired, termState, termAcceptancePatch,
  validateCertificateRequest, certificateIssueError, certificateState, publicCertificateVerification,
} from './insurance.js';

const TERMO = 'Declaro estar ciente de que o seguro esportivo cobre acidentes em treinos e eventos.';
const FED = { name: 'Federação', acronym: 'FGP', slug: 'fgp', modules: { insurance: true }, insurance: { insurer: 'X', policy: 'AP-1', valid_from: '2026-01-01', valid_until: '2026-12-31', covers: 'active_members', require_term: true, term_text: TERMO } };
const HOJE = '2026-10-23';

describe('termo do seguro', () => {
  it('a versão é estável ao espaço e muda com o texto', () => {
    expect(termVersion(TERMO)).toMatch(/^[0-9a-f]{8}$/);
    expect(termVersion(`  ${TERMO.replace(/ /g, '   ')} `)).toBe(termVersion(TERMO));
    expect(termVersion(`${TERMO}!`)).not.toBe(termVersion(TERMO));
    expect(termVersion('')).toBe('');
  });

  it('ligado exige texto; desligado não', () => {
    expect(validateInsuranceTerm({ require_term: true, term_text: 'curto' }).ok).toBe(false);
    expect(validateInsuranceTerm({ require_term: true, term_text: TERMO }).ok).toBe(true);
    expect(validateInsuranceTerm({ term_text: 'curto' })).toMatchObject({ ok: true, value: { require_term: false } });
  });

  it('só pessoa, só com o módulo e o termo; só de filiados ⇒ o cadastrado não', () => {
    expect(termRequired(FED)).toBe(true);
    expect(termRequired(FED, { entity: 'club' })).toBe(false);
    expect(termRequired({ ...FED, modules: {} })).toBe(false);
    expect(termRequired({ ...FED, insurance: { ...FED.insurance, require_term: false } })).toBe(false);
    const soFiliados = { ...FED, insurance: { ...FED.insurance, covers: 'federated_only' } };
    expect(termRequired(soFiliados, { tier: 'registered' })).toBe(false);
    expect(termRequired(soFiliados, { tier: 'federated' })).toBe(true);
  });

  it('o estado: aceitou a de hoje, uma antiga, nenhuma; a organização não precisa', () => {
    const v = termVersion(TERMO);
    expect(termState({ tier: 'federated' }, FED)).toMatchObject({ required: true, accepted: false, outdated: false, version: v });
    expect(termState({ insurance_term: { version: v, accepted_at_ms: 5 } }, FED)).toMatchObject({ accepted: true, accepted_at_ms: 5 });
    expect(termState({ insurance_term: { version: 'velha' } }, FED)).toMatchObject({ accepted: false, outdated: true });
    expect(termState({ org_kind: 'club' }, FED).required).toBe(false);
  });

  it('o aceite guarda os últimos 10', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({ version: String(i) }));
    const p = termAcceptancePatch({ insurance_term_log: log }, 'nova', 'ana', 99);
    expect(p.insurance_term).toEqual({ version: 'nova', accepted_at_ms: 99, by: 'ana' });
    expect(p.insurance_term_log).toHaveLength(INSURANCE_LIMITS.LOG_MAX);
    expect(p.insurance_term_log.at(-1).version).toBe('nova');
  });
});

describe('certificado do evento', () => {
  const EV = { event_name: 'Festival', venue: 'Arena Sul', city: 'POA', date_from: '2026-11-20', participants: 40 };

  it('valida o pedido: fim igual ao início, passado, ordem, até 31 dias, participantes', () => {
    expect(validateCertificateRequest(EV, HOJE)).toMatchObject({ ok: true, value: { date_to: '2026-11-20' } });
    expect(validateCertificateRequest({ ...EV, date_from: '2026-10-01' }, HOJE).errors.date_from).toBeTruthy();
    expect(validateCertificateRequest({ ...EV, date_to: '2026-11-19' }, HOJE).errors.date_to).toBeTruthy();
    expect(validateCertificateRequest({ ...EV, date_to: '2026-12-21' }, HOJE).errors.date_to).toBeTruthy();
    expect(validateCertificateRequest({ ...EV, date_to: '2026-12-20' }, HOJE).ok).toBe(true);
    expect(validateCertificateRequest({ ...EV, participants: 0 }, HOJE).errors.participants).toBeTruthy();
  });

  it('só emite com a apólice em vigor cobrindo as datas', () => {
    const ins = FED.insurance;
    expect(certificateIssueError(null, EV, HOJE)).toBeTruthy();
    expect(certificateIssueError({ ...ins, valid_until: '2026-10-01' }, EV, HOJE)).toBeTruthy();
    expect(certificateIssueError({ ...ins, valid_from: '2026-12-01' }, EV, HOJE)).toBeTruthy();
    expect(certificateIssueError(ins, { ...EV, date_to: '2027-01-02' }, HOJE)).toBeTruthy();
    expect(certificateIssueError(ins, EV, HOJE)).toBeNull();
  });

  it('o emitido vira encerrado depois do evento; a verificação diz o mínimo', () => {
    const cert = { status: 'issued', org_name: 'Clube Um', event: { ...EV, date_to: '2026-11-21' }, policy: { insurer: 'X', policy: 'AP-1', valid_until: '2026-12-31' }, issued_at_ms: 7, requested_by: 'ze' };
    expect(certificateState(cert, HOJE)).toBe('issued');
    expect(certificateState(cert, '2026-11-22')).toBe('expired');
    const pub = publicCertificateVerification(cert, FED, HOJE);
    expect(pub).toMatchObject({ status: 'valid', org_name: 'Clube Um', policy: { number: 'AP-1' }, event: { participants: 40 } });
    expect(JSON.stringify(pub)).not.toContain('ze');
    expect(publicCertificateVerification({ ...cert, status: 'cancelled' }, FED, HOJE).status).toBe('cancelled');
    expect(publicCertificateVerification(cert, FED, '2026-12-01').status).toBe('expired');
  });
});

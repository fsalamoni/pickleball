/**
 * PARIDADE cliente × servidor do seguro: a tela mostra o mesmo termo, a mesma
 * validação do pedido e a mesma conferência da apólice que o servidor grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/insurance.js';

const require = createRequire(import.meta.url);
const s = require('./federationInsurancePolicy.js');

const TERMO = 'Declaro estar ciente de que o seguro esportivo cobre acidentes em treinos e eventos.';
const INS = { insurer: 'X', policy: 'AP-1', valid_from: '2026-01-01', valid_until: '2026-12-31', covers: 'active_members', require_term: true, term_text: TERMO };
const FEDS = [
  {},
  { modules: { insurance: true }, insurance: INS },
  { modules: { insurance: true }, insurance: { ...INS, covers: 'federated_only' } },
  { modules: {}, insurance: INS },
];
const MEMBROS = [{}, { tier: 'registered' }, { org_kind: 'club' }, { insurance_term: { version: c.termVersion(TERMO), accepted_at_ms: 3 } }, { insurance_term: { version: 'x' } }];
const PEDIDOS = [
  {},
  { event_name: 'Festival', venue: 'Arena', city: 'POA', date_from: '2026-11-20', participants: 10 },
  { event_name: 'Festival', venue: 'Arena', city: 'POA', date_from: '2026-11-20', date_to: '2026-12-25', participants: 10 },
  { event_name: 'F', venue: 'A', city: 'P', date_from: '2026-10-01', participants: 9999 },
];
const HOJES = ['2026-10-23', '2026-11-25'];

describe('paridade: seguro', () => {
  it('os mesmos enums e tetos', () => {
    expect(s.INSURANCE_LIMITS).toEqual(c.INSURANCE_LIMITS);
    expect(s.CERT_STATUS).toEqual(c.CERT_STATUS);
  });

  it('termo: versão, validação, exigência, estado e aceite', () => {
    for (const txt of ['', TERMO, `  ${TERMO} `, 'curto']) {
      expect(s.termVersion(txt)).toBe(c.termVersion(txt));
      expect(s.validateInsuranceTerm({ require_term: true, term_text: txt })).toEqual(c.validateInsuranceTerm({ require_term: true, term_text: txt }));
    }
    for (const f of FEDS) {
      for (const tier of ['federated', 'registered']) expect(s.termRequired(f, { tier })).toBe(c.termRequired(f, { tier }));
      for (const m of MEMBROS) expect(s.termState(m, f)).toEqual(c.termState(m, f));
    }
    expect(s.termAcceptancePatch({ insurance_term_log: [{ version: 'a' }] }, 'b', 'u', 9)).toEqual(c.termAcceptancePatch({ insurance_term_log: [{ version: 'a' }] }, 'b', 'u', 9));
  });

  it('certificado: pedido, conferência da apólice, estado e verificação', () => {
    for (const hoje of HOJES) {
      for (const p of PEDIDOS) {
        expect(s.validateCertificateRequest(p, hoje)).toEqual(c.validateCertificateRequest(p, hoje));
        for (const ins of [null, INS, { ...INS, valid_until: '2026-11-01' }]) expect(s.certificateIssueError(ins, p, hoje)).toEqual(c.certificateIssueError(ins, p, hoje));
      }
      for (const status of ['requested', 'issued', 'cancelled']) {
        const cert = { status, org_name: 'C', event: { event_name: 'F', date_from: '2026-11-20', date_to: '2026-11-21', participants: 5 }, policy: { insurer: 'X', policy: 'AP' }, issued_at_ms: 1 };
        expect(s.certificateState(cert, hoje)).toBe(c.certificateState(cert, hoje));
        expect(s.publicCertificateVerification(cert, { name: 'F' }, hoje)).toEqual(c.publicCertificateVerification(cert, { name: 'F' }, hoje));
      }
    }
  });
});

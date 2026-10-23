/**
 * PARIDADE cliente × servidor do cofre de certidões e dos projetos da Lei de
 * Incentivo (rodada 3, Bloco 2): a tela valida, conta e mostra o mesmo que o
 * servidor grava (`federationInstitutionalPolicy.js` é cópia de
 * `domain/institutional.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/institutional.js';

const require = createRequire(import.meta.url);
const s = require('./federationInstitutionalPolicy.js');

const DATAS = ['2026-01-01', '2026-10-23', '2026-11-14', '2026-11-15', '2026-11-16', '2027-06-01'];
const CERTS = [
  { id: 'a', kind: 'cnd_federal', valid_until: '2026-11-22', created_at_ms: 1 },
  { id: 'b', kind: 'cnd_federal', valid_until: '2026-05-01', created_at_ms: 2 },
  { id: 'c', kind: 'fgts', valid_until: '2026-10-24', warned_steps: [30] },
  { id: 'd', kind: 'other', label: 'Alvará', valid_until: '2026-10-01' },
  { id: 'e', kind: 'other', label: ' alvará ', valid_until: '2026-10-02' },
  { id: 'f', kind: 'cndt', valid_until: 'x' },
];
const PROJ = {
  id: 'p', title: 'Escolas', status: 'capturing', approved_cents: 100000, capture_until: '2026-11-15',
  receipts: [{ id: 'r1', donor_name: 'A', amount_cents: 30000, date: '2026-10-01' }, { id: 'r2', donor_name: 'a', amount_cents: 10000, date: '2026-10-02' }, { id: 'r3', donor_name: 'B', amount_cents: 999, date: '2026-10-03', voided_at: '2026-10-04' }],
};

describe('paridade: certidões e Lei de Incentivo', () => {
  it('os mesmos enums e tetos', () => {
    ['CERT_KINDS', 'CERT_WARN_DAYS', 'INCENTIVE_STATUS', 'INCENTIVE_FLOW', 'ACCOUNTABILITY_RESULTS', 'RECEIPT_KINDS'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['AMOUNT_MAX', 'CERT_NOTE_MAX', 'INCENTIVE_CAPTURE_WARN_DAYS', 'RECEIPTS_MAX', 'INCENTIVE_NOTES_MAX'].forEach((k) => expect(s[k], k).toBe(c[k]));
    expect(s.CERT_KIND_LABELS).toEqual({ ...c.CERT_KIND_LABELS });
  });

  it('a mesma certidão, a mesma atual e os mesmos avisos', () => {
    [{}, { kind: 'other', label: 'ab', issued_at: '2026-10-10', valid_until: '2026-10-01' }, { kind: 'fgts', issued_at: '2026-10-01', valid_until: '2026-11-01', number: ' 1 ', note: 'x' }]
      .forEach((x) => expect(s.validateCertificate(x)).toEqual(c.validateCertificate(x)));
    CERTS.forEach((x) => expect(s.certSlot(x)).toBe(c.certSlot(x)));
    expect(s.currentCertificates(CERTS)).toEqual(c.currentCertificates(CERTS));
    DATAS.forEach((d) => {
      expect(s.certificatesSummary(CERTS, d)).toEqual(c.certificatesSummary(CERTS, d));
      CERTS.forEach((x) => {
        expect(s.certificateState(x, d)).toEqual(c.certificateState(x, d));
        expect(s.certificateWarnStep(x, d)).toBe(c.certificateWarnStep(x, d));
      });
    });
  });

  it('o mesmo projeto, o mesmo aporte, a mesma situação, o mesmo fluxo e a mesma receita', () => {
    [{}, { title: ' X ', approved_cents: -5, exec_start: '2027-02-01', exec_end: '2027-01-01' }, PROJ]
      .forEach((x) => expect(s.validateIncentiveProject(x)).toEqual(c.validateIncentiveProject(x)));
    [{}, { donor_name: 'A', amount_cents: 10, date: '2026-12-01', kind: 'outro' }, PROJ.receipts[0]]
      .forEach((x) => expect(s.validateIncentiveReceipt(x, '2026-10-23')).toEqual(c.validateIncentiveReceipt(x, '2026-10-23')));
    DATAS.forEach((d) => expect(s.incentiveProjectState(PROJ, d)).toEqual(c.incentiveProjectState(PROJ, d)));
    ['capturing', 'executing', 'reporting', 'closed', 'cancelled'].forEach((de) => ['capturing', 'executing', 'reporting', 'closed', 'cancelled'].forEach((para) => {
      [PROJ, { ...PROJ, receipts: [] }].forEach((p) => expect(s.incentiveTransition({ ...p, status: de }, para)).toEqual(c.incentiveTransition({ ...p, status: de }, para)));
    }));
    const lista = [PROJ, { ...PROJ, id: 'q', status: 'cancelled' }, { ...PROJ, id: 'z', title: 'Outro', receipts: [{ id: 'x', donor_name: 'C', amount_cents: 5, date: '2026-01-01' }] }];
    expect(s.incentiveIncome(lista)).toEqual(c.incentiveIncome(lista));
  });

  it('as mesmas permissões', () => {
    [[], ['finance'], ['fiscal'], ['admin'], ['members']].forEach((p) => {
      expect(s.canManageInstitutional(p)).toBe(c.canManageInstitutional(p));
      expect(s.canViewInstitutional(p)).toBe(c.canViewInstitutional(p));
    });
  });
});

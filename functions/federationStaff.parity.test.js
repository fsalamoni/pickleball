/**
 * PARIDADE cliente × servidor da equipe da federação: o que a tela diz antes
 * (cargo, permissões, mandato, quem pode mexer em quem) é o que o servidor
 * (`federationStaff.js`) confere depois. A regra do Firestore tem a mesma
 * conta em `fedPerms`/`fedRolePerms`.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/staff.js';
import { STAFF_ROLE_PERMISSIONS, STAFF_TERM_MAX_MONTHS } from '@/modules/federations/domain/constants.js';

const require = createRequire(import.meta.url);
const s = require('./federationStaffPolicy.js');

const AGORA = Date.UTC(2026, 9, 21, 15);
const DOCS = [
  null,
  { user_id: 'a', role: 'president' },
  { user_id: 'b', role: 'secretary' },
  { user_id: 'c', role: 'cons', perms: ['members', 'staff'], is_master: false, term_end_ms: AGORA + 1 },
  { user_id: 'd', role: 'cons', perms: ['members', 'staff'], is_master: false, term_end_ms: AGORA - 1 },
  { user_id: 'e', role: 'vice', perms: s.ALL, is_master: true, term_end_ms: AGORA - 1 },
  { user_id: 'f', role: 'president', is_master: false, perms: ['finance'] },
  { user_id: 'g', role: 'x', perms: ['staff', 'members', 'finance', 'comms'], is_master: false, term_end_ms: 0 },
];
const CARGOS = [null, { id: 'm', perms: s.ALL, is_master: true }, { id: 's', perms: ['members'], is_master: false }, { id: 'f', perms: ['members', 'finance'], is_master: false }, { id: 't', perms: s.ALL, is_master: false }];

describe('paridade da equipe', () => {
  it('as mesmas permissões e os mesmos modelos', () => {
    expect(s.ALL).toEqual(c.ALL_PERMISSIONS);
    expect(s.PERMS).toEqual(Object.fromEntries(Object.entries(STAFF_ROLE_PERMISSIONS).map(([k, v]) => [k, [...v]])));
    expect(s.TERM_MAX_MONTHS).toBe(STAFF_TERM_MAX_MONTHS);
    expect(s.ROLES_MAX).toBe(c.STAFF_ROLES_MAX);
    expect(s.DEFAULT_ROLES.map((r) => ({ ...r, perms: [...r.perms] }))).toEqual(c.DEFAULT_STAFF_ROLES.map((r) => ({ ...r, perms: [...r.perms] })));
  });

  it('master, mandato e permissões', () => {
    DOCS.forEach((d) => {
      expect(s.isMaster(d)).toBe(c.staffIsMaster(d));
      expect(s.termActive(d, AGORA)).toBe(c.staffTermActive(d, AGORA));
      if (d) expect(s.permsOf(d, AGORA)).toEqual(c.staffPerms(d, AGORA));
    });
  });

  it('quem pode mexer em quem, e o último master', () => {
    DOCS.filter(Boolean).forEach((actor) => DOCS.forEach((target) => CARGOS.forEach((role) => {
      expect(s.allowed({ actor, target, role, now: AGORA })).toBe(c.staffActionAllowed({ actor, target, role, nowMs: AGORA }));
    })));
    const equipe = DOCS.filter(Boolean);
    equipe.forEach((alvo) => expect(s.isLastMaster(alvo, equipe)).toBe(c.isLastMaster(alvo, equipe)));
    expect(s.allowed({ actor: null, now: AGORA })).toBe(false);
  });

  it('validação do cargo e do mandato', () => {
    const entradas = [
      {}, { name: 'X' }, { name: 'Conselheiro', perms: ['members', 'xpto', 'members'] }, { name: 'Vice', is_master: true, term_months: '24' },
      { id: 'Inválido!', name: 'Vice', perms: ['comms'] }, { id: 'conselho', name: ' Conselho ', description: 'a'.repeat(301), perms: ['comms'], term_months: 121 },
    ];
    entradas.forEach((e) => {
      const a = s.validateRole(e);
      const b = c.validateStaffRole(e);
      expect(a.ok).toBe(b.ok);
      expect(Object.keys(a.errors).sort()).toEqual(Object.keys(b.errors).sort());
      expect(a.value).toEqual(b.value);
    });
    [{}, { term_start: '2026-01-01' }, { term_start: '2026-01-01', term_end: '2025-12-31' }, { term_start: '2026-01-01', term_end: '31/12/2026' }].forEach((e) => {
      const a = s.validateTerm(e);
      const b = c.validateTerm(e);
      expect(a.ok).toBe(b.ok);
      expect(Object.keys(a.errors).sort()).toEqual(Object.keys(b.errors).sort());
    });
  });

  it('acesso de suporte', () => {
    [null, { expires_ms: AGORA }, { expires_ms: AGORA + 1 }].forEach((g) => expect(s.grantActive(g, AGORA)).toBe(c.grantActive(g, AGORA)));
  });
});

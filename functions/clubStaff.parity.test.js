/**
 * PARIDADE cliente × servidor da diretoria do clube: o que a tela diz antes
 * (cargo, permissões, mandato, quem pode mexer em quem) é o que o servidor
 * (`clubStaff.js`) confere depois. A regra do Firestore tem a mesma conta em
 * `cxPerms`/`cxHas`; `clubPermsOf` (associação) é a mesma que `staffPerms`.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/clubs/domain/staff.js';
import { clubPermsOf, ALL_CLUB_PERMS } from '@/modules/clubs/domain/association.js';

const require = createRequire(import.meta.url);
const s = require('./clubStaffPolicy.js');

const AGORA = Date.UTC(2026, 9, 25, 15);
const DOCS = [
  null,
  { user_id: 'a', role: 'president' },
  { user_id: 'b', role: 'secretary', perms: ['members', 'docs'] },
  { user_id: 'c', role: 'cons', perms: ['members', 'staff'], is_master: false, term_end_ms: AGORA + 1 },
  { user_id: 'd', role: 'cons', perms: ['members', 'staff'], is_master: false, term_end_ms: AGORA - 1 },
  { user_id: 'e', role: 'vice', perms: s.ALL, is_master: true, term_end_ms: AGORA - 1 },
  { user_id: 'f', role: 'president', is_master: false, perms: ['finance'] },
  { user_id: 'g', role: 'x', perms: ['staff', 'members', 'finance', 'comms', 'inexistente'], is_master: false, term_end_ms: 0 },
];
const CARGOS = [null, { id: 'm', perms: s.ALL, is_master: true }, { id: 's', perms: ['members'], is_master: false }, { id: 'f', perms: ['members', 'finance'], is_master: false }, { id: 't', perms: s.ALL, is_master: false }];

describe('paridade da diretoria do clube', () => {
  it('as mesmas permissões e os mesmos modelos', () => {
    expect(s.ALL).toEqual(ALL_CLUB_PERMS);
    expect(s.TERM_MAX_MONTHS).toBe(c.STAFF_TERM_MAX_MONTHS);
    expect(s.ROLES_MAX).toBe(c.STAFF_ROLES_MAX);
    expect(s.DEFAULT_ROLES.map((r) => ({ ...r, perms: [...r.perms] }))).toEqual(c.DEFAULT_CLUB_ROLES.map((r) => ({ ...r, perms: [...r.perms] })));
  });

  it('master, mandato e permissões (a regra, o servidor e a associação dizem o mesmo)', () => {
    DOCS.forEach((d) => {
      expect(s.isMaster(d)).toBe(c.staffIsMaster(d));
      expect(s.termActive(d, AGORA)).toBe(c.staffTermActive(d, AGORA));
      expect(s.permsOf(d, AGORA)).toEqual(c.staffPerms(d, AGORA));
      if (d && Array.isArray(d.perms)) expect(clubPermsOf({ staff: d, now: AGORA })).toEqual(c.staffPerms(d, AGORA));
    });
  });

  it('quem pode mexer em quem', () => {
    DOCS.forEach((actor) => DOCS.forEach((target) => CARGOS.forEach((role) => {
      expect(s.allowed({ actor, target, role, now: AGORA })).toBe(c.staffActionAllowed({ actor, target, role, nowMs: AGORA }));
    })));
  });

  it('cargo e mandato validados igual', () => {
    [{ name: 'Ok', perms: ['members'] }, { name: 'x', perms: [] }, { name: 'Mestre', is_master: true }, { id: 'ruim!', name: 'Abc', perms: ['members'], term_months: 200 }, { id: 'bom-1', name: 'Abc', description: 'd'.repeat(301), perms: ['inexistente'] }]
      .forEach((r) => {
        const a = s.validateRole(r);
        const b = c.validateStaffRole(r);
        expect(a.ok).toBe(b.ok);
        expect(Object.keys(a.errors)).toEqual(Object.keys(b.errors));
        expect(a.value).toEqual(b.value);
      });
    [{ term_start: '2026-01-01', term_end: '2027-01-01' }, { term_start: '', term_end: '' }, { term_start: '2026-05-01', term_end: '2026-01-01' }, { term_start: '2026-05-01', term_end: 'x' }]
      .forEach((t) => expect(s.validateTerm(t).ok).toBe(c.validateTerm(t).ok));
  });
});

/**
 * PARIDADE cliente × servidor da seleção do clube: o que a tela valida antes (a convocação, a
 * contagem, o nome público, a trava de proteção) é o que o servidor (`clubSelection.js`) confere depois.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/clubs/domain/selection.js';

const require = createRequire(import.meta.url);
const s = require('./clubSelectionPolicy.js');

const ENTRADAS = [
  undefined, null, {},
  { title: 'Seleção', event_name: 'Interclubes', starts_at: '2027-05-01' },
  { title: ' Seleção   Sul ', event_name: 'Interclubes', starts_at: '2027-05-01', ends_at: '2027-04-01' },
  { title: 'ab', event_name: 'x', starts_at: '01/05/2027' },
  { title: 'Seleção', event_name: 'Interclubes', starts_at: '2027-05-01', ends_at: '2027-05-03', accept_days: '99', slots: '12', travel_docs: ['id_doc', 'lixo', 'passport'], collect_uniform: true, involves_minors: true, message: '  Levem   água ' },
  { title: 'Seleção', event_name: 'Interclubes', starts_at: '2027-05-01', accept_days: 0, slots: -3, collect_uniform: 'sim' },
];
const CONVITES = [
  [], undefined,
  [{ status: 'invited', role: 'athlete' }, { status: 'accepted', role: 'athlete' }, { status: 'accepted', role: 'staff' }, { status: 'declined', role: 'athlete' }, { status: 'expired', role: 'athlete' }],
];

describe('paridade da seleção do clube', () => {
  it('as mesmas constantes', () => {
    expect(s.CALLUP_STATUS).toEqual(c.CALLUP_STATUS);
    expect(s.PUBLIC_STATUSES).toEqual(c.CALLUP_PUBLIC_STATUSES);
    expect(s.MEMBER_STATUS).toEqual(c.MEMBER_STATUS);
    expect(s.ROLES).toEqual(c.CALLUP_ROLES);
    expect(s.TRAVEL_DOCS).toEqual(c.TRAVEL_DOCS);
    expect(s.UNIFORM_SIZES).toEqual(c.UNIFORM_SIZES);
    expect(s.LIMITS).toEqual(c.CALLUP_LIMITS);
    expect(s.CALLUP_STATUS_LABELS).toEqual(c.CALLUP_STATUS_LABELS);
    expect(s.MEMBER_STATUS_LABELS).toEqual(c.MEMBER_STATUS_LABELS);
    expect(s.ROLE_LABELS).toEqual(c.CALLUP_ROLE_LABELS);
    expect(s.TRAVEL_DOC_LABELS).toEqual(c.TRAVEL_DOC_LABELS);
  });

  it('normalizar e validar a convocação', () => {
    ENTRADAS.forEach((e) => {
      expect(s.normalizeCallup(e)).toEqual(c.normalizeCallup(e));
      const a = s.validateCallup(e);
      const b = c.validateCallup(e);
      expect(a.ok).toBe(b.ok);
      expect(a.value).toEqual(b.value);
      expect(a.errors).toEqual(b.errors);
    });
  });

  it('contagem, vagas e quem ocupa vaga', () => {
    CONVITES.forEach((lista) => {
      expect(s.callupCounts(lista)).toEqual(c.callupCounts(lista));
      [{ slots: 0 }, { slots: 2 }, { slots: 1 }, undefined].forEach((cu) => expect(s.slotsLeft(cu, lista)).toEqual(c.slotsLeft(cu, lista)));
      (lista || []).forEach((m) => expect(s.occupies(m)).toBe(c.occupies(m)));
    });
  });

  it('o nome público e o id do convite', () => {
    ['Ana Souza Lima', 'Teo', '', '  Bia   Costa ', 'maria da silva'].forEach((n) => {
      [true, false].forEach((menor) => expect(s.publicName(n, menor)).toBe(c.publicName(n, menor)));
    });
    expect(s.memberDocId('c1', 'u')).toBe(c.memberDocId('c1', 'u'));
  });

  it('a trava de proteção diz o mesmo', () => {
    const guardians = [null, { consent: false }, { consent: true }];
    ['athlete', 'staff'].forEach((role) => [true, false].forEach((minor) => guardians.forEach((guardian) => [true, false].forEach((cleared) => [true, false].forEach((involvesMinors) => {
      const arg = { role, minor, guardian, cleared, involvesMinors };
      expect(s.callupGate(arg)).toEqual(c.callupGate(arg));
    })))));
  });

  it('o convite aberto', () => {
    const agora = 1000;
    [null, { status: 'invited', expires_at_ms: 2000 }, { status: 'invited', expires_at_ms: 500 }, { status: 'accepted', expires_at_ms: 2000 }].forEach((m) => {
      expect(s.inviteOpen(m, agora)).toBe(c.inviteOpen(m, agora));
    });
  });
});

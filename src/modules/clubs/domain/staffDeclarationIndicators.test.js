import { describe, it, expect } from 'vitest';
import { buildClubDeclaration } from './declaration.js';
import { clubIndicators, clubIndicatorsCsv } from './indicators.js';
import {
  DEFAULT_CLUB_ROLES, actorOf, staffActionAllowed, staffPerms, termStatus, validateStaffRole, validateTerm,
} from './staff.js';

const HOJE = '2027-03-10';
const club = { name: 'Clube Pickle', city: 'Curitiba', state: 'PR' };
const ativa = { user_id: 'u1', user_name: 'Ana', status: 'active', member_number: 'CP-0001', card_code: 'abc123', valid_from: '2027-01-01', valid_until: '2027-12-31', plan_name: 'Anual' };

describe('declaração do clube', () => {
  it('sai com a associação em dia e leva o link de verificação', () => {
    const d = buildClubDeclaration({ aff: ativa, club, origin: 'https://x.app', hoje: HOJE });
    expect(d.canIssue).toBe(true);
    expect(d.body).toContain('Ana');
    expect(d.body).toContain('CP-0001');
    expect(d.verifyUrl).toBe('https://x.app/c/verificar/abc123');
    expect(d.club.city).toBe('Curitiba / PR');
  });
  it('plano sem vencimento diz isso em vez de inventar data', () => {
    const d = buildClubDeclaration({ aff: { ...ativa, valid_until: '' }, club, hoje: HOJE });
    expect(d.canIssue).toBe(true);
    expect(d.body).toContain('sem data de vencimento');
  });
  it('vencida, suspensa, pendente e sem código não saem', () => {
    expect(buildClubDeclaration({ aff: { ...ativa, valid_until: '2027-01-31' }, club, hoje: HOJE }).canIssue).toBe(false);
    expect(buildClubDeclaration({ aff: { ...ativa, status: 'suspended' }, club, hoje: HOJE }).canIssue).toBe(false);
    expect(buildClubDeclaration({ aff: { ...ativa, status: 'pending' }, club, hoje: HOJE }).canIssue).toBe(false);
    const sem = buildClubDeclaration({ aff: { ...ativa, card_code: '' }, club, hoje: HOJE });
    expect(sem.canIssue).toBe(false);
    expect(sem.verifyUrl).toBe('');
  });
});

describe('diretoria do clube', () => {
  it('os oito modelos existem e só o presidente é master', () => {
    expect(DEFAULT_CLUB_ROLES).toHaveLength(8);
    expect(DEFAULT_CLUB_ROLES.filter((r) => r.is_master).map((r) => r.id)).toEqual(['president']);
  });
  it('mandato vencido não dá permissão; o master tem todas enquanto vale', () => {
    const agora = Date.parse('2027-03-10T12:00:00Z');
    expect(staffPerms({ perms: ['finance'], term_end_ms: agora - 1 }, agora)).toEqual([]);
    expect(staffPerms({ perms: ['finance'] }, agora)).toEqual(['finance']);
    expect(staffPerms({ is_master: true }, agora)).toContain('staff');
  });
  it('quem nomeia: master tudo; com "staff" só o que já tem e nunca master', () => {
    const agora = Date.now();
    const adm = actorOf({ isClubAdmin: true, uid: 'a' });
    expect(staffActionAllowed({ actor: adm, role: DEFAULT_CLUB_ROLES[0], nowMs: agora })).toBe(true);
    const vice = { user_id: 'v', perms: ['staff', 'members'] };
    expect(staffActionAllowed({ actor: vice, role: { perms: ['members'], is_master: false }, nowMs: agora })).toBe(true);
    expect(staffActionAllowed({ actor: vice, role: { perms: ['finance'], is_master: false }, nowMs: agora })).toBe(false);
    expect(staffActionAllowed({ actor: vice, role: { perms: ['members'], is_master: true }, nowMs: agora })).toBe(false);
    expect(staffActionAllowed({ actor: vice, target: { user_id: 'v' }, nowMs: agora })).toBe(false);
    expect(staffActionAllowed({ actor: null })).toBe(false);
  });
  it('cargo comum nunca leva "admin"; master leva tudo', () => {
    const r = validateStaffRole({ name: 'Tesoureiro', perms: ['finance', 'admin'] });
    expect(r.ok).toBe(true);
    expect(r.value.perms).toEqual(['finance']);
    expect(validateStaffRole({ name: 'X', perms: [] }).ok).toBe(false);
    expect(validateStaffRole({ name: 'Presidente', is_master: true }).value.perms).toContain('admin');
  });
  it('mandato: início obrigatório, fim depois do início, mais de 4 anos avisa', () => {
    expect(validateTerm({}).ok).toBe(false);
    expect(validateTerm({ term_start: '2027-01-01', term_end: '2026-01-01' }).ok).toBe(false);
    expect(validateTerm({ term_start: '2027-01-01', term_end: '2032-06-01' })).toMatchObject({ ok: true, longTerm: true });
  });
  it('estado do mandato', () => {
    const agora = Date.parse('2027-03-10T12:00:00Z');
    expect(termStatus({}, agora).kind).toBe('open');
    expect(termStatus({ term_end_ms: agora + 5 * 86_400_000 }, agora).kind).toBe('ending');
    expect(termStatus({ term_end_ms: agora - 1000 }, agora).kind).toBe('expired');
    expect(termStatus({ term_end_ms: agora + 90 * 86_400_000 }, agora).kind).toBe('active');
  });
});

describe('indicadores do clube', () => {
  const afiliacoes = [
    { user_id: 'u1', status: 'active', valid_until: '2027-12-31', plan_name: 'Anual', category: 'Adulto', requested_at_ms: Date.parse('2027-02-10T12:00:00Z') },
    { user_id: 'u2', status: 'active', valid_until: '', plan_name: 'Grátis', category: 'Adulto', requested_at_ms: Date.parse('2027-03-01T12:00:00Z') },
  ];
  it('fonte que não veio vira null, nunca zero', () => {
    const ind = clubIndicators({ hoje: HOJE });
    expect(ind.members).toBeNull();
    expect(ind.finance).toBeNull();
  });
  it('conta associados em dia por categoria', () => {
    const ind = clubIndicators({ affiliations: afiliacoes, charges: [], hoje: HOJE });
    expect(ind.members.active).toBe(2);
    expect(ind.members.byCategory).toEqual([{ key: 'Adulto', n: 2 }]);
    expect(ind.months).toHaveLength(12);
  });
  it('o CSV só leva o que foi medido', () => {
    const csv = clubIndicatorsCsv(clubIndicators({ affiliations: afiliacoes, hoje: HOJE }));
    expect(csv).toContain('Em dia');
    expect(csv).not.toContain('Recebido em 12 meses');
  });
});

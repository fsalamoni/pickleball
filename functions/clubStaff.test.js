/**
 * Diretoria do clube e importação de associados no SERVIDOR (Firestore falso):
 * quem administra monta cargos e nomeia; o cargo só vale para membro; quem tem
 * `staff` não mexe em master, em si, nem concede o que não tem; prorrogar pede
 * motivo; a varredura avisa e encerra; a importação casa por e-mail e não grava e-mail.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ca = require('./clubAssociation.js');
const cs = require('./clubStaff.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 25, 15, 0, 0);
const ctx = (db, now = NOW) => ({ db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const PRES = { uid: 'pres' };
const VICE = { uid: 'vice' };
const ZE = { uid: 'ze' };
const SEC = { uid: 'sec' };

function cenario() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: true } },
    'clubs/c1': { name: 'Clube Pickle Sul', member_count: 4, association: { enabled: true, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_vice': { club_id: 'c1', user_id: 'vice', role: 'member' },
    'club_members/c1_ze': { club_id: 'c1', user_id: 'ze', role: 'member', user_name: 'Zé' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_x/c1/staff/vice': { club_id: 'c1', user_id: 'vice', role_id: 'staffer', perms: ['staff', 'members'], is_master: false, term_end_ms: 0 },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', role_id: 'secretary', perms: ['members'], is_master: false, term_end_ms: 0 },
    'club_x/c1/roles/list': { roles: [
      { id: 'president', name: 'Presidente', perms: ['admin', 'members', 'finance', 'comms', 'docs', 'sports', 'discipline', 'fiscal', 'staff'], is_master: true, term_months: 0 },
      { id: 'staffer', name: 'Diretoria', perms: ['staff', 'members'], is_master: false, term_months: 0 },
      { id: 'secretary', name: 'Secretaria', perms: ['members'], is_master: false, term_months: 0 },
      { id: 'treasurer', name: 'Tesouraria', perms: ['finance'], is_master: false, term_months: 12 },
    ] },
    'users/ze': { full_name: 'Zé da Silva', email: 'ze@x.com' },
    'users/ana': { full_name: 'Ana Souza', email: 'ana@x.com', photo_url: 'https://x/ana.png' },
    'club_x/c1/plans/livre': { club_id: 'c1', name: 'Amigo', price_cents: 0, billing: 'annual', active: true },
    'club_x/c1/plans/anual': { club_id: 'c1', name: 'Sócio', price_cents: 12000, billing: 'annual', active: true },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const staff = (db, actor, data, now) => cs.staff(ctx(db, now), actor, { clubId: 'c1', ...data });
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

describe('diretoria do clube no servidor', () => {
  it('quem administra o clube nomeia, e o mandato sai do cargo', async () => {
    const db = cenario();
    await staff(db, PRES, { action: 'appoint', userId: 'ze', roleId: 'treasurer' });
    expect(doc(db, 'club_x/c1/staff/ze')).toMatchObject({ role_id: 'treasurer', perms: ['finance'], is_master: false, user_name: 'Zé da Silva' });
    expect(doc(db, 'club_x/c1/staff/ze').term_end).toBe('2027-10-25');
    expect(avisosPara(db, 'ze')).toHaveLength(1);
  });

  it('só membro do clube recebe cargo', async () => {
    const db = cenario();
    await expect(staff(db, PRES, { action: 'appoint', userId: 'ana', roleId: 'secretary' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('quem não está na diretoria nem administra não faz nada', async () => {
    const db = cenario();
    await expect(staff(db, ZE, { action: 'appoint', userId: 'sec', roleId: 'secretary' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('quem tem "staff" não nomeia master, não concede o que não tem e não mexe em si', async () => {
    const db = cenario();
    await expect(staff(db, VICE, { action: 'appoint', userId: 'ze', roleId: 'president' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(staff(db, VICE, { action: 'appoint', userId: 'ze', roleId: 'treasurer' })).rejects.toMatchObject({ code: 'permission-denied' }); // finance não é dele
    await expect(staff(db, VICE, { action: 'remove', userId: 'vice' })).resolves.toMatchObject({ ok: true }); // sair é permitido
    const db2 = cenario();
    await expect(staff(db2, VICE, { action: 'appoint', userId: 'ze', roleId: 'secretary' })).resolves.toMatchObject({ ok: true });
    await expect(staff(db2, VICE, { action: 'extend', userId: 'vice', termEnd: '2030-01-01', reason: 'ok' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('só quem administra monta os cargos; cargo com gente não se apaga', async () => {
    const db = cenario();
    await expect(staff(db, VICE, { action: 'role_save', role: { name: 'Novo', perms: ['members'] } })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await staff(db, PRES, { action: 'role_save', role: { name: 'Eventos', perms: ['comms'], term_months: 6 } });
    expect(doc(db, 'club_x/c1/roles/list').roles.some((x) => x.id === r.roleId)).toBe(true);
    await expect(staff(db, PRES, { action: 'role_delete', roleId: 'secretary' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await staff(db, PRES, { action: 'role_delete', roleId: r.roleId });
    expect(doc(db, 'club_x/c1/roles/list').roles.some((x) => x.id === r.roleId)).toBe(false);
  });

  it('alterar as permissões de um cargo atualiza quem já está nele', async () => {
    const db = cenario();
    await staff(db, PRES, { action: 'role_save', role: { id: 'secretary', name: 'Secretaria', perms: ['members', 'docs'] } });
    expect(doc(db, 'club_x/c1/staff/sec').perms).toEqual(['members', 'docs']);
  });

  it('prorrogar pede motivo e uma data depois da atual', async () => {
    const db = cenario();
    await staff(db, PRES, { action: 'appoint', userId: 'ze', roleId: 'treasurer', termEnd: '2026-12-31' });
    await expect(staff(db, PRES, { action: 'extend', userId: 'ze', termEnd: '2027-06-30' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(staff(db, PRES, { action: 'extend', userId: 'ze', termEnd: '2026-11-01', reason: 'ata' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await staff(db, PRES, { action: 'extend', userId: 'ze', termEnd: '2027-06-30', reason: 'Ata da assembleia' });
    const s = doc(db, 'club_x/c1/staff/ze');
    expect(s.term_end).toBe('2027-06-30');
    expect(s.term_history).toHaveLength(1);
  });

  it('permissões: o cargo só vale com mandato e com a pessoa ainda no clube', async () => {
    const db = cenario();
    expect(await ca.permsDe(ctx(db), 'c1', 'sec')).toEqual(['members']);
    db.store.docs.set('club_x/c1/staff/sec', { user_id: 'sec', perms: ['members'], term_end_ms: NOW - 1 });
    expect(await ca.permsDe(ctx(db), 'c1', 'sec')).toEqual([]);
    db.store.docs.set('club_x/c1/staff/sec', { user_id: 'sec', perms: ['members'], term_end_ms: 0 });
    db.store.docs.delete('club_members/c1_sec');
    expect(await ca.permsDe(ctx(db), 'c1', 'sec')).toEqual([]);
    expect((await ca.permsDe(ctx(db), 'c1', 'pres')).length).toBeGreaterThan(5);
  });

  it('o cargo master dá todas as permissões', async () => {
    const db = cenario();
    await staff(db, PRES, { action: 'appoint', userId: 'ze', roleId: 'president' });
    expect(await ca.permsDe(ctx(db), 'c1', 'ze')).toContain('finance');
  });

  it('varredura: avisa 30/7/1 dias antes e encerra o mandato vencido', async () => {
    const db = cenario();
    await staff(db, PRES, { action: 'appoint', userId: 'ze', roleId: 'treasurer', termEnd: '2026-11-10' });
    const antes = avisosPara(db, 'ze').length;
    const aos15 = Date.UTC(2026, 9, 26, 15);
    await cs.sweep(ctx(db, aos15));
    expect(avisosPara(db, 'ze')).toHaveLength(antes + 1);
    await cs.sweep(ctx(db, aos15));
    expect(avisosPara(db, 'ze')).toHaveLength(antes + 1);
    expect(avisosPara(db, 'pres').length).toBeGreaterThan(0);
    const r = await cs.sweep(ctx(db, Date.UTC(2026, 10, 12, 15)));
    expect(r.encerrados).toBe(1);
    expect(doc(db, 'club_x/c1/staff/ze')).toBeUndefined();
  });

  it('sair do clube encerra o cargo', async () => {
    const db = cenario();
    await ca.association(ctx(db), SEC, { clubId: 'c1', action: 'request', planId: 'livre' }).catch(() => null);
    db.store.docs.set('club_x/c1/aff/sec', { club_id: 'c1', user_id: 'sec', status: 'active', plan_id: 'livre' });
    await ca.association(ctx(db), SEC, { clubId: 'c1', action: 'leave' });
    expect(doc(db, 'club_x/c1/staff/sec')).toBeUndefined();
    expect(doc(db, 'club_members/c1_sec')).toBeUndefined();
  });
});

describe('importação de associados', () => {
  const imp = (db, actor, data) => ca.association(ctx(db), actor, { clubId: 'c1', action: 'import', ...data });

  it('só a secretaria importa', async () => {
    const db = cenario();
    await expect(imp(db, ZE, { planId: 'livre', rows: [{ email: 'ana@x.com' }] })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('quem tem conta vira associado ativo (com número e validade da lista); quem não tem fica pendente', async () => {
    const db = cenario();
    const r = await imp(db, SEC, { planId: 'anual', rows: [
      { email: 'ANA@x.com', member_number: 'CPS-0007', valid_until: '2027-03-31' },
      { email: 'ninguem@x.com', name: 'Sem Conta' },
      { email: 'ana@x.com' },
      { email: 'quebrado' },
    ] });
    expect(r).toMatchObject({ imported: 1, pending: 1 });
    expect(r.skipped).toHaveLength(2);
    expect(doc(db, 'club_x/c1/aff/ana')).toMatchObject({ status: 'active', member_number: 'CPS-0007', valid_until: '2027-03-31', imported: true });
    expect(JSON.stringify(doc(db, 'club_x/c1/aff/ana'))).not.toContain('@');
    expect(doc(db, 'club_members/c1_ana')).toBeTruthy();
    const pendente = [...db.store.docs.entries()].find(([p]) => p.startsWith('club_x/c1/imports/'))[1];
    expect(pendente.pending).toEqual([{ email: 'ninguem@x.com', name: 'Sem Conta', member_number: '', valid_until: '' }]);
  });

  it('quem já tem filiação viva é pulado', async () => {
    const db = cenario();
    await imp(db, SEC, { planId: 'livre', rows: [{ email: 'ana@x.com' }] });
    const r = await imp(db, SEC, { planId: 'livre', rows: [{ email: 'ana@x.com' }] });
    expect(r).toMatchObject({ imported: 0 });
    expect(r.skipped[0].reason).toMatch(/filiação/);
  });

  it('lista vazia é recusada', async () => {
    const db = cenario();
    await expect(imp(db, SEC, { planId: 'livre', rows: [] })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

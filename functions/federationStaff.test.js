/**
 * Equipe da federação no SERVIDOR contra o Firestore falso: cargos só pelo
 * admin master, nomear com mandato, quem tem `staff` só mexe fora dos cargos
 * master, prorrogação com histórico, a federação nunca fica sem admin master,
 * passar a administração, a varredura dos mandatos e o acesso justificado do
 * admin da plataforma (registro ANTES do acesso).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const st = require('./federationStaff.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0); // 2026-10-21 12:00 em Brasília
const DIA = 86400000;
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const PRES = { uid: 'pres' };
const GES = { uid: 'ges' };
const SEC = { uid: 'sec' };
const ADMIN = { uid: 'admin', email: 'admin@x', isPlatformAdmin: true };
const TODAS = ['admin', 'members', 'finance', 'competitions', 'courses', 'discipline', 'comms', 'staff'];

function cenario() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved' },
    'federations/nova': { name: 'Nova', acronym: 'FN', slug: 'fn', status: 'pending' },
    // presidente antigo (sem `perms`): vale pelo papel e é admin master
    'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', user_name: 'Pres', role: 'president' },
    'federation_staff/fpp_ges': { federation_id: 'fpp', user_id: 'ges', user_name: 'Gestora', role: 'gestao', role_id: 'gestao', perms: ['staff', 'members'], is_master: false, term_end_ms: 0 },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', user_name: 'Sec', role: 'secretary' },
    'users/ana': { full_name: 'Ana Souza', photo_url: 'https://x/ana.png' },
    'users/bia': { full_name: 'Bia Lima' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const logs = (db) => [...db.store.docs.entries()].filter(([p]) => p.startsWith('admin_access_logs/')).map(([, d]) => d);
const chamar = (db, actor, data, now) => st.staff(ctx(db, now), actor, { federationId: 'fpp', ...data });

describe('cargos', () => {
  it('só admin master monta cargos; a cópia das permissões chega a quem ocupa', async () => {
    const db = cenario();
    await expect(chamar(db, GES, { action: 'role_save', role: { name: 'Conselho', perms: ['members'] } })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(db, PRES, { action: 'role_save', role: { name: 'Conselho Fiscal', perms: ['finance'], term_months: 24 } });
    expect(r.roleId).toBe('conselho-fiscal');
    const roles = doc(db, 'federations/fpp').staff_roles;
    expect(roles).toHaveLength(9); // os oito modelos + o novo
    // editar a secretaria muda a cópia de quem está nela
    await chamar(db, PRES, { action: 'role_save', role: { id: 'secretary', name: 'Secretaria-geral', perms: ['members', 'comms'] } });
    expect(doc(db, 'federation_staff/fpp_sec')).toMatchObject({ role_name: 'Secretaria-geral', perms: ['members', 'comms'], is_master: false });
  });

  it('não apaga cargo ocupado nem o último cargo master', async () => {
    const db = cenario();
    await expect(chamar(db, PRES, { action: 'role_delete', roleId: 'secretary' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, PRES, { action: 'role_delete', roleId: 'president' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, PRES, { action: 'role_delete', roleId: 'treasurer' });
    expect(doc(db, 'federations/fpp').staff_roles.map((r) => r.id)).not.toContain('treasurer');
    // tirar o "master" do único cargo master ocupado deixaria a federação sem ninguém
    await expect(chamar(db, PRES, { action: 'role_save', role: { id: 'president', name: 'Presidente', perms: ['admin'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('pessoas e mandatos', () => {
  it('nomear: mandato padrão do cargo, cópia das permissões, aviso', async () => {
    const db = cenario();
    await chamar(db, PRES, { action: 'appoint', userId: 'ana', roleId: 'director', termStart: '2026-11-01' });
    const ana = doc(db, 'federation_staff/fpp_ana');
    expect(ana).toMatchObject({ user_name: 'Ana Souza', role_id: 'director', role_name: 'Diretor(a)', is_master: false, term_start: '2026-11-01', term_end: '2030-11-01' });
    expect(ana.perms).toEqual(TODAS);
    expect(ana.term_end_ms).toBeGreaterThan(NOW);
    expect(avisosPara(db, 'ana')).toHaveLength(1);
  });

  it('quem tem "staff" nomeia fora dos cargos master e só com as permissões que tem', async () => {
    const db = cenario();
    await chamar(db, GES, { action: 'appoint', userId: 'ana', roleId: 'secretary' });
    expect(doc(db, 'federation_staff/fpp_ana').role_id).toBe('secretary');
    await expect(chamar(db, GES, { action: 'appoint', userId: 'bia', roleId: 'treasurer' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, GES, { action: 'appoint', userId: 'bia', roleId: 'president' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, GES, { action: 'remove', userId: 'pres' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, SEC, { action: 'appoint', userId: 'bia', roleId: 'secretary' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('mandato inválido é recusado; conta inexistente também', async () => {
    const db = cenario();
    await expect(chamar(db, PRES, { action: 'appoint', userId: 'ana', roleId: 'secretary', termStart: '2026-11-01', termEnd: '2026-10-01' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, PRES, { action: 'appoint', userId: 'zzz', roleId: 'secretary' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('prorrogar estende, guarda o histórico e exige motivo', async () => {
    const db = cenario();
    await chamar(db, PRES, { action: 'appoint', userId: 'ana', roleId: 'secretary', termStart: '2026-01-01', termEnd: '2026-12-31' });
    await expect(chamar(db, PRES, { action: 'extend', userId: 'ana', termEnd: '2027-12-31', reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, PRES, { action: 'extend', userId: 'ana', termEnd: '2026-06-30', reason: 'Ata' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, PRES, { action: 'extend', userId: 'ana', termEnd: '2027-12-31', reason: 'Assembleia aprovou', act: 'Ata AGE 03/2026' });
    const ana = doc(db, 'federation_staff/fpp_ana');
    expect(ana.term_end).toBe('2027-12-31');
    expect(ana.term_history).toEqual([expect.objectContaining({ from: '2026-12-31', to: '2027-12-31', reason: 'Assembleia aprovou', act: 'Ata AGE 03/2026', by: 'pres' })]);
  });

  it('a federação nunca fica sem admin master', async () => {
    const db = cenario();
    await expect(chamar(db, PRES, { action: 'remove', userId: 'pres' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, PRES, { action: 'appoint', userId: 'pres', roleId: 'secretary' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, SEC, { action: 'remove', userId: 'sec' }); // qualquer um sai sozinho
    expect(doc(db, 'federation_staff/fpp_sec')).toBeUndefined();
  });

  it('passar a administração (e sair); depois quem recebeu tira quem passou', async () => {
    const db = cenario();
    await chamar(db, PRES, { action: 'transfer', userId: 'ana' });
    expect(doc(db, 'federation_staff/fpp_ana')).toMatchObject({ is_master: true, role_id: 'president' });
    expect(doc(db, 'federation_staff/fpp_pres')).toBeDefined(); // dois admins master ao mesmo tempo
    await st.staff(ctx(db), { uid: 'ana' }, { federationId: 'fpp', action: 'remove', userId: 'pres' });
    expect(doc(db, 'federation_staff/fpp_pres')).toBeUndefined();
    const db2 = cenario();
    await chamar(db2, PRES, { action: 'transfer', userId: 'bia', leave: true });
    expect(doc(db2, 'federation_staff/fpp_bia').is_master).toBe(true);
    expect(doc(db2, 'federation_staff/fpp_pres')).toBeUndefined();
    await expect(chamar(db2, GES, { action: 'transfer', userId: 'sec' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('federação pendente não monta equipe; quem não é da equipe não mexe', async () => {
    const db = cenario();
    await expect(st.staff(ctx(db), PRES, { federationId: 'nova', action: 'appoint', userId: 'ana', roleId: 'secretary' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, { uid: 'ana' }, { action: 'appoint', userId: 'bia', roleId: 'secretary' })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('varredura dos mandatos', () => {
  it('avisa 30/7/1 dias antes uma vez cada; vencido sai; o último master fica', async () => {
    const db = cenario();
    await chamar(db, PRES, { action: 'appoint', userId: 'ana', roleId: 'secretary', termStart: '2026-01-01', termEnd: '2026-11-10' });
    const c = ctx(db);
    expect(await st.sweep(c)).toEqual({ avisados: 1, encerrados: 0 }); // 20 dias: marco dos 30
    expect(await st.sweep(c)).toEqual({ avisados: 0, encerrados: 0 }); // não repete
    expect(avisosPara(db, 'pres').some((a) => String(a.title).includes('Ana Souza') || JSON.stringify(a).includes('Ana Souza'))).toBe(true);
    expect(await st.sweep(ctx(db, NOW + 15 * DIA))).toEqual({ avisados: 1, encerrados: 0 }); // marco dos 7
    expect(await st.sweep(ctx(db, NOW + 21 * DIA))).toEqual({ avisados: 0, encerrados: 1 });
    expect(doc(db, 'federation_staff/fpp_ana')).toBeUndefined();

    // o único master com mandato vencido continua (e é avisado uma vez)
    db.store.docs.set('federation_staff/fpp_pres', { ...doc(db, 'federation_staff/fpp_pres'), is_master: true, term_end: '2026-10-01', term_end_ms: NOW - DIA });
    const antes = avisosPara(db, 'pres').length;
    await st.sweep(c);
    await st.sweep(c);
    expect(doc(db, 'federation_staff/fpp_pres')).toBeDefined();
    expect(avisosPara(db, 'pres').length).toBe(antes + 1);
  });
});

describe('acesso justificado do admin da plataforma', () => {
  it('sem acesso, o admin não mexe; com motivo e prazo, registra ANTES e vira master; encerrar fecha', async () => {
    const db = cenario();
    await expect(chamar(db, ADMIN, { action: 'appoint', userId: 'ana', roleId: 'secretary' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(st.adminAccess(ctx(db), ADMIN, { federationId: 'fpp', action: 'grant', reason_category: 'suporte_solicitado', reason_text: 'curto', hours: 2 })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(st.adminAccess(ctx(db), ADMIN, { federationId: 'fpp', action: 'grant', reason_category: 'suporte_solicitado', reason_text: 'O presidente pediu ajuda com os cargos', hours: 3 })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(st.adminAccess(ctx(db), PRES, { federationId: 'fpp', action: 'grant', reason_category: 'suporte_solicitado', reason_text: 'O presidente pediu ajuda com os cargos', hours: 2 })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await st.adminAccess(ctx(db), ADMIN, { federationId: 'fpp', action: 'grant', reason_category: 'suporte_solicitado', reason_text: 'O presidente pediu ajuda com os cargos', hours: 2 }, { ip: '1.2.3.4' });
    expect(r.expires_ms).toBe(NOW + 2 * 3600000);
    expect(logs(db)).toEqual([expect.objectContaining({ action: 'federation_access', target_federation_id: 'fpp', reason_category: 'suporte_solicitado', hours: 2 })]);
    expect(logs(db)[0].ip_hash).not.toContain('1.2.3.4');
    expect(doc(db, 'federation_admin_grants/fpp_admin')).toMatchObject({ admin_uid: 'admin', expires_ms: NOW + 2 * 3600000 });
    await chamar(db, ADMIN, { action: 'appoint', userId: 'ana', roleId: 'secretary' });
    expect(doc(db, 'federation_staff/fpp_ana').added_by).toBe('admin');
    // o admin com acesso não "passa a administração" (não é dele)
    await expect(chamar(db, ADMIN, { action: 'transfer', userId: 'bia' })).rejects.toMatchObject({ code: 'permission-denied' });
    // prazo vencido: volta a não poder
    await expect(chamar(db, ADMIN, { action: 'appoint', userId: 'bia', roleId: 'secretary' }, NOW + 3 * 3600000)).rejects.toMatchObject({ code: 'permission-denied' });
    await st.adminAccess(ctx(db), ADMIN, { federationId: 'fpp', action: 'end' });
    expect(doc(db, 'federation_admin_grants/fpp_admin')).toBeUndefined();
    expect(logs(db).map((l) => l.action)).toEqual(['federation_access', 'federation_access_end']);
  });
});

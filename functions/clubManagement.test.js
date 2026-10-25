/**
 * Patrimônio do clube no SERVIDOR (Firestore falso): só o financeiro, a diretoria esportiva e a
 * administração mexem; a quantidade não fica abaixo do que está emprestado; a devolução volta o
 * bem ao inventário (e o danificado passa a dizer isso); a baixa pede motivo e não vale com
 * empréstimo aberto; a varredura avisa o atraso uma vez só.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cm = require('./clubManagement.js');
const m = require('./federationMembership.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0);
const hoje = m.isoDateBR(NOW);
const PRES = { uid: 'pres', name: 'Presidente' };
const ESP = { uid: 'esp', name: 'Diretor esportivo' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const FISC = { uid: 'fisc', name: 'Conselho fiscal' };
const ANA = { uid: 'ana', name: 'Ana' };

function cenario({ flag = true, associacao = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_esp': { club_id: 'c1', user_id: 'esp', role: 'member' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_members/c1_fisc': { club_id: 'c1', user_id: 'fisc', role: 'member' },
    'club_members/c1_ana': { club_id: 'c1', user_id: 'ana', role: 'member' },
    'club_x/c1/staff/esp': { club_id: 'c1', user_id: 'esp', perms: ['sports'], term_end_ms: 0 },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/staff/fisc': { club_id: 'c1', user_id: 'fisc', perms: ['fiscal'], term_end_ms: 0 },
  });
}
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, now) => cm.management(ctx(db, now), actor, { clubId: 'c1', ...data });
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const REDE = { name: 'Rede oficial', category: 'nets', quantity: 10, condition: 'good', location: 'Depósito' };
const novoBem = async (db, extra = {}) => (await chamar(db, ESP, { action: 'asset_save', asset: { ...REDE, ...extra } })).assetId;
const emprestimo = (extra = {}) => ({ borrower_kind: 'event', borrower_name: 'Torneio de abertura', quantity: 4, out_at: hoje, due_at: '2027-03-20', ...extra });

describe('patrimônio do clube: quem pode e o que vale', () => {
  it('flag desligada, associação fechada, sem cargo, só fiscal e ação desconhecida são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), ESP, { action: 'asset_save', asset: REDE })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), ESP, { action: 'asset_save', asset: REDE })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, ANA, { action: 'asset_save', asset: REDE })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, FISC, { action: 'asset_save', asset: REDE })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ESP, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ESP, { action: 'asset_save', asset: { ...REDE, name: '' } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('o financeiro, a diretoria esportiva e a administração cadastram o bem no clube', async () => {
    const db = cenario();
    for (const actor of [ESP, FIN, PRES]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await chamar(db, actor, { action: 'asset_save', asset: REDE });
      expect(doc(db, `club_x/c1/assets/${r.assetId}`)).toMatchObject({ club_id: 'c1', name: 'Rede oficial', quantity: 10, status: 'active', loans: [], created_by: actor.uid });
    }
  });

  it('⭐ empresta, não deixa passar do que há, e a quantidade não cai abaixo do emprestado', async () => {
    const db = cenario();
    const id = await novoBem(db);
    const r = await chamar(db, ESP, { action: 'asset_loan', assetId: id, loan: emprestimo() });
    expect(doc(db, `club_x/c1/assets/${id}`).loans[0]).toMatchObject({ id: r.loanId, quantity: 4, borrower_name: 'Torneio de abertura', lent_by: 'esp', returned_at: '' });
    await expect(chamar(db, ESP, { action: 'asset_loan', assetId: id, loan: emprestimo({ quantity: 7 }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ESP, { action: 'asset_loan', assetId: id, loan: emprestimo({ out_at: '2027-12-01' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ESP, { action: 'asset_save', assetId: id, asset: { ...REDE, quantity: 3 } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, ESP, { action: 'asset_save', assetId: id, asset: { ...REDE, quantity: 5 } });
    expect(doc(db, `club_x/c1/assets/${id}`).quantity).toBe(5);
  });

  it('bem de outro clube não é achado', async () => {
    const db = cenario();
    db.store.docs.set('club_x/c1/assets/alheio', { club_id: 'c2', name: 'Alheio', quantity: 1, status: 'active', loans: [] });
    await expect(chamar(db, ESP, { action: 'asset_loan', assetId: 'alheio', loan: emprestimo({ quantity: 1 }) })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('devolução: volta ao inventário; danificado passa a dizer isso; não devolve duas vezes nem antes da saída', async () => {
    const db = cenario();
    const id = await novoBem(db);
    const { loanId } = await chamar(db, ESP, { action: 'asset_loan', assetId: id, loan: emprestimo() });
    await expect(chamar(db, ESP, { action: 'asset_return', assetId: id, loanId, date: '2027-03-01' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ESP, { action: 'asset_return', assetId: id, loanId, date: '2027-12-01' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, ESP, { action: 'asset_return', assetId: id, loanId, date: hoje, condition: 'damaged', note: 'Rasgou uma' });
    const bem = doc(db, `club_x/c1/assets/${id}`);
    expect(bem.loans[0]).toMatchObject({ returned_at: hoje, return_condition: 'damaged', return_note: 'Rasgou uma' });
    expect(bem.condition).toBe('damaged');
    await expect(chamar(db, ESP, { action: 'asset_return', assetId: id, loanId, date: hoje })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('baixa pede motivo e não vale com empréstimo aberto; reativa; só a administração apaga o que nunca foi emprestado', async () => {
    const db = cenario();
    const id = await novoBem(db);
    const { loanId } = await chamar(db, ESP, { action: 'asset_loan', assetId: id, loan: emprestimo() });
    await expect(chamar(db, ESP, { action: 'asset_retire', assetId: id, reason: 'Perdeu' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, ESP, { action: 'asset_return', assetId: id, loanId, date: hoje });
    await expect(chamar(db, ESP, { action: 'asset_retire', assetId: id })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, ESP, { action: 'asset_retire', assetId: id, reason: 'Doado à escola' });
    expect(doc(db, `club_x/c1/assets/${id}`)).toMatchObject({ status: 'retired', retired_reason: 'Doado à escola' });
    await chamar(db, ESP, { action: 'asset_retire', assetId: id, undo: true });
    expect(doc(db, `club_x/c1/assets/${id}`).status).toBe('active');
    await expect(chamar(db, ESP, { action: 'asset_retire', assetId: id, remove: true })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, PRES, { action: 'asset_retire', assetId: id, remove: true })).rejects.toMatchObject({ code: 'failed-precondition' });
    const livre = await novoBem(db, { name: 'Bolas' });
    await chamar(db, PRES, { action: 'asset_retire', assetId: livre, remove: true });
    expect(doc(db, `club_x/c1/assets/${livre}`)).toBeUndefined();
  });

  it('⭐ a varredura avisa quem emprestou, uma vez só, quando a devolução combinada passa', async () => {
    const db = cenario();
    const id = await novoBem(db);
    await chamar(db, ESP, { action: 'asset_loan', assetId: id, loan: emprestimo({ due_at: hoje }) });
    expect((await cm.sweep(ctx(db))).notices).toBe(0);
    const depois = NOW + 3 * 86400000;
    expect((await cm.sweep(ctx(db, depois))).notices).toBe(1);
    expect(avisosPara(db, 'esp')[0].link).toBe('/clubes/c1/gerir?aba=patrimonio');
    expect((await cm.sweep(ctx(db, depois + 86400000))).notices).toBe(0);
  });

  it('a varredura não faz nada com a flag desligada nem em clube sem associação', async () => {
    const off = cenario({ flag: false });
    expect(await cm.sweep(ctx(off))).toEqual({ skipped: 'flag' });
    const db = cenario({ associacao: false });
    db.store.docs.set('club_x/c1/assets/b', { club_id: 'c1', name: 'Rede', quantity: 2, status: 'active', loans: [{ id: 'l1', quantity: 1, borrower_name: 'X', out_at: '2027-01-01', due_at: '2027-01-05', returned_at: '', lent_by: 'esp' }] });
    expect((await cm.sweep(ctx(db))).notices).toBe(0);
  });
});

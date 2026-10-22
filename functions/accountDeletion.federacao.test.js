/**
 * Exclusão de cadastro — os PONTOS do ranking oficial de federação.
 *
 * O lançamento (`federation_points`) fica como histórico do torneio, sem uid,
 * nome e foto; no ano ABERTO ele é cancelado (conta excluída não pontua mais);
 * o ano FECHADO não muda de soma — só perde o nome, no lançamento e no ranking
 * gravado daquele ano. O adversário segue intacto.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { executeAccountDeletion, REMOVED_ATHLETE } = require('../functions/accountDeletion.js');
const { createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const ANO = new Date().getFullYear();
const linhaDe = (uid, name, points) => ({ uid, name, photo_url: 'https://foto', points, position: 1, results: [] });

function cenario() {
  const db = createFakeDb({
    'users/ana': { uid: 'ana', full_name: 'Ana' },
    'users/bia': { uid: 'bia', full_name: 'Bia' },
    [`federation_points/r1_ana`]: { uid: 'ana', name: 'Ana', photo_url: 'https://foto', season: ANO, status: 'awarded', points: 100, result_id: 'r1' },
    [`federation_points/r0_ana`]: { uid: 'ana', name: 'Ana', photo_url: 'https://foto', season: ANO - 3, status: 'awarded', points: 70, result_id: 'r0' },
    [`federation_points/r1_bia`]: { uid: 'bia', name: 'Bia', season: ANO, status: 'awarded', points: 70, result_id: 'r1' },
    [`federation_rankings/fpp_${ANO - 3}`]: {
      federation_id: 'fpp', season: ANO - 3, uids: ['ana', 'bia'],
      general: [linhaDe('ana', 'Ana', 70), linhaDe('bia', 'Bia', 40)],
      categories: [{ key: 'm', rows: [linhaDe('ana', 'Ana', 70)] }],
    },
  });
  const auth = createFakeAuth(['ana', 'bia'], { log: db.store.log });
  return { db, ctx: { db, auth, bucket: createFakeBucket([]) } };
}

describe('excluir a conta e os pontos do ranking oficial', () => {
  it('⭐ ano aberto cancela, ano fechado só perde o nome, adversário intacto', async () => {
    const { db, ctx } = cenario();
    const bia = db.store.docs.get('federation_points/r1_bia');
    const r = await executeAccountDeletion(ctx, 'ana', { actor: { uid: 'admin', name: 'Dono' }, reason: 'pedido', hojeISO: `${ANO}-10-22`, FieldValue: FakeFieldValue });
    expect(r.status).not.toBe('blocked');
    const aberto = db.store.docs.get('federation_points/r1_ana');
    expect(aberto).toMatchObject({ uid: null, name: REMOVED_ATHLETE, photo_url: null, status: 'cancelled', cancel_reason: 'account_deleted', points: 100 });
    const fechado = db.store.docs.get('federation_points/r0_ana');
    expect(fechado).toMatchObject({ uid: null, name: REMOVED_ATHLETE, status: 'awarded', points: 70 });
    const ranking = db.store.docs.get(`federation_rankings/fpp_${ANO - 3}`);
    expect(ranking.uids).toEqual(['bia']);
    expect(ranking.general[0]).toMatchObject({ uid: null, name: REMOVED_ATHLETE, photo_url: null, points: 70 });
    expect(ranking.general[1]).toMatchObject({ uid: 'bia', name: 'Bia', points: 40 });
    expect(ranking.categories[0].rows[0]).toMatchObject({ uid: null, name: REMOVED_ATHLETE });
    expect(db.store.docs.get('federation_points/r1_bia')).toEqual(bia);
  });

  it('o clube que a conta representava segue filiado, sem representante; a cobrança dele perde só o pagador', async () => {
    const { db, ctx } = cenario();
    db.store.docs.set('federation_members/fpp_club_c1', {
      federation_id: 'fpp', user_id: null, user_name: 'Clube Pinheiros', org_kind: 'club', org_id: 'c1', status: 'active',
      representative_uid: 'ana', representative_name: 'Ana', representatives: [{ uid: 'ana', name: 'Ana', role: 'Presidente' }, { uid: 'bia', name: 'Bia', role: 'Diretora' }],
    });
    db.store.docs.set('federation_charges/k1', { member_id: 'fpp_club_c1', payer_uid: 'ana', payer_name: 'Clube Pinheiros', status: 'open' });
    const r = await executeAccountDeletion(ctx, 'ana', { actor: { uid: 'admin', name: 'Dono' }, reason: 'pedido', hojeISO: `${ANO}-10-22`, FieldValue: FakeFieldValue });
    expect(r.status).not.toBe('blocked');
    const m = db.store.docs.get('federation_members/fpp_club_c1');
    expect(m).toMatchObject({ status: 'active', user_name: 'Clube Pinheiros', representative_uid: null });
    expect(m.representatives).toEqual([{ uid: 'bia', name: 'Bia', role: 'Diretora' }]);
    expect(db.store.docs.get('federation_charges/k1')).toMatchObject({ payer_uid: null, payer_name: 'Clube Pinheiros', status: 'open' });
  });
});

/**
 * Exclusão de cadastro — a ASSOCIAÇÃO em clubes (`club_x`).
 *
 * A filiação e as cobranças FICAM (o clube presta contas), sem o nome; a
 * filiação viva encerra, o código da carteirinha deixa de verificar e o cargo
 * na equipe é apagado. Quem não tem nada nos clubes não é tocada, e a
 * associação de OUTRA pessoa fica intacta.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { executeAccountDeletion, REMOVED_ATHLETE } = require('../functions/accountDeletion.js');
const { createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

function cenario() {
  const db = createFakeDb({
    'users/ana': { uid: 'ana', full_name: 'Ana' },
    'users/bia': { uid: 'bia', full_name: 'Bia' },
    'clubs/c1': { name: 'Clube Um', association: { enabled: true, published: true } },
    'clubs/c2': { name: 'Clube Dois' },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', user_name: 'Ana', photo_url: 'https://foto', status: 'active', card_code: 'ABCDEFGH23', note: 'oi' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', user_name: 'Bia', status: 'active', card_code: 'ZZZZZZZZ22' },
    'club_x/c1/charges/k1': { club_id: 'c1', user_id: 'ana', payer_name: 'Ana', member_name: 'Ana', status: 'paid', amount_cents: 12000 },
    'club_x/c1/charges/k2': { club_id: 'c1', user_id: 'bia', payer_name: 'Bia', status: 'open' },
    'club_x/c1/staff/ana': { user_id: 'ana', perms: ['finance'] },
    'club_card_index/ABCDEFGH23': { club_id: 'c1', user_id: 'ana' },
    'club_card_index/ZZZZZZZZ22': { club_id: 'c1', user_id: 'bia' },
  });
  const auth = createFakeAuth(['ana', 'bia'], { log: db.store.log });
  return { db, ctx: { db, auth, bucket: createFakeBucket([]) } };
}

describe('excluir a conta e a associação em clubes', () => {
  it('⭐ a filiação encerra sem o nome, o código some, a cobrança fica sem o nome e o cargo é apagado', async () => {
    const { db, ctx } = cenario();
    const r = await executeAccountDeletion(ctx, 'ana', { actor: { uid: 'admin', name: 'Dono' }, reason: 'pedido', hojeISO: '2026-10-25', FieldValue: FakeFieldValue });
    expect(r.status).not.toBe('blocked');
    expect(db.store.docs.get('club_x/c1/aff/ana')).toMatchObject({ status: 'cancelled', user_name: REMOVED_ATHLETE, photo_url: null, card_code: null, note: '' });
    expect(db.store.docs.get('club_card_index/ABCDEFGH23')).toBeUndefined();
    expect(db.store.docs.get('club_x/c1/charges/k1')).toMatchObject({ payer_name: REMOVED_ATHLETE, member_name: '', status: 'paid', amount_cents: 12000 });
    expect(db.store.docs.get('club_x/c1/staff/ana')).toBeUndefined();
  });

  it('a associação de outra pessoa não é tocada', async () => {
    const { db, ctx } = cenario();
    await executeAccountDeletion(ctx, 'ana', { actor: { uid: 'admin', name: 'Dono' }, reason: 'pedido', hojeISO: '2026-10-25', FieldValue: FakeFieldValue });
    expect(db.store.docs.get('club_x/c1/aff/bia')).toMatchObject({ status: 'active', user_name: 'Bia', card_code: 'ZZZZZZZZ22' });
    expect(db.store.docs.get('club_card_index/ZZZZZZZZ22')).toBeTruthy();
    expect(db.store.docs.get('club_x/c1/charges/k2')).toMatchObject({ payer_name: 'Bia' });
  });
});

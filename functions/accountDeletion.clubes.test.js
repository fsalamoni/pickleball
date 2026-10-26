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
    'club_x/c1/ledger/l1': { club_id: 'c1', created_by: 'ana', created_by_name: 'Ana', amount_cents: 500, status: 'posted' },
    'club_x/c1/ledger/l2': { club_id: 'c1', created_by: 'bia', created_by_name: 'Bia', amount_cents: 700, status: 'posted' },
    'club_x/c1/reports/2026': { club_id: 'c1', opened_by: 'ana', opened_by_name: 'Ana', status: 'draft' },
    'club_x/c1/docs/d1': { club_id: 'c1', status: 'published', title: 'Regimento', created_by: 'ana', created_by_name: 'Ana', published_by: 'ana', published_by_name: 'Ana', signed_by: 'Ana, presidente' },
    'club_x/c1/docs/d2': { club_id: 'c1', status: 'published', title: 'Ata', created_by: 'bia', created_by_name: 'Bia', published_by: 'bia', published_by_name: 'Bia' },
    'club_x/c1/events/e1': { club_id: 'c1', title: 'Assembleia', created_by: 'ana', created_by_name: 'Ana', visibility: 'members' },
    'club_x/c1/events/e2': { club_id: 'c1', title: 'Torneio', created_by: 'bia', created_by_name: 'Bia', visibility: 'public' },
    'club_x/c1/cases/s1': { club_id: 'c1', user_id: 'ana', user_name: 'Ana', kind: 'warning', reason: 'Palavrão na quadra', status: 'active' },
    'club_x/c1/cases/s2': { club_id: 'c1', user_id: 'bia', user_name: 'Bia', kind: 'warning', reason: 'Atraso', status: 'active' },
    'club_x/c1/ombud/o1': { club_id: 'c1', kind: 'conduct', body: 'Relato identificado', anonymous: false, reporter_uid: 'ana', status: 'open' },
    'club_x/c1/ombud/o2': { club_id: 'c1', kind: 'conduct', body: 'Relato da Bia', anonymous: false, reporter_uid: 'bia', status: 'open' },
    'club_x/c1/assets/b1': { club_id: 'c1', name: 'Rede', created_by: 'ana', history: [{ action: 'create', by: 'ana', by_name: 'Ana' }, { action: 'loan', by: 'bia', by_name: 'Bia' }], loans: [{ id: 'x1', borrower_name: 'Arena Sol', lent_by: 'ana', lent_by_name: 'Ana' }, { id: 'x2', borrower_name: 'Liga', lent_by: 'bia', lent_by_name: 'Bia' }] },
    'club_x/c1/assets/b2': { club_id: 'c1', name: 'Bolas', created_by: 'bia', history: [{ action: 'create', by: 'bia', by_name: 'Bia' }], loans: [] },
    'club_x/c1/safeguard/ana': { club_id: 'c1', user_id: 'ana', name: 'Ana', pledge_version: 1, background: { status: 'valid', valid_until: '2027-01-01' } },
    'club_x/c1/safeguard/bia': { club_id: 'c1', user_id: 'bia', name: 'Bia', pledge_version: 1 },
    'club_x/c1/minors/ana': { club_id: 'c1', user_id: 'ana', guardian: { name: 'Mãe da Ana', phone: '51999990000' } },
    'club_x/c1/minors/bia': { club_id: 'c1', user_id: 'bia', guardian: { name: 'Pai do Bia', phone: '51988880000' } },
    'club_card_index/ABCDEFGH23': { club_id: 'c1', user_id: 'ana' },
    'club_card_index/ZZZZZZZZ22': { club_id: 'c1', user_id: 'bia' },
  });
  const auth = createFakeAuth(['ana', 'bia'], { log: db.store.log });
  const bucket = createFakeBucket(['clube-protecao/ana/cert.pdf', 'clube-protecao/bia/cert.pdf']);
  return { db, bucket, ctx: { db, auth, bucket } };
}

describe('excluir a conta e a associação em clubes', () => {
  it('⭐ a filiação encerra sem o nome, o código some, a cobrança fica sem o nome e o cargo é apagado', async () => {
    const { db, ctx, bucket } = cenario();
    const r = await executeAccountDeletion(ctx, 'ana', { actor: { uid: 'admin', name: 'Dono' }, reason: 'pedido', hojeISO: '2026-10-25', FieldValue: FakeFieldValue });
    expect(r.status).not.toBe('blocked');
    expect(db.store.docs.get('club_x/c1/aff/ana')).toMatchObject({ status: 'cancelled', user_name: REMOVED_ATHLETE, photo_url: null, card_code: null, note: '' });
    expect(db.store.docs.get('club_card_index/ABCDEFGH23')).toBeUndefined();
    expect(db.store.docs.get('club_x/c1/charges/k1')).toMatchObject({ payer_name: REMOVED_ATHLETE, member_name: '', status: 'paid', amount_cents: 12000 });
    expect(db.store.docs.get('club_x/c1/staff/ana')).toBeUndefined();
    // as contas ficam (o clube presta contas), sem o nome de quem as preparou
    expect(db.store.docs.get('club_x/c1/ledger/l1')).toMatchObject({ created_by_name: 'Usuário removido', amount_cents: 500, status: 'posted' });
    expect(db.store.docs.get('club_x/c1/reports/2026')).toMatchObject({ opened_by_name: 'Usuário removido', status: 'draft' });
    // o ato publicado é registro do clube: fica, sem o nome de quem o preparou e publicou
    expect(db.store.docs.get('club_x/c1/docs/d1')).toMatchObject({ created_by_name: 'Usuário removido', published_by_name: 'Usuário removido', status: 'published', title: 'Regimento' });
    // o evento da agenda oficial também fica, sem o nome de quem o marcou
    expect(db.store.docs.get('club_x/c1/events/e1')).toMatchObject({ created_by_name: 'Usuário removido', title: 'Assembleia' });
    // a sanção fica no histórico do clube, sem o nome; a manifestação identificada vira anônima
    expect(db.store.docs.get('club_x/c1/cases/s1')).toMatchObject({ user_name: REMOVED_ATHLETE, kind: 'warning', status: 'active' });
    expect(db.store.docs.get('club_x/c1/ombud/o1')).toMatchObject({ reporter_uid: null, anonymous: true, body: 'Relato identificado' });
    // o bem do patrimônio fica; só o nome dela sai do histórico e de quem emprestou (o nome da Bia, no mesmo bem, fica)
    const bem = db.store.docs.get('club_x/c1/assets/b1');
    expect(bem.name).toBe('Rede');
    expect(bem.history.map((h) => h.by_name)).toEqual(['Usuário removido', 'Bia']);
    expect(bem.loans.map((l) => l.lent_by_name)).toEqual(['Usuário removido', 'Bia']);
    expect(bem.loans[0].borrower_name).toBe('Arena Sol');
    // proteção de menores: o registro, o responsável do menor e a certidão pendente são apagados (nada deles fica)
    expect(db.store.docs.get('club_x/c1/safeguard/ana')).toBeUndefined();
    expect(db.store.docs.get('club_x/c1/minors/ana')).toBeUndefined();
    expect(bucket.arquivos).toEqual(['clube-protecao/bia/cert.pdf']);
  });

  it('a associação de outra pessoa não é tocada', async () => {
    const { db, ctx } = cenario();
    await executeAccountDeletion(ctx, 'ana', { actor: { uid: 'admin', name: 'Dono' }, reason: 'pedido', hojeISO: '2026-10-25', FieldValue: FakeFieldValue });
    expect(db.store.docs.get('club_x/c1/aff/bia')).toMatchObject({ status: 'active', user_name: 'Bia', card_code: 'ZZZZZZZZ22' });
    expect(db.store.docs.get('club_card_index/ZZZZZZZZ22')).toBeTruthy();
    expect(db.store.docs.get('club_x/c1/charges/k2')).toMatchObject({ payer_name: 'Bia' });
    expect(db.store.docs.get('club_x/c1/ledger/l2')).toMatchObject({ created_by_name: 'Bia' });
    expect(db.store.docs.get('club_x/c1/docs/d2')).toMatchObject({ created_by_name: 'Bia', published_by_name: 'Bia' });
    expect(db.store.docs.get('club_x/c1/events/e2')).toMatchObject({ created_by_name: 'Bia' });
    expect(db.store.docs.get('club_x/c1/cases/s2')).toMatchObject({ user_name: 'Bia' });
    expect(db.store.docs.get('club_x/c1/ombud/o2')).toMatchObject({ reporter_uid: 'bia', anonymous: false });
    expect(db.store.docs.get('club_x/c1/assets/b2').history[0].by_name).toBe('Bia');
    expect(db.store.docs.get('club_x/c1/safeguard/bia')).toMatchObject({ name: 'Bia' });
    expect(db.store.docs.get('club_x/c1/minors/bia')).toMatchObject({ guardian: { name: 'Pai do Bia' } });
  });
});

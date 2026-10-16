/**
 * Exclusão de cadastro — e-mail e celular. Protege: o código do celular e o
 * registro do que a pessoa recebeu somem; o bloqueio de envio fica, sem o
 * endereço (vale pelo hash); o aviso que ela mandou a outra pessoa fica com
 * quem recebeu, sem ela; a denúncia fica (moderação).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { executeAccountDeletion } = require('../functions/accountDeletion.js');
const { createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const HOJE = '2026-10-16';
const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };

describe('exclusão de conta: e-mail e celular', () => {
  it('⭐ apaga o que é dela, tira o endereço do bloqueio e mantém o resto', async () => {
    const db = createFakeDb({
      'users/ana': { uid: 'ana', full_name: 'Ana Souza' },
      'users/bia': { uid: 'bia', full_name: 'Bia Lima' },
      'phone_verifications/ana': { code_hash: 'x' },
      'message_outbox/n1_email': { user_id: 'ana', channel: 'email', to_masked: 'a•••a@x.com', cost_brl: 0 },
      'message_outbox/n2_email': { user_id: 'bia', sent_by: 'ana', channel: 'email', k_sender: 'ana|2026-10-16|email', k_pair: 'ana|bia|2026-10-16', cost_brl: 0 },
      'message_outbox/n3_sms': { user_id: 'bia', channel: 'sms', cost_brl: 0.1 },
      'message_suppressions/h1': { channel: 'email', address: 'ana@x.com', user_ids: ['ana'], reason: 'complaint' },
      'message_suppressions/h2': { channel: 'sms', address: '+5551999998888', user_ids: ['bia'], reason: 'stop' },
      'message_reports/r1': { reporter_uid: 'ana', sender_uid: 'bia', status: 'open' },
    });
    const ctx = { db, auth: createFakeAuth(['ana', 'bia'], { log: db.store.log }), bucket: createFakeBucket([]) };
    const antes = new Set(db.store.docs.keys());
    const r = await executeAccountDeletion(ctx, 'ana', { actor: ADMIN, reason: 'pedido da titular', hojeISO: HOJE, FieldValue: FakeFieldValue });
    expect(r.status).toBe('deleted');
    const sumiram = [...antes].filter((p) => !db.store.docs.has(p)).sort();
    expect(sumiram).toEqual(['message_outbox/n1_email', 'phone_verifications/ana', 'users/ana']);
    const g = (p) => db.store.docs.get(p);
    expect(g('message_suppressions/h1')).toMatchObject({ address: null, masked: null, user_ids: [], reason: 'complaint' });
    expect(g('message_suppressions/h2').address).toBe('+5551999998888');
    expect(g('message_outbox/n2_email')).toMatchObject({ user_id: 'bia', sent_by: null, k_sender: null, k_pair: null });
    expect(g('message_outbox/n3_sms')).toMatchObject({ user_id: 'bia', cost_brl: 0.1 });
    expect(g('message_reports/r1')).toMatchObject({ reporter_uid: 'ana', status: 'open' });
  });
});

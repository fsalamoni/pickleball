/**
 * Exclusão de cadastro — a MINHA CARREIRA, com as especificações REAIS, contra
 * o Firestore falso:
 *  1. os torneios de fora da pessoa e os pedidos da dupla (dos dois lados) somem;
 *  2. ⭐ no registro de OUTRA pessoa em que ela foi a dupla, fica o nome e sai
 *     só o vínculo com a conta (`partner.uid`, `partner_uids`, `linked_event`);
 *  3. nenhum outro documento de outra pessoa é apagado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { executeAccountDeletion, patchCareerPartner } = require('../functions/accountDeletion.js');
const {
  createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue,
} = require('../tests/fakes/fakeFirestore.cjs');

const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };

function cenario() {
  const db = createFakeDb({
    'users/bia': { uid: 'bia', full_name: 'Bia' },
    'users/ana': { uid: 'ana', full_name: 'Ana' },
    'career_events/bia_1': { uid: 'bia', name: 'Open', start_date: '2026-05-01', entries: [{ format: 'doubles', partner: { uid: 'ana', name: 'Ana' } }], partner_uids: ['ana'] },
    'career_events/ana_1': {
      uid: 'ana', name: 'Open', start_date: '2026-05-01',
      entries: [{ format: 'doubles', partner: { uid: 'bia', name: 'Bia' } }, { format: 'doubles', partner: { uid: 'cau', name: 'Cau' } }],
      partner_uids: ['bia', 'cau'], linked_event: { uid: 'bia', id: 'bia_1' },
    },
    'career_events/ana_2': { uid: 'ana', name: 'Etapa', start_date: '2026-06-01', entries: [{ format: 'singles' }], partner_uids: [] },
    'career_partner/bia_1__ana': { owner_uid: 'bia', partner_uid: 'ana', event_id: 'bia_1', status: 'confirmed' },
    'career_partner/ana_1__bia': { owner_uid: 'ana', partner_uid: 'bia', event_id: 'ana_1', status: 'confirmed', feedback: { improve: ['dink'] } },
    'career_partner/ana_1__cau': { owner_uid: 'ana', partner_uid: 'cau', event_id: 'ana_1', status: 'invited' },
    // Convites pelo WhatsApp (PR 6): o de quem sai some; o dos outros fica.
    'career_partner_invites/h1': { owner_uid: 'bia', event_id: 'bia_1', name_key: 'ze' },
    'career_partner_invites/h2': { owner_uid: 'ana', event_id: 'ana_1', name_key: 'lia' },
  });
  const auth = createFakeAuth(['bia', 'ana'], { log: db.store.log });
  const bucket = createFakeBucket(['carreira/bia/a.webp']);
  return { db, ctx: { db, auth, bucket } };
}

describe('exclusão de conta × Minha carreira', () => {
  it('⭐ some o que é da pessoa; no registro dos outros fica só o nome', async () => {
    const { db, ctx } = cenario();
    const antes = new Map(db.store.docs);
    await executeAccountDeletion(ctx, 'bia', { actor: ADMIN, reason: 'pedido da titular', hojeISO: '2026-11-04', FieldValue: FakeFieldValue });
    const sumiram = [...antes.keys()].filter((p) => !db.store.docs.has(p)).sort();
    expect(sumiram).toEqual(['career_events/bia_1', 'career_partner/ana_1__bia', 'career_partner/bia_1__ana', 'career_partner_invites/h1', 'users/bia']);
    const ana = db.store.docs.get('career_events/ana_1');
    expect(ana.entries[0].partner).toEqual({ name: 'Bia' });
    expect(ana.entries[1].partner).toEqual({ uid: 'cau', name: 'Cau' });
    expect(ana.partner_uids).toEqual(['cau']);
    expect(ana.linked_event).toBeNull();
    expect(db.store.docs.get('career_events/ana_2')).toEqual(antes.get('career_events/ana_2'));
  });

  it('🔴 o nome e a foto de quem sai somem da vitrine pública de OUTRA pessoa na hora (sem depender do gatilho)', async () => {
    const { db, ctx } = cenario();
    db.store.docs.set('career_public/ana_1', {
      uid: 'ana', event_id: 'ana_1', seal: 'confirmed', named_uids: ['bia', 'cau'],
      entries: [{ format: 'doubles', placement: 'champion', partner: { uid: 'bia', name: 'Bia', photo_url: 'https://f/bia' } }, { format: 'doubles', partner: { uid: 'cau', name: 'Cau', photo_url: null } }],
    });
    db.store.docs.set('career_public/bia_1', { uid: 'bia', event_id: 'bia_1', named_uids: [], entries: [] });
    await executeAccountDeletion(ctx, 'bia', { actor: ADMIN, reason: 'pedido da titular', hojeISO: '2026-11-04', FieldValue: FakeFieldValue });
    const v = db.store.docs.get('career_public/ana_1');
    expect(v.entries[0]).toEqual({ format: 'doubles', placement: 'champion', with_partner: true });
    expect(v.entries[1].partner.uid).toBe('cau');
    expect(v.named_uids).toEqual(['cau']);
    expect(JSON.stringify(v)).not.toContain('bia');
    expect(db.store.docs.has('career_public/bia_1')).toBe(false);
  });

  it('o registro que não cita a pessoa não muda', () => {
    expect(patchCareerPartner({ entries: [{ partner: { uid: 'x', name: 'X' } }] }, 'bia')).toBeNull();
    expect(patchCareerPartner(null, 'bia')).toBeNull();
  });
});

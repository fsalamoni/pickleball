/**
 * O que os clubes guardam da PRÓPRIA pessoa (Firestore falso): a leitura é sempre pelo uid de quem
 * chama, `pending` só olha os clubes de que ela é membro, `export` também os de que já saiu, e o que
 * é só de gestão ou credencial (nota interna, código da carteirinha) nunca sai.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cm = require('./clubMine.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 25, 15, 0, 0);
const ctx = (db) => ({ db, now: NOW, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const ANA = { uid: 'ana' };
const BIA = { uid: 'bia' };

function cenario(extra = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: true } },
    'clubs/c1': { name: 'Clube Um', association: { enabled: true, published: true } },
    'clubs/c2': { name: 'Clube Dois', association: { enabled: true, published: true } },
    'clubs/c3': { name: 'Clube Três' },
    'club_members/c1_ana': { club_id: 'c1', user_id: 'ana', role: 'member' },
    'club_members/c3_ana': { club_id: 'c3', user_id: 'ana', role: 'member' },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', status: 'active', valid_until: '2027-01-01', card_code: 'ABCDEFGH23', note: 'nota interna da secretaria' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', status: 'active' },
    'club_x/c1/charges/k1': { club_id: 'c1', user_id: 'ana', status: 'open', amount_cents: 12000 },
    'club_x/c1/charges/k2': { club_id: 'c1', user_id: 'bia', status: 'open', amount_cents: 9000 },
    'club_x/c1/cases/s1': { club_id: 'c1', user_id: 'ana', kind: 'warning', status: 'active' },
    'club_x/c1/callup_members/cm1': { club_id: 'c1', user_id: 'ana', status: 'invited', expires_at_ms: NOW + 86400000, staff_note: 'só da comissão' },
    'club_x/c1/elections/el1': { club_id: 'c1', title: 'Eleição 2027', status: 'voting', calendar: { voting_from: '2026-10-24', voting_to: '2026-10-28' } },
    'club_x/c1/voters/ana': { club_id: 'c1', election_id: 'el1', user_id: 'ana', kind: 'person', weight: 1, voted_at_ms: null, receipt: 'RECIBO' },
    'club_x/c1/staff/ana': { user_id: 'ana', perms: ['finance'] },
    'club_x/c1/ombud/o1': { club_id: 'c1', reporter_uid: 'ana', kind: 'conduct', status: 'open' },
    'club_x/c1/ombud/o2': { club_id: 'c1', reporter_uid: 'bia', kind: 'conduct', status: 'open' },
    'club_x/c2/aff/ana': { club_id: 'c2', user_id: 'ana', status: 'cancelled' },
    ...extra,
  });
}

describe('clubMine — pendências (pending)', () => {
  it('⭐ só olha os clubes de que a pessoa é membro e só os dados dela', async () => {
    const db = cenario();
    const r = await cm.mine(ctx(db), ANA, { scope: 'pending' });
    expect(r.incomplete).toBe(false);
    // c1 (membro, associação ligada); c2 (já saiu) e c3 (sem associação) não entram
    expect(r.clubs.map((c) => c.club_id)).toEqual(['c1']);
    const c = r.clubs[0];
    expect(c.charges.map((x) => x.id)).toEqual(['k1']);
    expect(c.sanctions.map((x) => x.id)).toEqual(['s1']);
    expect(c.callup_invites.map((x) => x.id)).toEqual(['cm1']);
    expect(c.elections).toEqual([expect.objectContaining({ id: 'el1', status: 'voting', voted: false })]);
    // o escopo enxuto não leva o que só a exportação precisa
    expect(c.ombud_reports).toBeUndefined();
    expect(c.staff_role).toBeUndefined();
  });

  it('quem não tem nada em clube nenhum recebe lista vazia', async () => {
    const r = await cm.mine(ctx(cenario()), { uid: 'zeca' }, { scope: 'pending' });
    expect(r).toEqual({ clubs: [], incomplete: false, failed: 0 });
  });

  it('com a flag desligada, recusa', async () => {
    const db = cenario({ 'platform_settings/global': { feature_flags: { club_association: false } } });
    await expect(cm.mine(ctx(db), ANA, { scope: 'pending' })).rejects.toThrow();
  });
});

describe('clubMine — exportação (export)', () => {
  it('⭐ traz tudo da pessoa, inclusive o clube de que já saiu, e nada da Bia', async () => {
    const db = cenario();
    const r = await cm.mine(ctx(db), ANA, { scope: 'export' });
    expect(r.clubs.map((c) => c.club_id).sort()).toEqual(['c1', 'c2']);
    const c1 = r.clubs.find((c) => c.club_id === 'c1');
    expect(c1.aff).toMatchObject({ id: 'ana', status: 'active' });
    expect(c1.staff_role).toMatchObject({ perms: ['finance'] });
    expect(c1.ombud_reports.map((o) => o.id)).toEqual(['o1']);
    expect(c1.charges.map((x) => x.id)).toEqual(['k1']);
    expect(JSON.stringify(r)).not.toContain('"bia"');
  });

  it('⭐ a nota interna, o código da carteirinha, a nota da comissão e o recibo da votação não saem', async () => {
    const r = await cm.mine(ctx(cenario()), ANA, { scope: 'export' });
    const txt = JSON.stringify(r);
    expect(txt).not.toContain('nota interna da secretaria');
    expect(txt).not.toContain('ABCDEFGH23');
    expect(txt).not.toContain('só da comissão');
    expect(txt).not.toContain('RECIBO');
  });

  it('a outra pessoa só vê a própria filiação', async () => {
    const r = await cm.mine(ctx(cenario()), BIA, { scope: 'export' });
    expect(r.clubs.map((c) => c.club_id)).toEqual(['c1']);
    expect(r.clubs[0].charges.map((x) => x.id)).toEqual(['k2']);
    expect(r.clubs[0].ombud_reports.map((x) => x.id)).toEqual(['o2']);
  });
});

describe('limpa', () => {
  it('Timestamp vira ISO e as chaves de gestão saem em qualquer profundidade', () => {
    const out = cm.limpa({ at: { toMillis: () => Date.UTC(2026, 0, 2) }, nested: { note: 'x', keep: 1 }, list: [{ card_code: 'y', ok: true }] });
    expect(out).toEqual({ at: '2026-01-02T00:00:00.000Z', nested: { keep: 1 }, list: [{ ok: true }] });
  });
});

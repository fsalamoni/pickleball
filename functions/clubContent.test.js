/**
 * Vantagens e comunicados do clube no SERVIDOR (Firestore falso): o "como usar"
 * e o código só chegam a quem tem filiação em dia e plano que a vantagem
 * alcança; o aviso do comunicado sai uma vez só, para os associados em dia, e
 * só a comunicação (ou a administração) o dispara.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cc = require('./clubContent.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 25, 15, 0, 0);
const ctx = (db, now = NOW) => ({ db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const PRES = { uid: 'pres' };
const COM = { uid: 'com' };
const SEC = { uid: 'sec' };
const ANA = { uid: 'ana' };
const BIA = { uid: 'bia' };
const CAIO = { uid: 'caio' };
const ZE = { uid: 'ze' };

function cenario() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: true } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: true, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_com': { club_id: 'c1', user_id: 'com', role: 'member' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_x/c1/staff/com': { club_id: 'c1', user_id: 'com', perms: ['comms'], is_master: false, term_end_ms: 0 },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', perms: ['members'], is_master: false, term_end_ms: 0 },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', status: 'active', plan_id: 'anual', valid_until: '2027-01-01' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', status: 'active', plan_id: 'livre', valid_until: '' },
    'club_x/c1/aff/caio': { club_id: 'c1', user_id: 'caio', status: 'active', plan_id: 'anual', valid_until: '2026-09-01' }, // venceu
    'club_x/c1/aff/ze': { club_id: 'c1', user_id: 'ze', status: 'suspended', plan_id: 'anual', valid_until: '2027-01-01' },
    'club_x/c1/benefits/todos': { club_id: 'c1', title: 'Café', active: true, has_secret: true, public: true },
    'club_x/c1/benefits/so-anual': { club_id: 'c1', title: 'Quadra prioritária', active: true, plan_ids: ['anual'], has_secret: false },
    'club_x/c1/benefits/pausada': { club_id: 'c1', title: 'Pausada', active: false },
    'club_x/c1/benefits/velha': { club_id: 'c1', title: 'Velha', active: true, valid_until: '2026-01-01' },
    'club_x/c1/bsec/todos': { how_to: 'Diga o código no caixa', code: 'CLUBE10' },
    'club_x/c1/news/pub': { club_id: 'c1', title: 'Assembleia', summary: 'Dia 10', body: 'Todos convidados', status: 'published', audience: 'public' },
    'club_x/c1/news/rasc': { club_id: 'c1', title: 'Rascunho', body: 'ainda não', status: 'draft', audience: 'public' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const content = (db, actor, data) => cc.content(ctx(db), actor, { clubId: 'c1', ...data });
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

describe('vantagens do associado', () => {
  it('quem está em dia recebe as vantagens no ar do seu plano, com o segredo', async () => {
    const db = cenario();
    const r = await content(db, ANA, { action: 'benefits' });
    expect(r.eligible).toBe(true);
    expect(r.items.map((b) => b.id).sort()).toEqual(['so-anual', 'todos']);
    expect(r.items.find((b) => b.id === 'todos')).toMatchObject({ how_to: 'Diga o código no caixa', code: 'CLUBE10' });
    expect(r.items.find((b) => b.id === 'so-anual').code).toBeUndefined();
  });

  it('o plano gratuito não recebe a vantagem restrita ao anual', async () => {
    const r = await content(cenario(), BIA, { action: 'benefits' });
    expect(r.items.map((b) => b.id)).toEqual(['todos']);
  });

  it('⭐ vencida, suspensa ou sem filiação: nada do segredo', async () => {
    for (const quem of [CAIO, ZE, SEC]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await content(cenario(), quem, { action: 'benefits' });
      expect(r).toEqual({ eligible: false, items: [] });
    }
  });

  it('associação desligada no clube: ninguém recebe', async () => {
    const db = cenario();
    db.store.docs.set('clubs/c1', { name: 'Clube Pickle Sul', association: { enabled: false } });
    expect(await content(db, ANA, { action: 'benefits' })).toEqual({ eligible: false, items: [] });
  });

  it('flag desligada recusa', async () => {
    const db = cenario();
    db.store.docs.set('platform_settings/global', { feature_flags: { club_association: false } });
    await expect(content(db, ANA, { action: 'benefits' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('aviso do comunicado', () => {
  it('a comunicação avisa os associados em dia, uma vez só', async () => {
    const db = cenario();
    const r = await content(db, COM, { action: 'news_notify', newsId: 'pub' });
    expect(r).toEqual({ ok: true, count: 2 }); // ana e bia (caio venceu, zé está suspenso)
    expect(avisosPara(db, 'ana')).toHaveLength(1);
    expect(avisosPara(db, 'bia')).toHaveLength(1);
    expect(avisosPara(db, 'caio')).toHaveLength(0);
    expect(avisosPara(db, 'ze')).toHaveLength(0);
    expect(avisosPara(db, 'ana')[0].link).toBe('/clubes/c1?tab=comunicados&noticia=pub');
    expect(avisosPara(db, 'ana')[0].link).not.toContain('#');
    expect(doc(db, 'club_x/c1/news/pub')).toMatchObject({ notified_count: 2, notified_by: 'com' });
    await expect(content(db, COM, { action: 'news_notify', newsId: 'pub' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('a administração também avisa', async () => {
    const db = cenario();
    await expect(content(db, PRES, { action: 'news_notify', newsId: 'pub' })).resolves.toMatchObject({ ok: true });
  });

  it('a secretaria e o estranho não avisam', async () => {
    const db = cenario();
    await expect(content(db, SEC, { action: 'news_notify', newsId: 'pub' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(content(db, ZE, { action: 'news_notify', newsId: 'pub' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rascunho não avisa; comunicado inexistente, também não', async () => {
    const db = cenario();
    await expect(content(db, COM, { action: 'news_notify', newsId: 'rasc' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(content(db, COM, { action: 'news_notify', newsId: 'nada' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('ação desconhecida é recusada', async () => {
    await expect(content(cenario(), COM, { action: 'zzz' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

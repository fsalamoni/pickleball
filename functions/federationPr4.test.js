/**
 * Federações PR 4 no servidor (Firestore falso): o aviso da notícia aos
 * filiados ATIVOS (uma vez só, dependente avisa o responsável, só a equipe de
 * comunicação, só publicada, só com o módulo) e quem opera a loja oficial da
 * federação no Mercado (admin ou financeiro da equipe).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const news = require('./federationNews.js');
const market = require('./marketplace.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const ctx = (db) => ({ db, now: NOW, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: FakeFieldValue, logger: { info() {}, warn() {} } });
const COM = { uid: 'com' };
const SEC = { uid: 'sec' };

function cenario({ modules = { news: true } } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', modules },
    'federation_staff/fpp_com': { federation_id: 'fpp', user_id: 'com', role: 'communication' },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_staff/fpp_tes': { federation_id: 'fpp', user_id: 'tes', role: 'treasurer' },
    'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', role: 'president' },
    'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', status: 'active' },
    'federation_members/fpp_dep_1': { federation_id: 'fpp', user_id: null, guardian_uid: 'ana', status: 'active' },
    'federation_members/fpp_bia': { federation_id: 'fpp', user_id: 'bia', status: 'active' },
    'federation_members/fpp_caio': { federation_id: 'fpp', user_id: 'caio', status: 'awaiting_payment' },
    'federation_news/n1': { federation_id: 'fpp', title: 'Etapa estadual', body: 'Inscrições abertas até sexta.', status: 'published', visibility: 'members' },
    'federation_news/n2': { federation_id: 'fpp', title: 'Rascunho', body: 'Ainda não.', status: 'draft' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const avisos = (db) => [...db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);

describe('PR 4: aviso da notícia', () => {
  it('avisa cada filiado ativo uma vez (o dependente avisa o responsável) e marca a notícia', async () => {
    const db = cenario();
    const r = await news.notify(ctx(db), COM, { newsId: 'n1' });
    expect(r).toEqual({ ok: true, count: 2 });
    expect(avisos(db).map((a) => a.user_id).sort()).toEqual(['ana', 'bia']);
    expect(avisos(db)[0].link).toBe('/federacoes/fpp?noticia=n1');
    expect(doc(db, 'federation_news/n1')).toMatchObject({ notified_count: 2, notified_by: 'com' });
    await expect(news.notify(ctx(db), COM, { newsId: 'n1' })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(avisos(db)).toHaveLength(2);
  });

  it('recusa quem não é da comunicação, rascunho e federação sem o módulo', async () => {
    await expect(news.notify(ctx(cenario()), SEC, { newsId: 'n1' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(news.notify(ctx(cenario()), COM, { newsId: 'n2' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(news.notify(ctx(cenario({ modules: {} })), COM, { newsId: 'n1' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('PR 4: loja oficial no Mercado', () => {
  it('quem opera a chave da federação é a equipe com admin ou financeiro', async () => {
    const uids = await market.operatorUids(cenario(), 'federation_fpp');
    expect(uids.sort()).toEqual(['pres', 'tes']);
  });
});

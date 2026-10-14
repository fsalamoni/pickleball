/**
 * Os avisos que trazem a pessoa de volta ao Mercado, contra o Firestore falso:
 * a busca salva que ganhou anúncio novo e o preço que baixou no favorito.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const m = require('./marketplace.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const dia = 86400000;
const agora = Date.UTC(2026, 9, 14, 13);
const avisos = (db) => [...db.store.docs.entries()].filter(([k]) => k.startsWith('notifications/')).map(([, v]) => v);

function cenario(extra = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { marketplace: true } },
    'market_listings/L1': { status: 'active', quantity: 1, title: 'Raquete JOOLA', type: 'product_used', price_cents: 50000, published_at: agora - dia, created_by: 'vend', seller_key: 'athlete_vend' },
    'market_listings/L2': { status: 'active', quantity: 1, title: 'Raquete velha', type: 'product_used', price_cents: 50000, published_at: agora - 9 * dia, created_by: 'vend', seller_key: 'athlete_vend' },
    'market_saved_searches/B1': { uid: 'eu', label: 'raquete', params: 'q=raquete', notify: true, created_at_ms: agora - 5 * dia },
    'market_saved_searches/B2': { uid: 'eu', label: 'bola', params: 'q=bola', notify: true, created_at_ms: agora - 5 * dia },
    'market_saved_searches/B3': { uid: 'mudo', label: 'raquete', params: 'q=raquete', notify: false, created_at_ms: 0 },
    ...extra,
  });
}

describe('aviso das buscas salvas', () => {
  it('avisa só o que chegou depois de salvar, uma vez por dia', async () => {
    const db = cenario();
    expect(await m.savedSearchAlerts({ db, now: agora })).toEqual({ sent: 1 });
    const [a] = avisos(db);
    expect(a).toMatchObject({ user_id: 'eu', link: '/mercado/buscas?abrir=B1' });
    expect(a.message).toContain('Raquete JOOLA');
    expect(db.store.docs.get('market_saved_searches/B1').last_alert_ms).toBe(agora);
    // No mesmo dia, nada de novo aviso; no dia seguinte, sem anúncio novo, também não.
    expect(await m.savedSearchAlerts({ db, now: agora + 3600000 })).toEqual({ sent: 0 });
    expect(await m.savedSearchAlerts({ db, now: agora + dia })).toEqual({ sent: 0 });
  });

  it('Mercado desligado não avisa ninguém', async () => {
    const db = cenario({ 'platform_settings/global': { feature_flags: { marketplace: false } } });
    expect(await m.savedSearchAlerts({ db, now: agora })).toEqual({ sent: 0 });
  });
});

describe('aviso de preço baixou', () => {
  const antes = { status: 'active', price_cents: 50000, title: 'Raquete JOOLA', seller_key: 'athlete_vend' };
  const favs = {
    'market_favorites/f1': { uid: 'fa', listing_id: 'L1' },
    'market_favorites/f2': { uid: 'vend', listing_id: 'L1' },
  };

  it('avisa quem favoritou (não quem vende) e guarda o piso', async () => {
    const db = cenario(favs);
    expect(await m.notifyPriceDrop({ db, now: agora }, 'L1', antes, { ...antes, price_cents: 40000 })).toBe(1);
    const [a] = avisos(db);
    expect(a).toMatchObject({ user_id: 'fa', title: 'Baixou 20%: Raquete JOOLA', link: '/mercado/anuncio/L1' });
    expect(db.store.docs.get('market_listings/L1').price_alert_cents).toBe(40000);
  });

  it('subir e descer de novo até o mesmo preço não avisa outra vez', async () => {
    const db = cenario(favs);
    const piso = { ...antes, price_cents: 45000, price_alert_cents: 40000 };
    expect(await m.notifyPriceDrop({ db, now: agora }, 'L1', { ...antes, price_cents: 50000 }, piso)).toBe(0);
    expect(avisos(db)).toEqual([]);
  });

  it('subida, anúncio pausado ou preço igual não avisam', async () => {
    const db = cenario(favs);
    expect(await m.notifyPriceDrop({ db, now: agora }, 'L1', antes, { ...antes, price_cents: 60000 })).toBe(0);
    expect(await m.notifyPriceDrop({ db, now: agora }, 'L1', antes, { ...antes, price_cents: 30000, status: 'paused' })).toBe(0);
    expect(await m.notifyPriceDrop({ db, now: agora }, 'L1', antes, antes)).toBe(0);
    expect(avisos(db)).toEqual([]);
  });
});

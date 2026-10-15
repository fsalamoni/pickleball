import { describe, it, expect } from 'vitest';
import {
  effectiveListing, normalizeVariants, variantQuantity,
  validateListingInput, buildSearchTerms, tokenize, coverOf, buyability, parseVideoLink, listingCompleteness,
  duplicateListingInput, publishBlockers, vacationState,
} from './listing.js';

const base = {
  title: 'Raquete JOOLA Perseus 16mm', category_slug: 'raquete-controle', type: 'product_used',
  condition: 'like_new', price_cents: 90000, quantity: 1, fulfillment: ['meetup'],
  media: [{ url: 'https://x/a.webp' }], city: 'São Paulo', state: 'sp', attributes: { marca: 'JOOLA', core_mm: '16' },
};

describe('anúncio', () => {
  it('normaliza um anúncio válido para publicar', () => {
    const r = validateListingInput(base, { publish: true });
    expect(r.ok).toBe(true);
    expect(r.value.state).toBe('SP');
    expect(r.value.brand).toBe('JOOLA');
    expect(r.value.category_path).toEqual(['raquetes', 'raquete-controle']);
    expect(r.value.media[0].is_cover).toBe(true);
    expect(r.value.search_terms).toEqual(expect.arrayContaining(['raquete', 'joola', 'perseus', 'usado', 'sao', 'paulo', 'controle']));
  });
  it('rascunho aceita sem foto; publicar exige foto, cidade e entrega', () => {
    const semFoto = { ...base, media: [], city: '' };
    expect(validateListingInput(semFoto).errors.media).toBeUndefined();
    const pub = validateListingInput(semFoto, { publish: true });
    expect(pub.errors.media).toBeTruthy();
    expect(pub.errors.city).toBeTruthy();
    expect(validateListingInput({ ...base, fulfillment: [] }).errors.fulfillment).toBeTruthy();
  });
  it('usado precisa do estado; novo é sempre novo', () => {
    expect(validateListingInput({ ...base, condition: '' }).errors.condition).toBeTruthy();
    expect(validateListingInput({ ...base, type: 'product_new', condition: 'fair' }).value.condition).toBe('new');
  });
  it('🐞 "Usado" do editor continua usado (o apelido curto não vira novo)', () => {
    const v = validateListingInput({ ...base, type: 'used', condition: 'good' }).value;
    expect(v.type).toBe('product_used');
    expect(v.condition).toBe('good');
  });
  it('preço "de" menor que o preço é erro', () => {
    expect(validateListingInput({ ...base, compare_at_cents: 50000 }).errors.compare_at_cents).toBeTruthy();
    expect(validateListingInput({ ...base, compare_at_cents: 120000 }).value.compare_at_cents).toBe(120000);
  });
  it('envio sem valor precisa de "a combinar"', () => {
    const r = validateListingInput({ ...base, fulfillment: ['shipping'] }, { publish: true });
    expect(r.errors.shipping_cents).toBeTruthy();
    expect(validateListingInput({ ...base, fulfillment: ['shipping'], shipping_to_agree: true }, { publish: true }).ok).toBe(true);
  });
  it('só aceita mídia https e no máximo um vídeo', () => {
    const r = validateListingInput({ ...base, media: [{ url: 'http://x' }, { url: 'https://v1', kind: 'video' }, { url: 'https://v2', kind: 'video' }] });
    expect(r.errors.media).toBeTruthy();
  });
  it('link de vídeo só YouTube/Vimeo', () => {
    expect(parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ').provider).toBe('youtube');
    expect(parseVideoLink('https://youtu.be/dQw4w9WgXcQ').id).toBe('dQw4w9WgXcQ');
    expect(parseVideoLink('https://vimeo.com/123456789').provider).toBe('vimeo');
    expect(parseVideoLink('https://malicioso.com/v')).toBeNull();
    expect(validateListingInput({ ...base, video_link: 'https://x.com' }).errors.video_link).toBeTruthy();
  });
  it('tokeniza sem acento e sem palavra vazia', () => {
    expect(tokenize('A raquete de PÉROLA para iniciantes')).toEqual(['raquete', 'perola', 'iniciantes']);
    expect(buildSearchTerms({ title: 'x'.repeat(5) }).length).toBeLessThanOrEqual(60);
  });
  it('capa e completude', () => {
    expect(coverOf({ media: [{ kind: 'video', url: 'v' }, { url: 'a' }] }).url).toBe('a');
    expect(listingCompleteness({ media: [{}, {}, {}, {}], description: 'x'.repeat(300), attributes: { a: 1, b: 2, c: 3 }, video_link: 'y' })).toBe(1);
  });
  it('dá para comprar? diz o motivo', () => {
    expect(buyability({ status: 'active', quantity: 1, seller_uid: 'v' }, { viewerUid: 'c' }).ok).toBe(true);
    expect(buyability({ status: 'active', quantity: 0 }).reason).toBe('Esgotado.');
    expect(buyability({ status: 'paused', quantity: 1 }).ok).toBe(false);
    expect(buyability({ status: 'active', quantity: 1, seller_uid: 'v' }, { viewerUid: 'v' }).own).toBe(true);
  });
  it('a cópia vira rascunho com o título marcado, sem vínculo nem contagens', () => {
    const c = duplicateListingInput({ ...base, id: 'l1', status: 'closed', source: { kind: 'arena_product', id: 'p' }, quantity_sold: 3, favorite_count: 2, seller_key: 'k' });
    expect(c.title).toBe('Raquete JOOLA Perseus 16mm (cópia)');
    expect(c.id).toBeUndefined();
    expect(c.source).toBeUndefined();
    expect(c.quantity_sold).toBeUndefined();
    expect(c.quantity).toBe(1);
    expect(validateListingInput(c).ok).toBe(true);
    expect(validateListingInput(duplicateListingInput({ ...base, title: 'x'.repeat(200) })).errors.title).toBeUndefined();
  });
  it('o que falta para publicar, sem repetir', () => {
    expect(publishBlockers(base)).toEqual([]);
    const faltas = publishBlockers({ ...base, media: [], city: '' });
    expect(faltas).toHaveLength(2);
    expect(faltas.join(' ')).toMatch(/foto/);
  });
  it('modo férias: todos pausados só quando não sobra nada no ar', () => {
    const ls = [{ status: 'active' }, { status: 'paused' }, { status: 'draft' }];
    expect(vacationState(ls).todosPausados).toBe(false);
    expect(vacationState(ls).noAr).toHaveLength(1);
    expect(vacationState([{ status: 'paused' }, { status: 'closed' }]).todosPausados).toBe(true);
    expect(vacationState([{ status: 'paused', admin_paused: true }]).todosPausados).toBe(false);
    expect(vacationState([]).todosPausados).toBe(false);
  });
  it('variações: cada uma com estoque; a quantidade do anúncio é a soma; nome repetido é erro', () => {
    const r = validateListingInput({ ...base, variants: [{ label: 'M', quantity: 2 }, { id: 'g', label: 'G', quantity: '1' }, { label: '  ', quantity: 9 }] });
    expect(r.ok).toBe(true);
    expect(r.value.variants.map((v) => v.label)).toEqual(['M', 'G']);
    expect(r.value.variants[1].id).toBe('g');
    expect(r.value.variants[0].id).toMatch(/^v0_/);
    expect(r.value.quantity).toBe(3);
    expect(variantQuantity(r.value, 'g')).toBe(1);
    expect(variantQuantity(r.value, 'nao-existe')).toBe(0);
    expect(variantQuantity({ ...base, variants: [] }, null)).toBe(1);
    expect(normalizeVariants([{ label: 'Azul', quantity: 1 }, { label: 'azul', quantity: 1 }]).error).toMatch(/mesmo nome/);
    expect(validateListingInput({ ...base, variants: Array.from({ length: 21 }, (_, i) => ({ label: `v${i}`, quantity: 1 })) }).errors.variants).toMatch(/Até 20/);
  });
  it('promoção com prazo: só com preço "de"; vencida, o anúncio lido volta ao preço cheio', () => {
    const ate = Date.now() + 86400000;
    const r = validateListingInput({ ...base, compare_at_cents: 120000, sale_until_ms: ate });
    expect(r.value.sale_until_ms).toBe(ate);
    expect(validateListingInput({ ...base, sale_until_ms: ate }).value.sale_until_ms).toBeNull();
    const l = { ...r.value, id: 'l' };
    expect(effectiveListing(l, ate - 1)).toBe(l);
    const depois = effectiveListing(l, ate + 1);
    expect(depois.price_cents).toBe(120000);
    expect(depois.compare_at_cents).toBeNull();
    expect(depois.sale_until_ms).toBeNull();
    expect(effectiveListing({ price_cents: 10, compare_at_cents: 5, sale_until_ms: 1 }, 2).price_cents).toBe(10);
  });
  it('aceite e recusa automáticos de oferta: só com ofertas ligadas, abaixo do preço e em ordem', () => {
    const r = validateListingInput({ ...base, accepts_offers: true, offer_auto_accept_cents: 80000, offer_auto_decline_cents: 50000 });
    expect(r.ok).toBe(true);
    expect(r.value.offer_auto_accept_cents).toBe(80000);
    expect(r.value.offer_auto_decline_cents).toBe(50000);
    expect(validateListingInput({ ...base, offer_auto_accept_cents: 80000 }).value.offer_auto_accept_cents).toBeNull();
    expect(validateListingInput({ ...base, accepts_offers: true, offer_auto_accept_cents: 90000 }).errors.offer_auto_accept_cents).toBeTruthy();
    expect(validateListingInput({ ...base, accepts_offers: true, offer_auto_accept_cents: 60000, offer_auto_decline_cents: 70000 }).errors.offer_auto_decline_cents).toBeTruthy();
  });
});

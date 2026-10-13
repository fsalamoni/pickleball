import { describe, it, expect } from 'vitest';
import {
  validateListingInput, buildSearchTerms, tokenize, coverOf, buyability, parseVideoLink, listingCompleteness,
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
});

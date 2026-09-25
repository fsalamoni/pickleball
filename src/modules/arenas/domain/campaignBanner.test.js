import { describe, it, expect } from 'vitest';
import {
  BANNER_SOURCE, BANNER_STATE, CAMPAIGN_DESTINATION, CAMPAIGN_DESTINATION_META,
  arenaCampaignBanners, availableDestinations, bannerAltText, campaignBannerState, campaignPlacementText,
  defaultBannerUntil, destinationCta, destinationLink, homeCampaignBanners, normalizeBannerPlacement,
  normalizeCampaignBanner, normalizeDestination,
} from './campaignBanner.js';
import { ARENA_MODULE_ID } from './modules.js';

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media';
const HOJE = '2026-09-25';

describe('⭐ para onde o banner leva', () => {
  const ctx = { arenaId: 'a1', campaignId: 'c9' };
  it('cada destino vira um caminho INTERNO da plataforma', () => {
    const d = (type, target_id) => destinationLink({ type, target_id }, ctx);
    expect(d('details')).toBe('/arenas/a1/campanhas/c9');
    expect(d('booking')).toBe('/arenas/a1#arena-reservar');
    expect(d('open_match')).toBe('/arenas/a1#arena-jogos-abertos');
    expect(d('game_day', 'gd1')).toBe('/dia-de-jogo/gd1');
    expect(d('tournament', 't1')).toBe('/torneios/t1');
    expect(d('product', 'p1')).toBe('/arenas/a1/loja?produto=p1');
    expect(d('members')).toBe('/arenas/a1#arena-planos');
    expect(d('classes')).toBe('/arenas/a1#arena-aulas');
    expect(d('promos')).toBe('/arenas/a1#arena-promocoes');
    expect(d('ranking')).toBe('/arenas/a1/torneios');
  });
  it('destino que pede alvo e não tem cai na seção da arena — nunca numa página quebrada', () => {
    expect(destinationLink({ type: 'game_day' }, ctx)).toBe('/arenas/a1#arena-dia-de-jogo');
    expect(destinationLink({ type: 'tournament' }, ctx)).toBe('/arenas/a1#arena-torneios');
    expect(destinationLink({ type: 'product' }, ctx)).toBe('/arenas/a1#arena-loja');
  });
  it('o alvo é codificado (não vira pedaço de outro caminho)', () => {
    expect(destinationLink({ type: 'tournament', target_id: '../admin' }, ctx)).toBe('/torneios/..%2Fadmin');
  });
  it('tipo desconhecido vira a página da campanha', () => {
    expect(destinationLink({ type: 'http://fora.com' }, ctx)).toBe('/arenas/a1/campanhas/c9');
    expect(normalizeDestination({ type: 'hack' }).value.type).toBe(CAMPAIGN_DESTINATION.DETAILS);
  });
  it('destino com alvo exige o alvo; sem alvo, descarta o que veio', () => {
    expect(normalizeDestination({ type: 'tournament' }).errors.target_id).toMatch(/torneio/);
    expect(normalizeDestination({ type: 'booking', target_id: 'x' }).value.target_id).toBe('');
    expect(normalizeDestination({ type: 'product', target_id: 'p1', target_label: 'Água' }).value)
      .toEqual({ type: 'product', target_id: 'p1', target_label: 'Água' });
  });
  it('só oferece destinos cujo módulo a arena ligou', () => {
    const lista = availableDestinations((m) => m !== ARENA_MODULE_ID.PDV);
    expect(lista).not.toContain(CAMPAIGN_DESTINATION.PRODUCT);
    expect(lista).toContain(CAMPAIGN_DESTINATION.BOOKING);
    expect(lista).toContain(CAMPAIGN_DESTINATION.TOURNAMENT);
  });
  it('o botão: o que a arena escreveu, senão o do destino', () => {
    expect(destinationCta({ type: 'booking' }, { cta: '' })).toBe(CAMPAIGN_DESTINATION_META.booking.cta);
    expect(destinationCta({ type: 'booking' }, { cta: 'Bora' })).toBe('Bora');
  });
});

describe('o banner da campanha', () => {
  it('sem banner é permitido (campanha só de aviso)', () => {
    expect(normalizeCampaignBanner(null)).toEqual({ valid: true, errors: {}, warnings: [], value: null });
  });
  it('desenho: normaliza o desenho e guarda o modelo de origem', () => {
    const r = normalizeCampaignBanner({ source: 'design', template_id: 'oferta', design: { title: 'Oi', layout: 'oferta', highlight: '10%' } });
    expect(r.valid).toBe(true);
    expect(r.value.source).toBe(BANNER_SOURCE.DESIGN);
    expect(r.value.template_id).toBe('oferta');
    expect(normalizeCampaignBanner({ source: 'design', template_id: 'inventado', design: { title: 'Oi' } }).value.template_id).toBe(null);
  });
  it('⭐ imagem enviada exige a imagem da plataforma E a descrição', () => {
    expect(normalizeCampaignBanner({ source: 'upload', image_url: 'https://fora.com/a.png', alt: 'x' }).errors.image_url).toBeTruthy();
    expect(normalizeCampaignBanner({ source: 'upload', image_url: URL_OK, alt: '' }).errors.alt).toMatch(/leitor de tela/);
    const ok = normalizeCampaignBanner({ source: 'upload', image_url: URL_OK, alt: 'Promoção de terça', width: 1600, height: 800 });
    expect(ok.valid).toBe(true);
    expect(ok.value).toMatchObject({ source: 'upload', image_url: URL_OK, alt: 'Promoção de terça', design: null });
  });
  it('o texto alternativo do desenho junta o que está escrito nele', () => {
    const b = normalizeCampaignBanner({ source: 'design', design: { title: 'Copa', kicker: 'Sábado', highlight: '18 OUT' } }).value;
    expect(bannerAltText(b)).toBe('Sábado — 18 OUT — Copa');
  });
});

describe('onde e até quando', () => {
  it('o padrão: página da arena, por 14 dias', () => {
    const r = normalizeBannerPlacement({}, { today: HOJE });
    expect(r.value).toEqual({ show_on_arena: true, show_home: false, banner_until: defaultBannerUntil(HOJE) });
    expect(defaultBannerUntil(HOJE)).toBe('2026-10-09');
  });
  it('data no passado, longe demais, ou lugar nenhum: erro', () => {
    expect(normalizeBannerPlacement({ banner_until: '2026-09-01' }, { today: HOJE }).errors.banner_until).toMatch(/passou/);
    expect(normalizeBannerPlacement({ banner_until: '2027-09-01' }, { today: HOJE }).errors.banner_until).toMatch(/120 dias/);
    expect(normalizeBannerPlacement({ show_on_arena: false, show_home: false }, { today: HOJE }).errors.placement).toBeTruthy();
  });
  it('o estado do banner: no ar, pausado, encerrado, sem banner', () => {
    const c = { banner: { source: 'design' }, banner_until: '2026-10-01' };
    expect(campaignBannerState(c, { today: HOJE })).toBe(BANNER_STATE.LIVE);
    expect(campaignBannerState({ ...c, banner_active: false }, { today: HOJE })).toBe(BANNER_STATE.PAUSED);
    expect(campaignBannerState({ ...c, banner_until: '2026-09-24' }, { today: HOJE })).toBe(BANNER_STATE.ENDED);
    expect(campaignBannerState({ ...c, status: 'cancelled' }, { today: HOJE })).toBe(BANNER_STATE.ENDED);
    expect(campaignBannerState({}, { today: HOJE })).toBe(BANNER_STATE.NONE);
  });
  it('na página da arena: só os no ar, os que vencem primeiro na frente', () => {
    const lista = arenaCampaignBanners([
      { id: 'a', banner: {}, banner_until: '2026-10-20' },
      { id: 'b', banner: {}, banner_until: '2026-10-01' },
      { id: 'c', banner: {}, banner_until: '2026-10-05', show_on_arena: false },
      { id: 'd', banner: {}, banner_until: '2026-10-05', banner_active: false },
      { id: 'e', banner_until: '2026-10-05' },
    ], { today: HOJE });
    expect(lista.map((c) => c.id)).toEqual(['b', 'a']);
  });
  it('na tela inicial: só os marcados, de arena existente e com o módulo ligado', () => {
    const r = homeCampaignBanners({
      campaigns: [
        { id: 'a', arena_id: 'x', banner: {}, show_home: true, banner_until: '2026-10-01' },
        { id: 'b', arena_id: 'y', banner: {}, show_home: true, banner_until: '2026-10-01' },
        { id: 'c', arena_id: 'x', banner: {}, show_home: false, banner_until: '2026-10-01' },
        { id: 'd', arena_id: 'z', banner: {}, show_home: true, banner_until: '2026-10-01' },
      ],
      arenas: [{ id: 'x' }, { id: 'y' }],
      isOnIn: (id) => id !== 'y',
      today: HOJE,
    });
    expect(r.map((b) => b.campaign.id)).toEqual(['a']);
  });
  it('o resumo diz onde está e para onde leva', () => {
    expect(campaignPlacementText({ banner: {}, show_home: true, destination: { type: 'tournament', target_label: 'Copa' } }))
      .toBe('Banner na página da arena e na tela inicial · leva a: Um torneio (Copa)');
    expect(campaignPlacementText({})).toBe('');
  });
});

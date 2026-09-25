/**
 * Os banners de promoção na tela inicial.
 *
 * O que protege:
 *  1. ⭐ só vira banner o cupom DIVULGADO e marcado para a tela inicial, ainda
 *     valendo, de arena existente com o módulo ligado — e nunca a indicação;
 *  2. ⭐ região: a minha cidade (sem acento/caixa), o meu estado, outra cidade;
 *  3. ⭐ sem cidade nem estado no perfil, NÃO mostra o Brasil inteiro — pede;
 *  4. a escolha guardada vence o padrão, e escolha inválida cai no padrão;
 *  5. as cidades com banner, para o seletor, mais cheias primeiro;
 *  6. o que vence primeiro vem primeiro.
 */
import { describe, it, expect } from 'vitest';
import {
  BANNER_REGION, arenaInRegion, bannerCities, cityKey, eligibleBanners, homeBanners,
  normalizeLocality, regionLabel, resolveBannerRegion,
} from './homeBanners.js';

const agora = Date.UTC(2026, 8, 25, 12);
const ARENAS = [
  { id: 'poa1', name: 'Arena Sol', city: 'Porto Alegre', state: 'RS' },
  { id: 'poa2', name: 'Arena Lua', city: 'porto alegre ', state: 'rs' },
  { id: 'cax', name: 'Arena Serra', city: 'Caxias do Sul', state: 'RS' },
  { id: 'sp', name: 'Arena Paulista', city: 'São Paulo', state: 'SP' },
];
const cupom = (over) => ({
  id: over.id, arena_id: over.arena_id, code: over.id.toUpperCase(), type: 'percent', value: 10,
  active: true, show_public: true, show_home: true, ...over,
});
const CUPONS = [
  cupom({ id: 'c1', arena_id: 'poa1' }),
  cupom({ id: 'c2', arena_id: 'poa2', expires_at: agora + 86_400_000 }),
  cupom({ id: 'c3', arena_id: 'cax' }),
  cupom({ id: 'c4', arena_id: 'sp' }),
  cupom({ id: 'priv', arena_id: 'poa1', show_public: false }),        // não divulgado
  cupom({ id: 'soarena', arena_id: 'poa1', show_home: false }),       // só na página da arena
  cupom({ id: 'off', arena_id: 'poa1', active: false }),               // desligado
  cupom({ id: 'venc', arena_id: 'poa1', expires_at: agora - 1 }),      // vencido
  cupom({ id: 'ind', arena_id: 'poa1', kind: 'referral', referrer_reward: 10 }), // indicação
  cupom({ id: 'orfao', arena_id: 'sumiu' }),                            // arena não existe
];
const dados = (over = {}) => ({ coupons: CUPONS, arenas: ARENAS, now: agora, ...over });

describe('normalizeLocality / cityKey', () => {
  it('ignora acento, caixa e espaços', () => {
    expect(normalizeLocality('  São  Paulo ')).toBe('sao paulo');
    expect(cityKey('Porto Alegre', 'rs')).toBe(cityKey('porto alegre ', 'RS'));
  });
});

describe('⭐ quem vira banner', () => {
  it('só o divulgado, marcado, valendo, de arena existente — nunca a indicação', () => {
    expect(eligibleBanners(dados()).map((b) => b.id).sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('arena com o módulo desligado não entra', () => {
    const ids = eligibleBanners(dados({ isOnIn: (id) => id !== 'sp' })).map((b) => b.id);
    expect(ids).not.toContain('c4');
  });

  it('o banner carrega o que a tela mostra', () => {
    const b = eligibleBanners(dados()).find((x) => x.id === 'c1');
    expect(b).toMatchObject({ arenaId: 'poa1', arenaName: 'Arena Sol', city: 'Porto Alegre', state: 'RS', benefit: '10% de desconto', bookable: true });
  });
});

describe('⭐ região', () => {
  it('a minha cidade — sem acento/caixa, e o que vence primeiro vem primeiro', () => {
    const r = resolveBannerRegion(null, { city: 'porto alegre', state: 'RS' });
    expect(r.mode).toBe(BANNER_REGION.CITY);
    expect(homeBanners(dados(), r).map((b) => b.id)).toEqual(['c2', 'c1']);
  });

  it('o meu estado', () => {
    const r = resolveBannerRegion('estado', { city: 'Porto Alegre', state: 'RS' });
    expect(homeBanners(dados(), r).map((b) => b.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('outra cidade (quem vai viajar)', () => {
    const r = resolveBannerRegion(`outra:${cityKey('São Paulo', 'SP')}`, { city: 'Porto Alegre', state: 'RS' });
    expect(r.mode).toBe(BANNER_REGION.OTHER);
    expect(homeBanners(dados(), r).map((b) => b.id)).toEqual(['c4']);
  });

  it('todas', () => {
    expect(homeBanners(dados(), resolveBannerRegion('todas', {}))).toHaveLength(4);
  });

  it('⭐ sem cidade nem estado no perfil: pede a cidade — não mostra o Brasil inteiro', () => {
    const r = resolveBannerRegion(null, {});
    expect(r.mode).toBe(BANNER_REGION.UNKNOWN);
    expect(homeBanners(dados(), r)).toEqual([]);
  });

  it('cidade no perfil sem estado: casa pelo nome da cidade', () => {
    const r = resolveBannerRegion(null, { city: 'Caxias do Sul' });
    expect(homeBanners(dados(), r).map((b) => b.id)).toEqual(['c3']);
  });

  it('escolha inválida cai no padrão (a cidade do perfil)', () => {
    expect(resolveBannerRegion('estado', { city: 'Porto Alegre' }).mode).toBe(BANNER_REGION.CITY);
    expect(resolveBannerRegion('outra:', { city: 'Porto Alegre', state: 'RS' }).mode).toBe(BANNER_REGION.CITY);
  });

  it('arenaInRegion sem região não casa', () => {
    expect(arenaInRegion(ARENAS[0], null)).toBe(false);
    expect(arenaInRegion(ARENAS[0], { mode: BANNER_REGION.UNKNOWN })).toBe(false);
  });
});

describe('cidades com banner e o texto da região', () => {
  it('mais cheias primeiro, sem repetir cidade escrita diferente', () => {
    const cidades = bannerCities(dados());
    expect(cidades[0]).toMatchObject({ key: cityKey('Porto Alegre', 'RS'), count: 2 });
    expect(cidades).toHaveLength(3);
  });

  it('o texto da região', () => {
    expect(regionLabel({ mode: 'todas' })).toBe('em todo o Brasil');
    expect(regionLabel({ mode: 'estado', state: 'RS' })).toBe('no RS');
    expect(regionLabel({ mode: 'cidade', city: 'Porto Alegre', state: 'RS' })).toBe('em Porto Alegre (RS)');
  });
});

describe('Onda CC — banners de CAMPANHA no mesmo carrossel', () => {
  const banner = { source: 'design', template_id: 'destaque', design: { layout: 'destaque', title: 'Oi', bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' } };
  const camp = (over) => ({
    id: over.id, arena_id: over.arena_id, name: over.id, banner, show_home: true,
    banner_active: true, banner_until: '2026-10-01', ...over,
  });
  const CAMPANHAS = [
    camp({ id: 'k1', arena_id: 'poa1' }),
    camp({ id: 'k2', arena_id: 'sp' }),
    camp({ id: 'pausada', arena_id: 'poa1', banner_active: false }),
    camp({ id: 'acabou', arena_id: 'poa1', banner_until: '2026-09-24' }),
    camp({ id: 'soarena', arena_id: 'poa1', show_home: false }),
    camp({ id: 'semarte', arena_id: 'poa1', banner: null }),
    camp({ id: 'orfa', arena_id: 'sumiu' }),
  ];

  it('sem `campaigns`, a saída é a de antes (só cupons)', () => {
    expect(eligibleBanners(dados()).every((b) => !b.campaign)).toBe(true);
  });

  it('entra só a campanha no ar, marcada para a tela inicial, com arte e arena existente', () => {
    const ids = eligibleBanners(dados({ campaigns: CAMPANHAS })).filter((b) => b.campaign).map((b) => b.id).sort();
    expect(ids).toEqual(['campanha:k1', 'campanha:k2']);
  });

  it('o último dia ainda vale (banner_until = hoje)', () => {
    const hoje = camp({ id: 'hoje', arena_id: 'poa1', banner_until: '2026-09-25' });
    const ids = eligibleBanners(dados({ campaigns: [hoje] })).map((b) => b.id);
    expect(ids).toContain('campanha:hoje');
  });

  it('o módulo de campanhas desligado na arena tira a campanha — e não mexe nos cupons', () => {
    const lista = eligibleBanners(dados({ campaigns: CAMPANHAS, isCampaignOnIn: (id) => id !== 'sp' }));
    expect(lista.map((b) => b.id)).not.toContain('campanha:k2');
    expect(lista.map((b) => b.id)).toContain('c4');
  });

  it('obedece ao filtro de região, como o cupom', () => {
    const r = resolveBannerRegion(null, { city: 'São Paulo', state: 'SP' });
    const ids = homeBanners(dados({ campaigns: CAMPANHAS }), r).map((b) => b.id).sort();
    expect(ids).toEqual(['c4', 'campanha:k2']);
  });

  it('conta na lista de cidades do seletor', () => {
    const sp = bannerCities(dados({ campaigns: CAMPANHAS })).find((c) => c.city === 'São Paulo');
    expect(sp.count).toBe(2);
  });

  it('vence no fim do dia de `banner_until` — e entra na ordem por vencimento', () => {
    const b = eligibleBanners(dados({ campaigns: CAMPANHAS })).find((x) => x.id === 'campanha:k1');
    expect(b.expiresAt).toBe(new Date('2026-10-01T23:59:59').getTime());
    expect(b.arenaName).toBe('Arena Sol');
  });
});

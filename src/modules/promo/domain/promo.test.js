import { describe, it, expect } from 'vitest';
import {
  PROMO_ISSUER, PLATFORM_ISSUER_ID, normalizeIssuer, issuerOf, promoSettingsId,
  PROMO_FAMILY, promoFamily, promoKinds, promoKindLabel,
  PROMO_REACH, normalizeReach, reachLabel, reachMatchesRegion,
  PROMO_VISIBILITY, isVisibleTo, coachIdsOfStudent,
  normalizePromoCouponInput, livePromoCoupons, promoBenefitText, promoUseHint,
  PROMO_DESTINATION, PROMO_DESTINATIONS_BY_ISSUER, normalizePromoDestination, promoDestinationLink,
  promoNoticeLink, promoDestinationCta,
  normalizePromoPlacement, defaultPromoUntil, isPromoBannerLive, livePromoBanners, promoPlacementText,
  PROMO_AUDIENCE, PROMO_AUDIENCES_BY_ISSUER, platformRecipients, coachRecipients,
  promoUsageReport,
  LESSON_COUPON_STATUS, lessonCouponFromPromo, normalizeLessonCoupon, lessonCouponDiscount, lessonCouponProblem,
  lessonReferencePrice, resolveLessonCoupon, lessonCouponLine,
  homePromoItems, promoItemsInRegion, promoCities, mergeBannerCities, byExpiry,
} from './promo.js';
import { COUPON_KIND, COUPON_TYPE } from '../../arenas/domain/marketing.js';
import { BANNER_REGION } from '../../arenas/domain/homeBanners.js';
import { isRuleSafeLink } from '../../../core/domain/internalLink.js';

const HOJE = '2026-09-26';

describe('emissor', () => {
  it('a plataforma tem id fixo; o professor, o uid', () => {
    expect(normalizeIssuer({ type: 'platform', id: 'qualquer' })).toEqual({ type: 'platform', id: PLATFORM_ISSUER_ID, name: 'PickleRush' });
    expect(normalizeIssuer({ type: 'coach', id: 'u1', name: '  Ana   Lima ' })).toEqual({ type: 'coach', id: 'u1', name: 'Ana Lima' });
  });

  it('emissor desconhecido ou professor sem uid não existe', () => {
    expect(normalizeIssuer({ type: 'arena', id: 'a1' })).toBeNull();
    expect(normalizeIssuer({ type: 'coach' })).toBeNull();
  });

  it('lê o emissor do documento gravado', () => {
    expect(issuerOf({ issuer_type: 'coach', issuer_id: 'u1', issuer_name: 'Ana' })).toEqual({ type: 'coach', id: 'u1', name: 'Ana' });
  });

  it('o documento de configurações é um por emissor', () => {
    expect(promoSettingsId({ type: 'platform', id: 'x' })).toBe('platform');
    expect(promoSettingsId({ type: 'coach', id: 'u1' })).toBe('u1');
    expect(promoSettingsId(null)).toBeNull();
  });
});

describe('tipos por emissor', () => {
  it('⭐ nenhum emissor tem hora grátis nem indicação (são da arena)', () => {
    for (const t of Object.values(PROMO_ISSUER)) {
      const kinds = promoKinds(t).map((k) => k.kind);
      expect(kinds).not.toContain(COUPON_KIND.FREE_HOURS);
      expect(kinds).not.toContain(COUPON_KIND.REFERRAL);
      expect(kinds[0]).toBe(COUPON_KIND.DISCOUNT);
    }
  });

  it('o mesmo tipo fala a língua de cada emissor', () => {
    expect(promoKindLabel('coach', COUPON_KIND.DISCOUNT)).toBe('Desconto na aula');
    expect(promoKindLabel('platform', COUPON_KIND.DISCOUNT)).toBe('Desconto');
  });

  it('família: desconto × vale', () => {
    expect(promoFamily({ kind: 'discount' })).toBe(PROMO_FAMILY.DISCOUNT);
    expect(promoFamily({})).toBe(PROMO_FAMILY.DISCOUNT);
    expect(promoFamily({ kind: 'drink' })).toBe(PROMO_FAMILY.VOUCHER);
  });
});

describe('alcance', () => {
  it('Brasil, estado e cidade', () => {
    expect(normalizeReach({}).value).toEqual({ mode: 'brasil', state: '', city: '' });
    expect(normalizeReach({ mode: 'estado', state: 'rs', city: 'x' }).value).toEqual({ mode: 'estado', state: 'RS', city: '' });
    expect(normalizeReach({ mode: 'cidade', state: 'RS', city: ' Porto  Alegre ' }).value)
      .toEqual({ mode: 'cidade', state: 'RS', city: 'Porto Alegre' });
  });

  it('sem o que precisa, é erro (e cai para o Brasil)', () => {
    const r = normalizeReach({ mode: 'cidade', city: 'Porto Alegre' });
    expect(r.valid).toBe(false);
    expect(r.errors.reach).toMatch(/cidade e o estado/);
    expect(normalizeReach({ mode: 'estado' }).errors.reach).toMatch(/estado/);
  });

  it('rótulos', () => {
    expect(reachLabel(null)).toBe('Todo o Brasil');
    expect(reachLabel({ mode: 'estado', state: 'sp' })).toBe('SP');
    expect(reachLabel({ mode: 'cidade', city: 'Campinas', state: 'SP' })).toBe('Campinas (SP)');
  });

  it('⭐ nacional aparece para todo mundo, inclusive quem ainda não disse a cidade', () => {
    expect(reachMatchesRegion({ mode: 'brasil' }, { mode: BANNER_REGION.UNKNOWN })).toBe(true);
    expect(reachMatchesRegion(undefined, { mode: BANNER_REGION.CITY, city: 'X', state: 'RS' })).toBe(true);
  });

  it('estado casa com a cidade e o estado daquele estado', () => {
    const r = { mode: 'estado', state: 'RS' };
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.STATE, state: 'RS' })).toBe(true);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.CITY, city: 'Pelotas', state: 'RS', key: 'RS|pelotas' })).toBe(true);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.STATE, state: 'SC' })).toBe(false);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.UNKNOWN })).toBe(false);
  });

  it('cidade casa só com a cidade (sem acento, sem caixa)', () => {
    const r = { mode: 'cidade', city: 'São Paulo', state: 'SP' };
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.CITY, city: 'sao paulo', state: 'SP', key: 'SP|sao paulo' })).toBe(true);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.OTHER, city: 'sao paulo', state: 'SP', key: 'SP|sao paulo' })).toBe(true);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.STATE, state: 'SP' })).toBe(true);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.CITY, city: 'Campinas', state: 'SP', key: 'SP|campinas' })).toBe(false);
    expect(reachMatchesRegion(r, { mode: BANNER_REGION.ALL })).toBe(true);
  });

  it('perfil com cidade sem estado: casa pelo nome', () => {
    expect(reachMatchesRegion({ mode: 'cidade', city: 'Recife', state: 'PE' }, { mode: BANNER_REGION.CITY, city: 'Recife', state: '' })).toBe(true);
  });
});

describe('visibilidade', () => {
  const doc = { issuer_type: 'coach', issuer_id: 'prof', visibility: PROMO_VISIBILITY.STUDENTS };
  it('só alunos: o próprio professor e os alunos dele', () => {
    expect(isVisibleTo(doc, { uid: 'prof' })).toBe(true);
    expect(isVisibleTo(doc, { uid: 'a', coachIdsDoAluno: new Set(['prof']) })).toBe(true);
    expect(isVisibleTo(doc, { uid: 'b', coachIdsDoAluno: new Set(['outro']) })).toBe(false);
    expect(isVisibleTo(doc, {})).toBe(false);
  });
  it('público e plataforma: todo mundo', () => {
    expect(isVisibleTo({ ...doc, visibility: 'todos' }, {})).toBe(true);
    expect(isVisibleTo({ issuer_type: 'platform', visibility: 'alunos' }, {})).toBe(true);
    expect(isVisibleTo(null)).toBe(false);
  });
});

describe('coachIdsOfStudent', () => {
  it('só vínculo ativo ou em pausa conta como aluno', () => {
    const ids = coachIdsOfStudent([
      { coach_id: 'a', status: 'active' }, { coach_id: 'b', status: 'paused' },
      { coach_id: 'c', status: 'invited' }, { status: 'active' }, null,
    ]);
    expect([...ids]).toEqual(['a', 'b']);
  });
});

describe('normalizePromoCouponInput', () => {
  it('⭐ o desconto do professor segue a validação da arena', () => {
    const r = normalizePromoCouponInput({ code: 'aula 10', value: 10 }, { issuerType: 'coach' });
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({ kind: 'discount', code: 'AULA10', type: 'percent', value: 10, visibility: 'todos' });
    expect(r.value.reach).toEqual({ mode: 'brasil', state: '', city: '' });
  });

  it('não grava campos de indicação nem valor mínimo', () => {
    const r = normalizePromoCouponInput({ code: 'X', value: 5, min_amount: 100 }, { issuerType: 'platform' });
    expect(r.value).not.toHaveProperty('referrer_reward');
    expect(r.value).not.toHaveProperty('first_booking_only');
    expect(r.value.min_amount).toBeNull();
  });

  it('tipo que o emissor não tem vira desconto (nunca hora grátis)', () => {
    const r = normalizePromoCouponInput({ code: 'X', kind: 'free_hours', value: 1 }, { issuerType: 'coach' });
    expect(r.value.kind).toBe('discount');
    const s = normalizePromoCouponInput({ code: 'X', kind: 'referral' }, { issuerType: 'platform' });
    expect(s.value.kind).toBe('discount');
    expect(s.valid).toBe(false); // desconto sem valor
  });

  it('vale exige o benefício', () => {
    expect(normalizePromoCouponInput({ code: 'X', kind: 'clinic' }, { issuerType: 'coach' }).errors.benefit).toBeTruthy();
    const ok = normalizePromoCouponInput({ code: 'X', kind: 'clinic', benefit: 'Clínica de voleio' }, { issuerType: 'coach' });
    expect(ok.valid).toBe(true);
    expect(ok.value.value).toBeNull();
  });

  it('só o professor pode restringir aos alunos', () => {
    expect(normalizePromoCouponInput({ code: 'X', value: 5, visibility: 'alunos' }, { issuerType: 'coach' }).value.visibility).toBe('alunos');
    expect(normalizePromoCouponInput({ code: 'X', value: 5, visibility: 'alunos' }, { issuerType: 'platform' }).value.visibility).toBe('todos');
  });

  it('alcance inválido é erro', () => {
    const r = normalizePromoCouponInput({ code: 'X', value: 5, reach: { mode: 'cidade' } }, { issuerType: 'platform' });
    expect(r.valid).toBe(false);
    expect(r.errors.reach).toBeTruthy();
  });

  it('show_home só com show_public (herdado da arena)', () => {
    expect(normalizePromoCouponInput({ code: 'X', value: 5, show_home: true }, { issuerType: 'platform' }).value.show_home).toBe(false);
    expect(normalizePromoCouponInput({ code: 'X', value: 5, show_public: true, show_home: true }, { issuerType: 'platform' }).value.show_home).toBe(true);
  });
});

describe('vitrine e textos', () => {
  const now = new Date(2026, 8, 26).getTime();
  it('só os divulgados e ainda valendo, os que vencem antes primeiro', () => {
    const lista = [
      { id: 'a', show_public: true, active: true, expires_at: now + 5000 },
      { id: 'b', show_public: true, active: true, expires_at: now + 1000 },
      { id: 'c', show_public: false, active: true },
      { id: 'd', show_public: true, active: false },
      { id: 'e', show_public: true, active: true, expires_at: now - 1 },
      { id: 'f', show_public: true, active: true, max_uses: 2, used_count: 2 },
    ];
    expect(livePromoCoupons(lista, now).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('benefício e onde usar', () => {
    expect(promoBenefitText({ issuer_type: 'coach', type: 'percent', value: 10 })).toBe('10% de desconto na aula');
    expect(promoBenefitText({ issuer_type: 'platform', kind: 'drink', benefit: '1 água' })).toBe('1 água');
    expect(promoUseHint({ issuer_type: 'coach' })).toMatch(/pedir a aula/);
    expect(promoUseHint({ issuer_type: 'coach', kind: 'clinic' })).toMatch(/professor/);
    expect(promoUseHint({ issuer_type: 'platform' })).toMatch(/Mostre/);
  });
});

describe('destino', () => {
  it('cada emissor tem a sua lista fechada', () => {
    expect(normalizePromoDestination({ type: PROMO_DESTINATION.BOOK_LESSON }, 'platform').value.type).toBe('details');
    expect(normalizePromoDestination({ type: PROMO_DESTINATION.TOURNAMENT }, 'coach').value.type).toBe('details');
    expect(normalizePromoDestination({ type: 'book_lesson' }, 'coach').value.type).toBe('book_lesson');
  });

  it('destino com alvo exige o alvo', () => {
    const r = normalizePromoDestination({ type: 'tournament' }, 'platform');
    expect(r.valid).toBe(false);
    expect(r.errors.target_id).toMatch(/torneio/);
    const ok = normalizePromoDestination({ type: 'game_day', target_id: 'g1', target_label: 'Sábado' }, 'platform');
    expect(ok.value).toEqual({ type: 'game_day', target_id: 'g1', target_label: 'Sábado' });
  });

  it('alvo que sobrou de outro tipo não é gravado', () => {
    expect(normalizePromoDestination({ type: 'ranking', target_id: 't1' }, 'platform').value.target_id).toBe('');
  });

  it('links', () => {
    const coach = { issuerType: 'coach', issuerId: 'u1', campaignId: 'c1' };
    expect(promoDestinationLink({ type: 'details' }, coach)).toBe('/campanhas/c1');
    expect(promoDestinationLink({ type: 'book_lesson' }, coach)).toBe('/coaches/u1?marcar=1');
    expect(promoDestinationLink({ type: 'clinics' }, coach)).toBe('/coaches/u1#professor-clinicas');
    expect(promoDestinationLink({ type: 'tournament', target_id: 't 1' }, { issuerType: 'platform' })).toBe('/torneios/t%201');
    expect(promoDestinationLink({ type: 'doubles' }, { issuerType: 'platform' })).toBe('/ranking/duplas');
    expect(promoDestinationLink({ type: 'details' }, { issuerType: 'platform' })).toBe('/promocoes');
  });

  it('⭐ todo destino é um caminho interno', () => {
    for (const [issuerType, tipos] of Object.entries(PROMO_DESTINATIONS_BY_ISSUER)) {
      for (const type of tipos) {
        const link = promoDestinationLink({ type, target_id: 'x' }, { issuerType, issuerId: 'u1', campaignId: 'c1' });
        expect(link.startsWith('/')).toBe(true);
        expect(link.startsWith('//')).toBe(false);
      }
    }
  });

  it('⭐ o link do AVISO passa na regra de notifications (sem #)', () => {
    for (const [issuerType, tipos] of Object.entries(PROMO_DESTINATIONS_BY_ISSUER)) {
      for (const type of tipos) {
        const link = promoNoticeLink({ type, target_id: 'x' }, { issuerType, issuerId: 'u1', campaignId: 'c1' });
        expect(isRuleSafeLink(link)).toBe(true);
      }
    }
    expect(promoNoticeLink({ type: 'clinics' }, { issuerType: 'coach', issuerId: 'u1', campaignId: 'c1' })).toBe('/campanhas/c1');
  });

  it('texto do botão', () => {
    expect(promoDestinationCta({ type: 'book_lesson' }, {})).toBe('Marcar aula');
    expect(promoDestinationCta({ type: 'book_lesson' }, { cta: 'Bora!' })).toBe('Bora!');
    expect(promoDestinationCta(null)).toBe('Saiba mais');
  });
});

describe('lugar e prazo', () => {
  it('padrão: na página, 14 dias', () => {
    const r = normalizePromoPlacement({}, { today: HOJE });
    expect(r.value).toEqual({ show_on_page: true, show_home: false, banner_until: defaultPromoUntil(HOJE) });
    expect(defaultPromoUntil(HOJE)).toBe('2026-10-10');
  });

  it('prazo passado, longo demais ou nenhum lugar: erro', () => {
    expect(normalizePromoPlacement({ banner_until: '2026-09-01' }, { today: HOJE }).errors.banner_until).toMatch(/passou/);
    expect(normalizePromoPlacement({ banner_until: '2027-09-01' }, { today: HOJE }).errors.banner_until).toMatch(/120/);
    expect(normalizePromoPlacement({ show_on_page: false }, { today: HOJE }).errors.placement).toBeTruthy();
  });

  it('no ar: ativo, no prazo, não cancelado', () => {
    const c = { banner: {}, banner_until: '2026-10-01' };
    expect(isPromoBannerLive(c, { today: HOJE })).toBe(true);
    expect(isPromoBannerLive({ ...c, banner_active: false }, { today: HOJE })).toBe(false);
    expect(isPromoBannerLive({ ...c, banner_until: '2026-09-25' }, { today: HOJE })).toBe(false);
    expect(isPromoBannerLive({ ...c, status: 'cancelled' }, { today: HOJE })).toBe(false);
    expect(isPromoBannerLive({ banner_until: '2026-10-01' }, { today: HOJE })).toBe(false);
  });

  it('banners no ar por lugar, os que vencem antes primeiro', () => {
    const lista = [
      { id: 'a', banner: {}, banner_until: '2026-10-20', show_home: true },
      { id: 'b', banner: {}, banner_until: '2026-10-01', show_home: true, show_on_page: false },
      { id: 'c', banner: {}, banner_until: '2026-10-05' },
    ];
    expect(livePromoBanners(lista, { today: HOJE, lugar: 'home' }).map((c) => c.id)).toEqual(['b', 'a']);
    expect(livePromoBanners(lista, { today: HOJE, lugar: 'page' }).map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('resumo na lista', () => {
    expect(promoPlacementText({ issuer_type: 'coach', banner: {}, show_home: true, destination: { type: 'book_lesson' } }))
      .toBe('Banner na tela inicial e no seu perfil · leva a: Marcar aula');
    expect(promoPlacementText({ issuer_type: 'platform', banner: {}, show_on_page: false, show_home: true, destination: { type: 'tournament', target_label: 'Open' } }))
      .toBe('Banner na tela inicial · leva a: Um torneio (Open)');
    expect(promoPlacementText({})).toBe('');
  });
});

describe('público do aviso', () => {
  const users = [
    { uid: 'a', city: 'Porto Alegre', state: 'RS', interests: ['competir'], is_coach: true },
    { uid: 'b', city: 'porto alegre', state: 'rs', interests: ['aulas'] },
    { uid: 'c', city: 'Pelotas', state: 'RS' },
    { uid: 'd', city: 'São Paulo', state: 'SP', hidden: true, interests: ['competir'] },
    { id: 'e', city: 'Porto Alegre', state: 'SC' },
    null,
  ];

  it('⭐ conta oculta pela moderação nunca recebe', () => {
    expect(platformRecipients(PROMO_AUDIENCE.ALL, { users })).toEqual(['a', 'b', 'c', 'e']);
    expect(platformRecipients(PROMO_AUDIENCE.INTEREST, { users, interest: 'competir' })).toEqual(['a']);
  });

  it('por estado e por cidade (a cidade confere o estado quando dado)', () => {
    expect(platformRecipients(PROMO_AUDIENCE.STATE, { users, state: 'RS' })).toEqual(['a', 'b', 'c']);
    expect(platformRecipients(PROMO_AUDIENCE.CITY, { users, city: 'Porto Alegre', state: 'RS' })).toEqual(['a', 'b']);
    expect(platformRecipients(PROMO_AUDIENCE.CITY, { users, city: 'Porto Alegre' })).toEqual(['a', 'b', 'e']);
  });

  it('recorte sem o dado não envia para ninguém (nunca para todo mundo)', () => {
    expect(platformRecipients(PROMO_AUDIENCE.INTEREST, { users })).toEqual([]);
    expect(platformRecipients(PROMO_AUDIENCE.STATE, { users })).toEqual([]);
    expect(platformRecipients(PROMO_AUDIENCE.CITY, { users })).toEqual([]);
    expect(platformRecipients('xyz', { users })).toEqual([]);
  });

  it('professores', () => {
    expect(platformRecipients(PROMO_AUDIENCE.COACHES, { users })).toEqual(['a']);
  });

  it('⭐ alunos do professor: convite não aceito não recebe', () => {
    const students = [
      { student_id: 's1', status: 'active' },
      { student_id: 's2', status: 'paused' },
      { student_id: 's3', status: 'invited' },
      { student_id: 's1', status: 'active' },
      { status: 'active' },
    ];
    expect(coachRecipients(PROMO_AUDIENCE.ACTIVE_STUDENTS, { students })).toEqual(['s1']);
    expect(coachRecipients(PROMO_AUDIENCE.ALL_STUDENTS, { students })).toEqual(['s1', 's2']);
    expect(coachRecipients(PROMO_AUDIENCE.ALL, { students })).toEqual([]);
  });

  it('cada emissor tem os seus públicos', () => {
    expect(PROMO_AUDIENCES_BY_ISSUER.coach).not.toContain(PROMO_AUDIENCE.ALL);
    expect(PROMO_AUDIENCES_BY_ISSUER.platform).not.toContain(PROMO_AUDIENCE.ACTIVE_STUDENTS);
  });
});

describe('controle de uso', () => {
  it('vale: custo = usos × custo unitário; sem custo informado é desconhecido', () => {
    const r = promoUsageReport({
      coupons: [
        { id: 'v1', code: 'AGUA', kind: 'drink', used_count: 3 },
        { id: 'v2', code: 'BRINDE', kind: 'product', used_count: 2 },
        { id: 'v3', code: 'NOVO', kind: 'product', used_count: 0 },
      ],
      costs: { v1: 4 },
    });
    expect(r.linhas.map((l) => l.custo)).toEqual([12, null, 0]);
    expect(r.total).toEqual({ usos: 5, custo: null, receita: null });
  });

  it('⭐ desconto do professor: custo e receita saem das aulas confirmadas com o cupom', () => {
    const r = promoUsageReport({
      coupons: [{ id: 'd1', code: 'AULA10', issuer_type: 'coach', type: 'percent', value: 10, used_count: 2 }],
      lessons: [
        { price: 135, coupon: { coupon_id: 'd1', status: 'applied', discount_value: 15, original_price: 150 } },
        { price: 90, coupon: { coupon_id: 'd1', status: 'applied', discount_value: 10 } },
        { price: 100, coupon: { coupon_id: 'd1', status: 'pending' } },
        { price: 100, coupon: { coupon_id: 'd1', status: 'rejected' } },
      ],
    });
    expect(r.linhas[0]).toMatchObject({ usos: 2, custo: 25, receita: 225 });
    expect(r.total).toEqual({ usos: 2, custo: 25, receita: 225 });
  });

  it('desconto da plataforma: só os usos (não há preço para medir)', () => {
    const r = promoUsageReport({ coupons: [{ id: 'p', issuer_type: 'platform', value: 10, used_count: 4 }] });
    expect(r.linhas[0]).toMatchObject({ usos: 4, custo: null, receita: null });
  });

  it('nenhum cupom: tudo zero', () => {
    expect(promoUsageReport({}).total).toEqual({ usos: 0, custo: 0, receita: 0 });
  });
});

describe('cupom no pedido de aula', () => {
  const cupom = { id: 'c1', code: 'AULA10', issuer_type: 'coach', type: 'percent', value: 10 };
  it('nasce pendente, com o que a tela sabe', () => {
    expect(lessonCouponFromPromo(cupom)).toEqual({
      coupon_id: 'c1', code: 'AULA10', benefit: '10% de desconto na aula', kind: 'discount', status: 'pending',
    });
    expect(lessonCouponFromPromo({ code: 'X' })).toBeNull();
  });

  it('⭐ o aluno nunca grava o cupom já aplicado', () => {
    const n = normalizeLessonCoupon({ coupon_id: 'c1', code: 'aula10', status: 'applied', discount_value: 999 });
    expect(n).toEqual({ coupon_id: 'c1', code: 'AULA10', benefit: '', kind: 'discount', status: LESSON_COUPON_STATUS.PENDING });
    expect(normalizeLessonCoupon({ code: 'X' })).toBeNull();
    expect(normalizeLessonCoupon('X')).toBeNull();
  });

  it('desconto nunca passa do preço; o vale de aula particular zera a aula; outro vale abate zero', () => {
    expect(lessonCouponDiscount(150, cupom)).toBe(15);
    expect(lessonCouponDiscount(40, { type: COUPON_TYPE.FIXED, value: 50 })).toBe(40);
    expect(lessonCouponDiscount(120, { kind: 'private_lesson', benefit: 'Aula experimental' })).toBe(120);
    expect(lessonCouponDiscount(100, { kind: 'clinic' })).toBe(0);
    expect(lessonCouponDiscount(0, cupom)).toBe(0);
  });

  it('⭐ por que o código não entra no pedido — em português', () => {
    const now = Date.now();
    const base = { ...cupom, issuer_id: 'prof', active: true };
    expect(lessonCouponProblem(null, { coachId: 'prof' })).toBe('Cupom não encontrado.');
    expect(lessonCouponProblem(base, { coachId: 'outro' })).toMatch(/não é deste professor/);
    expect(lessonCouponProblem({ ...base, issuer_type: 'platform', issuer_id: 'platform' }, { coachId: 'prof' })).toMatch(/não é deste professor/);
    expect(lessonCouponProblem({ ...base, kind: 'clinic' }, { coachId: 'prof' })).toMatch(/vale/);
    expect(lessonCouponProblem({ ...base, active: false }, { coachId: 'prof' })).toMatch(/não está mais valendo/);
    expect(lessonCouponProblem({ ...base, expires_at: now - 1000 }, { coachId: 'prof', now })).toMatch(/venceu/);
    expect(lessonCouponProblem(base, { coachId: 'prof', usedByUser: true })).toMatch(/já usou/);
    expect(lessonCouponProblem(base, { coachId: 'prof' })).toBeNull();
    expect(lessonCouponProblem({ ...base, kind: 'private_lesson' }, { coachId: 'prof' })).toBeNull();
  });
});

describe('cupom na confirmação da aula', () => {
  const now = new Date(2026, 8, 26).getTime();
  const cupom = { id: 'c1', code: 'AULA10', issuer_type: 'coach', issuer_id: 'prof', type: 'percent', value: 10, active: true, used_by: [] };
  const aula = (over = {}) => ({
    coach_id: 'prof', student_id: 'ana', slots: [{ date: '2026-09-30', start: '18:00', end: '19:30' }],
    coupon: { coupon_id: 'c1', code: 'AULA10', status: 'pending' }, ...over,
  });

  it('preço de referência: o da aula; sem ele, valor-hora × horas; sem nada, null', () => {
    expect(lessonReferencePrice({ price: 120 }, { hourly_rate: 200 })).toBe(120);
    expect(lessonReferencePrice(aula(), { hourly_rate: 100 })).toBe(150);
    expect(lessonReferencePrice(aula(), {})).toBeNull();
    expect(lessonReferencePrice({ slots: [] }, { hourly_rate: 100 })).toBeNull();
  });

  it('⭐ aplica o desconto e grava o valor já descontado', () => {
    const r = resolveLessonCoupon({ lesson: aula(), coupon: cupom, coach: { hourly_rate: 100 }, now });
    expect(r.price).toBe(135);
    expect(r.coupon).toMatchObject({ status: 'applied', discount_value: 15, original_price: 150, code: 'AULA10' });
  });

  it('vale de aula particular: a aula sai por conta do professor', () => {
    const r = resolveLessonCoupon({ lesson: aula({ price: 120 }), coupon: { ...cupom, kind: 'private_lesson', benefit: 'Aula experimental' }, coach: {}, now });
    expect(r.price).toBe(0);
    expect(r.coupon.discount_value).toBe(120);
  });

  it('sem preço conhecido: desconto em % fica desconhecido (nunca inventado); R$ fixo vale', () => {
    const pct = resolveLessonCoupon({ lesson: aula(), coupon: cupom, coach: {}, now });
    expect(pct.price).toBeUndefined();
    expect(pct.coupon).toMatchObject({ status: 'applied', discount_value: null, original_price: null });
    const fixo = resolveLessonCoupon({ lesson: aula(), coupon: { ...cupom, type: 'fixed', value: 30 }, coach: {}, now });
    expect(fixo.coupon.discount_value).toBe(30);
    expect(fixo.price).toBeUndefined();
  });

  it('⭐ cupom que não vale é RECUSADO com o motivo (e a aula segue)', () => {
    expect(resolveLessonCoupon({ lesson: aula(), coupon: { ...cupom, used_by: ['ana'] }, coach: {}, now }).coupon)
      .toMatchObject({ status: 'rejected', reason: 'Você já usou este cupom.' });
    expect(resolveLessonCoupon({ lesson: aula(), coupon: null, coach: {}, now }).coupon.status).toBe('rejected');
    expect(resolveLessonCoupon({ lesson: aula({ coach_id: 'outro' }), coupon: cupom, coach: {}, now }).coupon.reason).toMatch(/não é deste professor/);
  });

  it('a linha do cupom na aula', () => {
    expect(lessonCouponLine({ code: 'AULA10', status: 'pending', benefit: '10% de desconto na aula' })).toMatch(/quando o professor confirmar/);
    expect(lessonCouponLine({ code: 'AULA10', status: 'applied', discount_value: 15 })).toBe('Cupom AULA10 aplicado: −R$ 15,00');
    expect(lessonCouponLine({ code: 'AULA10', status: 'rejected', reason: 'Este cupom venceu.' })).toBe('Cupom AULA10 não aplicado: Este cupom venceu.');
    expect(lessonCouponLine(null)).toBe('');
  });
});

describe('⭐ tela inicial', () => {
  const now = new Date(2026, 8, 26, 12).getTime();
  const cupom = (id, over = {}) => ({
    id, code: id.toUpperCase(), issuer_type: 'platform', issuer_id: 'platform', active: true,
    show_public: true, show_home: true, type: 'percent', value: 10, ...over,
  });
  const camp = (id, over = {}) => ({
    id, issuer_type: 'coach', issuer_id: 'prof', show_home: true, banner_active: true,
    banner: { source: 'design' }, banner_until: '2026-10-10', ...over,
  });
  const base = { platformOn: true, coachesOn: true, today: HOJE, now };

  it('entra só o marcado para a tela inicial, no ar, de emissor ligado', () => {
    const itens = homePromoItems({
      ...base,
      coupons: [cupom('a'), cupom('b', { show_home: false }), cupom('c', { active: false }), cupom('d', { issuer_type: 'coach', issuer_id: 'x' })],
      campaigns: [camp('k'), camp('p', { banner_active: false }), camp('v', { banner_until: '2026-09-01' })],
    });
    expect(itens.map((i) => i.id)).toEqual(['promo-cupom:a', 'promo-cupom:d', 'promo-campanha:k']);
    expect(homePromoItems({ ...base, coachesOn: false, coupons: [cupom('d', { issuer_type: 'coach' })], campaigns: [camp('k')] })).toEqual([]);
  });

  it('⭐ "só alunos" não aparece para quem não é aluno', () => {
    const c = camp('k', { visibility: 'alunos' });
    expect(homePromoItems({ ...base, campaigns: [c], viewer: { uid: 'x' } })).toHaveLength(0);
    expect(homePromoItems({ ...base, campaigns: [c], viewer: { uid: 'a', coachIdsDoAluno: new Set(['prof']) } })).toHaveLength(1);
  });

  it('região, cidades e ordem', () => {
    const itens = homePromoItems({
      ...base,
      coupons: [cupom('nac', { expires_at: now + 1000 }), cupom('poa', { reach: { mode: 'cidade', city: 'Porto Alegre', state: 'RS' } })],
      campaigns: [camp('sp', { reach: { mode: 'estado', state: 'SP' } })],
    });
    const poa = { mode: BANNER_REGION.CITY, city: 'Porto Alegre', state: 'RS', key: 'RS|porto alegre' };
    expect(promoItemsInRegion(itens, poa).map((i) => i.id)).toEqual(['promo-cupom:nac', 'promo-cupom:poa']);
    expect(promoItemsInRegion(itens, { mode: BANNER_REGION.UNKNOWN }).map((i) => i.id)).toEqual(['promo-cupom:nac']);
    expect(promoCities(itens)).toEqual([{ key: 'RS|porto alegre', city: 'Porto Alegre', state: 'RS', count: 1 }]);
    expect(mergeBannerCities([{ key: 'RS|porto alegre', city: 'Porto Alegre', state: 'RS', count: 2 }], promoCities(itens)))
      .toEqual([{ key: 'RS|porto alegre', city: 'Porto Alegre', state: 'RS', count: 3 }]);
    expect([{ expiresAt: null }, { expiresAt: 5 }, { expiresAt: 1 }].sort(byExpiry).map((i) => i.expiresAt)).toEqual([1, 5, null]);
  });
});

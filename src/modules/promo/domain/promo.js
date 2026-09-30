/**
 * DIVULGAÇÃO da PLATAFORMA e dos PROFESSORES — cupons e campanhas (lógica pura).
 *
 * As mesmas ferramentas do marketing da arena (Ondas AJ, BX, BZ, CC, CD) —
 * tipos de cupom, arte de tíquete, banner com modelos ou arte enviada, destino
 * de lista fechada, aviso com o público contado antes, pausa, página da
 * campanha, controle de uso — para dois emissores novos:
 *
 *  - a **plataforma** (quem administra o PickleRush), falando com todo mundo
 *    ou com um recorte (região, interesse, professores);
 *  - cada **professor**, falando com os próprios alunos — e mostrando o que
 *    é público a todos, na tela inicial e no perfil dele.
 *
 * O que é GENÉRICO do marketing da arena é reaproveitado daqui mesmo
 * (`normalizeCouponInput`, `couponBenefitText`, `couponError`, a arte e o
 * banner). O que é da ARENA (preço de reserva, recepção, módulos, página da
 * arena) não entra: cada emissor tem os SEUS tipos, destinos e públicos.
 *
 * Coleções próprias (`promo_coupons`, `promo_campaigns`, `promo_settings`), com
 * `issuer_type` + `issuer_id`. Não reusam as da arena de propósito: a tela
 * inicial lê TODOS os `arena_coupons` marcados para ela, e um cupom de outro
 * emissor ali entraria num caminho que espera `arena_id`.
 */
import {
  COUPON_KIND, COUPON_TYPE, couponBenefitText, couponError, couponKind, isCouponValid, normalizeCouponInput,
} from '../../arenas/domain/marketing.js';
import {
  BANNER_DEFAULT_DAYS, BANNER_MAX_DAYS, campaignBannerState, BANNER_STATE,
} from '../../arenas/domain/campaignBanner.js';
import { BANNER_REGION, cityKey, normalizeLocality } from '../../arenas/domain/homeBanners.js';
import { LESSON_COUPON_STATUS } from './lessonCoupon.js';
import { BR_UFS } from '../../../core/domain/ufs.js';

/* ------------------------------------------------------------------ */
/*  Emissor                                                           */
/* ------------------------------------------------------------------ */

export const PROMO_ISSUER = Object.freeze({
  PLATFORM: 'platform',
  COACH: 'coach',
});

/** O `issuer_id` fixo da plataforma (nunca colide com um uid, que tem 28). */
export const PLATFORM_ISSUER_ID = 'platform';

export const PROMO_COLLECTIONS = Object.freeze({
  coupons: 'promo_coupons',
  campaigns: 'promo_campaigns',
  settings: 'promo_settings',
});

/** O id do documento de configurações (modelos e custos) do emissor. */
export function promoSettingsId(issuer) {
  if (!issuer) return null;
  return issuer.type === PROMO_ISSUER.PLATFORM ? PLATFORM_ISSUER_ID : (issuer.id || null);
}

/** Um emissor válido: `{ type, id, name }`. */
export function normalizeIssuer(input = {}) {
  const type = Object.values(PROMO_ISSUER).includes(input?.type) ? input.type : null;
  if (!type) return null;
  const id = type === PROMO_ISSUER.PLATFORM ? PLATFORM_ISSUER_ID : String(input.id || '').trim();
  if (!id) return null;
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    || (type === PROMO_ISSUER.PLATFORM ? 'PickleRush' : 'Professor');
  return { type, id, name };
}

/** O emissor de um documento gravado. */
export function issuerOf(doc) {
  return normalizeIssuer({ type: doc?.issuer_type, id: doc?.issuer_id, name: doc?.issuer_name });
}

/* ------------------------------------------------------------------ */
/*  Tipos de cupom, por emissor                                       */
/* ------------------------------------------------------------------ */

/**
 * As duas famílias da divulgação. Na arena há três (reserva, vale, indicação);
 * aqui a indicação não existe (ela credita a carteira DA ARENA) e o desconto
 * não entra num preço automático — ou entra na aula (professor), ou é
 * registrado pela equipe (plataforma).
 */
export const PROMO_FAMILY = Object.freeze({
  DISCOUNT: 'desconto',
  VOUCHER: 'vale',
});

const K = COUPON_KIND;

/**
 * Os tipos que cada emissor pode criar, com o texto de CADA UM — o mesmo
 * "Desconto" quer dizer coisas diferentes para a plataforma e para o professor.
 */
export const PROMO_KIND_META = Object.freeze({
  [PROMO_ISSUER.PLATFORM]: Object.freeze({
    [K.DISCOUNT]: { label: 'Desconto', hint: 'Percentual ou valor fixo — num evento da plataforma, numa loja parceira ou no que você anunciar. Quem usa mostra o código e a plataforma registra o uso.' },
    [K.EVENT]: { label: 'Inscrição em evento', hint: 'Inscrição num evento ou torneio da plataforma.', example: 'Inscrição no Open de Primavera' },
    [K.PRODUCT]: { label: 'Produto ou brinde', hint: 'Um brinde, um kit, um produto de parceiro.', example: '1 camiseta PickleRush' },
    [K.CLINIC]: { label: 'Clínica', hint: 'Participação numa clínica ou treino especial.', example: 'Clínica de saque com convidado' },
    [K.GROUP_LESSON]: { label: 'Aula em grupo', hint: 'Uma vaga numa aula em grupo.', example: '1 aula em grupo para iniciantes' },
    [K.PRIVATE_LESSON]: { label: 'Aula particular', hint: 'Uma aula individual.', example: '1 aula particular de 1h' },
    [K.RENTAL]: { label: 'Aluguel de equipamento', hint: 'Raquete, bolas ou outro equipamento.', example: 'Aluguel de 2 raquetes' },
    [K.FOOD]: { label: 'Comida', hint: 'Um lanche ou refeição num evento.', example: '1 lanche no festival' },
    [K.DRINK]: { label: 'Bebida', hint: 'Uma bebida num evento.', example: '1 água de coco' },
    [K.OTHER]: { label: 'Outro benefício', hint: 'Qualquer outra vantagem.', example: 'Frete grátis na loja parceira' },
  }),
  [PROMO_ISSUER.COACH]: Object.freeze({
    [K.DISCOUNT]: { label: 'Desconto na aula', hint: 'Percentual ou valor fixo na aula. O aluno informa o código ao pedir a aula; o uso conta quando você confirma.' },
    [K.PRIVATE_LESSON]: { label: 'Aula particular', hint: 'Uma aula individual por conta da casa.', example: '1 aula experimental grátis' },
    [K.GROUP_LESSON]: { label: 'Aula em grupo', hint: 'Uma vaga numa aula em grupo.', example: '1 aula em grupo de iniciantes' },
    [K.CLINIC]: { label: 'Clínica', hint: 'Participação numa clínica sua.', example: 'Clínica de voleio' },
    [K.PRODUCT]: { label: 'Produto ou brinde', hint: 'Um item da sua loja ou um brinde.', example: '1 overgrip' },
    [K.RENTAL]: { label: 'Aluguel de equipamento', hint: 'Raquete ou outro equipamento emprestado.', example: 'Raquete para a primeira aula' },
    [K.EVENT]: { label: 'Evento', hint: 'Participação num evento ou treino especial seu.', example: 'Treino coletivo de sábado' },
    [K.OTHER]: { label: 'Outro benefício', hint: 'Qualquer outra vantagem.', example: 'Avaliação de nível grátis' },
  }),
});

/** A família de um cupom da divulgação. */
export function promoFamily(coupon) {
  return couponKind(coupon) === K.DISCOUNT ? PROMO_FAMILY.DISCOUNT : PROMO_FAMILY.VOUCHER;
}

/** Os tipos que o emissor pode criar, na ordem de exibição. */
export function promoKinds(issuerType) {
  const meta = PROMO_KIND_META[issuerType] || {};
  return Object.entries(meta).map(([kind, m]) => ({
    kind, ...m, family: kind === K.DISCOUNT ? PROMO_FAMILY.DISCOUNT : PROMO_FAMILY.VOUCHER,
  }));
}

/** O rótulo do tipo, no texto do emissor. */
export function promoKindLabel(issuerType, kind) {
  return PROMO_KIND_META[issuerType]?.[kind]?.label || '';
}

/* ------------------------------------------------------------------ */
/*  Alcance (onde aparece) e visibilidade (para quem)                 */
/* ------------------------------------------------------------------ */

/** Até onde o banner/cupom aparece na tela inicial. */
export const PROMO_REACH = Object.freeze({
  BRASIL: 'brasil',
  ESTADO: 'estado',
  CIDADE: 'cidade',
});

const uf = (v) => String(v || '').trim().toUpperCase().slice(0, 2);

/** As 27 unidades da federação, para os seletores de estado (fonte única no núcleo). */
export { BR_UFS };

/**
 * O alcance normalizado. Estado exige a UF; cidade exige cidade e UF. Sem o
 * que precisa, cai para o Brasil todo — e o erro diz por quê.
 * @returns {{ valid: boolean, errors: object, value: { mode, state, city } }}
 */
export function normalizeReach(input = {}) {
  const errors = {};
  let mode = Object.values(PROMO_REACH).includes(input?.mode) ? input.mode : PROMO_REACH.BRASIL;
  const state = uf(input?.state);
  const city = String(input?.city || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (mode === PROMO_REACH.ESTADO && !state) errors.reach = 'Escolha o estado.';
  if (mode === PROMO_REACH.CIDADE && (!city || !state)) errors.reach = 'Informe a cidade e o estado.';
  if (Object.keys(errors).length) mode = PROMO_REACH.BRASIL;
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      mode,
      state: mode === PROMO_REACH.BRASIL ? '' : state,
      city: mode === PROMO_REACH.CIDADE ? city : '',
    },
  };
}

/** "Todo o Brasil", "RS", "Porto Alegre (RS)". */
export function reachLabel(reach) {
  if (!reach || reach.mode === PROMO_REACH.BRASIL || !reach.mode) return 'Todo o Brasil';
  if (reach.mode === PROMO_REACH.ESTADO) return uf(reach.state);
  return `${reach.city} (${uf(reach.state)})`;
}

/**
 * O item cabe na região que a pessoa está vendo na tela inicial
 * (`resolveBannerRegion`)? Nacional cabe em qualquer uma — inclusive quando a
 * pessoa ainda não disse a cidade.
 */
export function reachMatchesRegion(reach, region) {
  const mode = reach?.mode || PROMO_REACH.BRASIL;
  if (mode === PROMO_REACH.BRASIL) return true;
  if (!region || region.mode === BANNER_REGION.UNKNOWN) return false;
  if (region.mode === BANNER_REGION.ALL) return true;
  const st = uf(reach.state);
  if (region.mode === BANNER_REGION.STATE) return st === uf(region.state);
  if (mode === PROMO_REACH.ESTADO) return st === uf(region.state);
  // CIDADE × (cidade | outra cidade)
  const alvo = region.key || cityKey(region.city, region.state);
  if (!uf(region.state)) return normalizeLocality(reach.city) === normalizeLocality(region.city);
  return cityKey(reach.city, st) === alvo;
}

/** Para quem aparece (tela inicial, perfil, vitrine). A plataforma é sempre todos. */
export const PROMO_VISIBILITY = Object.freeze({
  ALL: 'todos',
  STUDENTS: 'alunos',
});

/**
 * A pessoa pode VER este item? Visibilidade "só alunos" é de APRESENTAÇÃO — o
 * cupom é legível por qualquer conta logada, como na arena; quem confere na
 * hora de usar é o professor.
 *
 * @param {object} doc cupom ou campanha
 * @param {{ uid?: string, coachIdsDoAluno?: Set<string> }} ctx
 */
export function isVisibleTo(doc, { uid = null, coachIdsDoAluno = new Set() } = {}) {
  if (!doc) return false;
  if (doc.issuer_type !== PROMO_ISSUER.COACH) return true;
  if (doc.visibility !== PROMO_VISIBILITY.STUDENTS) return true;
  return uid === doc.issuer_id || coachIdsDoAluno.has(doc.issuer_id);
}

/**
 * Os professores de quem a pessoa é aluna (vínculo ativo ou em pausa) — o que
 * decide o "só para os meus alunos". Convite não aceito ainda não é aluno.
 * @param {object[]} links documentos de `coach_students` da pessoa
 * @returns {Set<string>}
 */
export function coachIdsOfStudent(links = []) {
  return new Set((links || [])
    .filter((l) => l?.coach_id && (l.status === 'active' || l.status === 'paused'))
    .map((l) => l.coach_id));
}

/* ------------------------------------------------------------------ */
/*  Cupom                                                             */
/* ------------------------------------------------------------------ */

/**
 * O cupom da divulgação normalizado — a validação da arena, com os tipos, o
 * alcance e a visibilidade do emissor.
 *
 * @param {object} input
 * @param {{ issuerType: string }} ctx
 * @returns {{ valid: boolean, errors: object, value: object }}
 */
export function normalizePromoCouponInput(input = {}, { issuerType } = {}) {
  const permitidos = PROMO_KIND_META[issuerType] || {};
  const kind = permitidos[input.kind] ? input.kind : K.DISCOUNT;
  const base = normalizeCouponInput({ ...input, kind });
  const errors = { ...base.errors };
  if (!permitidos[kind]) errors.kind = 'Tipo de cupom não disponível.';
  const alcance = normalizeReach(input.reach || {});
  if (!alcance.valid) Object.assign(errors, alcance.errors);
  const visibility = issuerType === PROMO_ISSUER.COACH && input.visibility === PROMO_VISIBILITY.STUDENTS
    ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL;
  const {
    referrer_reward, referred_reward_kind, referred_reward_value, first_booking_only, max_per_referrer,
    ...campos
  } = base.value;
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      ...campos,
      // O desconto da divulgação não tem "valor mínimo da conta" automático
      // (não há conta): quem registra confere.
      min_amount: null,
      reach: alcance.value,
      visibility,
    },
  };
}

/** Os cupons que o emissor divulga e ainda valem (a vitrine). */
export function livePromoCoupons(coupons = [], now = Date.now()) {
  return (coupons || [])
    .filter((c) => c?.show_public === true && isCouponValid(c, now))
    .sort((a, b) => (Number(a.expires_at) || Infinity) - (Number(b.expires_at) || Infinity));
}

/** "10% de desconto na aula", "1 camiseta PickleRush". */
export function promoBenefitText(coupon) {
  if (!coupon) return '';
  const txt = couponBenefitText(coupon);
  if (couponKind(coupon) === K.DISCOUNT && coupon.issuer_type === PROMO_ISSUER.COACH) return `${txt} na aula`;
  return txt;
}

/** Onde a pessoa usa o cupom — a frase do canhoto e do "copiar". */
export function promoUseHint(coupon) {
  const coach = coupon?.issuer_type === PROMO_ISSUER.COACH;
  if (coach && couponKind(coupon) === K.DISCOUNT) return 'Informe o código ao pedir a aula.';
  if (coach) return 'Mostre o código ao professor.';
  return 'Mostre o código para usar.';
}

/* ------------------------------------------------------------------ */
/*  Campanha: destino                                                 */
/* ------------------------------------------------------------------ */

export const PROMO_DESTINATION = Object.freeze({
  DETAILS: 'details',
  // plataforma
  TOURNAMENTS: 'tournaments',
  TOURNAMENT: 'tournament',
  OPEN_GAMES: 'open_games',
  GAME_DAY: 'game_day',
  ARENAS: 'arenas',
  COACHES: 'coaches',
  RANKING: 'ranking',
  DOUBLES: 'doubles',
  CLUBS: 'clubs',
  COMMUNITY: 'community',
  PARTNERS: 'partners',
  PROMOS: 'promos',
  // professor
  PROFILE: 'profile',
  BOOK_LESSON: 'book_lesson',
  CLINICS: 'clinics',
  STORE: 'store',
  CONTENT: 'content',
});

const D = PROMO_DESTINATION;

/** Cada destino: rótulo, dica, botão e se pede alvo (qual torneio…). */
export const PROMO_DESTINATION_META = Object.freeze({
  [D.DETAILS]: { label: 'Página da campanha', hint: 'Mostra o banner, a mensagem e o caminho.', cta: 'Saiba mais' },
  [D.TOURNAMENTS]: { label: 'Torneios', hint: 'A lista de torneios da plataforma.', cta: 'Ver torneios' },
  [D.TOURNAMENT]: { label: 'Um torneio', hint: 'A página de um torneio com inscrição aberta.', cta: 'Inscrever-se', target: 'tournament' },
  [D.OPEN_GAMES]: { label: 'Procura-se jogo', hint: 'Os jogos com vaga da comunidade.', cta: 'Quero jogar' },
  [D.GAME_DAY]: { label: 'Um dia de jogo', hint: 'A página de um dia de jogo público.', cta: 'Ver o jogo', target: 'game_day' },
  [D.ARENAS]: { label: 'Arenas e quadras', hint: 'Encontrar arena e reservar quadra.', cta: 'Reservar quadra' },
  [D.COACHES]: { label: 'Professores', hint: 'O diretório de professores.', cta: 'Encontrar professor' },
  [D.RANKING]: { label: 'Ranking', hint: 'O ranking da plataforma.', cta: 'Ver o ranking' },
  [D.DOUBLES]: { label: 'Ranking de duplas', hint: 'As parcerias mais fortes.', cta: 'Ver as duplas' },
  [D.CLUBS]: { label: 'Clubes', hint: 'Os clubes da comunidade.', cta: 'Conhecer clubes' },
  [D.COMMUNITY]: { label: 'Comunidade', hint: 'As novidades da comunidade.', cta: 'Ver novidades' },
  [D.PARTNERS]: { label: 'Parceiros', hint: 'Os parceiros da plataforma.', cta: 'Ver parceiros' },
  [D.PROMOS]: { label: 'Promoções', hint: 'A vitrine de cupons e campanhas.', cta: 'Ver promoções' },
  [D.PROFILE]: { label: 'Meu perfil de professor', hint: 'O seu perfil público, com agenda, clínicas e loja.', cta: 'Conhecer o professor' },
  [D.BOOK_LESSON]: { label: 'Marcar aula', hint: 'Abre o pedido de aula no seu perfil.', cta: 'Marcar aula' },
  [D.CLINICS]: { label: 'Minhas clínicas', hint: 'As clínicas e workshops abertos.', cta: 'Ver clínicas' },
  [D.STORE]: { label: 'Minha loja', hint: 'Os produtos à venda com você.', cta: 'Ver a loja' },
  [D.CONTENT]: { label: 'Meu conteúdo', hint: 'A sua biblioteca de conteúdo.', cta: 'Ver conteúdo' },
});

/** Os destinos de cada emissor, na ordem de exibição. */
export const PROMO_DESTINATIONS_BY_ISSUER = Object.freeze({
  [PROMO_ISSUER.PLATFORM]: Object.freeze([
    D.DETAILS, D.TOURNAMENTS, D.TOURNAMENT, D.OPEN_GAMES, D.GAME_DAY, D.ARENAS, D.COACHES,
    D.RANKING, D.DOUBLES, D.CLUBS, D.COMMUNITY, D.PARTNERS, D.PROMOS,
  ]),
  [PROMO_ISSUER.COACH]: Object.freeze([
    D.DETAILS, D.PROFILE, D.BOOK_LESSON, D.CLINICS, D.STORE, D.CONTENT, D.PROMOS,
  ]),
});

/** O destino normalizado para o emissor. */
export function normalizePromoDestination(input = {}, issuerType) {
  const permitidos = PROMO_DESTINATIONS_BY_ISSUER[issuerType] || [D.DETAILS];
  const type = permitidos.includes(input?.type) ? input.type : D.DETAILS;
  const meta = PROMO_DESTINATION_META[type];
  const target_id = meta.target ? String(input?.target_id || '').trim().slice(0, 120) : '';
  const target_label = meta.target ? String(input?.target_label || '').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const errors = {};
  if (meta.target && !target_id) {
    errors.target_id = { tournament: 'Escolha o torneio.', game_day: 'Escolha o dia de jogo.' }[meta.target];
  }
  return { valid: Object.keys(errors).length === 0, errors, value: { type, target_id, target_label } };
}

/**
 * O link do destino — sempre um caminho INTERNO. O perfil do professor tem
 * âncoras por seção (`#professor-clinicas`…) para o clique no banner cair no
 * lugar certo; o AVISO leva à página da campanha (a regra de `notifications`
 * não aceita `#` — ver `core/domain/internalLink.js`).
 */
export function promoDestinationLink(destination, { issuerType, issuerId, campaignId } = {}) {
  const tipo = destination?.type || D.DETAILS;
  const alvo = encodeURIComponent(String(destination?.target_id || '').trim());
  const perfil = issuerId && issuerType === PROMO_ISSUER.COACH ? `/coaches/${encodeURIComponent(issuerId)}` : null;
  switch (tipo) {
    case D.TOURNAMENTS: return '/torneios';
    case D.TOURNAMENT: return alvo ? `/torneios/${alvo}` : '/torneios';
    case D.OPEN_GAMES: return '/procura-jogo';
    case D.GAME_DAY: return alvo ? `/dia-de-jogo/${alvo}` : '/procura-jogo';
    case D.ARENAS: return '/arenas';
    case D.COACHES: return '/coaches';
    case D.RANKING: return '/ranking';
    case D.DOUBLES: return '/ranking/duplas';
    case D.CLUBS: return '/clubes';
    case D.COMMUNITY: return '/novidades';
    case D.PARTNERS: return '/parceiros';
    case D.PROMOS: return '/promocoes';
    case D.PROFILE: return perfil || '/coaches';
    case D.BOOK_LESSON: return perfil ? `${perfil}?marcar=1` : '/coaches';
    case D.CLINICS: return perfil ? `${perfil}#professor-clinicas` : '/coaches';
    case D.STORE: return perfil ? `${perfil}#professor-loja` : '/coaches';
    case D.CONTENT: return perfil ? `${perfil}#professor-conteudo` : '/coaches';
    case D.DETAILS:
    default:
      return campaignId ? `/campanhas/${encodeURIComponent(campaignId)}` : (perfil || '/promocoes');
  }
}

/** O link que vai no AVISO: sem `#` (a regra recusaria o lote inteiro). */
export function promoNoticeLink(destination, ctx = {}) {
  const link = promoDestinationLink(destination, ctx);
  if (!link.includes('#')) return link;
  return promoDestinationLink({ type: D.DETAILS }, ctx);
}

/** O texto do botão: o que o emissor escreveu, senão o do destino. */
export function promoDestinationCta(destination, design) {
  const proprio = String(design?.cta || '').trim();
  if (proprio) return proprio;
  return PROMO_DESTINATION_META[destination?.type]?.cta || 'Saiba mais';
}

/* ------------------------------------------------------------------ */
/*  Campanha: lugar e prazo                                           */
/* ------------------------------------------------------------------ */

function somaDias(iso, dias) {
  const [a, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(a, m - 1, d + dias);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/**
 * Onde o banner aparece e até quando.
 *  - `show_home`: carrossel da tela inicial (no alcance escolhido);
 *  - `show_on_page`: a página do emissor — o perfil do professor, ou a vitrine
 *    de promoções no caso da plataforma.
 * @returns {{ valid, errors, value: { show_on_page, show_home, banner_until } }}
 */
export function normalizePromoPlacement(input = {}, { today } = {}) {
  const errors = {};
  const show_on_page = input.show_on_page !== false;
  const show_home = input.show_home === true;
  let until = String(input.banner_until || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) until = today ? somaDias(today, BANNER_DEFAULT_DAYS) : '';
  if (today && until < today) errors.banner_until = 'A data final já passou.';
  if (today && until > somaDias(today, BANNER_MAX_DAYS)) {
    errors.banner_until = `O banner fica no ar por até ${BANNER_MAX_DAYS} dias.`;
  }
  if (!show_on_page && !show_home) errors.placement = 'Escolha pelo menos um lugar para o banner aparecer.';
  return { valid: Object.keys(errors).length === 0, errors, value: { show_on_page, show_home, banner_until: until } };
}

/** O "até" padrão: hoje + 14 dias. */
export function defaultPromoUntil(today) {
  return somaDias(today, BANNER_DEFAULT_DAYS);
}

/** O banner da campanha está no ar hoje? (mesma régua da arena) */
export function isPromoBannerLive(campaign, { today } = {}) {
  return campaignBannerState(campaign, { today }) === BANNER_STATE.LIVE;
}

/** Os banners no ar num lugar (`page` ou `home`), os que vencem antes primeiro. */
export function livePromoBanners(campaigns = [], { today, lugar = 'home' } = {}) {
  return (campaigns || [])
    .filter((c) => (lugar === 'home' ? c?.show_home === true : c?.show_on_page !== false))
    .filter((c) => isPromoBannerLive(c, { today }))
    .sort((a, b) => String(a.banner_until || '9999').localeCompare(String(b.banner_until || '9999')));
}

/** "Banner na tela inicial e no seu perfil · leva a: Marcar aula". */
export function promoPlacementText(campaign) {
  if (!campaign?.banner) return '';
  const pagina = campaign.issuer_type === PROMO_ISSUER.COACH ? 'no seu perfil' : 'na vitrine de promoções';
  const onde = [
    campaign.show_home ? 'na tela inicial' : null,
    campaign.show_on_page !== false ? pagina : null,
  ].filter(Boolean);
  const destino = PROMO_DESTINATION_META[campaign.destination?.type]?.label || PROMO_DESTINATION_META.details.label;
  const alvo = campaign.destination?.target_label ? ` (${campaign.destination.target_label})` : '';
  return `Banner ${onde.join(' e ')} · leva a: ${destino}${alvo}`;
}

/* ------------------------------------------------------------------ */
/*  Campanha: público do aviso                                        */
/* ------------------------------------------------------------------ */

export const PROMO_AUDIENCE = Object.freeze({
  // plataforma
  ALL: 'todos',
  INTEREST: 'interesse',
  STATE: 'estado',
  CITY: 'cidade',
  COACHES: 'professores',
  // professor
  ACTIVE_STUDENTS: 'alunos_ativos',
  ALL_STUDENTS: 'todos_alunos',
});

const A = PROMO_AUDIENCE;

export const PROMO_AUDIENCE_META = Object.freeze({
  [A.ALL]: { label: 'Todo mundo', hint: 'Todas as contas da plataforma.' },
  [A.INTEREST]: { label: 'Por interesse', hint: 'Quem marcou um interesse no perfil (torneios, aulas, arenas…).', needs: 'interest' },
  [A.STATE]: { label: 'Por estado', hint: 'Quem informou o estado no perfil.', needs: 'state' },
  [A.CITY]: { label: 'Por cidade', hint: 'Quem informou a cidade no perfil.', needs: 'city' },
  [A.COACHES]: { label: 'Professores', hint: 'Quem tem perfil de professor ativo.' },
  [A.ACTIVE_STUDENTS]: { label: 'Alunos ativos', hint: 'Os alunos com vínculo ativo com você.' },
  [A.ALL_STUDENTS]: { label: 'Todos os alunos', hint: 'Ativos e em pausa (quem ainda não aceitou o convite fica de fora).' },
});

export const PROMO_AUDIENCES_BY_ISSUER = Object.freeze({
  [PROMO_ISSUER.PLATFORM]: Object.freeze([A.ALL, A.INTEREST, A.STATE, A.CITY, A.COACHES]),
  [PROMO_ISSUER.COACH]: Object.freeze([A.ACTIVE_STUDENTS, A.ALL_STUDENTS]),
});

const uniq = (lista) => [...new Set((lista || []).filter(Boolean))];

/**
 * Quem recebe o aviso da PLATAFORMA — a partir da lista de contas que o admin
 * já lê (`users`). Conta ocultada pela moderação não recebe.
 *
 * @param {string} audience
 * @param {{ users?: object[], interest?: string, state?: string, city?: string }} ctx
 * @returns {string[]} uids
 */
export function platformRecipients(audience, { users = [], interest = '', state = '', city = '' } = {}) {
  const vivos = (users || []).filter((u) => u && (u.uid || u.id) && u.hidden !== true);
  const id = (u) => u.uid || u.id;
  switch (audience) {
    case A.ALL: return uniq(vivos.map(id));
    case A.INTEREST:
      if (!interest) return [];
      return uniq(vivos.filter((u) => Array.isArray(u.interests) && u.interests.includes(interest)).map(id));
    case A.STATE:
      if (!uf(state)) return [];
      return uniq(vivos.filter((u) => uf(u.state) === uf(state)).map(id));
    case A.CITY:
      if (!city) return [];
      return uniq(vivos.filter((u) => normalizeLocality(u.city) === normalizeLocality(city)
        && (!uf(state) || uf(u.state) === uf(state))).map(id));
    case A.COACHES: return uniq(vivos.filter((u) => u.is_coach === true).map(id));
    default: return [];
  }
}

/**
 * Quem recebe o aviso do PROFESSOR — os alunos dele (`coach_students`). Quem
 * só foi convidado e não aceitou não recebe: ainda não é aluno.
 * @returns {string[]} uids
 */
export function coachRecipients(audience, { students = [] } = {}) {
  const lista = (students || []).filter((s) => s?.student_id);
  if (audience === A.ACTIVE_STUDENTS) return uniq(lista.filter((s) => s.status === 'active').map((s) => s.student_id));
  if (audience === A.ALL_STUDENTS) {
    return uniq(lista.filter((s) => s.status === 'active' || s.status === 'paused').map((s) => s.student_id));
  }
  return [];
}

/* ------------------------------------------------------------------ */
/*  Controle de uso                                                   */
/* ------------------------------------------------------------------ */

/**
 * Usos, custo e receita por cupom — a mesma ideia do controle da arena:
 * número desconhecido é `null` ("—" na tela), nunca zero.
 *
 *  - vale: custo = usos × custo unitário informado (sem custo → desconhecido);
 *  - desconto do professor: custo = o que foi abatido nas aulas confirmadas
 *    com o cupom; receita = o que essas aulas renderam;
 *  - desconto da plataforma: não passa por um preço da plataforma → custo e
 *    receita desconhecidos (só os usos).
 *
 * @param {{ coupons?: object[], costs?: Record<string, number>, lessons?: object[] }} input
 */
export function promoUsageReport({ coupons = [], costs = {}, lessons = [] } = {}) {
  const porCupom = new Map();
  (lessons || []).forEach((l) => {
    const c = l?.coupon;
    if (!c?.coupon_id || c.status !== 'applied') return;
    const atual = porCupom.get(c.coupon_id) || { desconto: 0, receita: 0, conhecido: true };
    // Na confirmação, `price` passa a ser o valor JÁ com o desconto e o
    // cupom guarda `original_price`. Receita = o que a aula rendeu.
    const d = Number(c.discount_value);
    const preco = Number(l.price);
    if (!Number.isFinite(d) || !Number.isFinite(preco)) atual.conhecido = false;
    else {
      const original = Number.isFinite(Number(c.original_price)) && c.original_price !== null
        ? Number(c.original_price) : preco + d;
      atual.desconto += d;
      atual.receita += Math.max(0, original - d);
    }
    porCupom.set(c.coupon_id, atual);
  });

  const linhas = (coupons || []).map((c) => {
    const usos = Number(c.used_count) || 0;
    const familia = promoFamily(c);
    let custo = null;
    let receita = null;
    if (familia === PROMO_FAMILY.VOUCHER) {
      const unit = costs?.[c.id];
      custo = Number.isFinite(Number(unit)) && unit !== null && unit !== '' ? Number(unit) * usos : (usos === 0 ? 0 : null);
    } else if (c.issuer_type === PROMO_ISSUER.COACH) {
      const agg = porCupom.get(c.id);
      if (!agg) { custo = usos === 0 ? 0 : null; receita = usos === 0 ? 0 : null; } else if (agg.conhecido) {
        custo = Math.round(agg.desconto * 100) / 100;
        receita = Math.round(agg.receita * 100) / 100;
      }
    }
    return { id: c.id, code: c.code, kind: couponKind(c), familia, usos, custo, receita, active: c.active !== false };
  });
  const soma = (campo) => (linhas.some((l) => l[campo] == null) ? null
    : Math.round(linhas.reduce((t, l) => t + (l[campo] || 0), 0) * 100) / 100);
  return {
    linhas,
    total: { usos: linhas.reduce((t, l) => t + l.usos, 0), custo: soma('custo'), receita: soma('receita') },
  };
}

/* ------------------------------------------------------------------ */
/*  O cupom no pedido de aula (professor)                             */
/* ------------------------------------------------------------------ */

export {
  LESSON_COUPON_STATUS, lessonCouponLine, normalizeLessonCoupon, pendingCouponReturn, hasReturnableUse,
} from './lessonCoupon.js';

/**
 * O cupom que o aluno informa no pedido de aula — só o que a tela sabe:
 * código, id e o benefício em texto. Nasce PENDENTE; quem aplica é o
 * professor, na confirmação (o uso é contado ali, como na arena).
 */
export function lessonCouponFromPromo(coupon) {
  if (!coupon?.id || !coupon?.code) return null;
  return {
    coupon_id: String(coupon.id).slice(0, 120),
    code: String(coupon.code).slice(0, 30),
    benefit: promoBenefitText(coupon).slice(0, 120),
    kind: couponKind(coupon),
    status: LESSON_COUPON_STATUS.PENDING,
  };
}

/**
 * Os tipos que entram no PEDIDO DE AULA: o desconto (abate o percentual ou o
 * valor) e o vale de AULA PARTICULAR (a aula sai por conta do professor). Os
 * outros vales são entregues em mãos — o aluno mostra o código na aula.
 */
export const LESSON_COUPON_KINDS = Object.freeze([K.DISCOUNT, K.PRIVATE_LESSON]);

/**
 * Por que este código NÃO entra no pedido de aula deste professor — ou `null`.
 * "Cupom inválido" não ensina nada; "é de outro professor" e "venceu" ensinam.
 *
 * `isStudent`: se a pessoa é aluna deste professor. Só pesa no cupom "só para
 * os meus alunos", e só quando SABIDO — `false` recusa; `null` (não deu para
 * conferir) não recusa aqui: quem decide é a confirmação, que confere de novo.
 *
 * @param {object|null} coupon
 * @param {{ coachId: string, usedByUser?: boolean, isStudent?: boolean|null, now?: number }} ctx
 */
export function lessonCouponProblem(coupon, { coachId, usedByUser = false, isStudent = null, now = Date.now() } = {}) {
  if (!coupon) return 'Cupom não encontrado.';
  if (coupon.issuer_type !== PROMO_ISSUER.COACH || coupon.issuer_id !== coachId) {
    return 'Este código não é deste professor.';
  }
  if (!LESSON_COUPON_KINDS.includes(couponKind(coupon))) {
    return 'Este código é um vale: mostre ao professor na aula para usar.';
  }
  if (coupon.visibility === PROMO_VISIBILITY.STUDENTS && isStudent === false) {
    return 'Este cupom é só para quem já é aluno deste professor.';
  }
  const erro = couponError(coupon, { anyFamily: true, usedByUser, now });
  return erro;
}

/**
 * Quanto o cupom abate de uma aula de `price`: o desconto (nunca além do
 * preço) ou a aula inteira (vale de aula particular). Outro vale abate zero.
 */
export function lessonCouponDiscount(price, coupon) {
  const base = Number(price) || 0;
  if (base <= 0 || !coupon) return 0;
  const kind = couponKind(coupon);
  if (kind === K.PRIVATE_LESSON) return Math.round(base * 100) / 100;
  if (kind !== K.DISCOUNT) return 0;
  const bruto = coupon.type === COUPON_TYPE.FIXED
    ? Number(coupon.value) || 0
    : base * ((Number(coupon.value) || 0) / 100);
  return Math.max(0, Math.min(base, Math.round(bruto * 100) / 100));
}

const minutosDoHorario = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Os horários válidos da aula, em ordem (data e início). */
function horariosDaAula(lesson) {
  return (Array.isArray(lesson?.slots) ? lesson.slots : [])
    .filter((s) => {
      const a = minutosDoHorario(s?.start);
      const b = minutosDoHorario(s?.end);
      return a != null && b != null && b > a;
    })
    .sort((x, y) => `${x.date || ''} ${x.start}`.localeCompare(`${y.date || ''} ${y.start}`));
}

const duracaoEmHoras = (s) => (minutosDoHorario(s.end) - minutosDoHorario(s.start)) / 60;
const centavos = (n) => Math.round(n * 100) / 100;

/**
 * O preço de referência da aula INTEIRA (todos os horários): o preço gravado
 * na aula (se houver) ou o valor-hora do professor × as horas dos horários.
 * Sem nenhum dos dois, `null` — e o desconto em % fica desconhecido (nunca
 * inventado).
 */
export function lessonReferencePrice(lesson = {}, coach = {}) {
  const gravado = Number(lesson?.price);
  if (lesson?.price != null && Number.isFinite(gravado) && gravado > 0) return centavos(gravado);
  const hora = Number(coach?.hourly_rate);
  if (coach?.hourly_rate == null || !Number.isFinite(hora) || hora <= 0) return null;
  const horas = horariosDaAula(lesson).reduce((t, s) => t + duracaoEmHoras(s), 0);
  if (horas <= 0) return null;
  return centavos(hora * horas);
}

/**
 * O valor da aula que o cupom COBRE — uma só. Numa aula recorrente (vários
 * horários) o cupom vale para a PRIMEIRA: ele conta um uso só, e "aula
 * experimental grátis" não pode virar dez semanas grátis. Com o preço gravado
 * da série, a parte de cada aula é o preço ÷ o número de aulas.
 */
export function lessonCouponBase(lesson = {}, coach = {}) {
  const horarios = horariosDaAula(lesson);
  const gravado = Number(lesson?.price);
  if (lesson?.price != null && Number.isFinite(gravado) && gravado > 0) {
    return centavos(horarios.length > 1 ? gravado / horarios.length : gravado);
  }
  const hora = Number(coach?.hourly_rate);
  if (coach?.hourly_rate == null || !Number.isFinite(hora) || hora <= 0 || horarios.length === 0) return null;
  return centavos(hora * duracaoEmHoras(horarios[0]));
}

/**
 * O que acontece com o cupom do pedido quando o PROFESSOR CONFIRMA a aula —
 * conta pura, o serviço só grava o resultado.
 *
 *  - cupom que não vale mais (venceu, esgotou, já usado por este aluno, é de
 *    outro professor): RECUSADO, com o motivo — a aula é confirmada assim
 *    mesmo, e o aluno é avisado do porquê;
 *  - vale: APLICADO. Com preço conhecido, `price` passa a ser o valor já com o
 *    desconto e o cupom guarda `original_price` e `discount_value`. Sem preço
 *    conhecido (professor sem valor-hora e aula sem preço), o desconto em R$
 *    fixo ainda vale; o percentual fica `null` — combinado na hora, nunca
 *    inventado.
 *
 * Numa aula recorrente o desconto vale para UMA aula (`lessonCouponBase`), e
 * `price` é o valor da série menos esse desconto. `isStudent` decide o cupom
 * "só para os meus alunos": o serviço o confere no banco e, se não conseguir,
 * nem chama esta conta (o cupom segue pendente).
 *
 * @returns {{ coupon: object, price?: number }}
 */
export function resolveLessonCoupon({ lesson, coupon, coach, isStudent = null, now = Date.now() } = {}) {
  const pedido = lesson?.coupon || {};
  const base = { ...pedido };
  const problema = lessonCouponProblem(coupon, {
    coachId: lesson?.coach_id,
    usedByUser: Boolean(lesson?.student_id) && (coupon?.used_by || []).includes(lesson.student_id),
    isStudent,
    now,
  });
  if (problema) return { coupon: { ...base, status: LESSON_COUPON_STATUS.REJECTED, reason: problema } };

  const total = lessonReferencePrice(lesson, coach);
  const coberta = lessonCouponBase(lesson, coach);
  const aulas = horariosDaAula(lesson).length;
  const kind = couponKind(coupon);
  let desconto = null;
  if (coberta != null) desconto = lessonCouponDiscount(coberta, coupon);
  else if (kind === K.DISCOUNT && coupon.type === COUPON_TYPE.FIXED) desconto = Math.max(0, Number(coupon.value) || 0);

  const aplicado = {
    ...base,
    benefit: promoBenefitText(coupon).slice(0, 120),
    kind,
    status: LESSON_COUPON_STATUS.APPLIED,
    discount_value: desconto,
    original_price: total,
    ...(aulas > 1 ? { lessons_count: aulas } : {}),
  };
  if (total == null || desconto == null) return { coupon: aplicado };
  return { coupon: aplicado, price: Math.max(0, centavos(total - desconto)) };
}

/* ------------------------------------------------------------------ */
/*  Tela inicial                                                      */
/* ------------------------------------------------------------------ */

function fimDoDiaMs(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const ms = new Date(`${iso}T23:59:59`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Os itens da divulgação que podem ir ao carrossel da tela inicial (antes do
 * filtro de região): cupons divulgados e marcados para a tela inicial, ainda
 * valendo; banners de campanha no ar marcados para ela — só dos emissores com
 * a flag ligada e só o que a pessoa pode ver ("só alunos").
 *
 * @returns {Array<{ id: string, promo: 'coupon'|'campaign', doc: object, reach: object, expiresAt: number|null }>}
 */
export function homePromoItems({
  coupons = [], campaigns = [], platformOn = false, coachesOn = false, viewer = {}, today, now = Date.now(),
} = {}) {
  const emissorLigado = (d) => (d?.issuer_type === PROMO_ISSUER.PLATFORM ? platformOn
    : d?.issuer_type === PROMO_ISSUER.COACH ? coachesOn : false);
  const pode = (d) => emissorLigado(d) && isVisibleTo(d, viewer);
  const alcance = (d) => normalizeReach(d?.reach || {}).value;
  const cupons = (coupons || [])
    .filter((c) => c?.show_home === true && c?.show_public === true && pode(c) && isCouponValid(c, now))
    .map((c) => {
      const exp = Number(c.expires_at);
      return {
        id: `promo-cupom:${c.id}`, promo: 'coupon', doc: c, reach: alcance(c),
        expiresAt: c.expires_at != null && Number.isFinite(exp) ? exp : null,
      };
    });
  const banners = livePromoBanners(campaigns, { today, lugar: 'home' })
    .filter(pode)
    .map((c) => ({ id: `promo-campanha:${c.id}`, promo: 'campaign', doc: c, reach: alcance(c), expiresAt: fimDoDiaMs(c.banner_until) }));
  return [...cupons, ...banners];
}

/** Os itens que valem para a região que a pessoa está vendo. */
export function promoItemsInRegion(itens = [], region) {
  return (itens || []).filter((i) => reachMatchesRegion(i.reach, region));
}

/**
 * As cidades que têm item REGIONAL (alcance "cidade") — para o seletor
 * "outra cidade", no mesmo formato de `bannerCities` das arenas.
 */
export function promoCities(itens = []) {
  const mapa = new Map();
  (itens || []).forEach((i) => {
    if (i?.reach?.mode !== PROMO_REACH.CIDADE || !i.reach.city) return;
    const key = cityKey(i.reach.city, i.reach.state);
    const atual = mapa.get(key) || { key, city: i.reach.city, state: uf(i.reach.state), count: 0 };
    atual.count += 1;
    mapa.set(key, atual);
  });
  return [...mapa.values()];
}

/** Junta as cidades das arenas e as da divulgação (somando as contagens). */
export function mergeBannerCities(...listas) {
  const mapa = new Map();
  listas.flat().forEach((c) => {
    if (!c?.key) return;
    const atual = mapa.get(c.key);
    mapa.set(c.key, atual ? { ...atual, count: atual.count + (c.count || 0) } : { ...c });
  });
  return [...mapa.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

/** Ordena pelo prazo: o que vence antes vem antes (sem prazo, por último). */
export function byExpiry(a, b) {
  const va = a?.expiresAt ?? Infinity;
  const vb = b?.expiresAt ?? Infinity;
  if (va === vb) return 0;
  return va < vb ? -1 : 1;
}

/**
 * O BANNER DA CAMPANHA (Onda CC) — para onde ele leva, onde aparece e até
 * quando.
 *
 * *"…com hiperlink que leve para maiores detalhes da campanha ou para funções
 * determinadas da campanha: reservas, dia de jogo, torneio, produto,
 * membros…"*
 *
 * O banner é UM clique entre a pessoa e o que a campanha quer que ela faça.
 * Por isso o destino é escolhido de uma lista FECHADA de lugares da
 * plataforma, e o link é montado aqui — nunca digitado. Link digitado quebra
 * (a tela vira "página não encontrada" no celular do cliente) e link de fora
 * leva quem confiou na arena para um lugar que ninguém conferiu.
 *
 * Os campos moram na própria campanha (`arena_campaigns`), todos opcionais:
 * `banner`, `destination`, `show_on_arena`, `show_home`, `banner_until`,
 * `banner_active`. Campanha antiga (sem banner) segue igual.
 *
 * PURO. Sem React, sem Firebase.
 */
import { normalizeBannerDesign, isAllowedImageUrl, platformTemplate, isArenaTemplateId } from './bannerArt.js';
import { ARENA_MODULE_ID } from './modules.js';

/* ------------------------------------------------------------------ */
/*  Destino                                                           */
/* ------------------------------------------------------------------ */

export const CAMPAIGN_DESTINATION = Object.freeze({
  DETAILS: 'details',
  BOOKING: 'booking',
  OPEN_MATCH: 'open_match',
  GAME_DAY: 'game_day',
  TOURNAMENT: 'tournament',
  PRODUCT: 'product',
  MEMBERS: 'members',
  CLASSES: 'classes',
  PROMOS: 'promos',
  RANKING: 'ranking',
});

/**
 * Cada destino: o que é, o botão que ele sugere e o que ele exige.
 * `module` é o módulo que o destino pressupõe ligado (sem ele, a seção de
 * destino não existe na página da arena, e o banner levaria ao nada).
 * `target` diz se é preciso escolher QUAL (qual dia de jogo, qual torneio…).
 */
export const CAMPAIGN_DESTINATION_META = Object.freeze({
  [CAMPAIGN_DESTINATION.DETAILS]: {
    label: 'Página da campanha',
    hint: 'Mostra o banner, a mensagem e o caminho para a arena.',
    cta: 'Saiba mais',
  },
  [CAMPAIGN_DESTINATION.BOOKING]: {
    label: 'Reservar quadra',
    hint: 'Leva direto ao calendário de reservas da arena.',
    cta: 'Reservar agora',
  },
  [CAMPAIGN_DESTINATION.OPEN_MATCH]: {
    label: 'Jogos abertos',
    hint: 'Os jogos com vaga que a arena publicou.',
    cta: 'Quero jogar',
    module: ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH,
  },
  [CAMPAIGN_DESTINATION.GAME_DAY]: {
    label: 'Um dia de jogo',
    hint: 'A página de um dia de jogo específico: regras, quem vai e a inscrição.',
    cta: 'Ver o jogo',
    target: 'game_day',
  },
  [CAMPAIGN_DESTINATION.TOURNAMENT]: {
    label: 'Um torneio',
    hint: 'A página de um torneio da casa, com a inscrição.',
    cta: 'Inscrever-se',
    target: 'tournament',
  },
  [CAMPAIGN_DESTINATION.PRODUCT]: {
    label: 'Um produto da loja',
    hint: 'Abre a loja com o produto em destaque, pronto para pedir.',
    cta: 'Ver o produto',
    target: 'product',
    module: ARENA_MODULE_ID.PDV,
  },
  [CAMPAIGN_DESTINATION.MEMBERS]: {
    label: 'Planos e membros',
    hint: 'Os planos e as vantagens de ser membro.',
    cta: 'Conhecer os planos',
    module: ARENA_MODULE_ID.MEMBERS,
  },
  [CAMPAIGN_DESTINATION.CLASSES]: {
    label: 'Aulas',
    hint: 'As próximas aulas e os professores, com a matrícula.',
    cta: 'Ver as aulas',
    module: ARENA_MODULE_ID.CLASSES,
  },
  [CAMPAIGN_DESTINATION.PROMOS]: {
    label: 'Promoções',
    hint: 'Os cupons que a arena divulga na página.',
    cta: 'Ver as promoções',
    module: ARENA_MODULE_ID.MARKETING_COUPONS,
  },
  [CAMPAIGN_DESTINATION.RANKING]: {
    label: 'Ranking da casa',
    hint: 'A classificação da arena, com os torneios da casa.',
    cta: 'Ver o ranking',
    module: ARENA_MODULE_ID.LEAGUES,
  },
});

/** Os destinos que fazem sentido PARA ESTA ARENA (os módulos que ela ligou). */
export function availableDestinations(isOn = () => true) {
  return Object.values(CAMPAIGN_DESTINATION).filter((t) => {
    const mod = CAMPAIGN_DESTINATION_META[t]?.module;
    return !mod || isOn(mod);
  });
}

/**
 * O link do destino. Sempre um caminho INTERNO da plataforma.
 *
 * Destino que pede alvo e não tem cai na seção da arena correspondente — o
 * banner nunca leva a uma página quebrada.
 */
export function destinationLink(destination, { arenaId, campaignId } = {}) {
  const tipo = destination?.type || CAMPAIGN_DESTINATION.DETAILS;
  const alvo = encodeURIComponent(String(destination?.target_id || '').trim());
  const arena = `/arenas/${arenaId}`;
  switch (tipo) {
    case CAMPAIGN_DESTINATION.BOOKING: return `${arena}#arena-reservar`;
    case CAMPAIGN_DESTINATION.OPEN_MATCH: return `${arena}#arena-jogos-abertos`;
    case CAMPAIGN_DESTINATION.GAME_DAY: return alvo ? `/dia-de-jogo/${alvo}` : `${arena}#arena-dia-de-jogo`;
    case CAMPAIGN_DESTINATION.TOURNAMENT: return alvo ? `/torneios/${alvo}` : `${arena}#arena-torneios`;
    case CAMPAIGN_DESTINATION.PRODUCT: return alvo ? `${arena}/loja?produto=${alvo}` : `${arena}#arena-loja`;
    case CAMPAIGN_DESTINATION.MEMBERS: return `${arena}#arena-planos`;
    case CAMPAIGN_DESTINATION.CLASSES: return `${arena}#arena-aulas`;
    case CAMPAIGN_DESTINATION.PROMOS: return `${arena}#arena-promocoes`;
    case CAMPAIGN_DESTINATION.RANKING: return `${arena}/torneios`;
    case CAMPAIGN_DESTINATION.DETAILS:
    default:
      return campaignId ? `${arena}/campanhas/${campaignId}` : arena;
  }
}

/**
 * O destino normalizado.
 * @returns {{ valid: boolean, errors: object, value: { type, target_id, target_label } }}
 */
export function normalizeDestination(input = {}) {
  const tipos = Object.values(CAMPAIGN_DESTINATION);
  const type = tipos.includes(input?.type) ? input.type : CAMPAIGN_DESTINATION.DETAILS;
  const meta = CAMPAIGN_DESTINATION_META[type];
  const target_id = meta.target ? String(input?.target_id || '').trim().slice(0, 120) : '';
  const target_label = meta.target ? String(input?.target_label || '').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const errors = {};
  if (meta.target && !target_id) {
    errors.target_id = {
      game_day: 'Escolha o dia de jogo.',
      tournament: 'Escolha o torneio.',
      product: 'Escolha o produto.',
    }[meta.target];
  }
  return { valid: Object.keys(errors).length === 0, errors, value: { type, target_id, target_label } };
}

/** O texto do botão: o que a arena escreveu, senão o do destino. */
export function destinationCta(destination, design) {
  const proprio = String(design?.cta || '').trim();
  if (proprio) return proprio;
  return CAMPAIGN_DESTINATION_META[destination?.type]?.cta || 'Saiba mais';
}

/* ------------------------------------------------------------------ */
/*  O banner em si                                                    */
/* ------------------------------------------------------------------ */

export const BANNER_SOURCE = Object.freeze({
  DESIGN: 'design',
  UPLOAD: 'upload',
});

/** A descrição da imagem enviada: obrigatória, é o que o leitor de tela lê. */
export const BANNER_ALT_MAX = 200;

/**
 * O banner normalizado (desenho OU imagem enviada).
 * @returns {{ valid: boolean, errors: object, warnings: string[], value: object|null }}
 */
export function normalizeCampaignBanner(input) {
  if (!input) return { valid: true, errors: {}, warnings: [], value: null };
  const errors = {};
  let warnings = [];

  if (input.source === BANNER_SOURCE.UPLOAD) {
    const url = String(input.image_url || '').trim();
    const alt = String(input.alt || '').replace(/\s+/g, ' ').trim().slice(0, BANNER_ALT_MAX);
    if (!isAllowedImageUrl(url)) errors.image_url = 'Envie a imagem do banner.';
    if (!alt) errors.alt = 'Descreva a imagem — é o que o leitor de tela lê, e o que aparece se ela não carregar.';
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      warnings,
      value: {
        source: BANNER_SOURCE.UPLOAD,
        template_id: null,
        design: null,
        image_url: isAllowedImageUrl(url) ? url.slice(0, 1000) : '',
        image_path: String(input.image_path || '').slice(0, 300),
        width: Number(input.width) || null,
        height: Number(input.height) || null,
        alt,
      },
    };
  }

  const d = normalizeBannerDesign(input.design || {});
  warnings = d.warnings;
  Object.assign(errors, d.errors);
  const tid = String(input.template_id || '');
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
    value: {
      source: BANNER_SOURCE.DESIGN,
      template_id: platformTemplate(tid) || isArenaTemplateId(tid) ? tid : null,
      design: d.value,
      image_url: '',
      image_path: '',
      alt: '',
    },
  };
}

/** O texto que descreve o banner para quem não o vê. */
export function bannerAltText(banner) {
  if (!banner) return '';
  if (banner.source === BANNER_SOURCE.UPLOAD) return banner.alt || '';
  const d = banner.design || {};
  return [d.kicker, d.highlight, d.title, d.subtitle].filter(Boolean).join(' — ');
}

/* ------------------------------------------------------------------ */
/*  Onde e até quando                                                 */
/* ------------------------------------------------------------------ */

/** Por quantos dias o banner fica no ar, se a arena não disser. */
export const BANNER_DEFAULT_DAYS = 14;
/** O máximo — banner eterno vira papel de parede que ninguém lê. */
export const BANNER_MAX_DAYS = 120;

function somaDias(iso, dias) {
  const [a, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(a, m - 1, d + dias);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** O "até" padrão: hoje + 14 dias. */
export function defaultBannerUntil(today) {
  return somaDias(today, BANNER_DEFAULT_DAYS);
}

/**
 * Onde o banner aparece e até quando.
 * @returns {{ valid: boolean, errors: object, value: { show_on_arena, show_home, banner_until } }}
 */
export function normalizeBannerPlacement(input = {}, { today } = {}) {
  const errors = {};
  const show_on_arena = input.show_on_arena !== false;
  const show_home = input.show_home === true;
  let until = String(input.banner_until || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) until = today ? defaultBannerUntil(today) : '';
  if (today && until < today) errors.banner_until = 'A data final já passou.';
  if (today && until > somaDias(today, BANNER_MAX_DAYS)) {
    errors.banner_until = `O banner fica no ar por até ${BANNER_MAX_DAYS} dias.`;
  }
  if (!show_on_arena && !show_home) {
    errors.placement = 'Escolha pelo menos um lugar para o banner aparecer.';
  }
  return { valid: Object.keys(errors).length === 0, errors, value: { show_on_arena, show_home, banner_until: until } };
}

/** O estado do banner de uma campanha, para a lista da arena. */
export const BANNER_STATE = Object.freeze({
  NONE: 'none',
  LIVE: 'live',
  PAUSED: 'paused',
  ENDED: 'ended',
});

export function campaignBannerState(campaign, { today } = {}) {
  if (!campaign?.banner) return BANNER_STATE.NONE;
  if (campaign.status === 'cancelled') return BANNER_STATE.ENDED;
  if (campaign.banner_until && today && campaign.banner_until < today) return BANNER_STATE.ENDED;
  if (campaign.banner_active === false) return BANNER_STATE.PAUSED;
  return BANNER_STATE.LIVE;
}

/** O banner está no ar? */
export function isCampaignBannerLive(campaign, ctx) {
  return campaignBannerState(campaign, ctx) === BANNER_STATE.LIVE;
}

/**
 * Os banners no ar na PÁGINA DA ARENA — os que vencem primeiro vêm primeiro
 * (é o que a pessoa pode perder).
 */
export function arenaCampaignBanners(campaigns = [], { today } = {}) {
  return (campaigns || [])
    .filter((c) => c?.show_on_arena !== false && isCampaignBannerLive(c, { today }))
    .sort((a, b) => String(a.banner_until || '9999').localeCompare(String(b.banner_until || '9999')));
}

/**
 * Os banners no ar na TELA INICIAL (antes do filtro de região), com a arena
 * e o módulo conferidos — banner de arena que desligou as campanhas sai.
 */
export function homeCampaignBanners({ campaigns = [], arenas = [], isOnIn = () => true, today } = {}) {
  const porId = new Map((arenas || []).map((a) => [a.id, a]));
  return (campaigns || [])
    .filter((c) => c?.show_home === true && isCampaignBannerLive(c, { today }))
    .map((c) => {
      const arena = porId.get(c.arena_id);
      if (!arena || !isOnIn(arena.id)) return null;
      return { campaign: c, arena };
    })
    .filter(Boolean);
}

/** O resumo da campanha na lista da arena: onde está o banner e para onde leva. */
export function campaignPlacementText(campaign) {
  if (!campaign?.banner) return '';
  const onde = [
    campaign.show_on_arena !== false ? 'página da arena' : null,
    campaign.show_home ? 'tela inicial' : null,
  ].filter(Boolean);
  const destino = CAMPAIGN_DESTINATION_META[campaign.destination?.type]?.label || CAMPAIGN_DESTINATION_META.details.label;
  const alvo = campaign.destination?.target_label ? ` (${campaign.destination.target_label})` : '';
  return `Banner na ${onde.join(' e na ')} · leva a: ${destino}${alvo}`;
}

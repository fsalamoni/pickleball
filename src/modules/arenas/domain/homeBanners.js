/**
 * Domínio: os BANNERS de promoção na tela inicial (Onda BZ). PURO, sem I/O.
 *
 * ## O pedido
 *
 * *"as campanhas e cupons são divulgados dentro da arena apenas? Talvez seja
 * importante divulgar na página início, como banner, com rolagem entre todos
 * os banners criados e filtro de distância ou localidade, para que alguém de
 * determinado local não veja banner de região muito distante."*
 *
 * ## De onde vem um banner
 *
 * Do cupom que a arena marcou para DIVULGAR (`show_public`) e, além disso,
 * como banner na tela inicial (`show_home`). Divulgar na página da arena não
 * põe o cupom na tela inicial de todo mundo: a arena escolhe as duas coisas
 * separadamente. Cupom desligado, vencido ou esgotado não vira banner; o
 * programa de indicação também não (ele tem o próprio cartão).
 *
 * ## Localidade, não distância
 *
 * Nem as arenas nem os perfis têm coordenadas — têm CIDADE e ESTADO. Filtrar
 * por quilômetros exigiria geocodificar endereços num serviço externo e gravar
 * coordenadas nas arenas; por isso o filtro é por localidade: a minha cidade,
 * o meu estado, ou outra cidade (quem vai viajar). A comparação ignora acento
 * e caixa — "São Paulo" e "sao paulo" são a mesma cidade.
 *
 * Sem saber onde a pessoa está (perfil sem cidade nem estado), NÃO se mostra
 * o Brasil inteiro — era exatamente o que o pedido queria evitar. A tela pede
 * a cidade.
 */

import { publicPromos, promoConditions } from './marketing.js';
import { homeCampaignBanners } from './campaignBanner.js';

/** 'YYYY-MM-DD' local de um instante (ms). */
function isoLocal(ms) {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** O fim (23:59:59, hora local) de um dia 'YYYY-MM-DD', em ms — ou `null`. */
function fimDoDia(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const ms = new Date(`${iso}T23:59:59`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export const BANNER_REGION = Object.freeze({
  CITY: 'cidade',
  STATE: 'estado',
  OTHER: 'outra',
  ALL: 'todas',
  UNKNOWN: 'escolher',
});

/** "São Paulo " → "sao paulo". */
export function normalizeLocality(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const uf = (v) => String(v || '').trim().toUpperCase().slice(0, 2);

/** A chave de uma cidade: "RS|porto alegre". */
export function cityKey(city, state) {
  return `${uf(state)}|${normalizeLocality(city)}`;
}

/**
 * A região que vale, a partir da escolha guardada (`preference`) e do perfil.
 *
 * `preference`: `'cidade'` · `'estado'` · `'todas'` · `'outra:RS|porto alegre'`
 * (ou nada — então o padrão: a cidade do perfil, senão o estado, senão pedir).
 *
 * @returns {{ mode: string, city?: string, state?: string, key?: string }}
 */
export function resolveBannerRegion(preference, profile = {}) {
  const cidade = String(profile?.city || '').trim();
  const estado = uf(profile?.state);
  const pref = String(preference || '');

  if (pref.startsWith(`${BANNER_REGION.OTHER}:`)) {
    const key = pref.slice(BANNER_REGION.OTHER.length + 1);
    const [st, ...resto] = key.split('|');
    if (st && resto.length) return { mode: BANNER_REGION.OTHER, key, state: st, city: resto.join('|') };
  }
  if (pref === BANNER_REGION.ALL) return { mode: BANNER_REGION.ALL };
  if (pref === BANNER_REGION.STATE && estado) return { mode: BANNER_REGION.STATE, state: estado };
  if (pref === BANNER_REGION.CITY && cidade) return { mode: BANNER_REGION.CITY, city: cidade, state: estado, key: cityKey(cidade, estado) };
  // Padrão: a cidade do perfil; sem ela, o estado; sem nada, pedir.
  if (cidade) return { mode: BANNER_REGION.CITY, city: cidade, state: estado, key: cityKey(cidade, estado) };
  if (estado) return { mode: BANNER_REGION.STATE, state: estado };
  return { mode: BANNER_REGION.UNKNOWN };
}

/** A arena está na região? */
export function arenaInRegion(arena, region) {
  if (!arena || !region) return false;
  switch (region.mode) {
    case BANNER_REGION.ALL:
      return true;
    case BANNER_REGION.STATE:
      return Boolean(region.state) && uf(arena.state) === region.state;
    case BANNER_REGION.CITY:
    case BANNER_REGION.OTHER: {
      const alvo = region.key || cityKey(region.city, region.state);
      // Cidade sem estado no perfil: casa só pelo nome da cidade.
      if (!uf(region.state) && region.mode === BANNER_REGION.CITY) {
        return normalizeLocality(arena.city) === normalizeLocality(region.city);
      }
      return cityKey(arena.city, arena.state) === alvo;
    }
    default:
      return false;
  }
}

/**
 * Os banners possíveis (antes do filtro de região): cupons marcados para a
 * tela inicial, ainda valendo, de arenas que existem e com o módulo ligado.
 *
 * Com `campaigns` (Onda CC), entram também os banners de CAMPANHA marcados
 * para a tela inicial e no ar — cada um com `campaign` preenchido, que é como
 * a tela sabe desenhar a arte em vez do cartão do cupom. `isCampaignOnIn`
 * responde pelo módulo de campanhas de cada arena. Sem `campaigns`, a saída é
 * exatamente a de antes.
 *
 * @param {{
 *   coupons?: object[], arenas?: object[], isOnIn?: (arenaId: string) => boolean, now?: number,
 *   campaigns?: object[]|null, isCampaignOnIn?: (arenaId: string) => boolean,
 * }} dados
 */
export function eligibleBanners({
  coupons = [], arenas = [], isOnIn = () => true, now = Date.now(),
  campaigns = null, isCampaignOnIn = () => true,
} = {}) {
  const porId = new Map((arenas || []).map((a) => [a.id, a]));
  const marcados = (coupons || []).filter((c) => c?.show_home === true && c?.show_public === true);
  const cupons = publicPromos(marcados, now)
    .map((promo) => {
      const arena = porId.get(promo.arena_id);
      if (!arena || !isOnIn(arena.id)) return null;
      return {
        id: promo.id,
        arenaId: arena.id,
        arenaName: arena.name || 'Arena',
        city: arena.city || '',
        state: uf(arena.state),
        code: promo.code,
        benefit: promo.discount,
        description: promo.description,
        conditions: promoConditions(promo),
        bookable: promo.bookable,
        expiresAt: promo.expires_at,
        arena,
      };
    })
    .filter(Boolean);
  if (!campaigns) return cupons;

  // Onda CC: o BANNER de campanha que a arena marcou para a tela inicial
  // entra no mesmo carrossel e no mesmo filtro de região. Quem decide se está
  // no ar é `homeCampaignBanners` (ativo, dentro da data, módulo ligado).
  const doDia = homeCampaignBanners({
    campaigns, arenas, isOnIn: isCampaignOnIn, today: isoLocal(now),
  }).map(({ campaign, arena }) => ({
    id: `campanha:${campaign.id}`,
    campaign,
    arenaId: arena.id,
    arenaName: arena.name || 'Arena',
    city: arena.city || '',
    state: uf(arena.state),
    expiresAt: fimDoDia(campaign.banner_until),
    arena,
  }));
  return [...cupons, ...doDia];
}

/**
 * Os banners da região — os que vencem primeiro vêm primeiro (é o que a
 * pessoa pode perder).
 */
export function homeBanners(dados = {}, region) {
  return eligibleBanners(dados)
    .filter((b) => arenaInRegion(b.arena, region))
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity) || a.arenaName.localeCompare(b.arenaName));
}

/**
 * As cidades que TÊM banner agora — para o seletor "outra cidade". Mais
 * banners primeiro; empate, em ordem alfabética.
 * @returns {Array<{ key: string, city: string, state: string, count: number }>}
 */
export function bannerCities(dados = {}) {
  const mapa = new Map();
  eligibleBanners(dados).forEach((b) => {
    if (!b.city) return;
    const key = cityKey(b.city, b.state);
    const atual = mapa.get(key) || { key, city: b.city, state: b.state, count: 0 };
    atual.count += 1;
    mapa.set(key, atual);
  });
  return [...mapa.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

/** A região em texto: "em Porto Alegre", "no RS", "em todo o Brasil". */
export function regionLabel(region) {
  if (!region) return '';
  if (region.mode === BANNER_REGION.ALL) return 'em todo o Brasil';
  if (region.mode === BANNER_REGION.STATE) return `no ${region.state}`;
  if (region.mode === BANNER_REGION.CITY || region.mode === BANNER_REGION.OTHER) {
    return `em ${region.city}${region.state ? ` (${region.state})` : ''}`;
  }
  return '';
}

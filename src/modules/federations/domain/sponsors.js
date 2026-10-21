/**
 * PATROCINADORES da federação (PR 4, módulo `sponsors`) — lógica pura.
 *
 * Moram no documento da federação (`federations.sponsors[]`, campo opcional,
 * até 12): nome, logo (https), link e faixa. Saem na página pública e na
 * carteirinha SÓ com o módulo ligado (`visibleSponsors`) — a lista gravada
 * fica, o módulo é o interruptor.
 */
import { t } from '@/core/i18n';
import { SPONSOR_TIER } from './constants.js';
import { fedModuleOn } from './federation.js';

export const SPONSORS_MAX = 12;
const TIER_ORDER = [SPONSOR_TIER.MAIN, SPONSOR_TIER.SUPPORT, SPONSOR_TIER.PARTNER];
const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isHttps = (u) => /^https:\/\/\S+$/i.test(u);

/**
 * @param {object[]} list
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object[] }}
 */
export function validateSponsors(list = []) {
  const errors = {};
  if (!Array.isArray(list)) return { ok: false, errors: { sponsors: t('Lista inválida.') }, value: [] };
  if (list.length > SPONSORS_MAX) errors.sponsors = t('No máximo {n} patrocinadores.', { n: SPONSORS_MAX });
  const value = list.slice(0, SPONSORS_MAX).map((s, i) => {
    const name = str(s?.name, 60);
    if (name.length < 2) errors[`${i}.name`] = t('Nome do patrocinador (mínimo 2 caracteres).');
    const logo_url = str(s?.logo_url, 500);
    if (logo_url && !isHttps(logo_url)) errors[`${i}.logo_url`] = t('O logo precisa de um endereço https://');
    const url = str(s?.url, 300);
    if (url && !isHttps(url)) errors[`${i}.url`] = t('O link começa com https://');
    const tier = TIER_ORDER.includes(s?.tier) ? s.tier : SPONSOR_TIER.SUPPORT;
    return { name, logo_url, url, tier };
  });
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Ordenados por faixa (oficial → apoio → parceiro), na ordem gravada dentro da faixa. */
export function sortSponsors(list = []) {
  return [...(list || [])].sort((a, b) => TIER_ORDER.indexOf(a?.tier) - TIER_ORDER.indexOf(b?.tier));
}

/** Os patrocinadores que SAEM (página, carteirinha): só com o módulo ligado. */
export function visibleSponsors(federation) {
  if (!fedModuleOn(federation, 'sponsors')) return [];
  return sortSponsors((federation?.sponsors || []).filter((s) => s && s.name));
}

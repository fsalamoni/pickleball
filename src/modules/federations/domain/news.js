/**
 * NOTÍCIAS E AVISOS da federação (PR 4, módulo `news`) — lógica pura.
 *
 * A notícia é um documento `federation_news` que a equipe (`comms`/`admin`)
 * grava pelo cliente; a regra confere. Publicada e PÚBLICA sai na página da
 * federação (dentro e fora do app); "só filiados" sai para quem tem filiação
 * ATIVA nesta federação (a regra lê `federation_members/{fed}_{uid}`). O
 * AVISO aos filiados (sino, e-mail…) é do SERVIDOR (`federationNews`), porque
 * a comunicação não lê a lista de filiados — e não se repete: `notified_at`.
 */
import { t } from '@/core/i18n';
import { NEWS_AUDIENCE, NEWS_STATUS } from './constants.js';

export const NEWS_TITLE_MAX = 140;
export const NEWS_BODY_MAX = 6000;
export const NEWS_SUMMARY_MAX = 300;

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const isHttps = (u) => /^https:\/\/\S+$/i.test(u);

/**
 * @param {object} input
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateNewsInput(input = {}) {
  const errors = {};
  const title = str(input.title, NEWS_TITLE_MAX);
  if (title.length < 3) errors.title = t('Dê um título à notícia (mínimo 3 caracteres).');
  const body = str(input.body, NEWS_BODY_MAX);
  if (body.length < 10) errors.body = t('Escreva o texto da notícia (mínimo 10 caracteres).');
  const status = Object.values(NEWS_STATUS).includes(input.status) ? input.status : NEWS_STATUS.DRAFT;
  const audience = Object.values(NEWS_AUDIENCE).includes(input.audience) ? input.audience : NEWS_AUDIENCE.PUBLIC;
  const link = str(input.link, 300);
  if (link && !isHttps(link) && !link.startsWith('/')) errors.link = t('O link começa com https:// (ou é um caminho do app, como /torneios).');
  const image_url = str(input.image_url, 500);
  if (image_url && !isHttps(image_url)) errors.image_url = t('A imagem precisa de um endereço https://');
  const published_at = str(input.published_at, 10);
  if (published_at && !/^\d{4}-\d{2}-\d{2}$/.test(published_at)) errors.published_at = t('Data inválida.');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { title, summary: str(input.summary, NEWS_SUMMARY_MAX), body, status, audience, link, image_url, published_at, pinned: input.pinned === true },
  };
}

/** Publicada? (o que sai da Central) */
export const isNewsPublished = (n) => n?.status === NEWS_STATUS.PUBLISHED;

/** Fixadas primeiro; depois da mais nova para a mais antiga (`published_at`, e na falta `created_at_ms`). */
export function sortNews(list = []) {
  const quando = (n) => (n.published_at ? Date.parse(`${n.published_at}T12:00:00Z`) : 0) || Number(n.created_at_ms) || 0;
  return [...(list || [])].sort((a, b) => (Number(b.pinned === true) - Number(a.pinned === true)) || (quando(b) - quando(a)));
}

/**
 * O que a pessoa vê na página: as públicas publicadas e, se é filiada ativa,
 * as "só filiados". `memberOf` = ela tem filiação ATIVA nesta federação.
 */
export function visibleNews(list = [], { memberOf = false } = {}) {
  return sortNews((list || []).filter((n) => isNewsPublished(n) && (n.audience === NEWS_AUDIENCE.PUBLIC || (memberOf && n.audience === NEWS_AUDIENCE.MEMBERS))));
}

/** O aviso aos filiados pode ser enviado? Publicada, "só filiados" ou pública, e ainda não avisada. */
export function canNotifyNews(n) {
  return isNewsPublished(n) && !n?.notified_at;
}

/** "Publicada · Pública · avisada a 120" — a linha da lista da Central. */
export function newsSummaryLine(n) {
  const partes = [];
  if (n?.pinned) partes.push(t('Fixada'));
  if (n?.notified_at) partes.push(t('avisada a {n}', { n: Number(n.notified_count) || 0 }));
  return partes.join(' · ');
}

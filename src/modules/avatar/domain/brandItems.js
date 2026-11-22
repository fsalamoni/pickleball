/**
 * ITENS DE MARCA do avatar (puro): as raquetes patrocinadas que o admin da
 * plataforma cadastra em `platform_settings/avatar_catalog.brand_paddles`.
 *
 * O item é DESCRIÇÃO, não imagem enviada: formato, cores e o nome da marca
 * escrito na face. O servidor a põe no pedido da imagem
 * (`functions/avatarAiPolicy.js`). Sempre aparece com o selo "Patrocinado" —
 * a pessoa sabe o que é anúncio. `art`, `edge`, `grip` e `ink` vêm do desenho
 * antigo e seguem gravados (nada é migrado); o pedido não os usa.
 */
import { PADDLE_SHAPES } from './catalog.js';

const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

const SHAPES = new Set(PADDLE_SHAPES.map((s) => s.id));
const BRAND_ARTS = new Set(['wordmark', 'stripe', 'split']);
export const BRAND_ART_IDS = Object.freeze([...BRAND_ARTS]);
export const MAX_BRAND_PADDLES = 40;

const clean = (v, max) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, max);
const hex = (v, fb) => (isHexColor(v) ? v.toLowerCase() : fb);
const ms = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** Gera o id do item a partir da marca e do nome (estável, gravado na receita). */
export function brandItemId(brand, name) {
  const slug = `${brand}-${name}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return slug ? `brand_${slug}` : '';
}

/**
 * O item limpo, ou `null` se não tem o mínimo (marca e nome).
 * Link de saída só https (vai para o site da marca, se houver).
 */
export function normalizeBrandPaddle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const brand = clean(raw.brand, 30);
  const name = clean(raw.name, 40);
  if (!brand || !name) return null;
  const id = /^brand_[a-z0-9-]{1,40}$/.test(raw.id || '') ? raw.id : brandItemId(brand, name);
  const link = clean(raw.link_url, 300);
  return {
    id,
    brand,
    name,
    wordmark: clean(raw.wordmark, 14) || brand.toUpperCase().slice(0, 14),
    shape: SHAPES.has(raw.shape) ? raw.shape : 'standard',
    art: BRAND_ARTS.has(raw.art) ? raw.art : 'wordmark',
    color: hex(raw.color, '#0b0f19'),
    color2: hex(raw.color2, '#d4f82e'),
    edge: hex(raw.edge, '#0b0f19'),
    grip: hex(raw.grip, '#1f2937'),
    ink: hex(raw.ink, '#ffffff'),
    link_url: /^https:\/\/[^\s]+$/.test(link) ? link : '',
    active: raw.active !== false,
    starts_ms: ms(raw.starts_ms),
    ends_ms: ms(raw.ends_ms),
  };
}

/** A lista limpa, sem ids repetidos, até o teto. */
export function normalizeBrandCatalog(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const item = normalizeBrandPaddle(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= MAX_BRAND_PADDLES) break;
  }
  return out;
}

/** No ar agora: ligado e dentro da janela de datas (se houver). */
export function isBrandItemLive(item, now = Date.now()) {
  if (!item?.active) return false;
  if (item.starts_ms && now < item.starts_ms) return false;
  if (item.ends_ms && now > item.ends_ms) return false;
  return true;
}

export function liveBrandPaddles(list, now = Date.now()) {
  return normalizeBrandCatalog(list).filter((i) => isBrandItemLive(i, now));
}

/**
 * MERCADO — configuração do admin e moderação automática (lógica pura).
 *
 * A configuração mora em `platform_settings/marketplace` (fora do documento
 * das flags, que todo mundo lê a cada sessão). O que faltar vale o padrão.
 */
import { TEXT_LIMITS } from './constants.js';
import { normalizeSearchText } from './listing.js';
import { ORDER_DEADLINES } from './orderStatus.js';
import { OFFER_RULES } from './offers.js';
import { t, tk } from '@/core/i18n';

/** Termos que derrubam o anúncio na hora (o admin acrescenta outros). */
export const DEFAULT_BANNED_TERMS = Object.freeze([
  'replica', 'réplica', 'falsificado', 'falsificada', 'copia primeira linha',
  'cópia primeira linha', 'paguem por fora', 'pix por fora',
]);

export const DEFAULT_MARKET_SETTINGS = Object.freeze({
  offers_enabled: true,
  stores_enabled: true,
  orders_enabled: true,
  disabled_categories: [],
  banned_terms: [],
  max_active_listings: { athlete: 30, coach: 60, arena: 300, store: 2000 },
  seller_answer_hours: ORDER_DEADLINES.sellerAnswerHours,
  payment_hours: ORDER_DEADLINES.paymentHours,
  auto_complete_days: ORDER_DEADLINES.autoCompleteDays,
  dispute_window_days: ORDER_DEADLINES.disputeWindowDays,
  offer_max_rounds: OFFER_RULES.maxRounds,
  offer_ttl_hours: OFFER_RULES.ttlHours,
  terms_version: 'mercado_v1',
});

const clampInt = (v, min, max, d) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function normalizeMarketSettings(raw) {
  const d = DEFAULT_MARKET_SETTINGS;
  const r = raw && typeof raw === 'object' ? raw : {};
  const bool = (k) => (typeof r[k] === 'boolean' ? r[k] : d[k]);
  const lim = r.max_active_listings || {};
  return {
    offers_enabled: bool('offers_enabled'),
    stores_enabled: bool('stores_enabled'),
    orders_enabled: bool('orders_enabled'),
    disabled_categories: Array.isArray(r.disabled_categories) ? r.disabled_categories.filter((s) => typeof s === 'string') : [],
    banned_terms: Array.isArray(r.banned_terms) ? r.banned_terms.map((s) => String(s).trim()).filter(Boolean).slice(0, 200) : [],
    max_active_listings: Object.fromEntries(Object.entries(d.max_active_listings)
      .map(([k, v]) => [k, clampInt(lim[k], 1, 10000, v)])),
    seller_answer_hours: clampInt(r.seller_answer_hours, 12, 240, d.seller_answer_hours),
    payment_hours: clampInt(r.payment_hours, 6, 168, d.payment_hours),
    auto_complete_days: clampInt(r.auto_complete_days, 2, 30, d.auto_complete_days),
    dispute_window_days: clampInt(r.dispute_window_days, 2, 30, d.dispute_window_days),
    offer_max_rounds: clampInt(r.offer_max_rounds, 1, 10, d.offer_max_rounds),
    offer_ttl_hours: clampInt(r.offer_ttl_hours, 6, 240, d.offer_ttl_hours),
    terms_version: typeof r.terms_version === 'string' && r.terms_version ? r.terms_version : d.terms_version,
  };
}

/**
 * Moderação automática: o texto tem termo proibido? Devolve o termo achado
 * (para o vendedor saber o que mudar) ou `null`.
 */
export function findBannedTerm(text, extra = []) {
  const norm = ` ${normalizeSearchText(text)} `;
  for (const term of [...DEFAULT_BANNED_TERMS, ...(extra || [])]) {
    const t = normalizeSearchText(term);
    if (t && norm.includes(` ${t} `)) return term;
  }
  return null;
}

/** Telefone, e-mail ou link de pagamento escritos na pergunta ou no anúncio. */
export function findContactLeak(text) {
  const s = String(text || '');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) return tk('e-mail');
  if (/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/.test(s)) return tk('telefone');
  if (/wa\.me|whatsapp\.com|chave pix/i.test(s)) return tk('contato fora da plataforma');
  return null;
}

export function validateQuestion(text) {
  const texto = String(text || '').trim().replace(/\s+/g, ' ');
  if (texto.length < 5) return { error: t('Escreva a sua pergunta.') };
  if (texto.length > TEXT_LIMITS.question) return { error: t('Até {n} caracteres.', { n: TEXT_LIMITS.question }) };
  const leak = findContactLeak(texto);
  if (leak) return { error: t('Não coloque {oque} na pergunta: ela é pública. Combine tudo pelo pedido ou pela conversa.', { oque: t(leak) }) };
  return { value: texto };
}

export function validateAnswer(text) {
  const texto = String(text || '').trim();
  if (texto.length < 2) return { error: t('Escreva a resposta.') };
  if (texto.length > TEXT_LIMITS.answer) return { error: t('Até {n} caracteres.', { n: TEXT_LIMITS.answer }) };
  const leak = findContactLeak(texto);
  if (leak) return { error: t('Não coloque {oque} na resposta: ela é pública.', { oque: t(leak) }) };
  return { value: texto };
}

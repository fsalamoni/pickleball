/**
 * Preço dinâmico da arena (flag arena_dynamic_pricing). Lógica pura, sem I/O.
 *
 * Complementa a tabela de preços por dia/horário (`pricing.js`) com uma camada
 * opcional: desconto em horário de BAIXA (para encher a grade) e sobretaxa em
 * horário de PICO. A config vive em `arena.dynamic_pricing` e é aplicada sobre
 * o preço-base resolvido de um slot. Aditivo — sem config, o preço não muda.
 */

import { timeToMinutes } from './pricing.js';

/** Limita um percentual a [0, 90]. */
function clampPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(90, v));
}

/** O slot (weekday, minutos) cai na janela? */
function inWindow(weekday, minutes, win) {
  if (!win) return false;
  const wd = Array.isArray(win.weekdays) ? win.weekdays : null;
  if (wd && wd.length > 0 && !wd.includes(weekday)) return false;
  const s = timeToMinutes(win.start);
  const e = timeToMinutes(win.end);
  if (s == null || e == null || minutes == null) return false;
  return minutes >= s && minutes < e;
}

/** Normaliza a config de preço dinâmico (defensivo). */
export function normalizeDynamicConfig(input = {}) {
  const win = (w) => (w ? {
    weekdays: Array.isArray(w.weekdays) ? w.weekdays.map((d) => Math.trunc(Number(d))).filter((d) => d >= 0 && d <= 6) : [],
    start: w.start || '',
    end: w.end || '',
  } : null);
  return {
    enabled: input.enabled !== false,
    offpeak: input.offpeak ? { ...win(input.offpeak), discount_pct: clampPct(input.offpeak.discount_pct) } : null,
    peak: input.peak ? { ...win(input.peak), surcharge_pct: clampPct(input.peak.surcharge_pct) } : null,
  };
}

/**
 * Aplica o preço dinâmico a um preço-base num slot.
 * PICO tem precedência sobre BAIXA quando as janelas se sobrepõem.
 * @param {number} basePrice preço-base resolvido do slot
 * @param {{ weekday?: number, minutes?: number, config?: object }} slot
 * @returns {{ price: number, kind: 'peak'|'offpeak'|null, pct: number }}
 */
export function applyDynamicPricing(basePrice, { weekday, minutes, config } = {}) {
  const p = Number(basePrice);
  if (!Number.isFinite(p) || !config || config.enabled === false) {
    return { price: Number.isFinite(p) ? p : 0, kind: null, pct: 0 };
  }
  if (inWindow(weekday, minutes, config.peak)) {
    const pct = clampPct(config.peak.surcharge_pct);
    return { price: Math.round(p * (1 + pct / 100) * 100) / 100, kind: 'peak', pct };
  }
  if (inWindow(weekday, minutes, config.offpeak)) {
    const pct = clampPct(config.offpeak.discount_pct);
    return { price: Math.round(p * (1 - pct / 100) * 100) / 100, kind: 'offpeak', pct };
  }
  return { price: p, kind: null, pct: 0 };
}

/** Rótulo curto para exibir a etiqueta do ajuste. */
export function dynamicPricingLabel(kind, pct) {
  if (kind === 'peak') return `Pico +${pct}%`;
  if (kind === 'offpeak') return `Baixa −${pct}%`;
  return null;
}

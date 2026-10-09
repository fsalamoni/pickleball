/**
 * Planos de treino (`training_plans`): semanas × dias, cada dia com até 4 itens.
 *
 * O plano é do ATLETA (só o dono escreve). O professor manda ITENS para o
 * aluno por compartilhamento; o aluno pode encaixá-los no plano.
 *
 * O assistente (`buildPlanSlots`) é determinístico: mesmas respostas e mesma
 * biblioteca ⇒ mesmo plano. Progride ao longo das semanas: do mais simples
 * (nível mais baixo, intensidade menor) para o mais desafiador.
 */

import { isISODate, todayLocal, weekKeyOf, addDays, daysBetween } from './dates.js';
import { isValidSkill, ITEM_KIND } from './taxonomy.js';
import { fitsLevel } from './trainingItem.js';

export const PLAN_STATUS = Object.freeze({ ATIVO: 'ativo', PAUSADO: 'pausado', CONCLUIDO: 'concluido' });
export const PLAN_STATUS_LABELS = Object.freeze({ ativo: 'Ativo', pausado: 'Pausado', concluido: 'Concluído' });
export const PLAN_LIMITS = Object.freeze({ weeks: 16, slots: 112, itemsPerSlot: 4, title: 120, goal: 300 });

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const int = (v, min, max, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

function normalizeSlot(s = {}) {
  const week = int(s.week, 1, PLAN_LIMITS.weeks, null);
  const day = int(s.day, 0, 6, null);
  if (week === null || day === null) return null;
  return {
    week,
    day,
    title: str(s.title, 80),
    item_ids: [...new Set((Array.isArray(s.item_ids) ? s.item_ids : []).map((x) => str(x, 64)).filter(Boolean))].slice(0, PLAN_LIMITS.itemsPerSlot),
    duration_min: int(s.duration_min, 0, 240, 0),
  };
}

/** @returns {{ valid: boolean, error: string, value: object }} */
export function normalizePlan(input = {}, { today = todayLocal() } = {}) {
  const title = str(input.title, PLAN_LIMITS.title);
  if (title.length < 3) return { valid: false, error: 'Dê um nome ao plano.', value: {} };
  const weeks = int(input.weeks, 1, PLAN_LIMITS.weeks, 4);
  const days = [...new Set((Array.isArray(input.days) ? input.days : []).map((d) => int(d, 0, 6, null)).filter((d) => d !== null))].sort();
  if (!days.length) return { valid: false, error: 'Escolha pelo menos um dia da semana.', value: {} };
  const slotKey = (s) => `${s.week}-${s.day}`;
  const seen = new Set();
  const slots = (Array.isArray(input.slots) ? input.slots : [])
    .map(normalizeSlot)
    .filter((s) => s && s.week <= weeks && !seen.has(slotKey(s)) && seen.add(slotKey(s)))
    .slice(0, PLAN_LIMITS.slots);
  return {
    valid: true,
    error: '',
    value: {
      title,
      goal: str(input.goal, PLAN_LIMITS.goal),
      focus: [...new Set((Array.isArray(input.focus) ? input.focus : []).filter(isValidSkill))].slice(0, 6),
      start_date: isISODate(input.start_date) ? weekKeyOf(input.start_date) : weekKeyOf(today),
      weeks,
      days,
      minutes: int(input.minutes, 10, 240, 60),
      slots,
      status: Object.values(PLAN_STATUS).includes(input.status) ? input.status : PLAN_STATUS.ATIVO,
      source: ['manual', 'assistente'].includes(input.source) ? input.source : 'manual',
    },
  };
}

/** Data (dia local) de um slot. A semana 1 começa na segunda de `start_date`. */
export function slotDate(plan, slot) {
  const offset = slot.day === 0 ? 6 : slot.day - 1; // segunda = 0 … domingo = 6
  return addDays(plan.start_date, (slot.week - 1) * 7 + offset);
}

/** Mapa data → slots, para a semana do diário e o "Hoje". */
export function plannedByDate(plan) {
  const out = {};
  if (!plan?.slots) return out;
  for (const s of plan.slots) {
    const d = slotDate(plan, s);
    (out[d] = out[d] || []).push(s);
  }
  return out;
}

export function planEndDate(plan) {
  return addDays(plan.start_date, plan.weeks * 7 - 1);
}

/** Em que semana do plano está hoje (1…weeks) ou `null` fora dele. */
export function currentPlanWeek(plan, today = todayLocal()) {
  if (!plan?.start_date || today < plan.start_date || today > planEndDate(plan)) return null;
  // daysBetween arredonda: com horário de verão a semana tem 7 dias − 1 h, e o floor direto voltava uma semana.
  return Math.floor(daysBetween(plan.start_date, today) / 7) + 1;
}

/**
 * Feito × planejado (até hoje). Um slot conta como feito quando há sessão
 * naquela data ligada ao plano. "Ficou para depois" não é falha.
 */
export function planProgress(plan, sessions = [], today = todayLocal()) {
  const byDate = plannedByDate(plan);
  const dates = Object.keys(byDate).filter((d) => d <= today);
  const doneDates = new Set(sessions.filter((s) => s.plan_id === plan.id).map((s) => s.date));
  const done = dates.filter((d) => doneDates.has(d)).length;
  const total = Object.keys(byDate).length;
  return { done, due: dates.length, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Hash estável (FNV-1a) para escolhas determinísticas. */
export function stableHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ordena de forma estável e "embaralhada" pela semente. */
export function seededOrder(list, seed) {
  return [...list].sort((a, b) => stableHash(`${seed}:${a.id}`) - stableHash(`${seed}:${b.id}`) || String(a.id).localeCompare(String(b.id)));
}

const matchesFocus = (item, focus) => !focus.length
  || (item.skills || []).some((s) => focus.some((f) => s === f || s.startsWith(`${f}.`) || f.startsWith(`${s}.`)));

const isWarmup = (it) => it.kind === ITEM_KIND.FISICO && (it.skills || []).some((s) => s === 'physical.aquecimento');

/**
 * Assistente de plano. Escolhe, por semana e dia, um aquecimento e drills do
 * foco que cabem no nível e no tempo. Sem itens adequados, o dia fica com
 * título e sem itens (a pessoa completa) — nunca inventa conteúdo.
 */
export function buildPlanSlots({ weeks = 4, days = [], minutes = 60, focus = [], level = null, place = '', items = [], seed = 'plano' }) {
  const usable = items.filter((it) => !it.legacy && it.kind !== ITEM_KIND.TREINO && it.kind !== ITEM_KIND.ESTUDO && fitsLevel(it, level)
    && (!place || !(it.place || []).length || it.place.includes(place)));
  const warmups = seededOrder(usable.filter(isWarmup), `${seed}:aq`);
  const main = seededOrder(usable.filter((it) => !isWarmup(it) && matchesFocus(it, focus)), `${seed}:main`)
    .sort((a, b) => (a.level_min ?? 0) - (b.level_min ?? 0) || (a.intensity ?? 0) - (b.intensity ?? 0));
  const others = seededOrder(usable.filter((it) => !isWarmup(it) && !matchesFocus(it, focus)), `${seed}:out`);
  const pool = main.length ? main : others;
  const slots = [];
  let cursor = 0;
  const totalDays = weeks * days.length || 1;
  for (let week = 1; week <= weeks; week += 1) {
    for (const day of [...days].sort()) {
      const item_ids = [];
      let left = minutes;
      const wu = warmups.length ? warmups[(week + day) % warmups.length] : null;
      if (wu) { item_ids.push(wu.id); left -= wu.duration_min || 10; }
      // Progressão: a posição no pool avança com o plano, então as semanas
      // finais pegam os itens mais desafiadores (o pool está ordenado por nível).
      const base = pool.length ? Math.floor((cursor / totalDays) * pool.length) : 0;
      for (let k = 0; k < pool.length && item_ids.length < PLAN_LIMITS.itemsPerSlot && left > 5; k += 1) {
        const it = pool[(base + k) % pool.length];
        if (item_ids.includes(it.id)) continue;
        item_ids.push(it.id);
        left -= it.duration_min || 15;
      }
      slots.push({ week, day, title: focus.length ? 'Treino do foco' : 'Treino', item_ids, duration_min: minutes });
      cursor += 1;
    }
  }
  return slots.slice(0, PLAN_LIMITS.slots);
}

/** O slot de hoje no plano ativo, se houver. */
export function slotForDate(plan, date) {
  if (!plan || plan.status !== PLAN_STATUS.ATIVO) return null;
  return plannedByDate(plan)[date]?.[0] || null;
}


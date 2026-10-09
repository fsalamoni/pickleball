/**
 * Peças puras do grupo TREINAR do Centro de Treino (Hoje · Planos · Diário ·
 * Evolução). O que a tela mostra sai daqui, testado — nenhuma conta mora no
 * componente.
 *
 * - Hoje: os itens do treino do dia (e os que ficaram de fora), o tempo total
 *   e os blocos do "Modo quadra".
 * - Rotina: o formato gravado em `training_meta.routine`.
 * - Plano: a semana vista dia a dia (feito × planejado — "ficou para depois"
 *   NUNCA é falha) e a edição de um dia.
 * - Diário: as sessões agrupadas por semana.
 * - Evolução: o domínio dos itens agrupado por nível.
 */

import { addDays, weekKeyOf } from './dates.js';
import { isValidSkill, PLACES, BLOCK_TYPE_LABELS, ITEM_KIND } from './taxonomy.js';
import { PLAN_LIMITS, slotDate } from './plan.js';
import { MASTERY } from './evolution.js';

const MIN_FALLBACK = 10;

/**
 * Os itens do treino de hoje que esta pessoa consegue ver, na ordem pedida, e
 * os que ficaram de fora (fonte falhou, item apagado ou oculto).
 * @returns {{ items: object[], missingIds: string[] }}
 */
export function pickItems(itemIds = [], byId = {}) {
  const items = [];
  const missingIds = [];
  for (const id of itemIds || []) {
    if (byId[id]) items.push(byId[id]);
    else missingIds.push(id);
  }
  return { items, missingIds };
}

/** Tempo do treino: o que a sessão do dia diz, senão a soma dos itens. */
export function totalMinutes(minutes, items = []) {
  if (Number.isFinite(minutes) && minutes > 0) return minutes;
  const soma = items.reduce((a, it) => a + (it.duration_min || 0), 0);
  return soma || null;
}

/**
 * Os blocos do "Modo quadra": um item por vez, com o tempo dele. Item sem
 * duração divide o que sobra do tempo total (mínimo de 5 min).
 * @returns {{ id: string, title: string, minutes: number, objective: string, setup: string,
 *   steps: string[], cues: string[], success: string, diagram: object|null }[]}
 */
export function courtBlocks(items = [], total = null) {
  const comTempo = items.reduce((a, it) => a + (it.duration_min || 0), 0);
  const semTempo = items.filter((it) => !it.duration_min).length;
  const sobra = Number.isFinite(total) && total > comTempo ? total - comTempo : 0;
  const parte = semTempo ? Math.max(5, Math.round(sobra / semTempo) || MIN_FALLBACK) : 0;
  return items.map((it) => ({
    id: it.id,
    title: it.title || 'Item',
    minutes: it.duration_min || parte,
    objective: it.objective || it.summary || '',
    setup: it.setup || '',
    steps: it.kind === ITEM_KIND.TREINO && (it.blocks || []).length
      ? it.blocks.map((b) => `${BLOCK_TYPE_LABELS[b.type] || 'Bloco'}: ${b.title || ''}${b.duration_min ? ` (${b.duration_min} min)` : ''}`.trim())
      : (it.steps || []).filter(Boolean),
    cues: (it.cues || []).filter(Boolean),
    success: it.success_criteria || '',
    diagram: (it.diagrams || [])[0] || null,
  }));
}

/** "07:05", e "1:02:03" passando de uma hora. */
export function formatClock(totalSec = 0) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Minutos para o registro a partir do tempo cronometrado (nunca 0 se treinou). */
export function minutesFromSeconds(sec = 0) {
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

export const ROUTINE_MINUTES = Object.freeze({ min: 10, max: 240, padrao: 45 });

/**
 * A rotina gravada em `training_meta.routine`: dias da semana (0 = domingo),
 * minutos, local e foco (até 6 habilidades).
 * @returns {{ valid: boolean, error: string, value: { days: number[], minutes: number, place: string, focus: string[] } }}
 */
export function normalizeRoutine(input = {}) {
  const days = [...new Set((Array.isArray(input.days) ? input.days : [])
    .map((d) => Math.round(Number(d)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  const n = Math.round(Number(input.minutes));
  const minutes = Number.isFinite(n) ? Math.min(ROUTINE_MINUTES.max, Math.max(ROUTINE_MINUTES.min, n)) : ROUTINE_MINUTES.padrao;
  const value = {
    days,
    minutes,
    place: PLACES.includes(input.place) ? input.place : '',
    focus: [...new Set((Array.isArray(input.focus) ? input.focus : []).filter(isValidSkill))].slice(0, 6),
  };
  if (!days.length) return { valid: false, error: 'Escolha pelo menos um dia da semana.', value };
  return { valid: true, error: '', value };
}

/** Segunda primeiro: a ordem em que a semana aparece na tela. */
export const WEEK_ORDER = Object.freeze([1, 2, 3, 4, 5, 6, 0]);

/** "06/10 a 12/10". */
export function weekRangeLabel(weekKey) {
  const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${fmt(weekKey)} a ${fmt(addDays(weekKey, 6))}`;
}

/**
 * Uma semana do plano, dia a dia, só nos dias do plano. Estado de cada dia:
 * `feito` (há sessão daquele dia ligada ao plano), `hoje`, `planejado` ou
 * `depois` — o dia que passou sem registro "ficou para depois", nunca falhou.
 * @returns {{ day: number, date: string, slot: object|null, state: string, sessions: object[] }[]}
 */
export function planWeekView(plan, sessions = [], week = 1, today) {
  if (!plan) return [];
  const dias = WEEK_ORDER.filter((d) => (plan.days || []).includes(d));
  return dias.map((day) => {
    const slot = (plan.slots || []).find((s) => s.week === week && s.day === day) || null;
    const date = slotDate(plan, { week, day });
    const doDia = sessions.filter((s) => s.plan_id === plan.id && s.date === date);
    let state = 'planejado';
    if (doDia.length) state = 'feito';
    else if (date === today) state = 'hoje';
    else if (date < today) state = 'depois';
    return { day, date, slot, state, sessions: doDia };
  });
}

/** Feitos por semana (para a grade de semanas): `{ week, done, total }`. */
export function planWeeksSummary(plan, sessions = []) {
  if (!plan) return [];
  return Array.from({ length: plan.weeks || 0 }, (_, i) => {
    const view = planWeekView(plan, sessions, i + 1, '');
    return { week: i + 1, done: view.filter((d) => d.state === 'feito').length, total: view.length };
  });
}

/**
 * Troca os itens de um dia do plano (cria o dia se não existia; mantém o
 * título e o tempo). Devolve a lista nova de dias — quem grava é o serviço.
 * @returns {{ ok: boolean, error: string, slots: object[] }}
 */
export function setSlotItems(plan, { week, day }, itemIds = []) {
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  const slots = (plan?.slots || []).map((s) => ({ ...s }));
  if (ids.length > PLAN_LIMITS.itemsPerSlot) {
    return { ok: false, error: `Um dia do plano tem no máximo ${PLAN_LIMITS.itemsPerSlot} itens.`, slots };
  }
  if (!(plan?.days || []).includes(day) || week < 1 || week > (plan?.weeks || 0)) {
    return { ok: false, error: 'Este dia não faz parte do plano.', slots };
  }
  const i = slots.findIndex((s) => s.week === week && s.day === day);
  if (i >= 0) slots[i] = { ...slots[i], item_ids: ids };
  else {
    if (slots.length >= PLAN_LIMITS.slots) return { ok: false, error: 'O plano já tem o máximo de dias.', slots };
    slots.push({ week, day, title: 'Treino', item_ids: ids, duration_min: plan.minutes || 0 });
  }
  return { ok: true, error: '', slots };
}

/** Acrescenta um item a um dia do plano (sem repetir; respeitando o limite). */
export function addItemToSlot(plan, { week, day }, itemId) {
  const atual = (plan?.slots || []).find((s) => s.week === week && s.day === day)?.item_ids || [];
  if (atual.includes(itemId)) return { ok: false, error: 'Este item já está nesse dia.', slots: plan?.slots || [] };
  return setSlotItems(plan, { week, day }, [...atual, itemId]);
}

/** Sessões agrupadas por semana, da mais recente para a mais antiga. */
export function sessionsByWeek(sessions = []) {
  const grupos = new Map();
  for (const s of sessions) {
    const wk = s.week_key || weekKeyOf(s.date);
    if (!grupos.has(wk)) grupos.set(wk, []);
    grupos.get(wk).push(s);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([weekKey, lista]) => ({ weekKey, sessions: lista }));
}

/**
 * O domínio dos itens agrupado por nível, com o título de cada um. Item que
 * não está mais visível aparece como "Item indisponível" — nunca some calado.
 */
export function masteryGroups(mastery = {}, byId = {}) {
  const out = { [MASTERY.APRENDENDO]: [], [MASTERY.CONSISTENTE]: [], [MASTERY.DOMINADO]: [] };
  for (const [id, nivel] of Object.entries(mastery || {})) {
    if (!(nivel in out)) continue;
    out[nivel].push({ id, title: byId[id]?.title || 'Item indisponível', available: !!byId[id] });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  return out;
}

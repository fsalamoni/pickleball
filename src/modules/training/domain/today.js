/**
 * "O que eu treino hoje?" — uma resposta só, estável ao recarregar.
 *
 * Ordem: (1) o dia do plano ativo; (2) o que o professor mandou e ainda não
 * foi feito, com prazo mais perto; (3) recomendação pelo foco e pelo nível,
 * determinística pela semente data + uid. Fora dos dias da rotina, o dia é
 * de descanso — com "treinar mesmo assim".
 */

import { slotForDate, seededOrder } from './plan.js';
import { weekdayOf } from './dates.js';
import { fitsLevel } from './trainingItem.js';
import { ITEM_KIND } from './taxonomy.js';

export const TODAY_SOURCE = Object.freeze({
  PLANO: 'plano', PROFESSOR: 'professor', RECOMENDACAO: 'recomendacao', DESCANSO: 'descanso', VAZIO: 'vazio',
});

const matchesFocus = (item, focus) => !focus.length
  || (item.skills || []).some((s) => focus.some((f) => s === f || s.startsWith(`${f}.`) || f.startsWith(`${s}.`)));

/**
 * @param {{ today: string, uid: string, plan?: object|null, inbox?: object[], items?: object[],
 *   routine?: object|null, level?: number|null, force?: boolean }} p
 * @returns {{ source: string, title: string, itemIds: string[], minutes: number|null, note: string, shareIds?: string[] }}
 */
export function todaySession({ today, uid, plan = null, inbox = [], items = [], routine = null, level = null, force = false }) {
  const slot = slotForDate(plan, today);
  // Dia do plano sem itens não esconde o que o professor mandou.
  if (slot?.item_ids?.length) {
    return {
      source: TODAY_SOURCE.PLANO,
      title: slot.title || plan.title,
      itemIds: slot.item_ids,
      minutes: slot.duration_min || plan.minutes || null,
      note: `Do plano "${plan.title}".`,
    };
  }
  const pending = inbox.filter((s) => s.kind === 'aluno' && !s.done_at && (!s.due_date || s.due_date <= today))
    .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  if (pending.length) {
    const first = pending.slice(0, 3);
    return {
      source: TODAY_SOURCE.PROFESSOR,
      title: 'Do seu professor',
      itemIds: first.map((s) => s.item_id),
      shareIds: first.map((s) => s.id),
      minutes: null,
      note: `${first[0].from_name} mandou para você treinar.`,
    };
  }
  const days = Array.isArray(routine?.days) ? routine.days : [];
  if (!force && days.length && !days.includes(weekdayOf(today))) {
    return { source: TODAY_SOURCE.DESCANSO, title: 'Dia de descanso', itemIds: [], minutes: null, note: 'Hoje não está na sua rotina. Descansar também é treino.' };
  }
  const focus = Array.isArray(routine?.focus) ? routine.focus : [];
  const minutes = Number.isFinite(routine?.minutes) ? routine.minutes : 45;
  const place = routine?.place || '';
  const usable = items.filter((it) => !it.legacy && fitsLevel(it, level) && it.kind !== ITEM_KIND.ESTUDO && it.kind !== ITEM_KIND.TREINO
    && (!place || !(it.place || []).length || it.place.includes(place)));
  if (!usable.length) {
    return { source: TODAY_SOURCE.VAZIO, title: 'Monte o seu treino', itemIds: [], minutes, note: 'Ainda não há itens na biblioteca que combinem com a sua rotina.' };
  }
  const seed = `${today}:${uid}`;
  const warm = seededOrder(usable.filter((it) => (it.skills || []).includes('physical.aquecimento')), `${seed}:aq`)[0];
  const main = seededOrder(usable.filter((it) => it !== warm && matchesFocus(it, focus) && it.kind !== ITEM_KIND.FISICO), `${seed}:m`);
  const pool = main.length ? main : seededOrder(usable.filter((it) => it !== warm), `${seed}:o`);
  const ids = warm ? [warm.id] : [];
  let left = minutes - (warm?.duration_min || 0);
  for (const it of pool) {
    if (ids.length >= 4 || left <= 5) break;
    ids.push(it.id);
    left -= it.duration_min || 15;
  }
  return {
    source: TODAY_SOURCE.RECOMENDACAO,
    title: focus.length ? 'Treino do seu foco' : 'Treino sugerido',
    itemIds: ids,
    minutes,
    note: 'Sugestão a partir da sua rotina e do seu nível. Troque o que quiser.',
  };
}

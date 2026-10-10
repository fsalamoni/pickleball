/**
 * Balanço do jogo (flag `game_debrief`, sobre `training_center`).
 *
 * Depois de um dia de jogo, de um torneio ou de um jogo avulso, a pessoa que
 * LIGOU o balanço para si responde em menos de um minuto: como foi, o que
 * funcionou, o que faltou, se sentiu evolução, como estavam o corpo e a
 * cabeça. A plataforma junta isso com os balanços anteriores e sugere a
 * semana de treino — que a pessoa escolhe se põe ou não nos seus treinos.
 *
 * O nome é "balanço" de propósito: "avaliação pós-jogo" já é a nota ao
 * companheiro (gamificação) e "autoavaliação" é a de 4 em 4 semanas
 * (`evolution.js`).
 *
 * Lógica pura: sem React, sem Firebase. Mesmas respostas, mesma biblioteca e
 * mesmo dia ⇒ mesma sugestão.
 */

import { addDays, daysBetween, isISODate, todayLocal, weekdayOf, weekKeyOf, WEEKDAY_SHORT } from './dates.js';
import { fitsLevel } from './trainingItem.js';
import { ITEM_KIND } from './taxonomy.js';
import { PLAN_LIMITS, PLAN_STATUS, planEndDate, seededOrder } from './plan.js';

/**
 * Os aspectos que a pessoa marca — em palavras de quadra, não da taxonomia.
 * Cada um aponta para as habilidades da biblioteca que o treinam. O `id` é
 * gravado no banco: nunca renomeie.
 */
export const GAME_ASPECTS = Object.freeze([
  { id: 'saque', label: 'Saque', skills: ['serve.saque_profundo', 'serve.consistencia'] },
  { id: 'devolucao', label: 'Devolução', skills: ['serve.devolucao_profunda'] },
  { id: 'terceira_bola', label: 'Terceira bola', skills: ['groundstrokes.terceira_bola_drop', 'groundstrokes.terceira_bola_drive'] },
  { id: 'drive', label: 'Drive', skills: ['groundstrokes.drive'] },
  { id: 'transicao', label: 'Chegar à rede', skills: ['groundstrokes.transicao', 'net.reset'] },
  { id: 'dink', label: 'Dink e jogo curto', skills: ['kitchen.dink_cruzado', 'kitchen.dink_paralelo', 'kitchen.paciencia'] },
  { id: 'ataque_rede', label: 'Atacar na rede', skills: ['net.voleio', 'net.speed_up', 'kitchen.dink_atacavel'] },
  { id: 'defesa', label: 'Defesa e reset', skills: ['net.reset', 'net.contra_ataque'] },
  { id: 'lob_smash', label: 'Lob e smash', skills: ['groundstrokes.lob', 'net.smash'] },
  { id: 'posicionamento', label: 'Posição da dupla', skills: ['doubles.posicionamento', 'doubles.cobertura_meio', 'doubles.comunicacao'] },
  { id: 'escolha_golpe', label: 'Escolha do golpe', skills: ['tactics.selecao_golpe', 'tactics.alvo', 'tactics.leitura_adversario'] },
  { id: 'mental', label: 'Cabeça e foco', skills: ['mental.foco', 'mental.pressao', 'mental.rotina_entre_pontos'] },
  { id: 'fisico', label: 'Físico e deslocamento', skills: ['physical.agilidade', 'physical.condicionamento'] },
]);

const ASPECT_BY_ID = Object.freeze(Object.fromEntries(GAME_ASPECTS.map((a) => [a.id, a])));
export const aspectLabel = (id) => ASPECT_BY_ID[id]?.label || id;

export const DEBRIEF_RATING_LABELS = Object.freeze({
  1: 'Muito abaixo', 2: 'Abaixo', 3: 'No meu normal', 4: 'Bem', 5: 'Muito bem',
});
export const DEBRIEF_ENERGY_LABELS = Object.freeze({
  1: 'Esgotado', 2: 'Cansado', 3: 'Normal', 4: 'Bem', 5: 'Ótimo',
});

export const EVOLUTION = Object.freeze({ MELHOROU: 'melhorou', IGUAL: 'igual', PIOROU: 'piorou', NAO_SEI: 'nao_sei' });
export const EVOLUTION_LABELS = Object.freeze({
  melhorou: 'Evoluí', igual: 'Fiquei igual', piorou: 'Caí de rendimento', nao_sei: 'Não sei dizer',
});

export const DEBRIEF_SOURCE = Object.freeze({
  DIA_DE_JOGO: 'dia_de_jogo', TORNEIO: 'torneio', RESERVA: 'reserva', AVULSO: 'avulso',
});
export const DEBRIEF_SOURCE_LABELS = Object.freeze({
  dia_de_jogo: 'Dia de jogo', torneio: 'Torneio', reserva: 'Jogo na arena', avulso: 'Jogo avulso',
});

export const DEBRIEF_STATUS = Object.freeze({ RESPONDIDO: 'respondido', DISPENSADO: 'dispensado' });

export const DEBRIEF_LIMITS = Object.freeze({ aspects: 3, note: 500, title: 120, windowDays: 7, history: 6 });

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const scale = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};
const safeKey = (v) => String(v ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

/** Chave estável do jogo ("dia_de_jogo_abc", "reserva_xyz_2026-10-09"). */
export function debriefSourceKey(source = {}) {
  const type = safeKey(source.type);
  const ref = safeKey(source.ref_id);
  return type && ref ? `${type}_${ref}` : '';
}

/** Id do documento: um balanço por pessoa por jogo. O prefixo é o que a regra confere. */
export function debriefId(uid, source) {
  const key = debriefSourceKey(source);
  return uid && key ? `${uid}_${key}` : '';
}

/** O que está ligado: a flag da plataforma E a escolha da pessoa. */
export function debriefEnabledFor(meta) {
  return meta?.debrief?.enabled === true;
}

/** Só os jogos depois de ligar entram como pendência — ligar não cobra o passado. */
export function debriefSince(meta) {
  const since = meta?.debrief?.since;
  return isISODate(since) ? since : null;
}

function normalizeSource(s = {}) {
  const type = Object.values(DEBRIEF_SOURCE).includes(s.type) ? s.type : null;
  if (!type || !isISODate(s.date)) return null;
  const ref = safeKey(s.ref_id);
  if (!ref) return null;
  const n = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.min(999, Math.round(Number(v)))) : null);
  return {
    type,
    ref_id: ref,
    title: str(s.title, DEBRIEF_LIMITS.title) || DEBRIEF_SOURCE_LABELS[type],
    date: s.date,
    games: n(s.games),
    wins: n(s.wins),
  };
}

function aspectList(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter((a) => ASPECT_BY_ID[a]))].slice(0, DEBRIEF_LIMITS.aspects);
}

/**
 * Valida e normaliza as respostas.
 * @returns {{ valid: boolean, error: string, value: object }}
 */
export function normalizeDebrief(input = {}) {
  const source = normalizeSource(input.source);
  if (!source) return { valid: false, error: 'Escolha o jogo e a data.', value: {} };
  const rating = scale(input.rating);
  if (!rating) return { valid: false, error: 'Diga como foi o seu jogo.', value: {} };
  const strengths = aspectList(input.strengths);
  const weaknesses = aspectList(input.weaknesses).filter((a) => !strengths.includes(a));
  return {
    valid: true,
    error: '',
    value: {
      source,
      status: DEBRIEF_STATUS.RESPONDIDO,
      rating,
      strengths,
      weaknesses,
      evolution: Object.values(EVOLUTION).includes(input.evolution) ? input.evolution : EVOLUTION.NAO_SEI,
      body: scale(input.body),
      mind: scale(input.mind),
      note: str(input.note, DEBRIEF_LIMITS.note),
    },
  };
}

/**
 * Os jogos que ainda pedem balanço: terminados, desde que a pessoa ligou, nos
 * últimos 7 dias, sem balanço respondido nem dispensado. Do mais recente para
 * o mais antigo.
 *
 * @param {{ events: object[], debriefs: object[], since: string|null, today?: string, nowMs?: number }} p
 *   `events`: `{ type, ref_id, title, date, ends_at_ms?, games?, wins? }`
 */
export function pendingDebriefs({ events = [], debriefs = [], since = null, today = todayLocal(), nowMs = Date.now() }) {
  if (!since) return [];
  const answered = new Set(debriefs.map((d) => debriefSourceKey(d.source)).filter(Boolean));
  const oldest = addDays(today, -DEBRIEF_LIMITS.windowDays);
  const seen = new Set();
  return events
    .map((e) => ({ ...normalizeSource(e), ends_at_ms: e.ends_at_ms }))
    .filter((e) => {
      if (!e.type) return false;
      const key = debriefSourceKey(e);
      if (answered.has(key) || seen.has(key)) return false;
      if (e.date < since || e.date < oldest || e.date > today) return false;
      if (Number.isFinite(e.ends_at_ms) && e.ends_at_ms > nowMs) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** Os balanços respondidos, do mais recente para o mais antigo. */
export function answeredDebriefs(debriefs = []) {
  return debriefs
    .filter((d) => d?.status === DEBRIEF_STATUS.RESPONDIDO)
    .sort((a, b) => String(b.source?.date || '').localeCompare(String(a.source?.date || ''))
      || Number(b.updated_at_ms || 0) - Number(a.updated_at_ms || 0));
}

/**
 * Onde focar a semana: o que faltou HOJE pesa 3; o que faltou nos últimos
 * balanços pesa 1 cada (repetido = padrão, não acaso); o que funcionou hoje
 * sai do foco. Até 2 focos e 1 ponto forte para manter.
 *
 * @returns {{ focus: Array<{ id, label, reason }>, maintain: { id, label }|null }}
 */
export function debriefFocus(debrief, history = []) {
  const score = new Map();
  const why = new Map();
  const hoje = new Set(debrief?.weaknesses || []);
  hoje.forEach((a) => { score.set(a, 3); why.set(a, 0); });
  const anteriores = history
    .filter((h) => h && h !== debrief && debriefSourceKey(h.source) !== debriefSourceKey(debrief?.source))
    .slice(0, DEBRIEF_LIMITS.history);
  anteriores.forEach((h) => (h.weaknesses || []).forEach((a) => {
    if (!ASPECT_BY_ID[a]) return;
    score.set(a, (score.get(a) || 0) + 1);
    why.set(a, (why.get(a) || 0) + 1);
  }));
  (debrief?.strengths || []).forEach((a) => score.delete(a));
  const focus = [...score.entries()]
    .sort((a, b) => b[1] - a[1]) // empate: a ordem em que a pessoa marcou (o sort é estável)
    .slice(0, 2)
    .map(([id]) => {
      const vezes = why.get(id) || 0;
      let reason;
      if (hoje.has(id) && vezes > 0) reason = `Você marcou hoje e em mais ${vezes} balanço${vezes > 1 ? 's' : ''} recente${vezes > 1 ? 's' : ''}.`;
      else if (hoje.has(id)) reason = 'Você marcou como ponto a melhorar neste jogo.';
      else reason = `Apareceu em ${vezes} dos seus balanços recentes.`;
      return { id, label: aspectLabel(id), reason };
    });
  const forte = (debrief?.strengths || [])[0];
  return { focus, maintain: forte ? { id: forte, label: aspectLabel(forte) } : null };
}

/** Semana mais leve: corpo ou cabeça no limite, ou o rendimento caiu num jogo ruim. */
export function needsLightWeek(debrief = {}) {
  return (debrief.body != null && debrief.body <= 2)
    || (debrief.mind != null && debrief.mind <= 2)
    || (debrief.evolution === EVOLUTION.PIOROU && debrief.rating <= 2);
}

const trains = (item, skills) => (item.skills || []).some((s) => skills.some((k) => s === k || k.startsWith(`${s}.`)));
const isWarmup = (it) => (it.skills || []).includes('physical.aquecimento');

/** Os dias da semana que vem: os da rotina ou, sem rotina, três espaçados. */
function suggestionDates(today, routineDays, light) {
  const next = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  let dates = routineDays.length ? next.filter((d) => routineDays.includes(weekdayOf(d))) : [next[0], next[2], next[4]];
  if (!dates.length) dates = [next[0], next[2], next[4]];
  return dates.slice(0, light ? 2 : 4);
}

/**
 * A sugestão da semana. Determinística (semente = balanço + dia). Nunca
 * inventa conteúdo: sem itens que treinem o foco, o dia sai sem itens e a
 * tela diz que a biblioteca ainda não tem.
 *
 * @param {{ debrief: object, history?: object[], items?: object[], level?: number|null,
 *   routine?: object|null, today?: string }} p
 */
export function suggestWeek({ debrief, history = [], items = [], level = null, routine = null, today = todayLocal() }) {
  const { focus, maintain } = debriefFocus(debrief, history);
  const light = needsLightWeek(debrief);
  const baseMinutes = Number.isFinite(routine?.minutes) ? routine.minutes : 45;
  const minutes = light ? Math.max(20, Math.round(baseMinutes * 0.7)) : baseMinutes;
  const place = routine?.place || '';
  const seed = `${debriefSourceKey(debrief?.source)}:${today}`;
  const usable = items.filter((it) => it && !it.legacy && fitsLevel(it, level)
    && it.kind !== ITEM_KIND.ESTUDO && it.kind !== ITEM_KIND.TREINO
    && (!place || !(it.place || []).length || it.place.includes(place))
    && (!light || !Number.isFinite(it.intensity) || it.intensity <= 2));
  const warmups = seededOrder(usable.filter(isWarmup), `${seed}:aq`);
  const pools = focus.map((f) => seededOrder(usable.filter((it) => !isWarmup(it) && trains(it, ASPECT_BY_ID[f.id].skills)), `${seed}:${f.id}`));
  const keep = maintain ? seededOrder(usable.filter((it) => !isWarmup(it) && trains(it, ASPECT_BY_ID[maintain.id].skills)), `${seed}:keep`) : [];
  const fallback = focus.length ? [] : seededOrder(usable.filter((it) => !isWarmup(it)), `${seed}:geral`);

  const dates = suggestionDates(today, Array.isArray(routine?.days) ? routine.days : [], light);
  const used = new Set();
  const take = (pool, offset) => {
    for (let k = 0; k < pool.length; k += 1) {
      const it = pool[(offset + k) % pool.length];
      if (!used.has(it.id)) return it;
    }
    return pool.length ? pool[offset % pool.length] : null;
  };
  const days = dates.map((date, i) => {
    const ids = [];
    let left = minutes;
    const wu = warmups.length ? warmups[i % warmups.length] : null;
    if (wu) { ids.push(wu.id); left -= wu.duration_min || 10; }
    // Alterna os focos: o 1º foco ganha os dias ímpares, o 2º os pares, e os dois entram quando cabe.
    const ordem = pools.length > 1 && i % 2 === 1 ? [pools[1], pools[0]] : pools;
    // No último dia o ponto forte entra logo depois do 1º foco: manter também é treino.
    const manter = i === dates.length - 1 && keep.length ? [keep] : [];
    const fontes = [...ordem.slice(0, 1), ...manter, ...ordem.slice(1), fallback].filter((p) => p.length);
    for (const pool of fontes) {
      if (ids.length >= PLAN_LIMITS.itemsPerSlot || left <= 5) break;
      const it = take(pool, i);
      if (!it || ids.includes(it.id)) continue;
      ids.push(it.id);
      used.add(it.id);
      left -= it.duration_min || 15;
    }
    const titulo = focus.length ? `Balanço: ${focus.map((f) => f.label.toLowerCase()).join(' e ')}` : 'Balanço: treino geral';
    return { date, label: `${WEEKDAY_SHORT[weekdayOf(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)}`, title: str(titulo, 80), item_ids: ids, minutes };
  });
  const semItens = days.every((d) => d.item_ids.filter((id) => !warmups.some((w) => w.id === id)).length === 0);
  let message;
  if (light) message = 'Semana mais leve: você contou que o corpo ou a cabeça estavam no limite. Menos dias e menos intensidade.';
  else if (focus.length) message = `Foco da semana: ${focus.map((f) => f.label.toLowerCase()).join(' e ')}.`;
  else message = 'Você não marcou nada a melhorar: uma semana para manter o ritmo.';
  return {
    focus,
    maintain,
    light,
    minutes,
    days,
    empty: semItens,
    message,
    skills: [...new Set(focus.flatMap((f) => ASPECT_BY_ID[f.id].skills))],
  };
}

/**
 * Como a sugestão entra nos treinos:
 *  - plano ATIVO que já começou e tem espaço ⇒ os dias entram nele (estica as
 *    semanas se a sugestão passar do fim; dia que já tem treino ganha os
 *    itens que couberem, até 4);
 *  - sem plano em curso ⇒ um plano novo, curto, de origem "balanço".
 *
 * @param {{ days: Array<{date,title,item_ids,minutes}>, plans?: object[], focus?: string[], skills?: string[],
 *   today?: string, title?: string }} p `focus`: rótulos (para o objetivo); `skills`: o foco do plano
 * @returns {{ mode: 'plano', planId: string, patch: object, added: number, full: string[] }
 *   | { mode: 'novo', input: object, pauses: object|null }}
 */
export function debriefPlanChange({ days = [], plans = [], focus = [], skills = [], today = todayLocal(), title = 'Semana do balanço' }) {
  const chosen = days.filter((d) => isISODate(d.date) && d.item_ids?.length).sort((a, b) => a.date.localeCompare(b.date));
  if (!chosen.length) return null;
  const ativo = plans.find((p) => p.status === PLAN_STATUS.ATIVO) || null;
  const last = chosen[chosen.length - 1].date;
  const emCurso = ativo && ativo.start_date <= today && planEndDate(ativo) >= today;
  const weekOf = (start, date) => Math.floor(daysBetween(start, date) / 7) + 1;

  if (emCurso && weekOf(ativo.start_date, last) <= PLAN_LIMITS.weeks) {
    const slots = (ativo.slots || []).map((s) => ({ ...s, item_ids: [...(s.item_ids || [])] }));
    const daysSet = new Set(ativo.days || []);
    let added = 0;
    const full = [];
    chosen.forEach((d) => {
      const week = weekOf(ativo.start_date, d.date);
      const day = weekdayOf(d.date);
      const slot = slots.find((s) => s.week === week && s.day === day);
      if (slot) {
        const antes = slot.item_ids.length;
        d.item_ids.forEach((id) => {
          if (slot.item_ids.length < PLAN_LIMITS.itemsPerSlot && !slot.item_ids.includes(id)) slot.item_ids.push(id);
        });
        if (slot.item_ids.length === antes) full.push(d.date);
        else added += 1;
      } else if (slots.length < PLAN_LIMITS.slots) {
        slots.push({ week, day, title: d.title, item_ids: d.item_ids.slice(0, PLAN_LIMITS.itemsPerSlot), duration_min: d.minutes || 0 });
        daysSet.add(day);
        added += 1;
      } else {
        full.push(d.date);
      }
    });
    return {
      mode: 'plano',
      planId: ativo.id,
      planTitle: ativo.title,
      patch: { ...ativo, slots, days: [...daysSet].sort(), weeks: Math.max(ativo.weeks, weekOf(ativo.start_date, last)) },
      added,
      full,
    };
  }

  const start = weekKeyOf(chosen[0].date);
  const weeks = weekOf(start, last);
  return {
    mode: 'novo',
    pauses: ativo,
    input: {
      title,
      goal: focus.length ? `Treinar ${focus.join(' e ')}, a partir do balanço do jogo.` : 'Manter o ritmo, a partir do balanço do jogo.',
      focus: skills,
      start_date: start,
      weeks,
      days: [...new Set(chosen.map((d) => weekdayOf(d.date)))].sort(),
      minutes: chosen[0].minutes || 45,
      slots: chosen.map((d) => ({ week: weekOf(start, d.date), day: weekdayOf(d.date), title: d.title, item_ids: d.item_ids, duration_min: d.minutes || 0 })),
      source: 'balanco',
    },
  };
}

/**
 * O que os balanços dizem ao longo do tempo: média das notas, o que mais
 * falta, o que mais funciona e como a pessoa sente a evolução.
 */
export function debriefTrends(debriefs = []) {
  const lista = answeredDebriefs(debriefs);
  if (!lista.length) return null;
  const conta = (campo) => {
    const m = new Map();
    lista.forEach((d) => (d[campo] || []).forEach((a) => m.set(a, (m.get(a) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, label: aspectLabel(id), count: n }));
  };
  const recentes = lista.slice(0, 5);
  const anteriores = lista.slice(5, 10);
  const media = (l) => (l.length ? Math.round((l.reduce((s, d) => s + (d.rating || 0), 0) / l.length) * 10) / 10 : null);
  const evol = {};
  lista.forEach((d) => { evol[d.evolution] = (evol[d.evolution] || 0) + 1; });
  return {
    total: lista.length,
    average: media(lista),
    recentAverage: media(recentes),
    previousAverage: media(anteriores),
    weaknesses: conta('weaknesses'),
    strengths: conta('strengths'),
    evolution: evol,
  };
}

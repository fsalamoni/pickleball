/**
 * Diário de treino (`training_sessions`).
 *
 * Registro honesto e rápido: "fiz", "fiz uma parte" ou "treino livre", minutos,
 * esforço na escala CR-10 e uma nota opcional. Nada de saúde (dor, lesão,
 * peso, remédio): a nota avisa, e nenhum campo pede isso.
 *
 * Carga da sessão (sRPE) = minutos × esforço (Foster). Registro próprio NÃO
 * dá XP na gamificação.
 */

import { isISODate, weekKeyOf, weekDates, todayLocal, addDays } from './dates.js';
import { isValidSkill } from './taxonomy.js';

export const SESSION_KINDS = Object.freeze(['quadra', 'jogo', 'fisico', 'estudo', 'mental']);
export const SESSION_KIND_LABELS = Object.freeze({
  quadra: 'Treino de quadra', jogo: 'Jogo', fisico: 'Físico', estudo: 'Estudo', mental: 'Mental',
});
export const SESSION_STATUS = Object.freeze({ FEITO: 'feito', PARCIAL: 'parcial', LIVRE: 'livre' });
export const SESSION_STATUS_LABELS = Object.freeze({ feito: 'Fiz tudo', parcial: 'Fiz uma parte', livre: 'Treino livre' });
export const SESSION_NOTES_MAX = 2000;
export const SESSION_HEALTH_HINT = 'Não registre informações de saúde (dor, lesão, remédio) aqui.';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const int = (v, min, max, d = null) => {
  if (v === '' || v === null || v === undefined) return d;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** @returns {{ valid: boolean, error: string, value: object }} */
export function normalizeSession(input = {}, { today = todayLocal() } = {}) {
  const date = isISODate(input.date) ? input.date : today;
  if (date > addDays(today, 1)) return { valid: false, error: 'O registro não pode ser de um dia que ainda não chegou.', value: {} };
  const duration_min = int(input.duration_min, 0, 600, 0);
  const rpe = int(input.rpe, 0, 10, null);
  const value = {
    date,
    week_key: weekKeyOf(date),
    title: str(input.title, 120) || 'Treino',
    kind: SESSION_KINDS.includes(input.kind) ? input.kind : 'quadra',
    status: Object.values(SESSION_STATUS).includes(input.status) ? input.status : SESSION_STATUS.FEITO,
    item_ids: [...new Set((Array.isArray(input.item_ids) ? input.item_ids : []).map((x) => str(x, 64)).filter(Boolean))].slice(0, 12),
    plan_id: input.plan_id ? str(input.plan_id, 64) : null,
    duration_min,
    rpe,
    notes: str(input.notes, SESSION_NOTES_MAX),
    skills: [...new Set((Array.isArray(input.skills) ? input.skills : []).filter(isValidSkill))].slice(0, 6),
    shared_coach_id: input.shared_coach_id ? str(input.shared_coach_id, 128) : null,
  };
  if (duration_min <= 0) return { valid: false, error: 'Diga quantos minutos durou.', value };
  return { valid: true, error: '', value };
}

/** Carga sRPE (minutos × esforço). Sem esforço registrado ⇒ `null` (desconhecido, não zero). */
export function sessionLoad(s = {}) {
  if (!Number.isFinite(s.rpe) || !Number.isFinite(s.duration_min)) return null;
  return s.duration_min * s.rpe;
}

/**
 * A semana (segunda a domingo): o que foi planejado × o que foi feito, dia a
 * dia. "Ficou para depois" nunca é falha — não há estado vermelho.
 * @param {{ weekKey: string, sessions: object[], plannedByDate?: Record<string, object[]>, today?: string }} p
 */
export function weekSummary({ weekKey, sessions = [], plannedByDate = {}, today = todayLocal() }) {
  const days = weekDates(weekKey).map((date) => {
    const done = sessions.filter((s) => s.date === date);
    const planned = plannedByDate[date] || [];
    let state = 'vazio';
    if (done.length) state = done.some((s) => s.status === SESSION_STATUS.PARCIAL) && !done.some((s) => s.status === SESSION_STATUS.FEITO) ? 'parcial' : 'feito';
    else if (planned.length) state = date < today ? 'depois' : date === today ? 'hoje' : 'planejado';
    return { date, done, planned, state };
  });
  const inWeek = sessions.filter((s) => s.week_key === weekKey || weekKeyOf(s.date) === weekKey);
  const minutes = inWeek.reduce((acc, s) => acc + (s.duration_min || 0), 0);
  const loads = inWeek.map(sessionLoad).filter((x) => x !== null);
  return {
    days,
    sessionsCount: inWeek.length,
    minutes,
    load: loads.length ? loads.reduce((a, b) => a + b, 0) : null,
    plannedCount: Object.entries(plannedByDate).filter(([d]) => d >= weekKey && d <= addDays(weekKey, 6)).reduce((a, [, v]) => a + v.length, 0),
    doneDays: days.filter((d) => d.state === 'feito' || d.state === 'parcial').length,
  };
}

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t?.seconds === 'number' ? t.seconds * 1000 : 0));

export function sortSessions(list = []) {
  return [...list].sort((a, b) => (a.date === b.date ? ms(b.created_at) - ms(a.created_at) : (a.date < b.date ? 1 : -1)));
}

/** Chaves das últimas N semanas (a atual primeiro) — a consulta usa `week_key in [...]`. */
export function recentWeekKeys(n = 8, today = todayLocal()) {
  const first = weekKeyOf(today);
  return Array.from({ length: Math.min(30, Math.max(1, n)) }, (_, i) => addDays(first, -7 * i));
}

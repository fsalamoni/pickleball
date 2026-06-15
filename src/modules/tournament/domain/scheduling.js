/**
 * Configuração de agendamento de uma modalidade: quantas quadras estão
 * disponíveis, em que janela de horário os jogos acontecem e qual a duração
 * média de cada jogo. A partir disso o sistema distribui os jogos sorteados
 * pelas quadras e horários, sem conflito de jogadores.
 *
 * Todas as funções deste módulo são puras (sem I/O).
 */

import { scheduleMatches } from './schedule.js';

export const DEFAULT_COURT_COUNT = 1;
export const MAX_COURT_COUNT = 50;
export const DEFAULT_MATCH_DURATION_MINUTES = 30;
export const MIN_MATCH_DURATION_MINUTES = 5;
export const MAX_MATCH_DURATION_MINUTES = 600;
/**
 * Descanso mínimo (em "slots", ou seja, múltiplos da duração do jogo) que um
 * jogador deve ter entre dois jogos. 1 = ao menos um intervalo de uma partida
 * antes de voltar à quadra, o que equilibra a participação e dá folga.
 */
export const DEFAULT_REST_SLOTS = 1;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clampInt(value, min, max, fallback) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Retorna 'HH:MM' válido ou null. */
export function normalizeTimeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return TIME_RE.test(trimmed) ? trimmed : null;
}

/** Retorna 'YYYY-MM-DD' válido ou null. */
export function normalizeDateString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) return null;
  const d = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : trimmed;
}

/**
 * Normaliza a configuração de agendamento vinda da UI/Firestore.
 * @param {object} [data]
 * @returns {{
 *   court_count: number,
 *   match_duration_minutes: number,
 *   play_date: string|null,
 *   play_start_time: string|null,
 *   play_end_time: string|null,
 * }}
 */
export function normalizeSchedulingConfig(data = {}) {
  return {
    court_count: clampInt(data.court_count, 1, MAX_COURT_COUNT, DEFAULT_COURT_COUNT),
    match_duration_minutes: clampInt(
      data.match_duration_minutes,
      MIN_MATCH_DURATION_MINUTES,
      MAX_MATCH_DURATION_MINUTES,
      DEFAULT_MATCH_DURATION_MINUTES,
    ),
    play_date: normalizeDateString(data.play_date),
    play_start_time: normalizeTimeString(data.play_start_time),
    play_end_time: normalizeTimeString(data.play_end_time),
  };
}

/**
 * Combina uma data ('YYYY-MM-DD') e um horário ('HH:MM') em um ISO string,
 * interpretando-os no fuso horário local do ambiente. Retorna null se faltar
 * algum dado essencial.
 *
 * @param {string|null} dateStr
 * @param {string|null} timeStr
 * @param {string|Date|null} [fallbackDate] data base usada quando `dateStr` é nulo
 * @returns {string|null}
 */
export function buildStartAtISO(dateStr, timeStr, fallbackDate = null) {
  const time = normalizeTimeString(timeStr);
  if (!time) return null;

  let baseDate = normalizeDateString(dateStr);
  if (!baseDate && fallbackDate) {
    const f = new Date(fallbackDate);
    if (!Number.isNaN(f.getTime())) {
      const y = f.getFullYear();
      const m = String(f.getMonth() + 1).padStart(2, '0');
      const d = String(f.getDate()).padStart(2, '0');
      baseDate = `${y}-${m}-${d}`;
    }
  }
  if (!baseDate) return null;

  const composed = new Date(`${baseDate}T${time}:00`);
  return Number.isNaN(composed.getTime()) ? null : composed.toISOString();
}

/**
 * Calcula quantos slots de `durationMinutes` cabem na janela [start, end].
 * Retorna null quando não é possível determinar (faltam horários).
 *
 * @param {string|null} startTime 'HH:MM'
 * @param {string|null} endTime   'HH:MM'
 * @param {number} durationMinutes
 * @returns {number|null}
 */
export function computeWindowSlots(startTime, endTime, durationMinutes) {
  const start = normalizeTimeString(startTime);
  const end = normalizeTimeString(endTime);
  if (!start || !end || !durationMinutes || durationMinutes <= 0) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const windowMin = endMin - startMin;
  if (windowMin <= 0) return null;
  return Math.floor(windowMin / durationMinutes);
}

/**
 * Sintetiza a lista de quadras a partir da quantidade configurada.
 * @param {number} courtCount
 * @returns {Array<{ id: string, name: string, index: number }>}
 */
export function buildCourts(courtCount) {
  const n = clampInt(courtCount, 1, MAX_COURT_COUNT, DEFAULT_COURT_COUNT);
  return Array.from({ length: n }, (_, i) => ({
    id: `court-${i + 1}`,
    name: `Quadra ${i + 1}`,
    index: i + 1,
  }));
}

/**
 * Recebe os jogos já gerados (com id, round, position e os ids dos lados) e a
 * configuração de agendamento da modalidade, e devolve um mapa
 * match_id → { court, court_index, slot, scheduled_at } além de avisos.
 *
 * Garantias:
 *  - Nenhum jogador joga em duas quadras no mesmo horário (restrição rígida).
 *  - Respeita um descanso mínimo entre jogos do mesmo jogador (equilíbrio de
 *    participação).
 *  - Distribui pelas N quadras disponíveis, a partir do horário de início, em
 *    intervalos iguais à duração configurada.
 *  - Se houver janela de término e os jogos não couberem, emite avisos e deixa
 *    os jogos excedentes sem horário (court/slot nulos), sem nunca criar
 *    conflitos.
 *
 * @param {Array<{ id: string, round?: number, position?: number, side_a_ids?: string[], side_b_ids?: string[], player_ids?: string[] }>} matches
 * @param {object} schedulingConfig saída de normalizeSchedulingConfig
 * @param {{ fallbackDate?: string|Date|null, restSlots?: number }} [options]
 * @returns {{ byMatchId: Map<string, object>, warnings: string[], totalSlots: number, slotMinutes: number, startAt: string|null }}
 */
export function assignSchedule(matches, schedulingConfig, options = {}) {
  const cfg = normalizeSchedulingConfig(schedulingConfig);
  const { fallbackDate = null, restSlots = DEFAULT_REST_SLOTS } = options;

  const courts = buildCourts(cfg.court_count);
  const startAt = buildStartAtISO(cfg.play_date, cfg.play_start_time, fallbackDate);
  const maxSlots = computeWindowSlots(
    cfg.play_start_time,
    cfg.play_end_time,
    cfg.match_duration_minutes,
  );

  const scheduleInput = (matches || []).map((m, idx) => ({
    id: m.id,
    round: m.round || 1,
    position: m.position || idx + 1,
    player_ids: m.player_ids || [
      ...(m.side_a_ids || []),
      ...(m.side_b_ids || []),
    ],
    duration_slots: 1,
  }));

  const { assignments, totalSlots, warnings } = scheduleMatches(scheduleInput, {
    courts,
    slotMinutes: cfg.match_duration_minutes,
    restSlots,
    startAt,
    // maxSlots pode ser 0 (janela menor que a duração de um jogo) — nesse caso
    // nada cabe e todos os jogos recebem aviso. null = sem limite de janela.
    maxSlots: maxSlots == null ? undefined : maxSlots,
  });

  const courtById = new Map(courts.map((c) => [c.id, c]));
  const byMatchId = new Map();
  assignments.forEach((a) => {
    const court = courtById.get(a.court_id);
    byMatchId.set(a.match_id, {
      court: court ? court.name : null,
      court_index: court ? court.index : null,
      slot: a.slot,
      scheduled_at: a.start_at,
    });
  });

  return {
    byMatchId,
    warnings,
    totalSlots,
    slotMinutes: cfg.match_duration_minutes,
    startAt,
  };
}

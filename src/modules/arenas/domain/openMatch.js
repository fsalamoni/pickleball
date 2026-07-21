/**
 * Domínio: Open Match (Arena V3 — sprint 1).
 *
 * Lógica pura para gerenciamento de slots de jogo aberto.
 * Sem I/O, testável.
 */

export const OPEN_SLOT_STATUS = Object.freeze({
  OPEN: 'open',
  FULL: 'full',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});

export const OPEN_SLOT_FORMATS = Object.freeze([
  'simples',
  'duplas',
  'mistas',
  'open',
  'treino',
]);

/**
 * Verifica se um slot está aberto para inscrições no momento.
 * @param {Object} slot
 * @param {Date|number} [now] - default Date.now()
 * @returns {boolean}
 */
export function isSlotOpenForJoin(slot, now = Date.now()) {
  if (!slot) return false;
  if (slot.status !== OPEN_SLOT_STATUS.OPEN) return false;

  // Construir timestamp do início do slot
  const startMs = slotStartMs(slot);
  if (!Number.isFinite(startMs)) return false;

  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  // Não pode se inscrever em slot que já começou (com 30min de tolerância)
  if (startMs < nowMs - 30 * 60_000) return false;
  if (startMs < nowMs) return false;

  return true;
}

/**
 * Constrói o timestamp de início do slot.
 * @param {Object} slot
 * @returns {number} ms epoch
 */
export function slotStartMs(slot) {
  if (!slot) return NaN;
  if (slot.start_ms && Number.isFinite(slot.start_ms)) return slot.start_ms;
  if (slot.start_at) {
    return slot.start_at instanceof Date
      ? slot.start_at.getTime()
      : Number(slot.start_at);
  }
  if (slot.date && slot.start) {
    // Interpretar como local time (YYYY-MM-DDTHH:MM sem TZ = local).
    // Usamos Date() que converte corretamente.
    const m = String(slot.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const sm = String(slot.start).match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !sm) return NaN;
    const [, y, mo, d] = m;
    const [, h, mi] = sm;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)).getTime();
  }
  return NaN;
}

/**
 * Quantas vagas ainda estão disponíveis.
 */
export function getAvailableSpots(slot) {
  if (!slot) return 0;
  const total = Number(slot.total_spots) || 0;
  const filled = Array.isArray(slot.participants) ? slot.participants.length : Number(slot.filled_spots) || 0;
  return Math.max(0, total - filled);
}

/**
 * % de ocupação do slot (0-100).
 */
export function getSlotFillPct(slot) {
  if (!slot) return 0;
  const total = Number(slot.total_spots) || 0;
  if (total === 0) return 0;
  const filled = Array.isArray(slot.participants) ? slot.participants.length : Number(slot.filled_spots) || 0;
  return Math.min(100, Math.round((filled / total) * 100));
}

/**
 * Verifica se o usuário pode se inscrever em um slot.
 * @param {Object} slot
 * @param {Object} user - { uid, ... }
 * @param {Object} [userProfile] - { level, city, ... }
 * @param {Date|number} [now] - para testabilidade
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canJoinOpenSlot(slot, user, userProfile, now = Date.now()) {
  if (!slot) return { ok: false, reason: 'Slot não encontrado.' };
  if (!user?.uid) return { ok: false, reason: 'Faça login para se inscrever.' };

  if (slot.status === OPEN_SLOT_STATUS.CANCELLED) {
    return { ok: false, reason: 'Slot cancelado.' };
  }
  if (slot.status === OPEN_SLOT_STATUS.COMPLETED) {
    return { ok: false, reason: 'Slot já encerrado.' };
  }
  if (!isSlotOpenForJoin(slot, now)) {
    return { ok: false, reason: 'Inscrições encerradas para este slot.' };
  }

  // Já está inscrito?
  if (Array.isArray(slot.participants) && slot.participants.includes(user.uid)) {
    return { ok: false, reason: 'Você já está inscrito neste slot.' };
  }

  // Sem vagas?
  if (getAvailableSpots(slot) <= 0) {
    return { ok: false, reason: 'Não há vagas disponíveis.' };
  }

  // Filtro de nível (se arena definiu)
  if (userProfile && Number.isFinite(userProfile.level)) {
    if (Number.isFinite(slot.min_level) && userProfile.level < slot.min_level) {
      return { ok: false, reason: `Nível mínimo: ${slot.min_level}.` };
    }
    if (Number.isFinite(slot.max_level) && userProfile.level > slot.max_level) {
      return { ok: false, reason: `Nível máximo: ${slot.max_level}.` };
    }
  }

  return { ok: true };
}

/**
 * Valida e normaliza um input de criação de slot.
 */
export function normalizeOpenSlotInput(input = {}) {
  const errors = {};
  const date = String(input.date ?? '').trim();
  const start = String(input.start ?? '').trim();
  const end = String(input.end ?? '').trim();

  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    errors.date = 'Data inválida (use AAAA-MM-DD).';
  }
  if (!start.match(/^\d{2}:\d{2}$/)) {
    errors.start = 'Horário inicial inválido (use HH:MM).';
  }
  if (!end.match(/^\d{2}:\d{2}$/)) {
    errors.end = 'Horário final inválido (use HH:MM).';
  }
  if (!errors.start && !errors.end) {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    if (s != null && e != null && e <= s) {
      errors.end = 'Horário final deve ser depois do inicial.';
    }
  }

  const totalSpots = Number(input.total_spots);
  if (!Number.isFinite(totalSpots) || totalSpots < 2 || totalSpots > 20) {
    errors.total_spots = 'Total de vagas deve ser entre 2 e 20.';
  }

  const format = String(input.format ?? 'duplas').trim();
  if (!OPEN_SLOT_FORMATS.includes(format)) {
    errors.format = 'Formato inválido.';
  }

  let minLevel = null;
  if (input.min_level !== '' && input.min_level != null) {
    const n = Number(input.min_level);
    if (!Number.isFinite(n) || n < 0 || n > 7) {
      errors.min_level = 'Nível mínimo deve ser entre 0 e 7.';
    } else {
      minLevel = n;
    }
  }
  let maxLevel = null;
  if (input.max_level !== '' && input.max_level != null) {
    const n = Number(input.max_level);
    if (!Number.isFinite(n) || n < 0 || n > 7) {
      errors.max_level = 'Nível máximo deve ser entre 0 e 7.';
    } else {
      maxLevel = n;
    }
  }
  if (minLevel != null && maxLevel != null && maxLevel < minLevel) {
    errors.max_level = 'Nível máximo deve ser maior que o mínimo.';
  }

  let price = null;
  if (input.price !== '' && input.price != null) {
    const n = Number(input.price);
    if (!Number.isFinite(n) || n < 0) {
      errors.price = 'Preço inválido.';
    } else {
      price = n;
    }
  }

  const value = {
    date,
    start,
    end,
    total_spots: totalSpots || 0,
    format,
    min_level: minLevel,
    max_level: maxLevel,
    price,
    court: String(input.court ?? '').trim().slice(0, 60),
    notes: String(input.notes ?? '').trim().slice(0, 500),
  };

  return { valid: Object.keys(errors).length === 0, errors, value };
}

function timeToMinutes(t) {
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Status computado do slot baseado em dados.
 */
export function computeSlotStatus(slot) {
  if (!slot) return OPEN_SLOT_STATUS.OPEN;
  if (slot.status === OPEN_SLOT_STATUS.CANCELLED) return OPEN_SLOT_STATUS.CANCELLED;
  if (slot.status === OPEN_SLOT_STATUS.COMPLETED) return OPEN_SLOT_STATUS.COMPLETED;
  if (getAvailableSpots(slot) <= 0) return OPEN_SLOT_STATUS.FULL;
  return OPEN_SLOT_STATUS.OPEN;
}

/**
 * Verifica se o slot já passou (deve virar 'completed').
 */
export function isSlotFinished(slot, now = Date.now()) {
  if (!slot) return false;
  const endMs = slotEndMs(slot);
  if (!Number.isFinite(endMs)) return false;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return endMs < nowMs;
}

function slotEndMs(slot) {
  if (!slot) return NaN;
  if (slot.end_ms && Number.isFinite(slot.end_ms)) return slot.end_ms;
  if (slot.end_at) {
    return slot.end_at instanceof Date
      ? slot.end_at.getTime()
      : Number(slot.end_at);
  }
  if (slot.date && slot.end) {
    const m = String(slot.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const sm = String(slot.end).match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !sm) return slotStartMs(slot);
    const [, y, mo, d] = m;
    const [, h, mi] = sm;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)).getTime();
  }
  return slotStartMs(slot);  // fallback
}

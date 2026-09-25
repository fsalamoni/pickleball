/**
 * Domínio: Open Match — a arena publica um horário com vagas.
 *
 * Lógica pura, sem I/O.
 *
 * ## O nível é o da RÉGUA ÚNICA (2.0–8.0)
 *
 * A faixa de nível de uma vaga (`min_level`/`max_level`) e o nível do atleta
 * são sempre a régua canônica da plataforma — a mesma dos sorteios, do rating
 * e do DUPR. Antes eram validados de 0 a 7 e comparados contra um campo de
 * perfil que não vive nessa escala: a peneira ou não filtrava nada, ou
 * filtrava errado. Ver `docs/13-NIVEL-UNIFICADO.md` e
 * `modules/rating/domain/unifiedLevel.js`.
 *
 * ## A vaga aberta OCUPA a quadra
 *
 * Uma vaga publicada às 19h na Quadra 1 é a Quadra 1 comprometida às 19h. Se o
 * calendário não souber disso, a arena vende duas vezes o mesmo horário. Por
 * isso `openSlotBlocks` deriva os bloqueios das próprias vagas, no mesmo
 * formato de `arena_unavailabilities` — mesma solução do dia de jogo da arena
 * (`games/domain/arenaGameDay.js`), pelo mesmo motivo.
 */

import { DUPR_MAX, DUPR_MIN } from '@/modules/rating/domain/duprScale.js';
import { instanteEmMs } from '@/core/domain/instant';

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
  // `instanteEmMs`: lido do banco, isto é Timestamp (ver core/domain/instant.js).
  if (slot.start_at) return instanteEmMs(slot.start_at);
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
 * @param {{ level?: number|null }} [athlete] — `level` é o nível na RÉGUA
 *   ÚNICA (2.0–8.0), vindo de `resolveUnifiedLevel`. Sem nível conhecido, a
 *   peneira NÃO barra: chutar um número seria pior do que deixar entrar.
 * @param {Date|number} [now] - para testabilidade
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canJoinOpenSlot(slot, user, athlete, now = Date.now()) {
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

  // Peneira de nível, na régua única.
  const fit = slotLevelFit(slot, athlete?.level);
  if (!fit.ok) return { ok: false, reason: fit.reason };

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Nível — sempre na régua única (2.0–8.0)                            */
/* ------------------------------------------------------------------ */

/** Um número na régua, com uma casa: `3.5`. Fora dela, `null`. */
function nivelValido(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= DUPR_MIN && n <= DUPR_MAX ? n : null;
}

/**
 * O nível do atleta cabe na faixa desta vaga?
 *
 * Sem faixa definida, cabe sempre. Sem nível conhecido, **também cabe**: a
 * plataforma nunca inventa um nível, e barrar quem não tem histórico
 * afastaria justamente quem mais precisa achar jogo.
 *
 * @param {Object} slot
 * @param {number|null|undefined} level — na régua 2.0–8.0
 * @returns {{ ok: boolean, reason?: string, known: boolean }}
 */
export function slotLevelFit(slot, level) {
  const min = nivelValido(slot?.min_level);
  const max = nivelValido(slot?.max_level);
  if (min == null && max == null) return { ok: true, known: false };

  const n = nivelValido(level);
  if (n == null) return { ok: true, known: false };

  if (min != null && n < min) {
    return {
      ok: false,
      known: true,
      reason: `Esta vaga é a partir do nível ${formatLevel(min)} — o seu é ${formatLevel(n)}.`,
    };
  }
  if (max != null && n > max) {
    return {
      ok: false,
      known: true,
      reason: `Esta vaga vai até o nível ${formatLevel(max)} — o seu é ${formatLevel(n)}.`,
    };
  }
  return { ok: true, known: true };
}

/** `3.5`, `3.0` — sempre com uma casa, como o DUPR se escreve. */
export function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '';
}

/**
 * A faixa de nível da vaga, em texto: "3.0 a 4.0", "a partir de 3.0",
 * "até 4.0" ou `null` (aberta a todos os níveis).
 * @returns {string|null}
 */
export function slotLevelRangeLabel(slot) {
  const min = nivelValido(slot?.min_level);
  const max = nivelValido(slot?.max_level);
  if (min != null && max != null) return `${formatLevel(min)} a ${formatLevel(max)}`;
  if (min != null) return `a partir de ${formatLevel(min)}`;
  if (max != null) return `até ${formatLevel(max)}`;
  return null;
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

  // A faixa vive na RÉGUA ÚNICA (2.0–8.0), a mesma do atleta. Escalas
  // diferentes na mesma comparação não filtram nada — filtram errado.
  const faixa = `${formatLevel(DUPR_MIN)} e ${formatLevel(DUPR_MAX)}`;
  let minLevel = null;
  if (input.min_level !== '' && input.min_level != null) {
    const n = Number(input.min_level);
    if (!Number.isFinite(n) || n < DUPR_MIN || n > DUPR_MAX) {
      errors.min_level = `Nível mínimo deve ser entre ${faixa}.`;
    } else {
      minLevel = n;
    }
  }
  let maxLevel = null;
  if (input.max_level !== '' && input.max_level != null) {
    const n = Number(input.max_level);
    if (!Number.isFinite(n) || n < DUPR_MIN || n > DUPR_MAX) {
      errors.max_level = `Nível máximo deve ser entre ${faixa}.`;
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
    // `court_id` é ADITIVO e opcional: sem ele a vaga segue existindo como
    // sempre existiu (texto livre), só não fecha a quadra no calendário.
    court_id: String(input.court_id ?? '').trim() || null,
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
  // `instanteEmMs`: lido do banco, isto é Timestamp (ver core/domain/instant.js).
  if (slot.end_at) return instanteEmMs(slot.end_at);
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

/* ------------------------------------------------------------------ */
/*  A vaga aberta OCUPA a quadra                                       */
/* ------------------------------------------------------------------ */

/**
 * Uma vaga ainda vale para ocupar a quadra? Cancelada, não. E a vaga ligada a
 * um DIA DE JOGO (Onda CA) também não: quem fecha a quadra é o dia de jogo
 * (`gameDayBlocks`), e contar os dois mostraria dois bloqueios no mesmo
 * horário — o mesmo cuidado do torneio interno que virou dia de jogo.
 */
function vagaOcupaQuadra(slot) {
  if (!slot) return false;
  if (slot.status === OPEN_SLOT_STATUS.CANCELLED) return false;
  if (typeof slot.game_day_id === 'string' && slot.game_day_id) return false;
  return Boolean(slot.court_id && slot.date && slot.start && slot.end);
}

/**
 * Os bloqueios de calendário que estas vagas implicam — DERIVADOS.
 *
 * Mesmo desenho de `gameDayBlocks` (`games/domain/arenaGameDay.js`), e pelo
 * mesmo motivo: uma vaga publicada às 19h na Quadra 1 é a Quadra 1
 * comprometida às 19h. Se só o "open match" souber disso, a arena vende o
 * mesmo horário duas vezes — o atleta reserva, chega, e encontra um jogo
 * aberto acontecendo na quadra dele.
 *
 * Diferente do dia de jogo, aqui **nada é gravado**: o bloqueio é sempre
 * calculado na leitura. Não há cópia para faltar.
 *
 * Vaga sem `court_id` (o formato antigo, com o nome da quadra em texto livre)
 * não gera bloqueio — não há como saber QUAL quadra é.
 *
 * @param {Array<object>} slots
 * @returns {Array<object>} no MESMO formato de `arena_unavailabilities`
 */
export function openSlotBlocks(slots = []) {
  if (!Array.isArray(slots)) return [];
  return slots.filter(vagaOcupaQuadra).map((s) => ({
    id: `vaga-aberta:${s.id}`,
    arena_id: s.arena_id,
    court_id: s.court_id,
    date: s.date,
    start_time: s.start,
    end_time: s.end,
    source: 'open_match',
    open_slot_id: s.id,
    notes: `Jogo aberto${s.format ? ` (${s.format})` : ''}`,
    derivado: true,
  }));
}

/** A identidade de um bloqueio de vaga, para não contar o mesmo duas vezes. */
function chaveDaVaga(b) {
  return [b?.open_slot_id, b?.court_id, b?.date, b?.start_time, b?.end_time].join('|');
}

/**
 * Os bloqueios que a tela já tem mais os que as vagas abertas implicam.
 *
 * Use para calcular STATUS (calendário, grade do dia, conflito de reserva).
 * **Não** use para LISTAR bloqueios numa tela de gestão: o derivado não tem
 * documento, e um botão de apagar apontaria para o nada — a lição que o dia de
 * jogo já ensinou.
 *
 * @param {Array<object>} blocks — gravados (e possivelmente já mesclados com
 *   os do dia de jogo)
 * @param {Array<object>} slots
 */
export function mergeOpenSlotBlocks(blocks = [], slots = []) {
  const base = Array.isArray(blocks) ? blocks : [];
  const jaTem = new Set(base.filter((b) => b?.open_slot_id).map(chaveDaVaga));
  const faltando = openSlotBlocks(slots).filter((b) => !jaTem.has(chaveDaVaga(b)));
  return faltando.length === 0 ? base : [...base, ...faltando];
}

/**
 * A vaga aberta bate com alguma OUTRA coisa já marcada na quadra?
 *
 * A arena precisa saber ANTES de publicar — publicar uma vaga em cima de uma
 * reserva confirmada é criar um conflito que só aparece no dia.
 *
 * Encostar não é sobrepor: 18h–20h e 20h–22h convivem.
 *
 * @param {{ court_id?: string, date: string, start: string, end: string }} vaga
 * @param {Array<object>} blocks — bloqueios (já mesclados) da arena
 * @param {Array<object>} bookedSlots — `{ court_id, date, start, end }` das reservas
 * @returns {{ hasConflict: boolean, reason: string|null }}
 */
export function openSlotConflict(vaga, blocks = [], bookedSlots = []) {
  // Jogo aberto em MAIS de uma quadra (Onda CA): confere quadra a quadra e
  // devolve o primeiro choque, dizendo em qual.
  const varias = Array.isArray(vaga?.court_ids) ? vaga.court_ids.filter(Boolean) : [];
  if (varias.length > 1) {
    for (const courtId of varias) {
      const r = openSlotConflict({ ...vaga, court_ids: undefined, court_id: courtId }, blocks, bookedSlots);
      if (r.hasConflict) return r;
    }
    return { hasConflict: false, reason: null };
  }
  if (!vaga?.court_id || !vaga?.date || !vaga?.start || !vaga?.end) {
    return { hasConflict: false, reason: null };
  }
  const ini = timeToMinutes(vaga.start);
  const fim = timeToMinutes(vaga.end);
  if (ini == null || fim == null) return { hasConflict: false, reason: null };

  const sobrepoe = (aIni, aFim) => aIni != null && aFim != null && aIni < fim && ini < aFim;

  const bloqueio = (blocks || []).find((b) => (
    b?.date === vaga.date
    // Bloqueio sem quadra fecha a arena inteira.
    && (!b.court_id || b.court_id === vaga.court_id)
    && sobrepoe(timeToMinutes(b.start_time), timeToMinutes(b.end_time))
  ));
  if (bloqueio) {
    return {
      hasConflict: true,
      reason: bloqueio.source === 'game_day'
        ? 'Já existe um dia de jogo nesta quadra e horário.'
        : bloqueio.source === 'open_match'
          ? 'Já existe outro jogo aberto nesta quadra e horário.'
          : 'Esta quadra está bloqueada neste horário.',
    };
  }

  const reserva = (bookedSlots || []).find((b) => (
    b?.date === vaga.date
    && b?.court_id === vaga.court_id
    && sobrepoe(timeToMinutes(b.start), timeToMinutes(b.end))
  ));
  if (reserva) {
    return { hasConflict: true, reason: 'Já existe uma reserva nesta quadra e horário.' };
  }

  return { hasConflict: false, reason: null };
}

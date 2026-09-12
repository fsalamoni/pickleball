/**
 * SELEÇÃO DE RESERVA — o que a pessoa escolheu no calendário, como dado puro.
 *
 * ## O problema que este arquivo resolve
 *
 * Reservar tinha dois passos, e o segundo **re-perguntava tudo o que o
 * primeiro já tinha respondido**: escolhia-se o dia no calendário, os horários
 * na grade, e então abria um formulário pedindo de novo data, horário, modo de
 * quadra ("qualquer / específicas / todas") e tipo (avulsa / vários / semanal).
 * Quem já tinha escolhido precisava escolher outra vez, num vocabulário
 * diferente — e as duas respostas podiam se contradizer.
 *
 * Aqui a escolha vira **uma coisa só**: uma lista de CÉLULAS.
 *
 *     { court_id, date, start, end }
 *
 * `court_id: null` é legítimo e significa **"tanto faz a quadra"** — a arena
 * atribui uma livre. É o que a visão "Por horário" produz.
 *
 * ## Por que agrupar por quadra
 *
 * O serviço grava **uma reserva por quadra**, e todas as reservas de uma
 * chamada compartilham a mesma lista de horários. Então "Quadra 1 às 19h e
 * Quadra 2 às 20h" não cabia numa chamada só — não por limitação de banco, mas
 * porque ninguém tinha escrito a conta.
 *
 * `groupSelectionByCourt` faz essa conta: junta numa mesma reserva as quadras
 * que têm **exatamente os mesmos horários** e separa as que não têm. Os casos
 * comuns continuam sendo UM grupo:
 *
 *   · uma quadra, vários horários            → 1 grupo
 *   · várias quadras, os mesmos horários     → 1 grupo
 *   · várias quadras, horários diferentes    → 1 grupo por conjunto
 */

import { timeToMinutes } from './pricing.js';

/** Teto de semanas de uma recorrência — meio ano é mais que suficiente. */
export const RECURRENCE_MAX_WEEKS = 26;

/** Identidade de uma célula. `null` de quadra vira string vazia, de propósito. */
export function cellKey(cell) {
  return `${cell?.court_id || ''}|${cell?.date || ''}|${cell?.start || ''}`;
}

/** A célula está na seleção? */
export function isCellSelected(selection = [], cell) {
  const k = cellKey(cell);
  return (selection || []).some((c) => cellKey(c) === k);
}

/**
 * Liga/desliga uma célula. Devolve SEMPRE uma lista nova, ordenada por
 * data → horário → quadra, para a tela nunca depender da ordem do clique.
 */
export function toggleSelectionCell(selection = [], cell) {
  const atual = Array.isArray(selection) ? selection : [];
  const k = cellKey(cell);
  const existe = atual.some((c) => cellKey(c) === k);
  const nova = existe
    ? atual.filter((c) => cellKey(c) !== k)
    : [...atual, {
      court_id: cell.court_id || null,
      date: cell.date,
      start: cell.start,
      end: cell.end,
    }];
  return sortSelection(nova);
}

/** Ordem canônica: data, depois horário, depois quadra. */
export function sortSelection(selection = []) {
  return [...(selection || [])].sort((a, b) => (
    String(a.date).localeCompare(String(b.date))
    || String(a.start).localeCompare(String(b.start))
    || String(a.court_id || '').localeCompare(String(b.court_id || ''))
  ));
}

/** Ids das quadras escolhidas (sem repetir). `null` = "tanto faz". */
export function selectionCourtIds(selection = []) {
  return Array.from(new Set((selection || []).map((c) => c.court_id || null)));
}

/** Só os horários (sem quadra), sem repetir — para resumos. */
function slotsDe(celulas) {
  const vistos = new Set();
  const saida = [];
  celulas.forEach((c) => {
    const k = `${c.date}|${c.start}|${c.end}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    saida.push({ date: c.date, start: c.start, end: c.end });
  });
  return saida;
}

/**
 * Agrupa a seleção no formato que o serviço grava: quadras que compartilham
 * exatamente os mesmos horários viram UM pedido.
 *
 * @returns {Array<{ courtIds: Array<string|null>, slots: Array<{date,start,end}> }>}
 *   `courtIds: [null]` significa "qualquer quadra livre".
 */
export function groupSelectionByCourt(selection = []) {
  const ordenada = sortSelection(selection);
  if (ordenada.length === 0) return [];

  // quadra → horários
  const porQuadra = new Map();
  ordenada.forEach((c) => {
    const id = c.court_id || null;
    porQuadra.set(id, [...(porQuadra.get(id) || []), c]);
  });

  // assinatura dos horários → quadras que a compartilham
  const porAssinatura = new Map();
  porQuadra.forEach((celulas, courtId) => {
    const slots = slotsDe(celulas);
    const assinatura = slots.map((s) => `${s.date}|${s.start}|${s.end}`).join(',');
    const grupo = porAssinatura.get(assinatura) || { courtIds: [], slots };
    grupo.courtIds.push(courtId);
    porAssinatura.set(assinatura, grupo);
  });

  // "Tanto faz a quadra" nunca se mistura com quadra escolhida, mesmo que os
  // horários batam: são pedidos de natureza diferente.
  const saida = [];
  porAssinatura.forEach((grupo) => {
    const comQuadra = grupo.courtIds.filter((id) => id !== null);
    const semQuadra = grupo.courtIds.filter((id) => id === null);
    if (comQuadra.length > 0) saida.push({ courtIds: comQuadra, slots: grupo.slots });
    if (semQuadra.length > 0) saida.push({ courtIds: [null], slots: grupo.slots });
  });
  return saida;
}

/**
 * Repete a seleção semana a semana.
 *
 * `weeks = 1` (ou menos) devolve a própria seleção: "só neste dia". A partir
 * de 2, cada célula ganha cópias em +7, +14… dias.
 */
export function expandSelectionWeeks(selection = [], weeks = 1) {
  const n = Math.max(1, Math.min(RECURRENCE_MAX_WEEKS, Math.trunc(Number(weeks) || 1)));
  const base = sortSelection(selection);
  if (n === 1) return base;

  const saida = [];
  for (let i = 0; i < n; i += 1) {
    base.forEach((c) => {
      saida.push({ ...c, date: addDays(c.date, i * 7) });
    });
  }
  return sortSelection(saida);
}

/** 'YYYY-MM-DD' + N dias, sem fuso: a data é um rótulo, não um instante. */
export function addDays(dateISO, days) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Minutos somados de uma lista de células. */
export function selectionMinutes(selection = []) {
  return (selection || []).reduce((total, c) => {
    const ini = timeToMinutes(c.start);
    const fim = timeToMinutes(c.end);
    if (ini == null || fim == null || fim <= ini) return total;
    return total + (fim - ini);
  }, 0);
}

/**
 * O resumo que a tela mostra antes de confirmar — o contrário de um
 * formulário: diz o que a pessoa escolheu, com as palavras dela.
 *
 * @param {Array} selection
 * @param {Map<string,string>|object} [nomePorQuadra] id → nome
 * @returns {{
 *   total: number, minutos: number, quadras: number, datas: Array<string>,
 *   porQuadra: Array<{ court_id, nome, slots: Array }>,
 *   qualquerQuadra: boolean,
 * }}
 */
export function summarizeSelection(selection = [], nomePorQuadra = null) {
  const ordenada = sortSelection(selection);
  const nomeDe = (id) => {
    if (!id) return 'Qualquer quadra';
    if (nomePorQuadra instanceof Map) return nomePorQuadra.get(id) || 'Quadra';
    return (nomePorQuadra && nomePorQuadra[id]) || 'Quadra';
  };

  const porQuadraMap = new Map();
  ordenada.forEach((c) => {
    const id = c.court_id || null;
    porQuadraMap.set(id, [...(porQuadraMap.get(id) || []), c]);
  });

  return {
    total: ordenada.length,
    minutos: selectionMinutes(ordenada),
    quadras: selectionCourtIds(ordenada).filter(Boolean).length,
    datas: Array.from(new Set(ordenada.map((c) => c.date))),
    qualquerQuadra: porQuadraMap.has(null),
    porQuadra: Array.from(porQuadraMap.entries()).map(([court_id, celulas]) => ({
      court_id,
      nome: nomeDe(court_id),
      slots: celulas.map((c) => ({ date: c.date, start: c.start, end: c.end })),
    })),
  };
}

/**
 * A recorrência só é gravável como metadado quando ela é DESCRITÍVEL: um único
 * horário, repetido semanalmente. Com vários horários ou várias quadras, o
 * campo `recurrence` (que tem um `start`/`end` só) seria mentira — e o que vale
 * de verdade é a lista de horários, que vai completa de qualquer jeito.
 *
 * @returns {{ weekday: number, start: string, end: string, weeks: number, fromDate: string }|null}
 */
export function describableRecurrence(selection = [], weeks = 1) {
  const n = Math.trunc(Number(weeks) || 1);
  if (n <= 1) return null;
  const base = sortSelection(selection);
  if (base.length !== 1) return null;
  const c = base[0];
  const m = String(c.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const weekday = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return {
    weekday,
    start: c.start,
    end: c.end,
    weeks: Math.min(RECURRENCE_MAX_WEEKS, n),
    fromDate: c.date,
  };
}

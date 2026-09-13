/**
 * DIA DE JOGO DA ARENA — domínio puro, sem I/O e sem React.
 *
 * ## O que é, e por que não é uma coleção nova
 *
 * É o MESMO dia de jogo que já existe (`game_days`), com dono numa arena. A
 * tentação era criar `arena_game_days` e recomeçar; seria um erro caro:
 * participantes, sorteio, fila do Play, placar do Americano, ranking do dia,
 * telão, publicação no ranking da plataforma e os tutoriais já existem e são
 * testados. Duplicar isso significaria duas implementações divergindo a cada
 * correção — e o pedido foi justamente "o dia de jogo, exatamente como
 * existe, dentro das arenas".
 *
 * Então um dia de jogo de arena é um `game_days` com campos ADITIVOS:
 *
 *   arena_id       string   a arena dona (ausente ⇒ dia de jogo do atleta)
 *   arena_name     string   desnormalizado, para cartões e listas
 *   signup_mode    'day'|'court'  onde o atleta se inscreve
 *   capacity       number|null    teto do dia (null = sem limite)
 *   arena_slots    array    as quadras e os horários (ver abaixo)
 *
 * **Ausente `arena_id`, nada aqui vale** — é a garantia de que nenhum dia de
 * jogo já criado muda de comportamento.
 *
 * ## Os slots
 *
 * Cada item de `arena_slots` é uma quadra reservada numa faixa de horário:
 *
 *   { court_id, court_name, start_time, end_time, capacity }
 *
 * Isso é o que permite as três formas que a arena pediu:
 *
 *  · **horário único para o dia todo** — vários slots com o mesmo start/end;
 *  · **horário por quadra** — cada slot com o seu;
 *  · **mais de um dia de jogo na mesma quadra e no mesmo dia** — basta que as
 *    faixas não se sobreponham, o que é conferido aqui e no serviço.
 *
 * ## Inscrição
 *
 *  · `signup_mode: 'day'`   — o atleta entra no DIA. O teto é `capacity`
 *    (null = sem limite). É o formato de um Americano/Play em que a arena
 *    remaneja as quadras conforme a presença.
 *  · `signup_mode: 'court'` — o atleta escolhe a QUADRA. O teto é o
 *    `capacity` de cada slot. É o formato de quem quer times fixos por quadra.
 *
 * ## Onde o limite é conferido — e onde NÃO é
 *
 * A contagem de inscritos é uma agregação: a regra do Firestore não consegue
 * contar documentos de uma subcoleção. O teto é conferido no domínio e
 * reconferido no serviço no instante da inscrição, lendo a lista. Isso fecha a
 * porta do uso normal e do clique repetido, **mas não é barreira de
 * segurança** — duas inscrições exatamente simultâneas podem estourar o teto
 * em um. É o mesmo compromisso das outras listas da plataforma, e a arena vê e
 * remove quem sobrar. Está dito aqui para ninguém descobrir isso de surpresa.
 */

import { timeToMinutes } from '@/modules/arenas/domain/pricing.js';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar.js';
import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';
import { GAME_DAY_MANAGE_MODE } from './gameDayRoles.js';

/** Onde o atleta se inscreve. */
export const ARENA_SIGNUP_MODE = Object.freeze({
  DAY: 'day',
  COURT: 'court',
});

export const ARENA_SIGNUP_MODE_LABELS = Object.freeze({
  [ARENA_SIGNUP_MODE.DAY]: 'No dia (a arena distribui as quadras)',
  [ARENA_SIGNUP_MODE.COURT]: 'Na quadra (o atleta escolhe onde joga)',
});

export const ARENA_SIGNUP_MODE_HINTS = Object.freeze({
  [ARENA_SIGNUP_MODE.DAY]:
    'Uma lista só para o dia inteiro. Use quando o rodízio atravessa as quadras — é o caso do Play e do Americano aprimorado.',
  [ARENA_SIGNUP_MODE.COURT]:
    'Uma lista por quadra, cada uma com o seu limite. Use quando cada quadra tem a sua turma e o seu horário.',
});

export const ARENA_GAME_DAY_LIMITS = Object.freeze({
  MAX_SLOTS: 12,
  MAX_CAPACITY: 200,
});

/* ------------------------------------------------------------ leituras -- */

/** É um dia de jogo de arena? (ausência de `arena_id` ⇒ não é) */
export function isArenaGameDay(gameDay) {
  return typeof gameDay?.arena_id === 'string' && gameDay.arena_id.length > 0;
}

/** Os slots gravados, sempre como array. */
export function arenaGameDaySlots(gameDay) {
  return Array.isArray(gameDay?.arena_slots) ? gameDay.arena_slots : [];
}

/** Modo de inscrição normalizado (desconhecido ⇒ no dia). */
export function arenaSignupMode(gameDay) {
  return gameDay?.signup_mode === ARENA_SIGNUP_MODE.COURT
    ? ARENA_SIGNUP_MODE.COURT
    : ARENA_SIGNUP_MODE.DAY;
}

/** Ids das quadras reservadas, sem repetição e na ordem dos slots. */
export function arenaGameDayCourtIds(gameDay) {
  return Array.from(new Set(
    arenaGameDaySlots(gameDay).map((s) => s?.court_id).filter(Boolean),
  ));
}

/**
 * A faixa do dia como um todo: do início mais cedo ao fim mais tarde.
 * @returns {{ start: string, end: string }|null}
 */
export function arenaGameDayTimeRange(gameDay) {
  const slots = arenaGameDaySlots(gameDay)
    .filter((s) => timeToMinutes(s?.start_time) != null && timeToMinutes(s?.end_time) != null);
  if (slots.length === 0) return null;
  const start = slots.reduce((a, s) => (timeToMinutes(s.start_time) < timeToMinutes(a) ? s.start_time : a), slots[0].start_time);
  const end = slots.reduce((a, s) => (timeToMinutes(s.end_time) > timeToMinutes(a) ? s.end_time : a), slots[0].end_time);
  return { start, end };
}

/** Todos os slots têm o MESMO horário? (decide como a tela resume o dia) */
export function arenaGameDaySingleWindow(gameDay) {
  const slots = arenaGameDaySlots(gameDay);
  if (slots.length === 0) return false;
  const { start_time: s0, end_time: e0 } = slots[0];
  return slots.every((s) => s.start_time === s0 && s.end_time === e0);
}

/** Resumo de quando e onde, para cartões. */
export function arenaGameDayWhenText(gameDay) {
  const faixa = arenaGameDayTimeRange(gameDay);
  const quadras = arenaGameDaySlots(gameDay).length;
  const partes = [];
  // A data por extenso: `2026-10-02` obriga a pessoa a traduzir mês e dia
  // de cabeça, e este texto aparece em cinco telas.
  if (gameDay?.date) partes.push(formatDateShortBR(gameDay.date));
  if (faixa) partes.push(`${faixa.start}–${faixa.end}`);
  if (quadras > 0) partes.push(`${quadras} ${quadras === 1 ? 'quadra' : 'quadras'}`);
  return partes.join(' · ');
}

/* -------------------------------------------------------- sobreposição -- */

/** Duas faixas de horário se sobrepõem? Encostar não é sobrepor. */
export function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  if ([as, ae, bs, be].some((x) => x == null)) return false;
  // 18:00–20:00 e 20:00–22:00 NÃO conflitam: um começa quando o outro acaba.
  return as < be && bs < ae;
}

/**
 * Conflitos dos slots candidatos contra os dias de jogo JÁ existentes da
 * arena. É o que permite "mais de um dia de jogo no mesmo dia e na mesma
 * quadra, desde que em horários diferentes".
 *
 * @param {{ date: string, slots: Array }} candidato
 * @param {Array<object>} outros dias de jogo da arena (o próprio, se estiver
 *   na lista, é ignorado por `ignoreId`)
 * @param {{ ignoreId?: string }} [opts]
 * @returns {Array<{ court_id, court_name, game_day_id, title, start_time, end_time }>}
 */
export function findGameDayOverlaps({ date, slots = [] } = {}, outros = [], { ignoreId = null } = {}) {
  const achados = [];
  (outros || []).forEach((outro) => {
    if (!outro || outro.id === ignoreId) return;
    if (outro.date !== date) return;
    if (outro.status === 'archived') return;
    arenaGameDaySlots(outro).forEach((ocupado) => {
      (slots || []).forEach((cand) => {
        if (!cand?.court_id || cand.court_id !== ocupado.court_id) return;
        if (!timeRangesOverlap(cand.start_time, cand.end_time, ocupado.start_time, ocupado.end_time)) return;
        achados.push({
          court_id: cand.court_id,
          court_name: cand.court_name || ocupado.court_name || null,
          game_day_id: outro.id,
          title: outro.title || 'Dia de jogo',
          start_time: ocupado.start_time,
          end_time: ocupado.end_time,
        });
      });
    });
  });
  return achados;
}

/**
 * Os slots, no formato que `checkBookingConflict` espera — para conferir
 * contra as RESERVAS já feitas na arena antes de fechar a quadra.
 */
export function slotsAsBookingCandidates({ date, slots = [] } = {}) {
  return (slots || [])
    .filter((s) => s?.court_id && s?.start_time && s?.end_time)
    .map((s) => ({ date, start: s.start_time, end: s.end_time, court_id: s.court_id }));
}

/**
 * As indisponibilidades a gravar para FECHAR a quadra no calendário.
 *
 * Fechar o calendário não é código novo: a arena já bloqueia horário por
 * `arena_unavailabilities`, e tudo — status de slot, calendário mensal,
 * conflito de reserva — já respeita isso. O dia de jogo grava um bloqueio por
 * slot e some com ele ao ser arquivado. Marcados com `source` e
 * `game_day_id` para nunca serem confundidos com um bloqueio manual da arena
 * (que a arena apaga à mão; estes, não).
 */
export function unavailabilityPayloadsFor(gameDay) {
  if (!isArenaGameDay(gameDay) || !gameDay?.date) return [];
  return arenaGameDaySlots(gameDay)
    .filter((s) => s?.court_id && s?.start_time && s?.end_time)
    .map((s) => ({
      arena_id: gameDay.arena_id,
      court_id: s.court_id,
      date: gameDay.date,
      start_time: s.start_time,
      end_time: s.end_time,
      source: 'game_day',
      game_day_id: gameDay.id,
      notes: `Dia de jogo: ${gameDay.title || 'sem título'}`,
    }));
}

/**
 * Os bloqueios de calendário que ESTES dias de jogo implicam — DERIVADOS.
 *
 * ## Por que derivar se já existe a cópia no banco
 *
 * Marcar um dia de jogo grava `arena_unavailabilities` com `source:
 * 'game_day'` (é o que faz o resto do sistema respeitar sem código novo). Essa
 * cópia é ótima para compatibilidade e péssima como ÚNICA verdade: se a
 * gravação falhar — regra, rede, um dia de jogo criado antes da cópia existir —
 * o calendário volta a oferecer para reserva uma quadra que está ocupada, e
 * ninguém percebe até alguém aparecer na arena com uma reserva inútil.
 *
 * O dia de jogo é a fonte; a cópia é conveniência. Aqui as telas montam a
 * verdade a partir da fonte.
 *
 * @param {Array<object>} gameDays
 * @returns {Array<object>} no MESMO formato de `arena_unavailabilities`
 */
export function gameDayBlocks(gameDays = []) {
  if (!Array.isArray(gameDays)) return [];
  return gameDays
    .filter((g) => g?.status !== 'archived')
    .flatMap((g) => unavailabilityPayloadsFor(g)
      .map((p, i) => ({ ...p, id: `dia-de-jogo:${g.id}:${i}`, derivado: true })));
}

/** A identidade de um bloqueio, para não contar o mesmo horário duas vezes. */
function chaveDoBloqueio(b) {
  return [b?.game_day_id, b?.court_id, b?.date, b?.start_time, b?.end_time].join('|');
}

/**
 * Os bloqueios GRAVADOS mais os que faltaram ser gravados.
 *
 * Use ao calcular STATUS de horário (calendário, grade do dia, conflito de
 * reserva). **Não** use para LISTAR bloqueios numa tela de gestão: o derivado
 * não tem documento no banco, e um botão de apagar apontaria para o nada.
 */
export function mergeGameDayBlocks(unavailabilities = [], gameDays = []) {
  const gravados = Array.isArray(unavailabilities) ? unavailabilities : [];
  const jaGravado = new Set(gravados.filter((u) => u?.game_day_id).map(chaveDoBloqueio));
  const faltando = gameDayBlocks(gameDays).filter((b) => !jaGravado.has(chaveDoBloqueio(b)));
  return faltando.length === 0 ? gravados : [...gravados, ...faltando];
}

/* -------------------------------------------------------------- vagas -- */

/** Teto inteiro e positivo, ou `null` (sem limite). */
export function normalizeCapacity(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(ARENA_GAME_DAY_LIMITS.MAX_CAPACITY, n);
}

/**
 * Quantas vagas ainda há — no dia e, quando for o caso, em cada quadra.
 *
 * @param {object} gameDay
 * @param {Array<object>} participants documentos de participante
 * @returns {{
 *   mode: string, limit: number|null, used: number, left: number|null,
 *   full: boolean,
 *   byCourt: Array<{ court_id, court_name, limit, used, left, full }>
 * }}
 */
export function arenaGameDayVacancies(gameDay, participants = []) {
  const lista = Array.isArray(participants) ? participants : [];
  const mode = arenaSignupMode(gameDay);
  const used = lista.length;
  const limit = normalizeCapacity(gameDay?.capacity);

  const byCourt = arenaGameDaySlots(gameDay).map((s) => {
    const limiteQuadra = normalizeCapacity(s?.capacity);
    const usadoQuadra = lista.filter((p) => p?.arena_court_id === s?.court_id).length;
    return {
      court_id: s?.court_id || null,
      court_name: s?.court_name || null,
      start_time: s?.start_time || null,
      end_time: s?.end_time || null,
      limit: limiteQuadra,
      used: usadoQuadra,
      left: limiteQuadra == null ? null : Math.max(0, limiteQuadra - usadoQuadra),
      full: limiteQuadra != null && usadoQuadra >= limiteQuadra,
    };
  });

  // No modo por quadra, o dia só está cheio quando TODAS as quadras estão —
  // e uma quadra sem limite nunca enche, então o dia também não.
  const full = mode === ARENA_SIGNUP_MODE.COURT
    ? byCourt.length > 0 && byCourt.every((c) => c.full)
    : limit != null && used >= limit;

  return {
    mode,
    limit,
    used,
    left: limit == null ? null : Math.max(0, limit - used),
    full,
    byCourt,
  };
}

/** Já está inscrito? */
export function isSignedUp(participants = [], uid) {
  if (!uid) return false;
  return (Array.isArray(participants) ? participants : []).some((p) => p?.user_id === uid);
}

/**
 * Pode se inscrever? Devolve o motivo quando não pode — a tela MOSTRA o
 * motivo em vez de só desabilitar o botão: "não posso e não sei por quê" é a
 * pior tela que existe.
 *
 * @returns {{ ok: boolean, reason: string|null, message: string|null }}
 */
export function canSignUpToArenaGameDay({
  gameDay, participants = [], uid, courtId = null,
} = {}) {
  const negar = (reason, message) => ({ ok: false, reason, message });

  if (!isArenaGameDay(gameDay)) return negar('not_arena', 'Este dia de jogo não é de uma arena.');
  if (!uid) return negar('anonymous', 'Entre na sua conta para marcar presença.');
  if (gameDay.status === 'archived') return negar('archived', 'Este dia de jogo foi encerrado.');
  if (isSignedUp(participants, uid)) return negar('already', 'Você já está inscrito neste dia de jogo.');

  const vagas = arenaGameDayVacancies(gameDay, participants);

  if (vagas.mode === ARENA_SIGNUP_MODE.COURT) {
    if (!courtId) return negar('court_required', 'Escolha em qual quadra você vai jogar.');
    const quadra = vagas.byCourt.find((c) => c.court_id === courtId);
    if (!quadra) return negar('court_unknown', 'Essa quadra não faz parte deste dia de jogo.');
    if (quadra.full) return negar('court_full', `A ${quadra.court_name || 'quadra'} já está lotada.`);
    return { ok: true, reason: null, message: null };
  }

  if (vagas.full) return negar('full', 'As vagas deste dia de jogo acabaram.');
  return { ok: true, reason: null, message: null };
}

/* ---------------------------------------------------------- validação -- */

function texto(v) {
  return String(v ?? '').trim();
}

/**
 * Normaliza e valida o que a arena preencheu na criação/edição.
 *
 * Devolve SEMPRE um `value` utilizável (mesmo inválido), para a tela poder
 * mostrar o que já foi digitado junto dos erros.
 *
 * @param {object} input
 * @param {{ courts?: Array<{id,name}> }} [ctx] quadras da arena, para resolver nome
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeArenaGameDayInput(input = {}, { courts = [] } = {}) {
  const nomePorId = new Map((courts || []).map((c) => [c.id, c.name]));

  const slots = (Array.isArray(input.arena_slots) ? input.arena_slots : [])
    .slice(0, ARENA_GAME_DAY_LIMITS.MAX_SLOTS)
    .map((s) => ({
      court_id: texto(s?.court_id) || null,
      court_name: texto(s?.court_name) || nomePorId.get(texto(s?.court_id)) || null,
      start_time: texto(s?.start_time) || null,
      end_time: texto(s?.end_time) || null,
      capacity: normalizeCapacity(s?.capacity),
    }))
    .filter((s) => s.court_id);

  const value = {
    title: texto(input.title).slice(0, 80),
    date: texto(input.date) || null,
    notes: texto(input.notes).slice(0, 1000) || null,
    format: Object.values(GAME_DAY_FORMAT).includes(input.format)
      ? input.format
      : GAME_DAY_FORMAT.AMERICANO,
    signup_mode: input.signup_mode === ARENA_SIGNUP_MODE.COURT
      ? ARENA_SIGNUP_MODE.COURT
      : ARENA_SIGNUP_MODE.DAY,
    capacity: normalizeCapacity(input.capacity),
    manage_mode: input.manage_mode === GAME_DAY_MANAGE_MODE.PARTICIPANTS
      ? GAME_DAY_MANAGE_MODE.PARTICIPANTS
      : GAME_DAY_MANAGE_MODE.OWNER_ONLY,
    arena_slots: slots,
  };

  const errors = {};
  if (!value.title) errors.title = 'Dê um nome ao dia de jogo.';
  if (!value.date || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) errors.date = 'Escolha a data.';
  if (slots.length === 0) errors.arena_slots = 'Escolha pelo menos uma quadra.';

  // Horários: cada slot precisa de início e fim, e o fim tem de vir depois.
  const horaRuim = slots.find((s) => {
    const ini = timeToMinutes(s.start_time);
    const fim = timeToMinutes(s.end_time);
    return ini == null || fim == null || fim <= ini;
  });
  if (horaRuim && !errors.arena_slots) {
    errors.arena_slots = `Confira o horário da ${horaRuim.court_name || 'quadra'}: o fim precisa vir depois do início.`;
  }

  // Uma quadra não pode aparecer duas vezes em faixas que se sobrepõem DENTRO
  // do mesmo dia de jogo — seria a arena reservando a si mesma duas vezes.
  if (!errors.arena_slots) {
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        if (slots[i].court_id !== slots[j].court_id) continue;
        if (timeRangesOverlap(slots[i].start_time, slots[i].end_time, slots[j].start_time, slots[j].end_time)) {
          errors.arena_slots = `A ${slots[i].court_name || 'quadra'} aparece duas vezes em horários que se sobrepõem.`;
          break;
        }
      }
      if (errors.arena_slots) break;
    }
  }

  // Limite por quadra só faz sentido quando a inscrição é POR quadra; e teto
  // do dia, quando é no dia. Não é erro — é limpeza, para não gravar um
  // número que a tela nunca vai mostrar e alguém vai jurar que está valendo.
  if (value.signup_mode === ARENA_SIGNUP_MODE.DAY) {
    value.arena_slots = value.arena_slots.map((s) => ({ ...s, capacity: null }));
  } else {
    value.capacity = null;
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

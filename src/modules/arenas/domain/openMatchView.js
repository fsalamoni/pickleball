/**
 * O que cada pessoa vê dos JOGOS ABERTOS — puro, sem React nem Firebase.
 *
 * A mesma lista de vagas aparece em quatro lugares, e cada um responde uma
 * pergunta diferente:
 *
 * | Onde                          | A pergunta                                   |
 * |-------------------------------|----------------------------------------------|
 * | Página da arena (seção)       | tem jogo aqui em que eu caiba?               |
 * | `/arenas/:id/open-match`      | todos os jogos desta arena                    |
 * | Minhas reservas               | em que jogos eu estou, e quem me chamou?      |
 * | Procura-se jogo               | onde tem jogo aberto, em qualquer arena?      |
 * | Central da arena              | quem vem, quem espera, o que já passou        |
 *
 * Antes cada tela fazia a sua conta; a seção nova e as telas antigas passam a
 * sair daqui, para "tem vaga" querer dizer a mesma coisa em todo lugar.
 */

import { getAvailableSpots, slotLevelFit, slotStartMs } from './openMatch.js';
import { WAITLIST_STATUS } from './waitlist.js';

const CANCELADA = 'cancelled';

/** Os formatos da vaga, como a tela os diz. */
export const OPEN_SLOT_FORMAT_LABEL = Object.freeze({
  duplas: 'Duplas', simples: 'Simples', mistas: 'Duplas mistas',
  open: 'Livre', treino: 'Treino',
});

/** A vaga ainda vai acontecer (não cancelada, não começou). */
export function isUpcomingSlot(slot, now = Date.now()) {
  if (!slot || slot.status === CANCELADA) return false;
  const inicio = slotStartMs(slot);
  // Sem hora conhecida, vale a data: hoje ainda conta. A data é a LOCAL — a
  // de UTC viraria amanhã às 21h no Brasil e sumiria com o jogo de hoje.
  if (!Number.isFinite(inicio)) return String(slot.date || '') >= dataLocal(now);
  return inicio >= now;
}

function dataLocal(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Do mais cedo para o mais tarde; sem data vai para o fim. */
export function sortSlotsBySchedule(slots = []) {
  return [...slots].sort((a, b) => (
    `${a.date || '9999'}${a.start || ''}`.localeCompare(`${b.date || '9999'}${b.start || ''}`)
  ));
}

/**
 * Que botão a vaga oferece a esta pessoa agora — a mesma resposta no cartão
 * grande e na linha compacta.
 *
 * | estado           | quando                                             |
 * |------------------|----------------------------------------------------|
 * | `sair`           | já estou no jogo                                   |
 * | `encerrado`      | o jogo já começou (e não estou nele)               |
 * | `na-fila`        | lotado e já estou na fila                          |
 * | `fila`           | lotado — é a hora de oferecer a fila               |
 * | `fora-da-faixa`  | tem vaga, mas o meu nível está fora da faixa        |
 * | `entrar`         | tem vaga e eu caibo                                |
 *
 * LOTADO e ENCERRADO são coisas diferentes: confundi-los escondia a fila.
 *
 * @returns {{ estado: string, vagas: number, motivo?: string }}
 */
export function slotActionState(slot, {
  jaEstou = false, naFila = false, level = null, now = Date.now(),
} = {}) {
  const vagas = getAvailableSpots(slot);
  if (jaEstou) return { estado: 'sair', vagas };
  const inicio = slotStartMs(slot);
  if (Number.isFinite(inicio) && inicio < now) return { estado: 'encerrado', vagas };
  if (vagas <= 0) return { estado: naFila ? 'na-fila' : 'fila', vagas };
  const fit = slotLevelFit(slot, level);
  if (!fit.ok) return { estado: 'fora-da-faixa', vagas, motivo: fit.reason };
  return { estado: 'entrar', vagas };
}

/**
 * A seção da página da arena: o que mostrar, em que ordem.
 *
 * - **chamadas**: a fila de espera me chamou numa vaga DESTA arena. Vem antes
 *   de tudo — tem prazo, e perder o prazo passa a vaga para o próximo.
 * - **meus**: jogos em que já estou.
 * - **destaque**: até `limite` jogos com vaga que eu posso entrar, os que
 *   cabem no meu nível primeiro (e, empatando, o mais cedo). Jogo lotado
 *   também entra, depois dos com vaga — é ali que se oferece a fila.
 * - **total**: quantos jogos futuros há, para o "ver todos".
 *
 * Nível desconhecido não tira ninguém do destaque: a plataforma não inventa
 * nível (mesma regra da peneira da vaga).
 *
 * @param {{ slots?: object[], uid?: string|null, level?: number|null,
 *           waitlist?: object[], limite?: number, now?: number }} p
 */
export function openMatchSectionModel({
  slots = [], uid = null, level = null, waitlist = [], limite = 3, now = Date.now(),
} = {}) {
  const futuras = sortSlotsBySchedule(slots.filter((s) => isUpcomingSlot(s, now)));
  const porId = new Map(futuras.map((s) => [s.id, s]));

  const chamadas = waitlist
    .filter((w) => w.status === WAITLIST_STATUS.NOTIFIED && porId.has(w.slot_id))
    .map((w) => ({ entrada: w, slot: porId.get(w.slot_id) }));

  const estou = (s) => Boolean(uid) && (s.participants || []).includes(uid);
  const meus = futuras.filter(estou);
  const outros = futuras.filter((s) => !estou(s));

  const peso = (s) => {
    const cabe = slotLevelFit(s, level).ok ? 0 : 2;
    const cheio = getAvailableSpots(s) > 0 ? 0 : 1;
    return cabe + cheio;
  };
  // `sort` é estável: dentro do mesmo peso fica a ordem de horário.
  const destaque = [...outros].sort((a, b) => peso(a) - peso(b)).slice(0, Math.max(0, limite));

  return { chamadas, meus, destaque, total: futuras.length, disponiveis: outros.length };
}

/**
 * Os jogos em que eu estou, de todas as arenas (Minhas reservas).
 * @param {object[]} slots vagas em que o uid aparece
 */
export function myUpcomingOpenSlots(slots = [], now = Date.now()) {
  return sortSlotsBySchedule(slots.filter((s) => isUpcomingSlot(s, now)));
}

/**
 * As chamadas da fila que ainda posso responder, com a vaga ao lado.
 * Uma chamada sem vaga conhecida (a vaga foi apagada) não aparece: não há o
 * que confirmar, e um botão para o nada ensina a desconfiar do botão.
 *
 * @param {object[]} waitlist minhas entradas
 * @param {Map<string, object>|object[]} slots vagas conhecidas
 */
export function pendingWaitlistCalls(waitlist = [], slots = [], now = Date.now()) {
  const porId = slots instanceof Map ? slots : new Map(slots.map((s) => [s.id, s]));
  return waitlist
    .filter((w) => w.status === WAITLIST_STATUS.NOTIFIED)
    .map((w) => ({ entrada: w, slot: porId.get(w.slot_id) }))
    .filter(({ slot }) => slot && isUpcomingSlot(slot, now));
}

/**
 * A fila de cada vaga, para a Central: quantos esperam e quem foi chamado.
 * @param {object[]} entries entradas da fila da arena
 * @returns {Map<string, { esperando: number, chamado: object|null, nomes: string[] }>}
 */
export function waitlistBySlot(entries = []) {
  const mapa = new Map();
  entries.forEach((e) => {
    if (!e?.slot_id) return;
    const atual = mapa.get(e.slot_id) || { esperando: 0, chamado: null, nomes: [] };
    if (e.status === WAITLIST_STATUS.WAITING) {
      atual.esperando += 1;
      if (e.athlete_name) atual.nomes.push(e.athlete_name);
    }
    if (e.status === WAITLIST_STATUS.NOTIFIED) atual.chamado = e;
    mapa.set(e.slot_id, atual);
  });
  return mapa;
}

/**
 * As vagas das arenas para quem procura jogo (Procura-se jogo): só as que
 * ainda aceitam gente e das arenas que mantêm o módulo ligado.
 *
 * @param {object[]} slots vagas abertas de todas as arenas
 * @param {(arenaId: string) => boolean} arenaAtiva a arena mantém o jogo aberto ligado?
 */
export function openSlotsForDiscovery(slots = [], arenaAtiva = () => true, now = Date.now()) {
  return sortSlotsBySchedule(slots.filter((s) => (
    isUpcomingSlot(s, now) && getAvailableSpots(s) > 0 && arenaAtiva(s.arena_id)
  )));
}

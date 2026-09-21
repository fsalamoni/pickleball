/**
 * Dia de jogo do CLUBE — o mesmo módulo, nascido de um evento de clube.
 *
 * ## O problema que isto resolve
 *
 * O dia de jogo existia em duas casas diferentes. O do atleta e o da arena
 * moram em `game_days/{id}` (com `participants` e `games` como subcoleções); o
 * do clube morava — e o LEGADO segue morando — em
 * `club_events/{eventId}/{participants,games}`, com `date_id` separando um dia
 * do outro. Duas casas significam duas telas, e duas telas divergem: o painel
 * do atleta ganhou Play, Americano aprimorado, telão e tutorial, e o do clube
 * ficou só no sorteio de grade — sem nada avisando quem organizava.
 *
 * A partir da Onda AS, um dia de jogo NOVO de clube é um `game_days` como
 * qualquer outro. O que muda é só a ORIGEM, e origem pode mudar três coisas:
 *
 *  1. **onde grava** — aqui não muda mais nada: grava em `game_days`;
 *  2. **quem organiza** — quem criou a data, os administradores nomeados e
 *     quem administra o CLUBE (campo `club_id`, conferido na regra);
 *  3. **o que o local acrescenta** — o clube tem RSVP por data, chat e a lista
 *     de membros; isso continua no evento e entra no dia de jogo como atalho.
 *
 * ## Legado: nada é migrado
 *
 * Um dia de jogo antigo de clube não tem `game_day_id` na sua data
 * (`club_events/{eventId}/dates/{dateId}`). É exatamente esse campo — aditivo,
 * opcional — que separa o novo do antigo: presente, a tela abre o módulo;
 * ausente, abre o organizador de sempre, com os mesmos dados no mesmo lugar.
 * Nenhum documento já publicado é lido, reescrito ou movido.
 *
 * Lógica pura: sem React, sem Firebase.
 */

import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';
import { GAME_DAY_MANAGE_MODE } from './gameDayRoles.js';

/** Limites do título gerado (o mesmo teto de `normalizeGameDayInput`). */
export const CLUB_GAME_DAY_TITLE_MAX = 80;

/** O dia de jogo pertence a um clube? (campo aditivo: ausente ⇒ não). */
export function isClubGameDay(gameDay) {
  return typeof gameDay?.club_id === 'string' && gameDay.club_id.length > 0;
}

/**
 * A data do evento já foi transformada em módulo?
 *
 * É a ÚNICA pergunta que separa o novo do legado. Sem `game_day_id`, a data é
 * legado e continua sendo servida pelo organizador antigo — inclusive as datas
 * criadas antes desta onda, que é o que o pedido exige.
 */
export function isModularEventDate(date) {
  return typeof date?.game_day_id === 'string' && date.game_day_id.length > 0;
}

/**
 * Uma data LEGADA pode ser convertida para o módulo sem perder nada?
 *
 * ## A regra, e por que ela é esta
 *
 * O legado não é migrado — nem aqui. As duas casas guardam em lugares
 * diferentes (`club_events/{id}/{participants,games}` contra
 * `game_days/{id}/…`), então converter uma data que JÁ TEM gente inscrita ou
 * jogo lançado esconderia esses documentos da tela: eles continuariam no banco,
 * intactos, mas ninguém mais os veria — e um dia de jogo já publicado costuma
 * estar no ranking de quem jogou.
 *
 * Só que existe um caso em que **não há nada para mover**: a data ainda VAZIA.
 * Aí a conversão não é migração, é escolher a casa antes de entrar nela — e é o
 * que deixa uma data agendada há meses receber Play, Americano aprimorado,
 * telão, tutorial, administradores nomeados e as configurações do dia.
 *
 * As contagens são SEMPRE recortadas por `date_id`: um evento semanal tem
 * dezenas de datas no mesmo `club_events/{id}`, e olhar o evento inteiro
 * reprovaria uma data vazia por causa de outra que já foi jogada.
 *
 * @param {object} args
 * @param {string} args.dateId
 * @param {Array<{date_id?: string|null}>} [args.participants] do EVENTO inteiro
 * @param {Array<{date_id?: string|null}>} [args.games]        do EVENTO inteiro
 * @returns {{ ok: boolean, motivo: string|null, participantes: number, jogos: number }}
 */
export function canUpgradeLegacyDate({ dateId, participants = [], games = [] } = {}) {
  const daData = (lista) => (Array.isArray(lista) ? lista : [])
    .filter((x) => (x?.date_id || null) === (dateId || null));

  const participantes = daData(participants).length;
  const jogos = daData(games).length;

  if (jogos > 0) {
    return {
      ok: false,
      motivo: 'Esta data já tem partidas registradas. Convertê-la esconderia o que já foi jogado.',
      participantes,
      jogos,
    };
  }
  if (participantes > 0) {
    return {
      ok: false,
      motivo: 'Esta data já tem atletas inseridos. Convertê-la esconderia a lista de quem está nela.',
      participantes,
      jogos,
    };
  }
  return { ok: true, motivo: null, participantes, jogos };
}

/**
 * Quebra o `date_time` do evento (`datetime-local`, sem fuso) em `date` e
 * `time`, que é como o dia de jogo guarda.
 *
 * Feito por texto de propósito: passar por `new Date()` reintroduziria o fuso
 * e faria um jogo das 19h de sexta virar sábado em parte do país.
 *
 * @param {string|null} value ex.: '2026-09-25T19:00'
 * @returns {{ date: string|null, time: string|null }}
 */
export function splitEventDateTime(value) {
  const bruto = String(value ?? '').trim();
  if (!bruto) return { date: null, time: null };
  const m = bruto.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!m) return { date: null, time: null };
  return { date: m[1], time: m[2] || null };
}

/** `2026-09-25` → `25/09`. Vazio quando a data não serve. */
export function shortDateBR(isoDate) {
  const m = String(isoDate ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : '';
}

/**
 * Título do dia de jogo criado a partir de uma data do evento.
 *
 * O nome do evento sozinho não serve: um evento semanal gera dezenas de dias
 * de jogo, e na lista do atleta todos apareceriam com o mesmo nome.
 */
export function clubGameDayTitle(eventTitle, dateTime) {
  const base = String(eventTitle ?? '').trim() || 'Dia de jogo';
  const { date } = splitEventDateTime(dateTime);
  const curto = shortDateBR(date);
  const cheio = curto ? `${base} — ${curto}` : base;
  return cheio.slice(0, CLUB_GAME_DAY_TITLE_MAX);
}

/**
 * Normaliza o que a tela do clube preencheu para o formato do `game_days`.
 *
 * Só monta os campos que a ORIGEM decide; o resto (visibilidade, membros,
 * status) é do serviço, como no dia de jogo da arena.
 *
 * @param {object} input `{ date_time, location, note, format, play_courts, manage_mode }`
 * @param {{ event?: object }} [ctx]
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeClubGameDayInput(input = {}, { event = null } = {}) {
  const { date, time } = splitEventDateTime(input.date_time);
  const formato = Object.values(GAME_DAY_FORMAT).includes(input.format)
    ? input.format
    : GAME_DAY_FORMAT.AMERICANO;
  const value = {
    title: clubGameDayTitle(event?.title, input.date_time),
    date,
    time,
    location: String(input.location ?? '').trim().slice(0, 160) || null,
    notes: String(input.note ?? '').trim().slice(0, 500) || null,
    format: formato,
    play_courts: input.play_courts,
    // O padrão do clube é COLABORATIVO, e não por comodidade: no evento de
    // clube legado qualquer membro mexia em participantes e jogos. Nascer
    // restrito seria tirar da comunidade algo que ela já tinha.
    manage_mode: input.manage_mode === GAME_DAY_MANAGE_MODE.OWNER_ONLY
      ? GAME_DAY_MANAGE_MODE.OWNER_ONLY
      : GAME_DAY_MANAGE_MODE.PARTICIPANTS,
  };

  const errors = {};
  if (!value.date) errors.date_time = 'Informe a data e o horário.';

  return { valid: Object.keys(errors).length === 0, errors, value };
}

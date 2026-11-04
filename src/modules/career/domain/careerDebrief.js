/**
 * O BALANÇO do torneio de fora (camada 4 da ficha, docs/54 §4.4): o mesmo
 * balanço do jogo (`training_debriefs`, docs/42), com a origem `externo` e o
 * `ref_id` = id do `career_events`. Um balanço por torneio — o id é
 * `{uid}_externo_{eventoId}`, montado por `debriefId`.
 *
 * Não vira pendência: o torneio de fora é quase sempre retroativo, então o
 * convite é o botão na ficha. PURO.
 *
 * Não importa `training/domain/debrief.js` de propósito: este arquivo chega à
 * estante de troféus (perfil, Minha área) pela linha do tempo, e o domínio do
 * balanço puxaria a biblioteca de treino junto. Os dois valores abaixo são
 * cópias com teste de paridade (`careerDebrief.test.js`).
 */
import { isISODate } from '@/modules/training/domain/dates.js';
import { CAREER_STATUS } from './careerEvent.js';

/** `DEBRIEF_SOURCE.EXTERNO` (gravado; a regra confere). */
export const CAREER_DEBRIEF_TYPE = 'externo';
/** `DEBRIEF_STATUS.RESPONDIDO`. */
export const CAREER_DEBRIEF_DONE = 'respondido';
const RESPONDIDO = CAREER_DEBRIEF_DONE;

/**
 * A origem do balanço de um torneio JOGADO (`null` para planejado, cancelado
 * ou sem id). Jogos e vitórias ficam em branco: o torneio de fora não os tem.
 * `dateLabel` é só para a tela (o modo lista sabe só o ano) e não é gravado.
 */
export function careerDebriefSource(event) {
  if (!event?.id || event.status !== CAREER_STATUS.PLAYED || !isISODate(event.start_date)) return null;
  const soAno = event.date_precision === 'year';
  return {
    type: CAREER_DEBRIEF_TYPE,
    ref_id: event.id,
    title: String(event.name || '').trim(),
    date: !soAno && isISODate(event.end_date) ? event.end_date : event.start_date,
    games: null,
    wins: null,
    dateLabel: soAno ? String(event.start_date).slice(0, 4) : null,
  };
}

/** `training_debriefs` (cópia do nome da coleção, pelo mesmo motivo). */
export const CAREER_DEBRIEF_COLLECTION = 'training_debriefs';

/** O id do balanço do torneio — o mesmo que `debriefId` monta (teste de paridade). */
export const careerDebriefDocId = (uid, eventId) => `${uid}_${CAREER_DEBRIEF_TYPE}_${eventId}`;

/** O balanço RESPONDIDO deste torneio, ou `null`. */
export function careerDebriefFor(event, debriefs = []) {
  if (!careerDebriefSource(event)) return null;
  return (debriefs || []).find((d) => d?.status === RESPONDIDO
    && d.source?.type === CAREER_DEBRIEF_TYPE && d.source?.ref_id === event.id) || null;
}

/**
 * MINHA CARREIRA — os HÁBITOS que a gamificação conta (docs/54 §9, docs/38).
 *
 * A gamificação premia REGISTRAR, REFLETIR e COMPLETAR — nunca o resultado
 * declarado. Este arquivo é a ÚNICA porta entre a carreira e o motor de XP:
 *  - `isCompleteCareerRecord` diz se a FICHA está completa (resultado + foto +
 *    balanço), a mesma régua da concessão de XP do servidor
 *    (`functions/careerXp.js`, paridade em `careerHabits.test.js`);
 *  - `careerHabitCounts` devolve só CONTAGENS de hábito. A colocação entra
 *    apenas como "foi preenchida?" — campeão e fase de grupos contam igual
 *    (guarda `src/core/guards/carreiraNaoPontua.test.js`).
 *
 * PURO e leve de propósito (só literais): o motor de XP o importa, e puxar o
 * domínio inteiro da carreira poria a carreira no pacote de toda tela.
 * Os literais são cópias com teste de paridade contra `careerEvent.js`,
 * `careerDebrief.js` e `progression.js`.
 */

/** `CAREER_STATUS.PLAYED`. */
const PLAYED = 'played';
/** `CAREER_DEBRIEF_TYPE` / `CAREER_DEBRIEF_DONE`. */
const EXTERNO = 'externo';
const RESPONDIDO = 'respondido';
/** `GOAL_KIND.PROCESS` / `GOAL_STATUS.DONE`. */
const PROCESSO = 'process';
const CONCLUIDA = 'done';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** O balanço RESPONDIDO do torneio de fora `eventId` desta pessoa? */
export function isCareerDebriefDone(debrief, eventId, uid) {
  return Boolean(debrief && debrief.status === RESPONDIDO && debrief.source && debrief.source.type === EXTERNO
    && debrief.source.ref_id === eventId && (!uid || debrief.uid === uid));
}

/**
 * A ficha do torneio JOGADO está completa? Resultado (toda participação com a
 * colocação preenchida) + ao menos uma foto + o balanço respondido. A dupla
 * não entra: é a régua do plano (§7.1). `hoje` (AAAA-MM-DD) recusa o futuro.
 * O VALOR da colocação nunca importa — só se foi dita.
 */
export function isCompleteCareerRecord(ev, debrief, hoje) {
  if (!ev || ev.status !== PLAYED || !ISO.test(String(ev.start_date || ''))) return false;
  if (hoje && ev.start_date > hoje) return false;
  const entries = Array.isArray(ev.entries) ? ev.entries : [];
  if (!entries.length || !entries.every((e) => Boolean(e && e.placement))) return false;
  // Foto de verdade: um arquivo na pasta da pessoa (a regra do registro é rasa).
  const pasta = `carreira/${ev.uid}/`;
  if (!Array.isArray(ev.photos) || !ev.photos.some((p) => String((p && p.path) || '').startsWith(pasta))) return false;
  return isCareerDebriefDone(debrief, ev.id, ev.uid);
}

/**
 * As contagens de hábito da carreira, para as conquistas da família
 * "Carreira". `events`/`goals` são as listas da própria pessoa;
 * `debriefs` os balanços dela (os de torneio de fora são filtrados aqui).
 *
 * @returns {{ records: number, completeRecords: number, debriefs: number, processGoalsDone: number }}
 */
export function careerHabitCounts({ events = [], goals = [], debriefs = [], hoje } = {}) {
  const lista = (v) => (Array.isArray(v) ? v : []);
  const externos = new Map();
  lista(debriefs).forEach((d) => {
    if (d && d.status === RESPONDIDO && d.source && d.source.type === EXTERNO && d.source.ref_id) externos.set(d.source.ref_id, d);
  });
  const jogados = lista(events).filter((ev) => ev && ev.status === PLAYED);
  return {
    records: jogados.length,
    completeRecords: jogados.filter((ev) => isCompleteCareerRecord(ev, externos.get(ev.id), hoje)).length,
    debriefs: jogados.filter((ev) => externos.has(ev.id)).length,
    processGoalsDone: lista(goals).filter((g) => g && g.kind === PROCESSO
      && (g.status === CONCLUIDA || Number(g.progress_manual) >= 100)).length,
  };
}

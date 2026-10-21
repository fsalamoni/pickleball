/**
 * Reuniões e assembleias do calendário oficial — a conta PURA (sem banco):
 * a convocação (data, edital, quórum, pauta) e o resultado (presença,
 * chamada, quórum, o que se decidiu em cada item, documentos).
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/meeting.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationMeeting.parity.test.js`. Os ids são GRAVADOS: nunca renomeie.
 */
const MEETING_ITEMS_MAX = 40;
const MEETING_ITEM_TITLE_MAX = 200;
const MEETING_ITEM_TEXT_MAX = 1000;
const MEETING_QUORUM_MAX = 300;
const MEETING_NOTES_MAX = 2000;
const MEETING_VOTES_MAX = 1000000;
const CONVOCATION_DAYS_DEFAULT = 8;
const BR_OFFSET_MS = 3 * 3600000;

const ITEM_KIND_IDS = ['deliberation', 'election', 'information'];
const ITEM_RESULTS = Object.freeze({
  approved: ['deliberation'], rejected: ['deliberation'], elected: ['election'], informed: ['information'],
  postponed: ['deliberation', 'election', 'information'], withdrawn: ['deliberation', 'election', 'information'],
});
const SEM_QUORUM = ['postponed', 'withdrawn'];
/** Só resultado votado guarda votos. */
const COM_VOTO = ['approved', 'rejected', 'elected'];
const CALL_IDS = ['first', 'second'];
const MEETING_DOC_TYPES = Object.freeze({ edital: ['convocation', 'notice'], minutes: ['minutes'], attendance: ['attendance'], votes: ['vote_record'] });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOC_ID = /^[A-Za-z0-9]{1,80}$/;

const limpa = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const limpaTexto = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const docId = (v) => (DOC_ID.test(String(v || '')) ? String(v) : '');
const inteiro = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MEETING_VOTES_MAX ? n : NaN;
};
const todayBr = (nowMs = Date.now()) => new Date(nowMs - BR_OFFSET_MS).toISOString().slice(0, 10);

function validateConvocation(input = {}, { eventDate = '', nowMs = Date.now() } = {}) {
  const errors = {};
  const convenedOn = String(input.convened_on || '');
  if (!ISO.test(convenedOn)) errors.convened_on = 'Informe a data da convocação.';
  else if (convenedOn > todayBr(nowMs)) errors.convened_on = 'A convocação não pode ter data futura.';
  else if (eventDate && convenedOn > eventDate) errors.convened_on = 'A convocação vem antes da reunião.';
  const secondCall = String(input.second_call_time || '');
  if (secondCall && !HHMM.test(secondCall)) errors.second_call_time = 'Horário da segunda chamada inválido.';
  const brutos = Array.isArray(input.items) ? input.items : [];
  const items = brutos
    .map((it) => ({ title: limpa(it && it.title, MEETING_ITEM_TITLE_MAX), description: limpaTexto(it && it.description, MEETING_ITEM_TEXT_MAX), kind: ITEM_KIND_IDS.includes(it && it.kind) ? it.kind : 'deliberation' }))
    .filter((it) => it.title || it.description);
  if (!items.length) errors.items = 'A pauta precisa de pelo menos um item.';
  else if (items.length > MEETING_ITEMS_MAX) errors.items = `No máximo ${MEETING_ITEMS_MAX} itens na pauta.`;
  else if (items.some((it) => !it.title)) errors.items = 'Todo item da pauta precisa de um título.';
  const value = {
    convened_on: convenedOn,
    edital_doc_id: docId(input.edital_doc_id),
    quorum_first: limpa(input.quorum_first, MEETING_QUORUM_MAX),
    second_call_time: secondCall,
    quorum_second: limpa(input.quorum_second, MEETING_QUORUM_MAX),
    items: items.slice(0, MEETING_ITEMS_MAX).map((it, i) => ({ id: `p${i + 1}`, ...it })),
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

function validateRecord(input = {}, pauta = []) {
  const errors = {};
  const call = CALL_IDS.includes(input.call) ? input.call : '';
  if (!call) errors.call = 'Diga em que chamada a reunião começou.';
  const openedAt = String(input.opened_at || '');
  if (openedAt && !HHMM.test(openedAt)) errors.opened_at = 'Horário de abertura inválido.';
  const quorum = input.quorum_reached !== false;
  const present = inteiro(input.present);
  if (present === null || Number.isNaN(present)) errors.present = 'Informe quantos estavam presentes.';
  const eligible = inteiro(input.eligible);
  if (Number.isNaN(eligible)) errors.eligible = 'Número de aptos inválido.';
  else if (eligible !== null && Number.isInteger(present) && present > eligible) errors.eligible = 'Presentes não podem passar dos aptos.';
  const entradas = Array.isArray(input.items) ? input.items : [];
  const items = (pauta || []).map((p, i) => {
    const e = entradas.find((x) => x && x.id === p.id) || entradas[i] || {};
    const result = ITEM_RESULTS[e.result] && ITEM_RESULTS[e.result].includes(p.kind) ? e.result : '';
    const v = e.votes && typeof e.votes === 'object' ? e.votes : null;
    const votos = v && COM_VOTO.includes(result) ? { yes: inteiro(v.yes), no: inteiro(v.no), abstain: inteiro(v.abstain) } : null;
    const temVoto = votos && Object.values(votos).some((n) => n !== null);
    if (!result) errors[`item_${p.id}`] = `Diga o resultado do item ${i + 1}.`;
    else if (!quorum && !SEM_QUORUM.includes(result)) errors[`item_${p.id}`] = `Sem quórum nada se decide: o item ${i + 1} fica adiado ou sai da pauta.`;
    if (temVoto && Object.values(votos).some((n) => Number.isNaN(n))) errors[`item_${p.id}`] = `Votos inválidos no item ${i + 1}.`;
    return {
      id: p.id, result,
      votes: temVoto && !Object.values(votos).some((n) => Number.isNaN(n)) ? { yes: votos.yes || 0, no: votos.no || 0, abstain: votos.abstain || 0 } : null,
      summary: limpaTexto(e.summary, MEETING_ITEM_TEXT_MAX),
      doc_id: docId(e.doc_id),
    };
  });
  if (!items.length) errors.items = 'A reunião não tem pauta: convoque antes de registrar o resultado.';
  const value = {
    call, opened_at: openedAt, quorum_reached: quorum,
    present: Number.isInteger(present) ? present : 0,
    eligible: Number.isInteger(eligible) ? eligible : null,
    items,
    notes: limpaTexto(input.notes, MEETING_NOTES_MAX),
    minutes_doc_id: docId(input.minutes_doc_id),
    attendance_doc_id: docId(input.attendance_doc_id),
    votes_doc_id: docId(input.votes_doc_id),
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

module.exports = {
  MEETING_ITEMS_MAX, MEETING_ITEM_TITLE_MAX, MEETING_ITEM_TEXT_MAX, MEETING_QUORUM_MAX, MEETING_NOTES_MAX, MEETING_VOTES_MAX,
  CONVOCATION_DAYS_DEFAULT, ITEM_KIND_IDS, ITEM_RESULTS, CALL_IDS, MEETING_DOC_TYPES,
  todayBr, validateConvocation, validateRecord,
};

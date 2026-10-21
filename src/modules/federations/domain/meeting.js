/**
 * REUNIÕES E ASSEMBLEIAS do calendário oficial (módulo `calendar`) — lógica
 * pura. Vale para os eventos de tipo `meeting` (assembleias, diretoria,
 * conselho fiscal, comissões): a CONVOCAÇÃO (data, edital do acervo, quórum
 * e a pauta) e o RESULTADO (presença, chamada, quórum, o que se decidiu em
 * cada item, a ata, a lista de presença e o registro de votação).
 *
 * Tudo mora no próprio `federation_events` (campo `meeting`), que SÓ o
 * servidor grava (`functions/federationAgenda.js`, ações `convene` e
 * `record`). Mudar a pauta depois de convocar e corrigir um resultado já
 * publicado pedem motivo e entram no histórico do evento.
 *
 * O prazo mínimo de convocação vem do estatuto (`federations.rules.
 * convocation_min_days`, padrão 8 dias): fora do prazo a tela AVISA, mas não
 * bloqueia — o estatuto pode ter exceção de urgência.
 *
 * ⚠️ Os ids de tipo de item, resultado e chamada são GRAVADOS: nunca
 * renomeie. A validação tem cópia no servidor
 * (`functions/federationMeetingPolicy.js`, paridade em
 * `federationMeeting.parity.test.js`).
 */
import { t, tk } from '@/core/i18n';

export const MEETING_ITEMS_MAX = 40;
export const MEETING_ITEM_TITLE_MAX = 200;
export const MEETING_ITEM_TEXT_MAX = 1000;
export const MEETING_QUORUM_MAX = 300;
export const MEETING_NOTES_MAX = 2000;
export const MEETING_VOTES_MAX = 1000000;
export const CONVOCATION_DAYS_DEFAULT = 8;
const BR_OFFSET_MS = 3 * 3600000;
const DAY_MS = 86400000;

/** O que o item da pauta pede: deliberar (votar), eleger ou só informar. */
export const ITEM_KINDS = Object.freeze([
  { id: 'deliberation', label: tk('Deliberação') },
  { id: 'election', label: tk('Eleição') },
  { id: 'information', label: tk('Informe') },
]);

/** Resultado possível de cada tipo de item. */
export const ITEM_RESULTS = Object.freeze({
  approved: { label: tk('Aprovado'), kinds: ['deliberation'] },
  rejected: { label: tk('Rejeitado'), kinds: ['deliberation'] },
  elected: { label: tk('Eleição realizada'), kinds: ['election'] },
  informed: { label: tk('Informado'), kinds: ['information'] },
  postponed: { label: tk('Adiado'), kinds: ['deliberation', 'election', 'information'] },
  withdrawn: { label: tk('Retirado da pauta'), kinds: ['deliberation', 'election', 'information'] },
});
/** Sem quórum não se decide nada: o item fica adiado ou sai da pauta. */
const SEM_QUORUM = ['postponed', 'withdrawn'];
/** Só resultado votado guarda votos. */
const COM_VOTO = ['approved', 'rejected', 'elected'];

export const MEETING_CALLS = Object.freeze([
  { id: 'first', label: tk('Primeira chamada') },
  { id: 'second', label: tk('Segunda chamada') },
]);

/** Os documentos do acervo que a reunião aceita em cada lugar (tipos do acervo). */
export const MEETING_DOC_TYPES = Object.freeze({
  edital: ['convocation', 'notice'],
  minutes: ['minutes'],
  attendance: ['attendance'],
  votes: ['vote_record'],
});

const ITEM_KIND_IDS = ITEM_KINDS.map((k) => k.id);
const CALL_IDS = MEETING_CALLS.map((c) => c.id);
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

/** Hoje em Brasília (`2026-11-05`). */
export const todayBr = (nowMs = Date.now()) => new Date(nowMs - BR_OFFSET_MS).toISOString().slice(0, 10);
const utcDia = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diasEntre = (de, ate) => Math.round((utcDia(ate) - utcDia(de)) / DAY_MS);

export const itemKind = (id) => ITEM_KINDS.find((k) => k.id === id) || null;
export const resultsFor = (kind) => Object.entries(ITEM_RESULTS).filter(([, r]) => r.kinds.includes(kind)).map(([id, r]) => ({ id, label: r.label }));

/**
 * A convocação: data (≤ hoje e ≤ a data da reunião), edital (opcional),
 * quórum de 1ª e 2ª chamada e a pauta (1 a 40 itens). Os itens ganham id
 * pela posição (`p1`, `p2`…) — a pauta só muda antes do resultado.
 */
export function validateConvocation(input = {}, { eventDate = '', nowMs = Date.now() } = {}) {
  const errors = {};
  const convenedOn = String(input.convened_on || '');
  if (!ISO.test(convenedOn)) errors.convened_on = t('Informe a data da convocação.');
  else if (convenedOn > todayBr(nowMs)) errors.convened_on = t('A convocação não pode ter data futura.');
  else if (eventDate && convenedOn > eventDate) errors.convened_on = t('A convocação vem antes da reunião.');
  const secondCall = String(input.second_call_time || '');
  if (secondCall && !HHMM.test(secondCall)) errors.second_call_time = t('Horário da segunda chamada inválido.');
  const brutos = Array.isArray(input.items) ? input.items : [];
  const items = brutos
    .map((it) => ({ title: limpa(it?.title, MEETING_ITEM_TITLE_MAX), description: limpaTexto(it?.description, MEETING_ITEM_TEXT_MAX), kind: ITEM_KIND_IDS.includes(it?.kind) ? it.kind : 'deliberation' }))
    .filter((it) => it.title || it.description);
  if (!items.length) errors.items = t('A pauta precisa de pelo menos um item.');
  else if (items.length > MEETING_ITEMS_MAX) errors.items = t('No máximo {n} itens na pauta.', { n: MEETING_ITEMS_MAX });
  else if (items.some((it) => !it.title)) errors.items = t('Todo item da pauta precisa de um título.');
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

/**
 * O resultado: chamada, horário de abertura, quórum atingido, presentes e
 * aptos, o que se decidiu em cada item da pauta (na mesma ordem), votos
 * (opcionais), resumo, ato que saiu dele e os documentos da reunião.
 */
export function validateRecord(input = {}, pauta = []) {
  const errors = {};
  const call = CALL_IDS.includes(input.call) ? input.call : '';
  if (!call) errors.call = t('Diga em que chamada a reunião começou.');
  const openedAt = String(input.opened_at || '');
  if (openedAt && !HHMM.test(openedAt)) errors.opened_at = t('Horário de abertura inválido.');
  const quorum = input.quorum_reached !== false;
  const present = inteiro(input.present);
  if (present === null || Number.isNaN(present)) errors.present = t('Informe quantos estavam presentes.');
  const eligible = inteiro(input.eligible);
  if (Number.isNaN(eligible)) errors.eligible = t('Número de aptos inválido.');
  else if (eligible !== null && Number.isInteger(present) && present > eligible) errors.eligible = t('Presentes não podem passar dos aptos.');
  const entradas = Array.isArray(input.items) ? input.items : [];
  const items = (pauta || []).map((p, i) => {
    const e = entradas.find((x) => x && x.id === p.id) || entradas[i] || {};
    const result = ITEM_RESULTS[e.result]?.kinds.includes(p.kind) ? e.result : '';
    const v = e.votes && typeof e.votes === 'object' ? e.votes : null;
    const votos = v && COM_VOTO.includes(result) ? { yes: inteiro(v.yes), no: inteiro(v.no), abstain: inteiro(v.abstain) } : null;
    const temVoto = votos && Object.values(votos).some((n) => n !== null);
    if (!result) errors[`item_${p.id}`] = t('Diga o resultado do item {n}.', { n: i + 1 });
    else if (!quorum && !SEM_QUORUM.includes(result)) errors[`item_${p.id}`] = t('Sem quórum nada se decide: o item {n} fica adiado ou sai da pauta.', { n: i + 1 });
    if (temVoto && Object.values(votos).some((n) => Number.isNaN(n))) errors[`item_${p.id}`] = t('Votos inválidos no item {n}.', { n: i + 1 });
    return {
      id: p.id, result,
      votes: temVoto && !Object.values(votos).some((n) => Number.isNaN(n)) ? { yes: votos.yes || 0, no: votos.no || 0, abstain: votos.abstain || 0 } : null,
      summary: limpaTexto(e.summary, MEETING_ITEM_TEXT_MAX),
      doc_id: docId(e.doc_id),
    };
  });
  if (!items.length) errors.items = t('A reunião não tem pauta: convoque antes de registrar o resultado.');
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

/* -------------------------------------------------------- para a tela -- */

export const isMeetingRecorded = (ev) => Boolean(ev?.meeting?.record);
export const isMeetingConvened = (ev) => Boolean(ev?.meeting?.convened_on);

/**
 * A antecedência da convocação: dias entre a convocação e a reunião, o
 * mínimo do estatuto e se ficou abaixo dele (`late`). `null` sem convocação.
 */
export function convocationNotice(ev, minDays = CONVOCATION_DAYS_DEFAULT) {
  const de = ev?.meeting?.convened_on;
  if (!ISO.test(String(de || '')) || !ISO.test(String(ev?.date || ''))) return null;
  const days = diasEntre(de, ev.date);
  const min = Number.isFinite(Number(minDays)) ? Math.max(0, Math.trunc(Number(minDays))) : CONVOCATION_DAYS_DEFAULT;
  return { days, min, late: days < min };
}

/** O que dá para fazer na reunião: convocar/mudar a pauta (antes do resultado) e registrar/corrigir o resultado (depois de começar). */
export function meetingActions(ev, { canManage = false, isMeeting = false, nowMs = Date.now() } = {}) {
  const nada = { convene: false, record: false };
  if (!ev || ev.derived || !canManage || !isMeeting || ev.status === 'cancelled') return nada;
  const gravado = isMeetingRecorded(ev);
  const comecou = (Number(ev.starts_at_ms) || 0) <= nowMs;
  return {
    convene: !gravado && ev.status !== 'postponed',
    record: isMeetingConvened(ev) && comecou && ev.status === 'scheduled',
  };
}

/** Contagem dos resultados (para o resumo "3 aprovados, 1 adiado"). */
export function recordTally(record) {
  const out = {};
  (record?.items || []).forEach((it) => { if (it.result) out[it.result] = (out[it.result] || 0) + 1; });
  return out;
}

/** Formulário da convocação a partir do evento (ou em branco, com a data de hoje). */
export function convocationDraft(ev, nowMs = Date.now()) {
  const m = ev?.meeting || {};
  return {
    convened_on: m.convened_on || todayBr(nowMs),
    edital_doc_id: m.edital?.doc_id || '',
    quorum_first: m.quorum_first || '',
    second_call_time: m.second_call_time || '',
    quorum_second: m.quorum_second || '',
    items: (m.items && m.items.length ? m.items : [{ title: '', description: '', kind: 'deliberation' }]).map((it) => ({ title: it.title || '', description: it.description || '', kind: it.kind || 'deliberation' })),
  };
}

/** Formulário do resultado a partir do evento (ou em branco, com um item por ponto da pauta). */
export function recordDraft(ev) {
  const r = ev?.meeting?.record || {};
  const porId = new Map((r.items || []).map((x) => [x.id, x]));
  const votoTexto = (n) => (n == null ? '' : String(n));
  return {
    call: r.call || 'first', opened_at: r.opened_at || '', quorum_reached: r.quorum_reached !== false,
    present: r.present == null ? '' : String(r.present), eligible: r.eligible == null ? '' : String(r.eligible),
    items: (ev?.meeting?.items || []).map((p) => {
      const x = porId.get(p.id) || {};
      return { id: p.id, result: x.result || '', votes: { yes: votoTexto(x.votes?.yes), no: votoTexto(x.votes?.no), abstain: votoTexto(x.votes?.abstain) }, summary: x.summary || '', doc_id: x.doc?.doc_id || '' };
    }),
    notes: r.notes || '',
    minutes_doc_id: r.minutes?.doc_id || '', attendance_doc_id: r.attendance?.doc_id || '', votes_doc_id: r.votes?.doc_id || '',
  };
}

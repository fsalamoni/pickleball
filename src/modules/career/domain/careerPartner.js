/**
 * MINHA CARREIRA — a DUPLA confirma e comenta (`career_partner`, docs/54 §6).
 *
 * PURO (sem React, sem Firebase). O documento `career_partner/{evento}__{dupla}`
 * só o SERVIDOR escreve (`functions/career.js`); aqui ficam:
 *  - os valores GRAVADOS (status, decisão, motivo da denúncia) — nunca renomeie;
 *  - a régua que o servidor também aplica (cópia em `functions/careerPolicy.js`,
 *    com teste de paridade): em quais participações a pessoa foi citada, a
 *    IMPRESSÃO do que se confirma (datas + categorias + colocação — o NOME do
 *    torneio não entra: corrigir "Copa Sul" para "Copa do Sul" não pede nova
 *    confirmação), maioridade e a visão da dupla normalizada;
 *  - o que a tela deriva: o selo da dupla, as pendências, a "voz da dupla" que
 *    pesa no foco do balanço, o "Pôr na minha carreira também" e o "Com quem
 *    você já jogou".
 *
 * Não importa `training/domain/debrief.js` de propósito (o selo chega à estante
 * pela linha do tempo, e o balanço puxaria a biblioteca de treino): os ids dos
 * aspectos são uma CÓPIA com teste de paridade (`careerPartner.test.js`).
 */
import { t, tk } from '@/core/i18n';
import { CAREER_FORMAT, CAREER_STATUS } from './careerEvent.js';

export const CAREER_PARTNER = 'career_partner';

/** Status do pedido. Gravado: nunca renomeie. */
export const PARTNER_STATUS = Object.freeze({
  INVITED: 'invited', CONFIRMED: 'confirmed', DECLINED: 'declined', RECONFIRM: 'reconfirm',
});
export const PARTNER_STATUS_LABEL = Object.freeze({
  invited: tk('Aguardando a dupla'),
  confirmed: tk('Confirmado pela dupla'),
  declined: tk('A dupla não confirmou'),
  reconfirm: tk('Aguardando a dupla confirmar de novo'),
});

/** O que o dono faz com a visão da dupla. Gravado. */
export const OWNER_DECISION = Object.freeze({ PENDING: 'pending', USE: 'use', KEEP: 'keep' });

/** Motivos da denúncia. Gravado. */
export const PARTNER_REPORT_REASONS = Object.freeze(['offensive', 'false_claim', 'personal_data', 'other']);
export const PARTNER_REPORT_LABEL = Object.freeze({
  offensive: tk('Ofensivo ou desrespeitoso'),
  false_claim: tk('Não jogamos juntos'),
  personal_data: tk('Expõe dado pessoal'),
  other: tk('Outro motivo'),
});

/** Ids de `GAME_ASPECTS` (training/domain/debrief.js) — cópia com paridade. */
export const PARTNER_ASPECT_IDS = Object.freeze([
  'saque', 'devolucao', 'terceira_bola', 'drive', 'transicao', 'dink', 'ataque_rede',
  'defesa', 'lob_smash', 'posicionamento', 'escolha_golpe', 'mental', 'fisico',
]);

export const PARTNER_LIMITS = Object.freeze({ aspects: 3, text: 280, reason: 500, voices: 6 });
export const ADULT_AGE = 18;

/** Id do documento: um por (evento, dupla). */
export const partnerDocId = (eventId, partnerUid) => `${eventId}__${partnerUid}`;

/** As participações (índices) em que `partnerUid` foi a dupla — simples não tem dupla. */
export function citedEntryIndexes(event, partnerUid) {
  if (!partnerUid) return [];
  return (event?.entries || []).reduce((acc, e, i) => {
    if (e && e.format !== CAREER_FORMAT.SINGLES && e.partner && e.partner.uid === partnerUid) acc.push(i);
    return acc;
  }, []);
}

/** Os uids citados como dupla no evento (sem repetir). */
export function eventPartnerUids(event) {
  const out = [];
  (event?.entries || []).forEach((e) => {
    const uid = e && e.format !== CAREER_FORMAT.SINGLES && e.partner && e.partner.uid;
    if (uid && !out.includes(uid)) out.push(uid);
  });
  return out;
}

const s = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * A IMPRESSÃO do que a dupla confirma: datas e, de cada participação citada,
 * formato, categoria, idade, faixa e colocação. O nome do torneio NÃO entra.
 */
export function careerFingerprint(event, indexes) {
  const ev = event || {};
  const partes = [s(ev.start_date), s(ev.end_date), ev.date_precision === 'year' ? 'year' : 'day'];
  (indexes || []).forEach((i) => {
    const e = (ev.entries || [])[i] || {};
    partes.push([e.format, e.gender, e.age, e.age_label, e.level_bracket, e.level_label, e.placement, e.placement_n].map(s).join(':'));
  });
  return partes.join('|');
}

/** Idade completa em `hoje` (AAAA-MM-DD); `null` sem data válida. */
export function ageOn(birth, today) {
  const b = s(birth).slice(0, 10);
  const h = s(today).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) return null;
  let idade = Number(h.slice(0, 4)) - Number(b.slice(0, 4));
  if (h.slice(5) < b.slice(5)) idade -= 1;
  return idade;
}

/** Maior de idade? Nascimento desconhecido conta como MENOR. */
export function isAdult(birth, today) {
  const idade = ageOn(birth, today);
  return idade !== null && idade >= ADULT_AGE;
}

const texto = (v, max) => s(v).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const aspectos = (lista) => [...new Set((Array.isArray(lista) ? lista : []).filter((a) => PARTNER_ASPECT_IDS.includes(a)))].slice(0, PARTNER_LIMITS.aspects);

/**
 * A visão da dupla: um ponto forte, o que mais ajudaria a melhorar e uma
 * sugestão de treino. Pelo menos uma coisa preenchida. `{ valid, error, value }`.
 */
export function normalizePartnerFeedback(raw = {}) {
  const value = {
    strengths: aspectos(raw.strengths),
    improve: aspectos(raw.improve),
    text_strength: texto(raw.text_strength, PARTNER_LIMITS.text),
    text_improve: texto(raw.text_improve, PARTNER_LIMITS.text),
    text_drill: texto(raw.text_drill, PARTNER_LIMITS.text),
  };
  const algo = value.strengths.length || value.improve.length || value.text_strength || value.text_improve || value.text_drill;
  if (!algo) return { valid: false, error: 'Diga pelo menos uma coisa: um ponto forte, o que melhorar ou um treino.', value: null };
  return { valid: true, error: '', value };
}

/* ------------------------------------------------------- o que a tela deriva -- */

const docsDoEvento = (docs, eventId) => (docs || []).filter((d) => d && d.event_id === eventId);

/**
 * Selo da dupla de um evento: `confirmed` (alguém confirmou e nada está esperando
 * nova confirmação), `awaiting` (pedido em aberto) ou `null`.
 */
export function partnerSealFor(event, docs) {
  const eventId = typeof event === 'string' ? event : event?.id;
  const meus = docsDoEvento(docs, eventId);
  if (meus.some((d) => d.status === PARTNER_STATUS.INVITED || d.status === PARTNER_STATUS.RECONFIRM)) return 'awaiting';
  // Com o registro em mãos, o selo só vale se o que está nele é o que a dupla
  // confirmou (o gatilho que pede "confirmar de novo" pode ter falhado).
  const confere = (d) => typeof event === 'string'
    || careerFingerprint(event, citedEntryIndexes(event, d.partner_uid)) === d.fingerprint;
  if (meus.some((d) => d.status === PARTNER_STATUS.CONFIRMED && confere(d))) return 'confirmed';
  return null;
}

/** "Pedir de novo" depois de "Não foi assim" só faz sentido com o registro corrigido. */
export function declinedNeedsChange(event, d) {
  return d?.status === PARTNER_STATUS.DECLINED
    && careerFingerprint(event, citedEntryIndexes(event, d.partner_uid)) === d.fingerprint;
}

/** O pedido da dupla `partnerUid` neste evento, ou `null`. */
export function partnerDocFor(docs, eventId, partnerUid) {
  return (docs || []).find((d) => d && d.event_id === eventId && d.partner_uid === partnerUid) || null;
}

/** Pedido que espera a resposta da dupla (convite novo ou "confirmar de novo"). */
export const awaitsPartner = (d) => d?.status === PARTNER_STATUS.INVITED || d?.status === PARTNER_STATUS.RECONFIRM;
/** Visão da dupla que espera a decisão do dono. */
export const awaitsOwner = (d) => Boolean(d?.feedback) && (!d.owner_decision || d.owner_decision === OWNER_DECISION.PENDING);

/**
 * "Precisa de você": pedidos de confirmação que chegaram e visões da dupla que
 * esperam a decisão. Lista que não carregou chega `undefined` e volta
 * `undefined` (nunca zero).
 */
export function careerPartnerPending(docs, uid) {
  if (!Array.isArray(docs) || !uid) return undefined;
  const convites = docs.filter((d) => d.partner_uid === uid && awaitsPartner(d));
  const visoes = docs.filter((d) => d.owner_uid === uid && awaitsOwner(d));
  return {
    convites: convites.length,
    visoes: visoes.length,
    // Com UM só, o atalho leva direto a ele (a decisão mora dentro da ficha).
    convite: convites.length === 1 ? convites[0].id : null,
    visaoEvento: visoes.length === 1 ? visoes[0].event_id : null,
  };
}

/**
 * A VOZ DA DUPLA no foco do balanço: só as visões que o dono marcou "Usar no
 * meu treino", as mais recentes primeiro, até 6 (a janela dos balanços).
 * `[{ name, aspects }]` — os aspectos que a dupla disse para melhorar.
 */
export function partnerVoices(docs, uid) {
  return (docs || [])
    .filter((d) => d && d.owner_uid === uid && d.owner_decision === OWNER_DECISION.USE && (d.feedback?.improve || []).length)
    .sort((a, b) => (Number(b.decided_at_ms) || 0) - (Number(a.decided_at_ms) || 0))
    .slice(0, PARTNER_LIMITS.voices)
    .map((d) => ({ name: d.partner_name || t('Sua dupla'), aspects: d.feedback.improve.filter((a) => PARTNER_ASPECT_IDS.includes(a)) }));
}

/**
 * "Pôr na minha carreira também": o registro da DUPLA já preenchido a partir
 * do que ela confirmou — as mesmas datas e categorias, com a dupla invertida
 * (quem convidou vira a dupla). `linked_event` aponta para o registro de quem
 * convidou; o servidor confere e liga os dois.
 */
export function mirrorEventDraft(doc) {
  if (!doc?.summary) return null;
  const sm = doc.summary;
  return {
    name: sm.name || '',
    start_date: sm.start_date || '',
    end_date: sm.end_date || null,
    date_precision: sm.date_precision === 'year' ? 'year' : 'day',
    city: sm.city || '',
    state: sm.state || '',
    status: CAREER_STATUS.PLAYED,
    entries: (sm.entries || []).map((e) => ({ ...e, partner: { uid: doc.owner_uid, name: doc.owner_name || '' } })),
    linked_event: { uid: doc.owner_uid, id: doc.event_id },
  };
}

/**
 * "Com quem você já jogou": as pessoas COM CONTA que já foram dupla — dos
 * torneios de fora (a dupla escolhida da lista) e dos pódios da plataforma
 * (quem estava no pódio junto). Quem mais jogou junto primeiro.
 * `[{ uid, name, photo_url, together }]`.
 */
export function pastPartners({ career = [], trophies = [], me = null } = {}) {
  const m = new Map();
  const somar = (uid, name, photo, evento) => {
    if (!uid || uid === me) return;
    if (!m.has(uid)) m.set(uid, { uid, name: s(name).trim(), photo_url: photo || null, eventos: new Set() });
    const p = m.get(uid);
    if (!p.name && name) p.name = s(name).trim();
    if (!p.photo_url && photo) p.photo_url = photo;
    p.eventos.add(evento);
  };
  (career || []).forEach((ev) => (ev?.entries || []).forEach((e) => {
    if (e?.partner?.uid) somar(e.partner.uid, e.partner.name, null, `c:${ev.id}`);
  }));
  // A estante chega como `{ torneios, diasDeJogo }`; uma lista solta também vale.
  const pods = Array.isArray(trophies) ? trophies : [...(trophies?.torneios || []), ...(trophies?.diasDeJogo || [])];
  pods.forEach((tr) => (tr?.people || []).forEach((p) => somar(p.user_id, p.name, p.photo_url, `t:${tr.tournamentId || tr.gameDayId || tr.id}`)));
  return [...m.values()]
    .filter((p) => p.name)
    .map((p) => ({ uid: p.uid, name: p.name, photo_url: p.photo_url, together: p.eventos.size }))
    .sort((a, b) => b.together - a.together || a.name.localeCompare(b.name));
}

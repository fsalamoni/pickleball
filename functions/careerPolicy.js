/**
 * MINHA CARREIRA — a régua da DUPLA no servidor.
 *
 * CÓPIA de `src/modules/career/domain/careerPartner.js` (o pacote de Functions
 * é publicado isolado e não enxerga `src/`), com teste de paridade em
 * `careerPolicy.parity.test.js`: mexer num lado só quebra o teste.
 *
 *  - em quais participações a pessoa foi citada como dupla;
 *  - a IMPRESSÃO do que se confirma (datas + categorias + colocação; o nome do
 *    torneio NÃO entra — corrigir o nome não pede nova confirmação);
 *  - maioridade (nascimento desconhecido conta como menor);
 *  - a visão da dupla normalizada (aspectos de `GAME_ASPECTS`, textos ≤ 280);
 *  - o link do aviso com a régua de `isInternalLink` do `firestore.rules`;
 *  - a dupla SEM conta (PR 6): validade do convite, o nome comparável e as
 *    duplas digitadas só com o nome.
 */

const PARTNER_STATUS = Object.freeze({
  INVITED: 'invited', CONFIRMED: 'confirmed', DECLINED: 'declined', RECONFIRM: 'reconfirm',
});
const OWNER_DECISION = Object.freeze({ PENDING: 'pending', USE: 'use', KEEP: 'keep' });
const PARTNER_REPORT_REASONS = Object.freeze(['offensive', 'false_claim', 'personal_data', 'other']);
const PARTNER_ASPECT_IDS = Object.freeze([
  'saque', 'devolucao', 'terceira_bola', 'drive', 'transicao', 'dink', 'ataque_rede',
  'defesa', 'lob_smash', 'posicionamento', 'escolha_golpe', 'mental', 'fisico',
]);
const PARTNER_LIMITS = Object.freeze({ aspects: 3, text: 280, reason: 500, voices: 6 });
const ADULT_AGE = 18;
/** O mesmo padrão de `isInternalLink` (firestore.rules) e `INTERNAL_LINK_PATTERN` (cliente). */
const INTERNAL_LINK_PATTERN = '^/([A-Za-z0-9_?=&%.:-][A-Za-z0-9/_?=&%.:-]*)?$';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const partnerDocId = (eventId, partnerUid) => `${eventId}__${partnerUid}`;
/** Cópia de `formatHasPartner` (cliente): simples e americano não têm dupla fixa. */
const formatHasPartner = (format) => format !== 'singles' && format !== 'americano';

function citedEntryIndexes(event, partnerUid) {
  if (!partnerUid) return [];
  return ((event && event.entries) || []).reduce((acc, e, i) => {
    if (e && formatHasPartner(e.format) && e.partner && e.partner.uid === partnerUid) acc.push(i);
    return acc;
  }, []);
}

function careerFingerprint(event, indexes) {
  const ev = event || {};
  const partes = [s(ev.start_date), s(ev.end_date), ev.date_precision === 'year' ? 'year' : 'day'];
  (indexes || []).forEach((i) => {
    const e = (ev.entries || [])[i] || {};
    partes.push([e.format, e.gender, e.age, e.age_label, e.level_bracket, e.level_label, e.placement, e.placement_n].map(s).join(':'));
  });
  return partes.join('|');
}

function ageOn(birth, today) {
  const b = s(birth).slice(0, 10);
  const h = s(today).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) return null;
  let idade = Number(h.slice(0, 4)) - Number(b.slice(0, 4));
  if (h.slice(5) < b.slice(5)) idade -= 1;
  return idade;
}

function isAdult(birth, today) {
  const idade = ageOn(birth, today);
  return idade !== null && idade >= ADULT_AGE;
}

const texto = (v, max) => s(v).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const aspectos = (lista) => [...new Set((Array.isArray(lista) ? lista : []).filter((a) => PARTNER_ASPECT_IDS.includes(a)))].slice(0, PARTNER_LIMITS.aspects);

function normalizePartnerFeedback(raw = {}) {
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

/** O link de um aviso: só caminho interno que a regra aceita; senão, sem link. */
function linkDeAviso(link) {
  return typeof link === 'string' && link.length <= 400 && new RegExp(INTERNAL_LINK_PATTERN).test(link) ? link : null;
}

/* ------------------------------------------- dupla SEM conta (PR 6) -- */

/** Validade do link de convite pelo WhatsApp (uso único). */
const INVITE_TTL_DAYS = 14;
/** O token do link: 24 bytes aleatórios em base64url (32 caracteres). */
const INVITE_TOKEN_PATTERN = '^[A-Za-z0-9_-]{32}$';

/** O nome digitado comparado sem caixa, acento nem espaço repetido. */
function partnerNameKey(name) {
  return s(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * As duplas digitadas SÓ COM O NOME (sem conta), uma por nome:
 * `[{ name, key, indexes }]`. Simples não tem dupla.
 */
function namedPartners(event) {
  const m = new Map();
  ((event && event.entries) || []).forEach((e, i) => {
    if (!e || !formatHasPartner(e.format) || !e.partner || e.partner.uid) return;
    const key = partnerNameKey(e.partner.name);
    if (!key) return;
    if (!m.has(key)) m.set(key, { name: s(e.partner.name).trim(), key, indexes: [] });
    m.get(key).indexes.push(i);
  });
  return [...m.values()];
}

module.exports = {
  PARTNER_STATUS,
  OWNER_DECISION,
  PARTNER_REPORT_REASONS,
  PARTNER_ASPECT_IDS,
  PARTNER_LIMITS,
  ADULT_AGE,
  INTERNAL_LINK_PATTERN,
  partnerDocId,
  formatHasPartner,
  citedEntryIndexes,
  careerFingerprint,
  ageOn,
  isAdult,
  normalizePartnerFeedback,
  linkDeAviso,
  INVITE_TTL_DAYS,
  INVITE_TOKEN_PATTERN,
  partnerNameKey,
  namedPartners,
};

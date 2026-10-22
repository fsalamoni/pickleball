/**
 * REGULARIDADE do filiado (Bloco 1 das próximas frentes, 2026-10-22) — lógica
 * pura, sem banco:
 *
 *  - VALIDADE dos documentos: cada documento exigido pelo plano pode vencer
 *    (`plan.doc_validity = { [chave]: meses }`); a secretaria grava
 *    `valid_until` ao aceitar; o resumo da situação (`docsSummary`) é o que o
 *    servidor espelha na filiação (`docs_state`) e o que trava a inscrição em
 *    torneio chancelado quando a federação escolheu (`rules.block_expired_docs`);
 *  - NÍVEL OFICIAL do atleta (`official_level`): a escala é da federação
 *    (`rules.levels`), a régua 2.0–8.0 da plataforma só SUGERE;
 *  - SEGURO esportivo (`federations.insurance`) e OCORRÊNCIAS (lesão,
 *    acidente) em evento;
 *  - CONSENTIMENTOS (LGPD): uso de imagem, comunicações, compartilhamento — e
 *    os próprios da federação (`rules.extra_consents`).
 *
 * ⚠️ CÓPIA no servidor: `functions/federationRegularityPolicy.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationRegularity.parity.test.js`. Ids e chaves são GRAVADOS: nunca
 * renomeie.
 */
import { t, tk } from '@/core/i18n';
import { addMonthsISO, daysBetween } from './membership.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
export const isIsoDate = (s) => ISO.test(String(s || '')) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());

/* ------------------------------------------------ validade dos documentos -- */

/** Prazos de validade que a federação escolhe por documento (0 = não vence). */
export const DOC_VALIDITY_MONTHS = Object.freeze([0, 3, 6, 12, 24, 36, 60]);
/** A partir de quantos dias antes o documento aparece como "vence logo". */
export const DOC_EXPIRY_WARN_DAYS = 30;
/** Avisos ao dono: 30 dias antes, 7 dias antes e no dia (uma vez cada). */
export const DOC_EXPIRY_NOTICE_DAYS = Object.freeze([30, 7, 0]);

export const DOC_VALIDITY_LABELS = Object.freeze({
  0: tk('Não vence'), 3: tk('3 meses'), 6: tk('6 meses'), 12: tk('1 ano'), 24: tk('2 anos'), 36: tk('3 anos'), 60: tk('5 anos'),
});

/** `{ chave: meses }` só com chaves conhecidas e prazos da lista; 0 sai (não vence). */
export function normalizeDocValidity(raw, keys = null) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([k, v]) => {
    const meses = Math.trunc(Number(v));
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(k) || !DOC_VALIDITY_MONTHS.includes(meses) || meses === 0) return;
    if (keys && !keys.includes(k)) return;
    out[k] = meses;
  });
  return out;
}

/** Quantos meses vale o documento `key` deste plano (0 = não vence). */
export const docValidityMonths = (plan, key) => normalizeDocValidity(plan?.doc_validity)[key] || 0;

/** A validade sugerida ao aceitar: a data de referência (emissão ou hoje) + o prazo do plano; `null` se não vence. */
export function defaultValidUntil(plan, key, fromIso) {
  const meses = docValidityMonths(plan, key);
  return meses && isIsoDate(fromIso) ? addMonthsISO(fromIso, meses) : null;
}

/** A validade que a secretaria digitou: data válida e não anterior a hoje; vazia = não vence. */
export function validateValidUntil(value, hoje) {
  const v = str(value, 10);
  if (!v) return { ok: true, value: null };
  if (!isIsoDate(v)) return { ok: false, error: t('Data inválida.') };
  if (hoje && v < hoje) return { ok: false, error: t('A validade não pode ser no passado: o documento já está vencido.') };
  return { ok: true, value: v };
}

/**
 * Resumo da situação dos documentos de UMA filiação, a partir do retrato de
 * `requiredDocsStatus(plan, docs, hoje)`:
 *  - `none`: o plano não pede documento;
 *  - `expired`: algum documento aceito venceu e não há outro válido;
 *  - `incomplete`: falta enviar, está em análise ou foi recusado;
 *  - `expiring`: tudo em dia, mas algum vence em até 30 dias;
 *  - `ok`: tudo aceito e válido.
 * `next_expiry` é a validade mais próxima entre os válidos.
 */
export function docsSummary(statusList = []) {
  if (!statusList.length) return { state: 'none', next_expiry: null, expired: 0, expiring: 0, missing: 0, pending: 0 };
  const conta = (f) => statusList.filter(f).length;
  const expired = conta((d) => d.status === 'expired');
  const missing = conta((d) => d.status === 'missing' || d.status === 'rejected');
  const pending = conta((d) => d.status === 'pending');
  const expiring = conta((d) => d.status === 'approved' && d.expiring);
  const validades = statusList.filter((d) => d.status === 'approved' && d.valid_until).map((d) => d.valid_until).sort();
  const state = expired ? 'expired' : (missing || pending) ? 'incomplete' : expiring ? 'expiring' : 'ok';
  return { state, next_expiry: validades[0] || null, expired, expiring, missing, pending };
}

/** A federação trava a inscrição em torneio chancelado de quem tem documento VENCIDO? */
export const docsBlock = (rules, summary) => rules?.block_expired_docs === true && summary?.state === 'expired';

export const DOCS_STATE_LABELS = Object.freeze({
  none: tk('Sem documentos exigidos'), ok: tk('Documentos em dia'), expiring: tk('Documento vence logo'),
  incomplete: tk('Documentos pendentes'), expired: tk('Documento vencido'),
});

/* ------------------------------------------------------------ nível oficial -- */

/** A escala padrão (USA Pickleball/DUPR): a federação troca à vontade. */
export const DEFAULT_LEVELS = Object.freeze(['2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5+']);
export const LEVELS_MAX = 20;
export const LEVEL_LABEL_MAX = 16;
export const LEVEL_HISTORY_MAX = 20;
export const LEVEL_REASON_MIN = 3;

/** A escala da federação: rótulos únicos (sem diferenciar maiúscula), na ordem dada; vazia = a padrão. */
export function normalizeLevels(list) {
  const vistos = new Set();
  const out = (Array.isArray(list) ? list : [])
    .map((x) => str(x, LEVEL_LABEL_MAX))
    .filter((x) => x && !vistos.has(x.toLowerCase()) && vistos.add(x.toLowerCase()))
    .slice(0, LEVELS_MAX);
  return out.length ? out : [...DEFAULT_LEVELS];
}

/** O número de um rótulo ("3.5", "4,0+", "Nível 3" → 3.5, 4, 3); `null` sem número. */
export function levelNumber(label) {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(label || ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}

/**
 * O rótulo da escala que a régua da plataforma (2.0–8.0) sugere: o maior
 * rótulo com número até o nível da pessoa; abaixo de todos, o primeiro.
 * Escala sem números (Iniciante, Avançado…) ou nível desconhecido: `null`.
 */
export function suggestLevel(unified, levels) {
  const n = Number(unified);
  if (unified == null || !Number.isFinite(n)) return null;
  const comNumero = normalizeLevels(levels).map((l) => ({ l, v: levelNumber(l) })).filter((x) => x.v != null);
  if (!comNumero.length) return null;
  const ate = comNumero.filter((x) => x.v <= n + 1e-9).sort((a, b) => b.v - a.v);
  return (ate[0] || comNumero.sort((a, b) => a.v - b.v)[0]).l;
}

/** Definir o nível: um rótulo da escala e o motivo (fica no histórico e no aviso ao atleta). */
export function validateLevelInput(input = {}, levels) {
  const errors = {};
  const label = str(input.label, LEVEL_LABEL_MAX);
  const reason = str(input.reason, 300);
  if (!normalizeLevels(levels).includes(label)) errors.label = t('Escolha um nível da escala da federação.');
  if (reason.length < LEVEL_REASON_MIN) errors.reason = t('Diga o motivo (ex.: avaliação técnica, resultados no circuito).');
  return { ok: !Object.keys(errors).length, errors, value: { label, reason } };
}

/** Pedido de revisão do atleta: o motivo é obrigatório. */
export function validateLevelReview(input = {}) {
  const reason = str(input.reason, 600);
  return reason.length < 10 ? { ok: false, error: t('Conte em poucas palavras por que o nível deve mudar (mínimo 10 caracteres).') } : { ok: true, value: { reason, wanted: str(input.wanted, LEVEL_LABEL_MAX) } };
}

/** O pedido de revisão está esperando a federação? */
export const levelReviewPending = (member) => member?.level_review?.status === 'pending';

/* ----------------------------------------------------- seguro e ocorrências -- */

export const INSURANCE_COVERS = Object.freeze({ ACTIVE: 'active_members', FEDERATED: 'federated_only' });
export const INSURANCE_COVERS_LABELS = Object.freeze({
  active_members: tk('Todos os filiados e cadastrados em dia'),
  federated_only: tk('Só os filiados (pagantes) em dia'),
});

/** A apólice da federação: seguradora, número, vigência, cobertura e como acionar. */
export function validateInsurance(input = {}) {
  const errors = {};
  const v = {
    insurer: str(input.insurer, 80), policy: str(input.policy, 40),
    valid_from: str(input.valid_from, 10) || null, valid_until: str(input.valid_until, 10),
    coverage: str(input.coverage, 800), phone: str(input.phone, 30), how_to_claim: str(input.how_to_claim, 800),
    covers: Object.values(INSURANCE_COVERS).includes(input.covers) ? input.covers : INSURANCE_COVERS.ACTIVE,
  };
  if (v.insurer.length < 2) errors.insurer = t('Informe a seguradora.');
  if (!isIsoDate(v.valid_until)) errors.valid_until = t('Informe até quando a apólice vale.');
  if (v.valid_from && !isIsoDate(v.valid_from)) errors.valid_from = t('Data inválida.');
  if (v.valid_from && isIsoDate(v.valid_until) && v.valid_from > v.valid_until) errors.valid_until = t('O fim da vigência vem antes do início.');
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/** A apólice hoje: `none` (sem cadastro), `future` (ainda não começou), `active` ou `expired`. */
export function insuranceState(ins, hoje) {
  if (!ins || !isIsoDate(ins.valid_until)) return { state: 'none', days_left: null };
  if (ins.valid_from && hoje < ins.valid_from) return { state: 'future', days_left: null };
  const dias = daysBetween(hoje, ins.valid_until);
  return dias < 0 ? { state: 'expired', days_left: dias } : { state: 'active', days_left: dias };
}

/** A filiação está coberta? Filiação em dia + apólice vigente + o público da apólice. */
export function memberInsured(member, federation, hoje, memberActive) {
  const ins = federation?.insurance;
  if (!memberActive || insuranceState(ins, hoje).state !== 'active') return false;
  return ins.covers !== INSURANCE_COVERS.FEDERATED || (member?.tier || 'federated') === 'federated';
}

export const INCIDENT_KIND = Object.freeze({ INJURY: 'injury', ACCIDENT: 'accident', ILLNESS: 'illness', OTHER: 'other' });
export const INCIDENT_KIND_LABELS = Object.freeze({
  injury: tk('Lesão'), accident: tk('Acidente'), illness: tk('Mal súbito'), other: tk('Outra ocorrência'),
});
export const INCIDENT_STATUS = Object.freeze({ OPEN: 'open', CLAIM: 'claim', CLOSED: 'closed' });
export const INCIDENT_STATUS_LABELS = Object.freeze({
  open: tk('Registrada'), claim: tk('Seguro acionado'), closed: tk('Encerrada'),
});
export const INCIDENT_DESC_MAX = 2000;

/** A ocorrência: data (não futura), tipo, onde e o que houve. */
export function validateIncident(input = {}, hoje) {
  const errors = {};
  const v = {
    date: str(input.date, 10), kind: Object.values(INCIDENT_KIND).includes(input.kind) ? input.kind : INCIDENT_KIND.INJURY,
    place: str(input.place, 120), event_name: str(input.event_name, 120), tournament_id: str(input.tournament_id, 64) || null,
    body_part: str(input.body_part, 60), description: str(input.description, INCIDENT_DESC_MAX),
    first_aid: input.first_aid === true, hospital: input.hospital === true,
  };
  if (!isIsoDate(v.date)) errors.date = t('Informe a data.');
  else if (hoje && v.date > hoje) errors.date = t('A data não pode ser no futuro.');
  if (v.description.length < 10) errors.description = t('Conte o que aconteceu (mínimo 10 caracteres).');
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/* ---------------------------------------------------------- consentimentos -- */

export const CONSENT_KIND = Object.freeze({ IMAGE: 'image', COMMS: 'comms', SHARE: 'share' });
export const CONSENT_EXTRA_MAX = 5;
export const CONSENT_LOG_MAX = 30;

/** Os consentimentos de toda federação: o rótulo e o texto que a pessoa lê antes de marcar. */
export const BASE_CONSENTS = Object.freeze([
  { id: 'image', label: tk('Uso de imagem'), text: tk('Autorizo a federação a publicar fotos e vídeos em que eu apareça em eventos, na página, nas notícias e nas redes sociais dela.') },
  { id: 'comms', label: tk('Comunicações e novidades'), text: tk('Aceito receber novidades, convites e ofertas da federação e dos patrocinadores dela. Os avisos da filiação (vencimento, cobrança, decisões) chegam sempre, com ou sem esta autorização.') },
  { id: 'share', label: tk('Compartilhar com a confederação'), text: tk('Autorizo enviar meu nome, número de filiado, nível e resultados à confederação nacional e às entidades com que a federação tem convênio, para ranking e registro.') },
]);

/** Os consentimentos próprios da federação: id estável, rótulo e texto; sem texto, some. */
export function normalizeExtraConsents(list) {
  const vistos = new Set(Object.values(CONSENT_KIND));
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ id: str(x?.id, 24).replace(/[^A-Za-z0-9_-]/g, ''), label: str(x?.label, 60), text: str(x?.text, 600) }))
    .filter((x) => x.id && x.label.length >= 2 && x.text.length >= 10 && !vistos.has(x.id) && vistos.add(x.id))
    .slice(0, CONSENT_EXTRA_MAX);
}

/** Tudo o que a pessoa pode autorizar nesta federação, já traduzido. */
export function consentItems(federation) {
  return [
    ...BASE_CONSENTS.map((c) => ({ id: c.id, label: t(c.label), text: t(c.text), base: true })),
    ...normalizeExtraConsents(federation?.rules?.extra_consents).map((c) => ({ ...c, base: false })),
  ];
}

/** `{ id: true|false }` só com os ids que existem nesta federação. */
export function normalizeConsentsInput(raw, ids) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  ids.forEach((id) => { if (typeof raw[id] === 'boolean') out[id] = raw[id]; });
  return out;
}

/** A pessoa autorizou? (ausente = não — o consentimento da LGPD é sempre explícito) */
export const consentGranted = (member, id) => member?.consents?.[id]?.granted === true;

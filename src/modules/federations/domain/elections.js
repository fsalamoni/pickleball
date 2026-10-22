/**
 * ELEIÇÕES da federação (módulo `elections`) — a conta PURA, sem banco:
 * cargos, calendário, colégio eleitoral com pesos (teto 1:6, atletas com ao
 * menos 1/3 do peso — Lei 14.597/2023, art. 36, X, "h", e art. 60, §1º),
 * apoio de até 5% (art. 36, X, "i"), quem vota, a cédula, a apuração
 * ponderada com brancos e nulos e a regra de empate do edital.
 *
 * ⚠️ O servidor tem CÓPIA (`functions/federationElectionsPolicy.js`, o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationElections.parity.test.js`. Os ids (situação, tipo de cargo,
 * órgão, modo, regra de empate, categoria) são GRAVADOS: nunca renomeie.
 *
 * SIGILO: nada aqui liga cédula a eleitor. A cédula leva só a eleição, as
 * escolhas e o peso; o eleitor leva só "votou" e o comprovante.
 */
import { t, tk } from '@/core/i18n';

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const LABEL_MAX = 80;
export const POSITIONS_MAX = 10;
export const SEATS_MAX = 20;
export const MEMBERS_MAX = 20;
export const NAME_MAX = 80;
export const ROLE_MAX = 60;
export const PLATFORM_MAX = 4000;
export const REASON_MIN = 10;
export const CHALLENGE_MIN = 20;
export const ENDORSEMENT_MAX_PCT = 5;
export const WEIGHT_MAX = 6;
export const MIN_MONTHS_MAX = 60;
export const NOTICE_MIN_DAYS = 30;
export const NOTICE_DAYS_MAX = 365;
export const COMMISSION_MAX = 7;
export const SMALL_GROUP = 3;
export const HISTORY_MAX = 20;
export const WOMEN_TENTHS = 3;
export const BOARD_MAX = 12;
const BR_OFFSET_MS = 3 * 3600000;
const DAY_MS = 86400000;

export const STATUS = Object.freeze({
  DRAFT: 'draft', PUBLISHED: 'published', CANDIDACY: 'candidacy', CHALLENGES: 'challenges',
  VOTING: 'voting', COUNTING: 'counting', CLOSED: 'closed', CANCELLED: 'cancelled',
});
/** Só estes são gravados; `candidacy` e `challenges` são FASES do calendário (`electionPhase`). */
export const STORED_STATUS = Object.freeze(['draft', 'published', 'voting', 'counting', 'closed', 'cancelled']);
export const CANDIDACY_STATUS = Object.freeze({ SUBMITTED: 'submitted', ACCEPTED: 'accepted', CHALLENGED: 'challenged', REJECTED: 'rejected', WITHDRAWN: 'withdrawn' });
export const POSITION_KINDS = Object.freeze(['slate', 'individual']);
export const ORGANS = Object.freeze(['board', 'fiscal', 'athletes', 'other']);
export const MODES = Object.freeze(['online', 'presential', 'mixed']);
export const TIE_RULES = Object.freeze(['oldest', 'earliest', 'runoff']);
export const CATEGORIES = Object.freeze(['athlete', 'coach', 'referee', 'club', 'arena']);
export const PERSON_CATEGORIES = Object.freeze(['athlete', 'coach', 'referee']);
export const CALENDAR_KEYS = Object.freeze(['notice_on', 'candidacy_from', 'candidacy_to', 'challenge_to', 'defense_to', 'voting_from', 'voting_to', 'result_on', 'inauguration_on']);
export const GENDERS = Object.freeze(['f', 'm']);
export const SPECIAL_CHOICES = Object.freeze(['blank', 'null']);
export const DEFAULT_WEIGHTS = Object.freeze({ athlete: 1, coach: 1, referee: 1, club: 3, arena: 3 });

const line = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const isTime = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
const int = (v, def) => (v === '' || v == null || !Number.isFinite(Number(v)) ? def : Math.trunc(Number(v)));

/** Dias entre duas datas ISO (ate − de). */
export function daysBetween(de, ate) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DAY_MS);
}
/** A data ISO `meses` antes/depois (dia que não existe cai no último do mês). */
export function addMonthsISO(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
/** Instante (ms) de uma data e hora de Brasília (UTC−3). */
export function brMs(iso, hhmm = '00:00') {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) + BR_OFFSET_MS;
}
/** A data de hoje em Brasília. */
export const todayBr = (ms) => new Date(ms - BR_OFFSET_MS).toISOString().slice(0, 10);

/* ------------------------------------------------------------ edital -- */

function validatePositions(lista, errors) {
  const entrada = Array.isArray(lista) ? lista : [];
  if (!entrada.length) errors.positions = t('Inclua ao menos um cargo.');
  if (entrada.length > POSITIONS_MAX) errors.positions = t('No máximo {n} cargos por eleição.', { n: POSITIONS_MAX });
  return entrada.slice(0, POSITIONS_MAX).map((p, i) => {
    const kind = POSITION_KINDS.includes(p && p.kind) ? p.kind : 'slate';
    const organ = ORGANS.includes(p && p.organ) ? p.organ : 'other';
    const label = line(p && p.label, LABEL_MAX);
    if (label.length < 3) errors[`positions.${i}.label`] = t('Dê o nome do cargo.');
    const seats = kind === 'slate' ? 1 : int(p && p.seats, 1);
    if (seats < 1 || seats > SEATS_MAX) errors[`positions.${i}.seats`] = t('Vagas de 1 a {n}.', { n: SEATS_MAX });
    const gender_min = int(p && p.gender_min, 0);
    const teto = kind === 'slate' ? Math.floor(MEMBERS_MAX / 2) : Math.floor(seats / 2);
    if (gender_min < 0 || gender_min > teto) errors[`positions.${i}.gender_min`] = t('O mínimo de cada sexo vai de 0 a {n}.', { n: teto });
    return { id: `c${i + 1}`, label, kind, organ, seats, gender_min };
  });
}

function validateCalendar(cal = {}, noticeMinDays, errors) {
  const c = {};
  CALENDAR_KEYS.forEach((k) => {
    c[k] = line(cal[k], 10);
    if (c[k] && !isDate(c[k])) errors[`calendar.${k}`] = t('Data inválida.');
    else if (!c[k] && k !== 'inauguration_on') errors[`calendar.${k}`] = t('Informe a data.');
  });
  c.voting_opens = isTime(cal.voting_opens) ? cal.voting_opens : '08:00';
  c.voting_closes = isTime(cal.voting_closes) ? cal.voting_closes : '18:00';
  const presentes = CALENDAR_KEYS.filter((k) => c[k] && !errors[`calendar.${k}`]);
  for (let i = 1; i < presentes.length; i += 1) {
    const a = presentes[i - 1];
    const b = presentes[i];
    const estrito = b === 'voting_from';
    if (c[b] < c[a] || (estrito && c[b] === c[a])) {
      errors[`calendar.${b}`] = estrito ? t('A votação começa depois do prazo de defesa (é o dia de julgar).') : t('Esta data não pode vir antes da anterior.');
    }
  }
  if (c.voting_from === c.voting_to && c.voting_closes <= c.voting_opens && !errors['calendar.voting_to']) errors['calendar.voting_to'] = t('A votação fecha depois de abrir.');
  if (c.notice_on && c.voting_from && !errors['calendar.notice_on'] && !errors['calendar.voting_from'] && daysBetween(c.notice_on, c.voting_from) < noticeMinDays) {
    errors['calendar.notice_on'] = t('O edital sai ao menos {n} dias antes da votação.', { n: noticeMinDays });
  }
  return c;
}

function validateCollege(col = {}, errors) {
  const min_months = int(col.min_months, 0);
  if (min_months < 0 || min_months > MIN_MONTHS_MAX) errors['college.min_months'] = t('De 0 a {n} meses.', { n: MIN_MONTHS_MAX });
  const weights = {};
  const entrada = col.weights || {};
  CATEGORIES.forEach((k) => {
    const w = int(entrada[k], DEFAULT_WEIGHTS[k]);
    if (w < 0 || w > WEIGHT_MAX) errors[`college.weights.${k}`] = t('Peso de 0 a {n} (0 = não vota).', { n: WEIGHT_MAX });
    weights[k] = Math.max(0, Math.min(WEIGHT_MAX, w));
  });
  if (!(weights.athlete > 0)) errors['college.weights.athlete'] = t('Os atletas votam: peso de 1 a {n}.', { n: WEIGHT_MAX });
  return { min_months, weights };
}

/** A comissão eleitoral: pessoas da plataforma, sem repetir, até 7. */
export function validateCommission(lista, errors = {}) {
  const entrada = Array.isArray(lista) ? lista : [];
  if (entrada.length > COMMISSION_MAX) errors.commission = t('A comissão tem no máximo {n} pessoas.', { n: COMMISSION_MAX });
  const vistos = new Set();
  const out = [];
  entrada.slice(0, COMMISSION_MAX).forEach((p) => {
    const uid = line(p && p.uid, 128);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || vistos.has(uid)) return;
    vistos.add(uid);
    out.push({ uid, name: line(p && p.name, NAME_MAX) || t('Membro da comissão') });
  });
  return out;
}

/**
 * O edital inteiro. `{ ok, errors (chaves), value }`. Ver `validateCalendar`
 * (ordem das datas e antecedência do edital) e `validateCollege` (pesos).
 */
export function validateElection(input = {}) {
  const errors = {};
  const title = line(input.title, TITLE_MAX);
  if (title.length < 5) errors.title = t('Dê um título (mínimo 5 caracteres).');
  const description = text(input.description, DESCRIPTION_MAX);
  const notice_min_days = int(input.notice_min_days, NOTICE_MIN_DAYS);
  if (notice_min_days < 0 || notice_min_days > NOTICE_DAYS_MAX) errors.notice_min_days = t('De 0 a {n} dias.', { n: NOTICE_DAYS_MAX });
  const positions = validatePositions(input.positions, errors);
  const calendar = validateCalendar(input.calendar || {}, Math.max(0, Math.min(NOTICE_DAYS_MAX, notice_min_days)), errors);
  const college = validateCollege(input.college || {}, errors);
  const pct = Math.round((Number(input.endorsement_pct) || 0) * 10) / 10;
  if (pct < 0 || pct > ENDORSEMENT_MAX_PCT) errors.endorsement_pct = t('O apoio exigido vai de 0% a {n}% do colégio (a lei não deixa passar de 5%).', { n: ENDORSEMENT_MAX_PCT });
  const mode = MODES.includes(input.mode) ? input.mode : 'online';
  const tie_rule = TIE_RULES.includes(input.tie_rule) ? input.tie_rule : 'oldest';
  const commission = validateCommission(input.commission, errors);
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { title, description, positions, calendar, college, endorsement_pct: Math.max(0, Math.min(ENDORSEMENT_MAX_PCT, pct)), mode, tie_rule, notice_min_days, commission },
  };
}

/* ----------------------------------------------------------- colégio -- */

/** A filiação ativa precisa começar até esta data para votar (`min_months` antes de `hoje`). */
export const collegeCutoff = (hoje, minMonths) => addMonthsISO(hoje, -Math.max(0, Number(minMonths) || 0));

/**
 * O COLÉGIO de uma eleição: filiados (pessoas com conta) ativos há
 * `min_months`, sem suspensão disciplinar, e — com o peso do grupo acima de
 * zero — os clubes e arenas filiados no mesmo prazo, votando pelo
 * representante (quem pediu a filiação). Dependente (sem conta) não vota.
 * Id do eleitor: `{eleição}_{uid}` (pessoa) ou `{eleição}_{club|arena}_{org}`.
 */
export function buildVoterRoll({ members = [], affiliations = [], election, hoje, nowMs }) {
  const w = (election && election.college && election.college.weights) || {};
  const minMonths = Number(election && election.college && election.college.min_months) || 0;
  const corte = collegeCutoff(hoje, minMonths);
  const corteMs = brMs(corte, '23:59');
  const eid = (election && election.id) || '';
  const out = [];
  const vistos = new Set();
  (members || []).forEach((m) => {
    if (!m || m.status !== 'active' || !m.user_id || vistos.has(m.user_id)) return;
    if (m.valid_until && m.valid_until < hoje) return;
    if (Number(m.discipline_until_ms) > nowMs) return;
    const category = PERSON_CATEGORIES.includes(m.person_type) ? m.person_type : 'athlete';
    const weight = Number(w[category]) || 0;
    if (!(weight > 0)) return;
    if (minMonths > 0 && !(m.valid_from && m.valid_from <= corte)) return;
    vistos.add(m.user_id);
    out.push({ id: `${eid}_${m.user_id}`, user_id: m.user_id, name: line(m.user_name, NAME_MAX), category, weight, kind: 'person', org_id: null });
  });
  (affiliations || []).forEach((a) => {
    if (!a || a.status !== 'approved' || !['club', 'arena'].includes(a.kind) || !a.requested_by || !a.org_id) return;
    const weight = Number(w[a.kind]) || 0;
    if (!(weight > 0)) return;
    if (minMonths > 0 && !(Number(a.review && a.review.at_ms) > 0 && a.review.at_ms <= corteMs)) return;
    out.push({ id: `${eid}_${a.kind}_${a.org_id}`, user_id: a.requested_by, name: line(a.org_name, NAME_MAX), category: a.kind, weight, kind: a.kind, org_id: a.org_id });
  });
  return out;
}

/**
 * O peso de cada grupo e as duas checagens da lei: atletas com ao menos 1/3
 * do peso total e proporção até 1:6. `small`: grupos com 1 ou 2 eleitores —
 * o voto deles pode ser deduzido da apuração (o peso da cédula é do grupo).
 */
export function collegeBalance(roll = [], weights = {}) {
  const by = {};
  CATEGORIES.forEach((k) => { by[k] = { voters: 0, weight: 0, unit: Number(weights[k]) || 0 }; });
  (roll || []).forEach((v) => {
    if (!by[v.category]) return;
    by[v.category].voters += 1;
    by[v.category].weight += Number(v.weight) || 0;
  });
  const total = CATEGORIES.reduce((s, k) => s + by[k].weight, 0);
  const voters = CATEGORIES.reduce((s, k) => s + by[k].voters, 0);
  const usados = CATEGORIES.map((k) => by[k].unit).filter((x) => x > 0);
  const ratio = usados.length ? Math.max(...usados) / Math.min(...usados) : 1;
  const athleteShare = total > 0 ? by.athlete.weight / total : 0;
  const small = CATEGORIES.filter((k) => by[k].voters > 0 && by[k].voters < SMALL_GROUP);
  const athletesOk = total > 0 && by.athlete.weight * 3 >= total;
  const ratioOk = ratio <= WEIGHT_MAX;
  return { byCategory: by, total, voters, ratio, ratioOk, athleteShare, athletesOk, small, ok: athletesOk && ratioOk };
}

/** Quantos apoios a chapa precisa: `pct`% do colégio, arredondado para cima (0% = nenhum). */
export const endorsementsNeeded = (pct, collegeSize) => (Number(pct) > 0 ? Math.max(1, Math.ceil((Number(pct) * Number(collegeSize || 0)) / 100)) : 0);

/** A pessoa vota (ou apoia) hoje? Mesma conta de `buildVoterRoll`, para uma filiação. */
export function memberEligible(m, { hoje, nowMs, minMonths = 0 }) {
  if (!m || m.status !== 'active' || !m.user_id) return false;
  if (m.valid_until && m.valid_until < hoje) return false;
  if (Number(m.discipline_until_ms) > nowMs) return false;
  return !(minMonths > 0) || Boolean(m.valid_from && m.valid_from <= collegeCutoff(hoje, minMonths));
}

/* ------------------------------------------------------------- fases -- */

/** A fase de agora: a situação gravada, e entre o edital e a votação, a do calendário. */
export function electionPhase(e, hoje) {
  const st = (e && e.status) || STATUS.DRAFT;
  if (st !== STATUS.PUBLISHED) return st;
  const c = e.calendar || {};
  if (c.candidacy_from && hoje < c.candidacy_from) return STATUS.PUBLISHED;
  if (c.candidacy_to && hoje <= c.candidacy_to) return STATUS.CANDIDACY;
  return STATUS.CHALLENGES;
}

/**
 * A janela de cada ato da chapa, pelo calendário: registrar e apoiar no
 * prazo de registro; impugnar do início do registro ao prazo de
 * impugnação; defender até o prazo de defesa; desistir até a votação abrir.
 */
export function windowOpen(e, kind, hoje) {
  if (!e || e.status !== STATUS.PUBLISHED) return false;
  const c = e.calendar || {};
  if (kind === 'candidacy' || kind === 'endorse') return hoje >= c.candidacy_from && hoje <= c.candidacy_to;
  if (kind === 'challenge') return hoje >= c.candidacy_from && hoje <= c.challenge_to;
  if (kind === 'defense') return hoje <= c.defense_to;
  return kind === 'withdraw';
}

export const votingOpensMs = (e) => brMs(e.calendar.voting_from, e.calendar.voting_opens || '08:00');
export const votingClosesMs = (e) => brMs(e.calendar.voting_to, e.calendar.voting_closes || '18:00');
/** Impugnação já pode ser julgada: a chapa se defendeu, ou o prazo de defesa passou. */
export const challengeReady = (ch, e, hoje) => Boolean(ch) && !ch.decision && (Boolean(ch.defense) || hoje > ((e && e.calendar && e.calendar.defense_to) || '9999-12-31'));

/**
 * O que espera a COMISSÃO agora (a linha do tempo mostra; a faixa "Precisa de
 * você" conta). Lista de `{ id, count? }`, na ordem.
 */
export function commissionTodo(e, candidacies = [], { hoje, nowMs }) {
  const st = e && e.status;
  if (!e || [STATUS.CLOSED, STATUS.CANCELLED].includes(st)) return [];
  if (st === STATUS.DRAFT) return [{ id: 'publish' }];
  const out = [];
  if (st === STATUS.PUBLISHED) {
    const daEleicao = (candidacies || []).filter((c) => c.election_id === e.id);
    const analisar = daEleicao.filter((c) => c.status === CANDIDACY_STATUS.SUBMITTED).length;
    const julgar = daEleicao.filter((c) => c.status === CANDIDACY_STATUS.CHALLENGED && (c.challenges || []).some((ch) => challengeReady(ch, e, hoje))).length;
    if (analisar) out.push({ id: 'judge_candidacies', count: analisar });
    if (julgar) out.push({ id: 'judge_challenges', count: julgar });
    const pendentes = daEleicao.some((c) => [CANDIDACY_STATUS.SUBMITTED, CANDIDACY_STATUS.CHALLENGED].includes(c.status));
    if (!pendentes && nowMs >= votingOpensMs(e)) out.push({ id: 'open_voting' });
    if (!out.length) out.push({ id: 'wait' });
    return out;
  }
  if (st === STATUS.VOTING) return [{ id: nowMs >= votingClosesMs(e) ? 'close_voting' : 'monitor' }];
  if (st === STATUS.COUNTING) return [{ id: e.mode !== 'online' && !e.presential ? 'record_presential' : 'publish_result' }];
  return out;
}

/* ------------------------------------------------------------ chapas -- */

/** A chapa (ou a candidatura individual) para um cargo. */
export function validateCandidacy(input = {}, position) {
  const errors = {};
  if (!position) errors.position_id = t('Escolha o cargo.');
  const slate = !position || position.kind === 'slate';
  const entrada = Array.isArray(input.members) ? input.members : [];
  const vistos = new Set();
  const members = [];
  entrada.slice(0, MEMBERS_MAX).forEach((x, i) => {
    const uid = line(x && x.uid, 128);
    const name = line(x && x.name, NAME_MAX);
    const role = line(x && x.role, ROLE_MAX);
    const gender = GENDERS.includes(x && x.gender) ? x.gender : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !name) { errors[`members.${i}`] = t('Escolha a pessoa.'); return; }
    if (vistos.has(uid)) { errors[`members.${i}`] = t('A mesma pessoa aparece duas vezes.'); return; }
    if (slate && !role) errors[`members.${i}.role`] = t('Diga o cargo desta pessoa na chapa.');
    if (!gender) errors[`members.${i}.gender`] = t('Informe o sexo (conta para o mínimo de cada sexo).');
    vistos.add(uid);
    members.push({ uid, name, role: slate ? role : '', gender });
  });
  if (entrada.length > MEMBERS_MAX) errors.members = t('No máximo {n} pessoas.', { n: MEMBERS_MAX });
  else if (slate && members.length < 2) errors.members = t('Uma chapa tem ao menos duas pessoas.');
  else if (!slate && members.length !== 1) errors.members = t('A candidatura individual é de uma pessoa.');
  if (slate && position && position.gender_min > 0) {
    const f = members.filter((x) => x.gender === 'f').length;
    const m = members.filter((x) => x.gender === 'm').length;
    if (f < position.gender_min || m < position.gender_min) errors.gender_min = t('Este cargo pede ao menos {n} pessoa(s) de cada sexo na chapa.', { n: position.gender_min });
  }
  const name = line(input.name, NAME_MAX) || (!slate && members[0] ? members[0].name : '');
  if (name.length < 3) errors.name = t('Dê o nome da chapa.');
  const platform = text(input.platform, PLATFORM_MAX);
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { position_id: position ? position.id : '', name, members, platform, women_count: members.filter((x) => x.gender === 'f').length },
  };
}

/**
 * Alertas da comissão (nunca bloqueiam): chapa da diretoria com menos de 30%
 * de mulheres (art. 36, IX) e cabeça de chapa que é o presidente de agora
 * (recondução — a lei permite uma só; `presidentTerms`: mandatos já
 * registrados na equipe).
 */
export function candidacyAlerts(c, position, { presidentUid = null, presidentTerms = 0 } = {}) {
  const out = [];
  const members = (c && c.members) || [];
  if (position && position.kind === 'slate' && position.organ === 'board' && members.length) {
    const mulheres = members.filter((x) => x.gender === 'f').length;
    if (mulheres * 10 < members.length * WOMEN_TENTHS) out.push({ id: 'women', women: mulheres, total: members.length });
    if (presidentUid && members[0] && members[0].uid === presidentUid) out.push({ id: 'reelection', terms: Math.max(1, Number(presidentTerms) || 1) });
  }
  return out;
}

/* ------------------------------------------------------------ cédula -- */

/**
 * A cédula: uma escolha por cargo — o id de uma chapa ACEITA daquele cargo,
 * `blank` (em branco) ou `null` (nulo). Todo cargo precisa de resposta.
 * @param {object} choices
 * @param {object[]} positions
 * @param {Record<string, string[]>} accepted posição → ids das chapas aceitas
 */
export function validateBallot(choices, positions = [], accepted = {}) {
  const errors = {};
  const entrada = choices && typeof choices === 'object' ? choices : {};
  const value = {};
  (positions || []).forEach((p) => {
    const v = String(entrada[p.id] == null ? '' : entrada[p.id]);
    if (!v) errors[p.id] = t('Escolha uma opção para {cargo}.', { cargo: p.label });
    else if (!SPECIAL_CHOICES.includes(v) && !(accepted[p.id] || []).includes(v)) errors[p.id] = t('Opção inválida para {cargo}.', { cargo: p.label });
    else value[p.id] = v;
  });
  Object.keys(entrada).forEach((k) => { if (!(positions || []).some((p) => p.id === k)) errors[k] = t('Cargo desconhecido.'); });
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/* ---------------------------------------------------------- apuração -- */

/**
 * Soma os PESOS por cargo: as cédulas do app e os totais da mesa
 * (presencial). Nada é contado por pessoa — só por opção.
 */
export function tally(ballots = [], presential = null, positions = []) {
  const out = {};
  (positions || []).forEach((p) => { out[p.id] = { totals: {}, blank: 0, null: 0, valid: 0, total: 0 }; });
  const soma = (pid, escolha, w) => {
    const r = out[pid];
    if (!r || !(w > 0)) return;
    r.total += w;
    if (escolha === 'blank') r.blank += w;
    else if (escolha === 'null') r.null += w;
    else { r.totals[escolha] = (r.totals[escolha] || 0) + w; r.valid += w; }
  };
  (ballots || []).forEach((b) => {
    const w = Number(b && b.weight) || 0;
    Object.entries((b && b.choices) || {}).forEach(([pid, escolha]) => soma(pid, escolha, w));
  });
  Object.entries((presential && presential.totals) || {}).forEach(([pid, porOpcao]) => {
    Object.entries(porOpcao || {}).forEach(([escolha, w]) => soma(pid, escolha, Number(w) || 0));
  });
  return out;
}

/**
 * Quem foi eleito em cada cargo. Ordem: mais peso; empate pela regra do
 * edital — `oldest` (cabeça de chapa mais velho: `births`, id → data ISO),
 * `earliest` (registrada primeiro) ou `runoff` (empate marcado, sem eleito no
 * corte: a comissão convoca novo turno). Cargo individual com mínimo de cada
 * sexo troca o último eleito do sexo que sobra pelo melhor do que falta.
 */
export function decideWinners(tallied, positions = [], candidacies = [], { tieRule = 'oldest', births = {} } = {}) {
  return (positions || []).map((p) => {
    const r = tallied[p.id] || { totals: {}, blank: 0, null: 0, valid: 0, total: 0 };
    const cands = (candidacies || []).filter((c) => c.position_id === p.id && [CANDIDACY_STATUS.ACCEPTED].includes(c.status));
    const desempate = (a, b) => {
      if (tieRule === 'oldest') {
        const na = births[a.id] || '9999-12-31';
        const nb = births[b.id] || '9999-12-31';
        if (na !== nb) return na < nb ? -1 : 1;
      }
      if (tieRule !== 'runoff') {
        const sa = Number(a.submitted_at_ms) || 0;
        const sb = Number(b.submitted_at_ms) || 0;
        if (sa !== sb) return sa - sb;
      }
      return String(a.id).localeCompare(String(b.id));
    };
    const ranking = cands
      .map((c) => ({ c, weight: r.totals[c.id] || 0 }))
      .sort((a, b) => b.weight - a.weight || desempate(a.c, b.c));
    const vagas = p.kind === 'slate' ? 1 : p.seats;
    let tie = false;
    let eleitos = ranking.filter((x) => x.weight > 0).slice(0, vagas);
    const fora = ranking.filter((x) => x.weight > 0).slice(vagas);
    if (tieRule === 'runoff' && eleitos.length === vagas && fora.length && fora[0].weight === eleitos[vagas - 1].weight) {
      tie = true;
      const corte = eleitos[vagas - 1].weight;
      eleitos = eleitos.filter((x) => x.weight > corte);
    }
    if (!tie && p.kind === 'individual' && p.gender_min > 0) {
      const sexo = (x) => (x.c.members && x.c.members[0] && x.c.members[0].gender) || '';
      ['f', 'm'].forEach((s) => {
        const outro = s === 'f' ? 'm' : 'f';
        let faltam = p.gender_min - eleitos.filter((x) => sexo(x) === s).length;
        while (faltam > 0) {
          const entra = ranking.find((x) => x.weight > 0 && sexo(x) === s && !eleitos.includes(x));
          const sobra = eleitos.filter((x) => sexo(x) === outro).length > p.gender_min;
          const sai = [...eleitos].reverse().find((x) => sexo(x) === outro);
          if (!entra || !sobra || !sai) break;
          eleitos = [...eleitos.filter((x) => x !== sai), entra].sort((a, b) => b.weight - a.weight || desempate(a.c, b.c));
          faltam -= 1;
        }
      });
    }
    const ids = new Set(eleitos.map((x) => x.c.id));
    return {
      position_id: p.id, label: p.label, kind: p.kind, seats: vagas, tie,
      total: r.total, valid: r.valid, blank: r.blank, null: r.null,
      items: ranking.map((x) => ({ candidacy_id: x.c.id, name: x.c.name, weight: x.weight, elected: ids.has(x.c.id) })),
    };
  });
}

/* -------------------------------------------------- governança e textos -- */

/**
 * A diretoria e o conselho fiscal ELEITOS, no formato de
 * `federations.governance.board` ({ role, name }), com quantas são mulheres.
 * `null` com `error` quando passa do teto da governança.
 */
export function governanceFromResults(results = [], positions = [], candidacies = []) {
  const board = [];
  let women = 0;
  (results || []).forEach((r) => {
    const p = (positions || []).find((x) => x.id === r.position_id);
    if (!p || !['board', 'fiscal'].includes(p.organ)) return;
    r.items.filter((i) => i.elected).forEach((i) => {
      const c = (candidacies || []).find((x) => x.id === i.candidacy_id);
      ((c && c.members) || []).forEach((m) => {
        board.push({ role: line(p.kind === 'slate' ? (m.role || p.label) : p.label, ROLE_MAX), name: line(m.name, NAME_MAX) });
        if (m.gender === 'f') women += 1;
      });
    });
  });
  if (board.length > BOARD_MAX) return { board: null, women_count: null, error: t('Os eleitos passam de {n} nomes: atualize a governança à mão.', { n: BOARD_MAX }) };
  return { board, women_count: women, error: '' };
}

const dataBr = (iso) => (iso && isDate(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const ORGAN_TEXT = { board: 'Diretoria', fiscal: 'Conselho fiscal', athletes: 'Representação dos atletas', other: 'Outro órgão' };
const MODE_TEXT = { online: 'pelo aplicativo, com voto secreto', presential: 'presencial, com voto secreto', mixed: 'pelo aplicativo e presencial, com voto secreto' };
const TIE_TEXT = { oldest: 'vence a chapa cujo cabeça é o mais velho', earliest: 'vence a chapa registrada primeiro', runoff: 'há novo turno entre as empatadas' };
const CAT_TEXT = { athlete: 'Atleta', coach: 'Professor(a)', referee: 'Árbitro(a)', club: 'Clube filiado', arena: 'Arena filiada' };

/** O texto do EDITAL (vai para o acervo e fica na eleição). Em português: é registro oficial. */
export function noticeText(fed, e) {
  const c = e.calendar || {};
  const w = (e.college && e.college.weights) || {};
  const linhas = [
    `${(fed && fed.name) || ''} — ${e.title}`,
    '',
    `A ${(fed && fed.acronym) || (fed && fed.name) || 'federação'} convoca as eleições abaixo, nos termos do estatuto e da Lei 14.597/2023 (Lei Geral do Esporte).`,
    e.description ? `\n${e.description}` : '',
    '',
    '1. Cargos',
    ...(e.positions || []).map((p, i) => `1.${i + 1}. ${p.label} — ${ORGAN_TEXT[p.organ] || ''}; ${p.kind === 'slate' ? 'por chapa' : `individual, ${p.seats} vaga(s)`}${p.gender_min > 0 ? `; mínimo de ${p.gender_min} de cada sexo` : ''}.`),
    '',
    '2. Calendário (horário de Brasília)',
    `Publicação do edital: ${dataBr(c.notice_on)}`,
    `Registro de chapas: de ${dataBr(c.candidacy_from)} a ${dataBr(c.candidacy_to)}`,
    `Impugnações: até ${dataBr(c.challenge_to)}; defesa: até ${dataBr(c.defense_to)}`,
    `Votação: de ${dataBr(c.voting_from)} às ${c.voting_opens || '08:00'} a ${dataBr(c.voting_to)} às ${c.voting_closes || '18:00'}`,
    `Resultado: ${dataBr(c.result_on)}${c.inauguration_on ? `; posse: ${dataBr(c.inauguration_on)}` : ''}`,
    '',
    '3. Colégio eleitoral',
    `Votam os filiados em dia${e.college && e.college.min_months > 0 ? ` há ao menos ${e.college.min_months} mês(es) na abertura da votação` : ''}, sem suspensão disciplinar. Pesos:`,
    ...CATEGORIES.filter((k) => w[k] > 0).map((k) => `— ${CAT_TEXT[k]}: ${w[k]}`),
    'Os atletas somam ao menos 1/3 do valor total dos votos, e a proporção entre pesos não passa de 1 para 6.',
    '',
    '4. Registro de chapas',
    e.endorsement_pct > 0 ? `Cada chapa precisa do apoio de ${e.endorsement_pct}% do colégio eleitoral.` : 'Não se exige apoio mínimo para registrar chapa.',
    'Membro da comissão eleitoral não concorre. Quem tiver a candidatura impugnada apresenta defesa no prazo.',
    '',
    '5. Votação e apuração',
    `A votação é ${MODE_TEXT[e.mode] || MODE_TEXT.online}. A apuração soma os pesos; brancos e nulos não são votos válidos. Em caso de empate, ${TIE_TEXT[e.tie_rule] || TIE_TEXT.oldest}.`,
    '',
    '6. Comissão eleitoral',
    (e.commission || []).length ? (e.commission || []).map((p) => p.name).join(', ') : 'A diretoria conduz até a nomeação da comissão.',
  ];
  return linhas.filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n').trim();
}

/** O texto da ATA do resultado. */
export function minutesText(fed, e, results = [], totals = {}) {
  const linhas = [
    `${(fed && fed.name) || ''} — Ata da apuração: ${e.title}`,
    '',
    `Eleitores no colégio: ${totals.voters || 0} (peso total ${totals.total_weight || 0}). Votaram: ${totals.voted || 0} (peso ${totals.voted_weight || 0}).`,
    '',
    ...(results || []).flatMap((r) => [
      `${r.label}: válidos ${r.valid}, brancos ${r.blank}, nulos ${r.null}.`,
      ...r.items.map((i) => `— ${i.name}: ${i.weight}${i.elected ? ' (eleita)' : ''}`),
      r.tie ? 'Empate no corte: novo turno, conforme o edital.' : '',
      '',
    ]),
    `Comissão eleitoral: ${(e.commission || []).map((p) => p.name).join(', ') || 'diretoria'}.`,
  ];
  return linhas.filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n').trim();
}


/* ------------------------------------------- só do cliente: rótulos e rascunho -- */

export const STATUS_LABEL = Object.freeze({
  draft: tk('Rascunho'), published: tk('Edital publicado'), candidacy: tk('Registro de chapas'), challenges: tk('Impugnações e julgamento'),
  voting: tk('Votação aberta'), counting: tk('Apuração'), closed: tk('Resultado publicado'), cancelled: tk('Cancelada'),
});
export const STATUS_TONE = Object.freeze({ draft: 'neutral', published: 'blue', candidacy: 'blue', challenges: 'amber', voting: 'green', counting: 'purple', closed: 'ink', cancelled: 'red' });
export const CANDIDACY_STATUS_LABEL = Object.freeze({ submitted: tk('Em análise'), accepted: tk('Aceita'), challenged: tk('Impugnada'), rejected: tk('Indeferida'), withdrawn: tk('Retirada') });
export const CANDIDACY_TONE = Object.freeze({ submitted: 'amber', accepted: 'green', challenged: 'red', rejected: 'neutral', withdrawn: 'neutral' });
export const POSITION_KIND_LABEL = Object.freeze({ slate: tk('Por chapa'), individual: tk('Individual') });
export const ORGAN_LABEL = Object.freeze({ board: tk('Diretoria'), fiscal: tk('Conselho fiscal'), athletes: tk('Representação dos atletas'), other: tk('Outro órgão') });
export const MODE_LABEL = Object.freeze({ online: tk('Pelo aplicativo'), presential: tk('Presencial'), mixed: tk('Aplicativo e presencial') });
export const TIE_RULE_LABEL = Object.freeze({ oldest: tk('Cabeça de chapa mais velho'), earliest: tk('Chapa registrada primeiro'), runoff: tk('Novo turno entre as empatadas') });
export const CATEGORY_LABEL = Object.freeze({ athlete: tk('Atletas'), coach: tk('Professores'), referee: tk('Árbitros'), club: tk('Clubes filiados'), arena: tk('Arenas filiadas') });
export const CALENDAR_LABEL = Object.freeze({
  notice_on: tk('Edital'), candidacy_from: tk('Abre o registro de chapas'), candidacy_to: tk('Fecha o registro de chapas'), challenge_to: tk('Prazo de impugnação'),
  defense_to: tk('Prazo de defesa'), voting_from: tk('Abre a votação'), voting_to: tk('Fecha a votação'), result_on: tk('Resultado'), inauguration_on: tk('Posse'),
});
export const TODO_LABEL = Object.freeze({
  publish: tk('Revise e publique o edital'), judge_candidacies: tk('Analise as chapas registradas'), judge_challenges: tk('Julgue as impugnações'),
  open_voting: tk('Abra a votação'), wait: tk('Aguarde o calendário'), monitor: tk('Votação em andamento'), close_voting: tk('Encerre a votação'),
  record_presential: tk('Lance a votação presencial'), publish_result: tk('Apure e publique o resultado'),
});

/** Um rascunho de edital com o calendário já coerente (edital hoje, votação em 45 dias). */
export function electionDraft(hoje) {
  const d = (n) => new Date(Date.parse(`${hoje}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
  return {
    title: '', description: '', mode: 'online', tie_rule: 'oldest', endorsement_pct: 0, notice_min_days: NOTICE_MIN_DAYS,
    positions: [{ label: 'Diretoria executiva', kind: 'slate', organ: 'board', seats: 1, gender_min: 0 }],
    calendar: {
      notice_on: hoje, candidacy_from: d(1), candidacy_to: d(15), challenge_to: d(20), defense_to: d(25),
      voting_from: d(45), voting_to: d(45), result_on: d(46), inauguration_on: '', voting_opens: '08:00', voting_closes: '18:00',
    },
    college: { min_months: 0, weights: { ...DEFAULT_WEIGHTS } },
    commission: [],
  };
}

/** A linha do tempo do calendário para a tela: cada data com `done` (passou) e a de agora. */
export function electionTimeline(e, hoje) {
  const c = (e && e.calendar) || {};
  const itens = CALENDAR_KEYS.filter((k) => c[k]).map((k) => ({ key: k, date: c[k], label: CALENDAR_LABEL[k], done: c[k] < hoje }));
  const atual = itens.findIndex((i) => !i.done);
  return itens.map((i, n) => ({ ...i, current: n === atual }));
}

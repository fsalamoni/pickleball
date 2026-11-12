/**
 * MINHA CARREIRA — o torneio de FORA da plataforma (`career_events/{uid}_{id}`).
 *
 * PURO (sem React, sem Firebase). Fonte única de:
 *  - as listas FECHADAS do registro (formato, gênero, idade, faixa de nível,
 *    colocação, tipo de foto) — os valores são GRAVADOS: nunca renomeie;
 *  - os limites de cada campo (a regra do Firestore é rasa de propósito, como
 *    em `player_goals`: quem segura o tamanho é este arquivo e o serviço);
 *  - o status derivado da DATA LOCAL (passada = `played`, futura = `planned`);
 *  - a completude em camadas ("2 de 3") com o ÚNICO próximo passo;
 *  - o "É este?" contra os torneios da plataforma em que a pessoa jogou;
 *  - o modo lista (ano · nome · categoria · medalha) e o "repetir o do ano
 *    passado".
 *
 * O resultado aqui é DECLARADO pela pessoa: nunca entra em ranking, rating
 * nem XP (guarda `src/core/guards/carreiraNaoPontua.test.js`).
 */
import { t, tk } from '@/core/i18n';
import { normalizeLocality } from '@/core/domain/locality.js';
import { isBrazilUF } from '@/core/domain/ufs.js';
import { LEVEL_BRACKETS, LEGACY_LEVEL_BRACKETS, LEVEL_BRACKET_LABEL, levelBracketText } from '@/core/domain/levelBrackets.js';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { addDays, isISODate, toISODate, todayLocal } from '@/modules/training/domain/dates.js';
import {
  AGE_CATEGORY, AGE_CATEGORY_LABELS, GENDER_CATEGORY, TOURNAMENT_STATUS, TOURNAMENT_VISIBILITY,
} from '@/modules/tournament/domain/constants.js';

export const CAREER_EVENTS = 'career_events';

/** Status gravado. Nunca renomeie. */
export const CAREER_STATUS = Object.freeze({ PLAYED: 'played', PLANNED: 'planned', CANCELLED: 'cancelled' });

/** Formato da participação. "Equipes" existe só na carreira. Gravado: nunca renomeie. */
export const CAREER_FORMAT = Object.freeze({ SINGLES: 'singles', DOUBLES: 'doubles', TEAMS: 'teams', AMERICANO: 'americano' });
export const CAREER_FORMAT_LABEL = Object.freeze({
  singles: tk('Simples'), doubles: tk('Duplas'), teams: tk('Equipe'), americano: tk('Americano'),
});

/**
 * O formato tem dupla FIXA? Simples não tem dupla e no Americano a dupla troca a
 * cada jogo: nos dois a ficha não pede "com quem você jogou" nem convida
 * ninguém. Cópia no servidor (`functions/careerPolicy.js`), com paridade.
 */
export const formatHasPartner = (format) => format !== CAREER_FORMAT.SINGLES && format !== CAREER_FORMAT.AMERICANO;

/** Gênero da categoria: os valores de `GENDER_CATEGORY` (o registro rápido oferece os três primeiros). */
export const CAREER_GENDERS = Object.freeze([GENDER_CATEGORY.MALE, GENDER_CATEGORY.FEMALE, GENDER_CATEGORY.MIXED, GENDER_CATEGORY.OPEN]);
export const CAREER_GENDER_LABEL = Object.freeze({
  male: tk('Masc'), female: tk('Fem'), mixed: tk('Mista'), open: tk('Aberta'),
});

/** Idade: `AGE_CATEGORY` ou `other` (com `age_label` livre — o 40+ não existe na lista). */
export const CAREER_AGES = Object.freeze([...Object.values(AGE_CATEGORY), 'other']);

/**
 * Faixa de nível DECLARADA (como o torneio de fora chamou a categoria). Nunca
 * alimenta a régua 2.0–8.0. Desde 2026-11-12 é a lista OFICIAL da plataforma
 * e mora no núcleo (`core/domain/levelBrackets.js`); aqui só se reexporta. As
 * faixas antigas (`LEGACY_LEVEL_BRACKETS`) seguem aceitas ao salvar de novo.
 */
export { LEVEL_BRACKETS, LEGACY_LEVEL_BRACKETS, LEVEL_BRACKET_LABEL, levelBracketText };
const ACCEPTED_LEVEL_BRACKETS = Object.freeze([...LEVEL_BRACKETS, ...LEGACY_LEVEL_BRACKETS]);

/** Colocação. Gravado: nunca renomeie. */
export const PLACEMENT = Object.freeze({
  CHAMPION: 'champion', RUNNER_UP: 'runner_up', THIRD: 'third', SEMIS: 'semis',
  QUARTERS: 'quarters', ROUND_OF_16: 'round_of_16', GROUPS: 'groups', OTHER: 'other',
});
export const PLACEMENT_LABEL = Object.freeze({
  champion: tk('Campeão'), runner_up: tk('Vice'), third: tk('3º lugar'), semis: tk('Semifinal'),
  quarters: tk('Quartas de final'), round_of_16: tk('Oitavas de final'), groups: tk('Fase de grupos'), other: tk('Outra colocação'),
});
/** O degrau do pódio (1, 2, 3) de cada colocação; o resto não é pódio. */
export const PLACEMENT_POSITION = Object.freeze({ champion: 1, runner_up: 2, third: 3 });

/** Tipo da foto. Gravado. */
export const PHOTO_KIND = Object.freeze(['medal', 'podium', 'draw', 'other']);
export const PHOTO_KIND_LABEL = Object.freeze({
  medal: tk('Medalha'), podium: tk('Pódio'), draw: tk('Chave'), other: tk('Outra'),
});

/** Prioridade do planejado. Gravado. */
export const CAREER_PRIORITY = Object.freeze(['main', 'important', 'casual']);

export const CAREER_LIMITS = Object.freeze({
  name: 120, organizer: 120, city: 80, link: 300, stage: 40, notes: 2000,
  entries: 6, photos: 6, label: 40, partner: 80, alt: 140, federation: 120, acronym: 16,
  aim: 120, ifThen: 200,
});

/** "O foco funcionou?" (depois do planejado com foco). Gravado: nunca renomeie. */
export const FOCUS_RESULT = Object.freeze(['yes', 'partly', 'no']);

const ID_OK = /^[\w-]{6,128}$/;

const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const umDe = (v, lista, padrao = null) => (lista.includes(v) ? v : padrao);
const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Só `https://`, ≤ 300. Guardado, nunca aberto pelo servidor (SSRF). */
export function normalizeCareerLink(v) {
  const s = String(v ?? '').trim();
  if (!s || s.length > CAREER_LIMITS.link || !/^https:\/\/[^\s/]+\.[^\s]+/i.test(s)) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password ? s : '';
  } catch {
    return '';
  }
}

/** A dupla: o nome (≤ 80) e o uid só quando veio do seletor de usuários. */
function normalizePartner(p) {
  const name = txt(p?.name, CAREER_LIMITS.partner);
  if (!name) return null;
  const uid = typeof p?.uid === 'string' && /^[\w-]{6,128}$/.test(p.uid) ? p.uid : null;
  return uid ? { uid, name } : { name };
}

/** `{ uid, id }` do registro da dupla (o id começa pelo uid dela), ou `null`. */
function normalizeLinkedEvent(v) {
  const uid = typeof v?.uid === 'string' && /^[\w-]{6,128}$/.test(v.uid) ? v.uid : null;
  const id = typeof v?.id === 'string' && v.id.length <= 200 ? v.id : '';
  return uid && id.startsWith(`${uid}_`) ? { uid, id } : null;
}

/** Uma participação (uma categoria jogada). */
export function normalizeEntry(raw = {}) {
  const format = umDe(raw.format, Object.values(CAREER_FORMAT), CAREER_FORMAT.DOUBLES);
  const out = {
    format,
    gender: umDe(raw.gender, CAREER_GENDERS, null),
    age: umDe(raw.age, CAREER_AGES, null),
    level_bracket: umDe(raw.level_bracket, ACCEPTED_LEVEL_BRACKETS, null),
    placement: umDe(raw.placement, Object.values(PLACEMENT), null),
  };
  if (out.age === 'other') out.age_label = txt(raw.age_label, CAREER_LIMITS.label);
  if (out.level_bracket === 'other') out.level_label = txt(raw.level_label, CAREER_LIMITS.label);
  const n = numero(raw.placement_n);
  if (out.placement === PLACEMENT.OTHER && n !== null && n >= 1 && n <= 999) out.placement_n = Math.round(n);
  const pts = numero(raw.points_declared);
  if (pts !== null && pts >= 0 && pts <= 100000) out.points_declared = Math.round(pts);
  // Simples e Americano não têm dupla fixa. Equipe guarda a dupla de dentro da equipe (PR 3 convida).
  const partner = formatHasPartner(format) ? normalizePartner(raw.partner) : null;
  if (partner) out.partner = partner;
  return out;
}

/** Uma foto: caminho no Storage (`carreira/{uid}/…`), link com token, tipo e descrição. */
export function normalizePhoto(raw = {}, uid = null) {
  const path = String(raw.path || '');
  if (!path.startsWith('carreira/') || (uid && !path.startsWith(`carreira/${uid}/`))) return null;
  const url = String(raw.url || '');
  return {
    path,
    url: /^https:\/\//.test(url) ? url.slice(0, 2000) : '',
    kind: umDe(raw.kind, PHOTO_KIND, 'other'),
    alt: txt(raw.alt, CAREER_LIMITS.alt),
  };
}

/**
 * Status pela data LOCAL: futura = planejado; hoje ou antes = jogado.
 * Cancelado fica cancelado. Nunca `Date.parse` cru (seria meia-noite UTC).
 *
 * O que JÁ ERA planejado (`current`) segue planejado até o ÚLTIMO dia do
 * torneio (`endDate`, ou o início): no dia do jogo a tela diz "É hoje" e só no
 * dia seguinte pergunta "Como foi?" — a mesma régua do aviso D+1 do servidor.
 * Com a colocação já dita (`hasResult`) vale a data de início: quem lança o
 * resultado no dia não fica preso em "planejado". Registro novo com a data de
 * hoje continua sendo jogado.
 */
export function deriveCareerStatus(startDate, { current = null, today = todayLocal(), endDate = null, hasResult = false } = {}) {
  if (current === CAREER_STATUS.CANCELLED) return CAREER_STATUS.CANCELLED;
  if (!isISODate(startDate)) return CAREER_STATUS.PLAYED;
  const emPlano = current === CAREER_STATUS.PLANNED && !hasResult;
  const fim = emPlano && isISODate(endDate) && endDate > startDate ? endDate : startDate;
  return (emPlano ? fim >= today : startDate > today) ? CAREER_STATUS.PLANNED : CAREER_STATUS.PLAYED;
}

const temResultado = (ev) => (ev?.entries || []).some((e) => Boolean(e?.placement));

/**
 * O planejado que veio de um torneio do PickleRush ("Pôr no meu plano",
 * `origin_ref: 'tor:…'`). É só PLANO: não liga ao torneio (isso é o "É este"),
 * não pergunta "Como foi?" e, passada a data, sai da linha do tempo — o
 * resultado, se a pessoa jogou, é o oficial.
 */
export const isPlatformPlan = (ev) => typeof ev?.origin_ref === 'string' && ev.origin_ref.startsWith('tor:');
export const platformPlanTournamentId = (ev) => (isPlatformPlan(ev) ? ev.origin_ref.slice(4) : null);

/**
 * O evento com o status de HOJE: o gravado é o do dia em que se salvou, e o
 * planejado cuja data passou é jogado. Aplicado na leitura (`listCareerEvents`).
 */
export function withDerivedStatus(ev, today = todayLocal()) {
  if (!ev) return ev;
  const status = deriveCareerStatus(ev.start_date, { current: ev.status, today, endDate: ev.end_date, hasResult: temResultado(ev) });
  // `planned_passed`: era planejado e a data (o último dia) passou — a ficha pergunta "Como foi?" (não é gravado).
  // O plano de um torneio do PickleRush não pergunta: quem jogou tem o resultado oficial.
  return status === ev.status ? ev : { ...ev, status, ...(ev.status === CAREER_STATUS.PLANNED && !isPlatformPlan(ev) ? { planned_passed: true } : {}) };
}

/**
 * O plano que passou e ainda ESPERA a resposta ("Como foi?"): o último dia
 * passou e nenhuma colocação foi dita. Não se sabe se a pessoa jogou — é
 * pendência e fica FORA de toda contagem de torneio jogado.
 */
export const awaitsResult = (ev) => ev?.planned_passed === true && !temResultado(ev);

/**
 * Torneio de FORA que conta como jogado: jogado, não é o plano de um torneio
 * do PickleRush (ali vale o oficial) e não espera o "Como foi?". A régua ÚNICA
 * dos resumos (Minha área, Meu desempenho, "N de ~M", repetir, parcerias):
 * nunca filtre `status === 'played'` à mão para contar.
 */
export const isOutsidePlayed = (ev) => ev?.status === CAREER_STATUS.PLAYED && !isPlatformPlan(ev) && !awaitsResult(ev);

/** Data que existe (31/02 não) e o ano aceito: de 1990 a cinco à frente (erro de digitação fica de fora). */
const dataReal = (iso) => isISODate(iso) && addDays(iso, 0) === iso;
const ANO_MIN = 1990;

/**
 * Normaliza o evento inteiro, com os limites. `{ valid, error, value }`.
 * Nome e data são obrigatórios; participação, pelo menos uma.
 */
export function normalizeCareerEvent(raw = {}, { uid = null, today = todayLocal(), nowMs = Date.now() } = {}) {
  const name = txt(raw.name, CAREER_LIMITS.name);
  if (!name) return { valid: false, error: t('Dê um nome ao torneio.'), value: null };
  const datePrecision = raw.date_precision === 'year' ? 'year' : 'day';
  const start = String(raw.start_date || '');
  if (!dataReal(start)) return { valid: false, error: t('Escolha a data do torneio.'), value: null };
  // "0202" e "2206" são erro de digitação: criariam uma temporada absurda e um plano que nunca passa.
  const anoMax = Number(today.slice(0, 4)) + 5;
  const anoOk = (iso) => Number(iso.slice(0, 4)) >= ANO_MIN && Number(iso.slice(0, 4)) <= anoMax;
  if (!anoOk(start)) return { valid: false, error: t('Ano entre 1990 e {ano}.', { ano: anoMax }), value: null };
  let end = dataReal(raw.end_date) && anoOk(raw.end_date) ? raw.end_date : null;
  if (end && end < start) end = null;
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).slice(0, CAREER_LIMITS.entries).map(normalizeEntry);
  if (!entries.length) return { valid: false, error: t('Escolha pelo menos uma categoria.'), value: null };
  const status = deriveCareerStatus(start, { current: raw.status, today, endDate: end, hasResult: entries.some((e) => Boolean(e.placement)) });
  const state = String(raw.state || '').trim().toUpperCase();
  const value = {
    uid: uid || raw.uid || null,
    status,
    name,
    organizer: txt(raw.organizer, CAREER_LIMITS.organizer),
    city: txt(raw.city, CAREER_LIMITS.city),
    state: isBrazilUF(state) ? state : '',
    start_date: start,
    end_date: end,
    date_precision: datePrecision,
    link: normalizeCareerLink(raw.link),
    federated: raw.federated === true || Boolean(raw.federation_id),
    federation_id: typeof raw.federation_id === 'string' && raw.federation_id ? raw.federation_id.slice(0, 128) : null,
    federation_name: txt(raw.federation_name, CAREER_LIMITS.federation),
    federation_acronym: txt(raw.federation_acronym, CAREER_LIMITS.acronym),
    stage_tier: txt(raw.stage_tier, CAREER_LIMITS.stage),
    entries,
    photos: (Array.isArray(raw.photos) ? raw.photos : []).map((p) => normalizePhoto(p, uid || raw.uid)).filter(Boolean).slice(0, CAREER_LIMITS.photos),
    notes: String(raw.notes ?? '').slice(0, CAREER_LIMITS.notes),
    platform_tournament_id: typeof raw.platform_tournament_id === 'string' && raw.platform_tournament_id ? raw.platform_tournament_id.slice(0, 128) : null,
    // As contas citadas como dupla (consulta `array-contains` da exclusão de conta, que tira o uid de quem saiu).
    partner_uids: [...new Set(entries.map((e) => e.partner?.uid).filter(Boolean))],
    // "Pôr na minha carreira também": o registro de quem convidou. O servidor confere e liga os dois.
    linked_event: normalizeLinkedEvent(raw.linked_event),
    created_at_ms: Number(raw.created_at_ms) || nowMs,
    updated_at_ms: nowMs,
  };
  if (status === CAREER_STATUS.PLANNED) value.priority = umDe(raw.priority, CAREER_PRIORITY, 'casual');
  // PR 4 — o planejado: prazo de inscrição, "Já me inscrevi", a meta e o foco do torneio.
  if (isISODate(raw.registration_deadline) && raw.registration_deadline <= start) value.registration_deadline = raw.registration_deadline;
  if (raw.registered === true) value.registered = true;
  const aim = txt(raw.aim, CAREER_LIMITS.aim);
  if (aim) value.aim = aim;
  if (typeof raw.focus_aspect === 'string' && /^[a-z_]{2,40}$/.test(raw.focus_aspect)) value.focus_aspect = raw.focus_aspect;
  const ifThen = txt(raw.if_then, CAREER_LIMITS.ifThen);
  if (ifThen) value.if_then = ifThen;
  if (value.focus_aspect && FOCUS_RESULT.includes(raw.focus_result)) value.focus_result = raw.focus_result;
  // "Mandar ao meu professor": ato explícito; a regra confere o vínculo ATIVO.
  if (typeof raw.shared_coach_id === 'string' && ID_OK.test(raw.shared_coach_id)) value.shared_coach_id = raw.shared_coach_id;
  // "Pôr no meu plano": de onde veio (não oferecer de novo o que já está no plano).
  if (typeof raw.origin_ref === 'string' && /^(fed|tor):[\w:-]{1,150}$/.test(raw.origin_ref)) value.origin_ref = raw.origin_ref;
  return { valid: true, error: '', value };
}

/** Id novo, com o prefixo do dono (a regra confere): `{uid}_{tempo}{aleatório}`. */
export function newCareerEventId(uid, now = Date.now(), rand = Math.random()) {
  return `${uid}_${now.toString(36)}${Math.floor(rand * 1e6).toString(36)}`;
}

/** O melhor degrau (1–3) entre as participações, ou `null`. */
export function bestPosition(event) {
  const ps = (event?.entries || []).map((e) => PLACEMENT_POSITION[e.placement]).filter(Boolean);
  return ps.length ? Math.min(...ps) : null;
}

/** "Duplas Mista", "Simples Masc · 3.5" — o rótulo de uma participação. */
export function entryLabel(entry) {
  if (!entry) return '';
  const partes = [t(CAREER_FORMAT_LABEL[entry.format] || CAREER_FORMAT_LABEL.doubles)];
  if (entry.gender) partes[0] += ` ${t(CAREER_GENDER_LABEL[entry.gender])}`;
  if (entry.age && entry.age !== 'open') partes.push(entry.age === 'other' ? entry.age_label : AGE_CATEGORY_LABELS[entry.age]);
  if (entry.level_bracket) partes.push(levelBracketText(entry.level_bracket, entry.level_label));
  return partes.filter(Boolean).join(' · ');
}

/** "Campeão", "Semifinal", "5º lugar". */
export function placementText(entry) {
  if (!entry?.placement) return '';
  if (entry.placement === PLACEMENT.OTHER && entry.placement_n) return t('{n}º lugar', { n: entry.placement_n });
  return t(PLACEMENT_LABEL[entry.placement]);
}

/* ------------------------------------------------------- completude -- */

/** As camadas da ficha, em ordem. `available: false` = não dá para saber (o balanço não carregou). */
export const CAREER_LAYER = Object.freeze({ RESULT: 'resultado', PHOTO: 'foto', PARTNER: 'dupla', DEBRIEF: 'balanco' });
const LAYER_STEP = Object.freeze({
  resultado: tk('Diga a colocação'),
  foto: tk('Ponha a foto da medalha ou do pódio'),
  dupla: tk('Diga com quem você jogou'),
  balanco: tk('Faça o balanço do torneio'),
});

/**
 * Completude em camadas de um torneio JOGADO: `{ done, total, layers, next }`.
 * `debriefDone` (booleano) diz se o balanço do torneio foi feito
 * (`careerDebriefFor`); sem ele — os balanços não carregaram — a camada sai da
 * conta e do próximo passo, em vez de afirmar que falta. Planejado,
 * cancelado ("Não fui"), o plano que passou e ainda espera o "Como foi?" e o
 * plano de um torneio do PickleRush: `null` — não há o que completar (a ficha
 * nem mostra colocação e foto nesses casos). A régua é `isOutsidePlayed`.
 */
export function careerCompleteness(event, { debriefDone } = {}) {
  if (!isOutsidePlayed(event)) return null;
  const entries = event.entries || [];
  const precisaDupla = entries.filter((e) => formatHasPartner(e.format));
  const layers = [
    { id: CAREER_LAYER.RESULT, done: entries.length > 0 && entries.every((e) => Boolean(e.placement)), available: true },
    { id: CAREER_LAYER.PHOTO, done: (event.photos || []).length > 0, available: true },
    { id: CAREER_LAYER.PARTNER, done: precisaDupla.every((e) => Boolean(e.partner?.name)), available: true },
    { id: CAREER_LAYER.DEBRIEF, done: debriefDone === true, available: typeof debriefDone === 'boolean' },
  ];
  const valendo = layers.filter((l) => l.available);
  const falta = valendo.find((l) => !l.done) || null;
  return {
    done: valendo.filter((l) => l.done).length,
    total: valendo.length,
    layers,
    next: falta ? { id: falta.id, label: t(LAYER_STEP[falta.id]) } : null,
  };
}

/* ----------------------------------------------------------- "É este?" -- */

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'em', 'no', 'na', 'torneio', 'open', 'copa', 'etapa']);

/** Nome comparável: sem acento, caixa, pontuação, ano e palavras vazias. */
export function normalizeTournamentName(nome) {
  return normalizeLocality(nome)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p) && !/^(19|20)\d{2}$/.test(p));
}

function nomeParecido(a, b) {
  const x = normalizeTournamentName(a);
  const y = new Set(normalizeTournamentName(b));
  if (!x.length || !y.size) return false;
  const comuns = x.filter((p) => y.has(p)).length;
  return comuns / Math.min(x.length, y.size) >= 0.6;
}

const diaLocal = (v) => {
  const ms = instanteDoDiaEmMs(v);
  return Number.isFinite(ms) ? toISODate(new Date(ms)) : null;
};

const distanciaDias = (a, b) => Math.round(Math.abs(instanteDoDiaEmMs(a) - instanteDoDiaEmMs(b)) / 86400000);

/**
 * "É este?": o torneio da plataforma em que a pessoa JOGOU (`listMyTournaments`
 * com `is_player`) que parece ser o registrado — nome parecido, data a até 3
 * dias e, quando os dois têm cidade, a mesma cidade. `null` sem candidato.
 * A lista que FALHOU chega `undefined` e a resposta é `null`: nunca afirma
 * "não está na plataforma".
 */
export function matchPlatformTournament(event, myTournaments) {
  if (!event || !Array.isArray(myTournaments) || event.date_precision === 'year') return null;
  if (event.platform_tournament_id) return null;
  const candidatos = myTournaments.filter(isCareerPlatformTournament).map((tt) => {
    const dia = diaLocal(tt.starts_at) || diaLocal(tt.start_date);
    if (!dia || !isISODate(event.start_date)) return null;
    const dist = distanciaDias(dia, event.start_date);
    if (dist > 3) return null;
    if (!nomeParecido(event.name, tt.name)) return null;
    if (event.city && tt.city && normalizeLocality(event.city) !== normalizeLocality(tt.city)) return null;
    return { tournament: tt, dist };
  }).filter(Boolean);
  candidatos.sort((a, b) => a.dist - b.dist);
  return candidatos[0]?.tournament || null;
}

/**
 * Torneio da plataforma que conta como JOGADO na carreira: a pessoa jogou e
 * ele não é rascunho (ambiente de teste) nem privado. Cancelado fica (aparece riscado).
 */
export function isCareerPlatformTournament(tt) {
  return Boolean(tt && tt.is_player && tt.status !== TOURNAMENT_STATUS.DRAFT && tt.visibility !== TOURNAMENT_VISIBILITY.PRIVATE);
}

/** O selo "oficial" só vale com o torneio na lista de quem JOGOU. */
export function isOfficialLink(event, myTournaments) {
  if (!event?.platform_tournament_id || !Array.isArray(myTournaments)) return false;
  return myTournaments.some((tt) => tt?.id === event.platform_tournament_id && isCareerPlatformTournament(tt));
}

/**
 * Selo derivado (nunca gravado): `official` (ligado ao torneio da plataforma),
 * `confirmed` (a dupla confirmou — `partnerSeal` vem de `partnerSealFor`, sobre
 * os documentos que só o servidor grava) ou `declared`.
 */
export function careerSeal(event, myTournaments, partnerSeal = null) {
  if (isOfficialLink(event, myTournaments)) return 'official';
  return partnerSeal === 'confirmed' ? 'confirmed' : 'declared';
}

/* ------------------------------------------------------- modo lista -- */

/** Uma linha vazia do modo lista. */
export function emptyListRow(year = Number(todayLocal().slice(0, 4))) {
  return { year, name: '', format: CAREER_FORMAT.DOUBLES, gender: null, placement: null };
}

/**
 * Linhas do modo lista → eventos (só o ano é conhecido: `date_precision:
 * 'year'`, data 1º de janeiro, nunca no futuro). Linha vazia é ignorada; sem
 * nome mas com categoria ou medalha, é erro.
 * `{ events, errors }` — `errors` diz QUAL linha ficou de fora e por quê.
 */
export function listRowsToEvents(rows, { uid, today = todayLocal(), nowMs = Date.now(), rand = Math.random } = {}) {
  const anoAtual = Number(today.slice(0, 4));
  const events = [];
  const errors = [];
  (rows || []).forEach((r, i) => {
    if (!txt(r?.name, CAREER_LIMITS.name)) {
      // Linha com categoria ou medalha e sem nome foi começada: dizer, em vez de ignorar calada.
      if (r?.gender || r?.placement) errors.push({ row: i, error: t('Falta o nome do torneio.') });
      return;
    }
    const ano = Math.round(Number(r.year));
    if (!Number.isFinite(ano) || ano < 1990 || ano > anoAtual) {
      errors.push({ row: i, error: t('Ano entre 1990 e {ano}.', { ano: anoAtual }) });
      return;
    }
    const { valid, error, value } = normalizeCareerEvent({
      name: r.name,
      start_date: `${ano}-01-01`,
      date_precision: 'year',
      status: CAREER_STATUS.PLAYED,
      entries: [{ format: r.format, gender: r.gender, placement: r.placement }],
    }, { uid, today, nowMs });
    if (!valid) { errors.push({ row: i, error }); return; }
    // A linha que já tem id (dado pela tela ao criá-la) o mantém: salvar de novo regrava o MESMO documento.
    const id = uid && typeof r.id === 'string' && r.id.startsWith(`${uid}_`) ? r.id : newCareerEventId(uid, nowMs + i, rand());
    events.push({ id, ...value });
  });
  return { events, errors };
}

/** "7 de ~20 registrados": `null` sem a estimativa da pessoa. */
export function registeredProgress(events, estimate) {
  const total = Math.round(Number(estimate));
  // Lista que não carregou não vira "0 de ~N".
  if (!Array.isArray(events) || !Number.isFinite(total) || total <= 0) return null;
  const feitos = events.filter(isOutsidePlayed).length;
  return { done: feitos, estimate: total, complete: feitos >= total };
}

/* -------------------------------------------- repetir o do ano passado -- */

/**
 * O rascunho de "repetir o torneio do ano passado": nome (com o ano trazido
 * para a edição seguinte, se o nome tiver ano), organizador, cidade e
 * federação. A data sugerida mantém o dia da semana (364 dias por edição) e
 * anda quantas edições forem precisas para não nascer no passado: o torneio de
 * anos atrás vem para este ano e, se a data deste ano já passou, para o
 * próximo. As categorias e o resultado ficam em branco.
 */
export function repeatEvent(previous, today = todayLocal()) {
  if (!previous) return null;
  const comData = isISODate(previous.start_date);
  let n = comData ? Math.max(1, Number(today.slice(0, 4)) - Number(previous.start_date.slice(0, 4))) : 1;
  const comDia = comData && previous.date_precision !== 'year';
  // 20 edições é teto de segurança (data absurda não trava a tela).
  while (comDia && n < 20 && addDays(previous.start_date, 364 * n) < today) n += 1;
  const nome = String(previous.name || '').replace(/\b(19|20)\d{2}\b/, (a) => String(Number(a) + n));
  const sugestao = comDia ? addDays(previous.start_date, 364 * n) : '';
  return {
    name: nome,
    organizer: previous.organizer || '',
    city: previous.city || '',
    state: previous.state || '',
    federated: previous.federated === true,
    federation_id: previous.federation_id || null,
    federation_name: previous.federation_name || '',
    federation_acronym: previous.federation_acronym || '',
    stage_tier: previous.stage_tier || '',
    start_date: sugestao,
  };
}

/** Os eventos que dá para repetir: os jogados de anos ANTERIORES, do mais novo. */
export function repeatableEvents(events, today = todayLocal()) {
  const ano = today.slice(0, 4);
  return (events || [])
    .filter((e) => isOutsidePlayed(e) && String(e.start_date).slice(0, 4) < ano)
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
}

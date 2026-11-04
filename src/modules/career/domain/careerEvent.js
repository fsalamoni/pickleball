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
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { addDays, isISODate, toISODate, todayLocal } from '@/modules/training/domain/dates.js';
import {
  AGE_CATEGORY, AGE_CATEGORY_LABELS, GENDER_CATEGORY, TOURNAMENT_STATUS, TOURNAMENT_VISIBILITY,
} from '@/modules/tournament/domain/constants.js';

export const CAREER_EVENTS = 'career_events';

/** Status gravado. Nunca renomeie. */
export const CAREER_STATUS = Object.freeze({ PLAYED: 'played', PLANNED: 'planned', CANCELLED: 'cancelled' });

/** Formato da participação. "Equipes" existe só na carreira. Gravado. */
export const CAREER_FORMAT = Object.freeze({ SINGLES: 'singles', DOUBLES: 'doubles', TEAMS: 'teams' });
export const CAREER_FORMAT_LABEL = Object.freeze({
  singles: tk('Simples'), doubles: tk('Duplas'), teams: tk('Equipe'),
});

/** Gênero da categoria: os valores de `GENDER_CATEGORY` (o registro rápido oferece os três primeiros). */
export const CAREER_GENDERS = Object.freeze([GENDER_CATEGORY.MALE, GENDER_CATEGORY.FEMALE, GENDER_CATEGORY.MIXED, GENDER_CATEGORY.OPEN]);
export const CAREER_GENDER_LABEL = Object.freeze({
  male: tk('Masc'), female: tk('Fem'), mixed: tk('Mista'), open: tk('Aberta'),
});

/** Idade: `AGE_CATEGORY` ou `other` (com `age_label` livre — o 40+ não existe na lista). */
export const CAREER_AGES = Object.freeze([...Object.values(AGE_CATEGORY), 'other']);

/** Faixa de nível DECLARADA. Nunca alimenta a régua 2.0–8.0. Gravado. */
export const LEVEL_BRACKETS = Object.freeze(['2.5', '3.0', '3.5', '4.0', '4.5', '5.0+', 'A', 'B', 'C', 'D', 'open', 'other']);

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
});

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

/** Uma participação (uma categoria jogada). */
export function normalizeEntry(raw = {}) {
  const format = umDe(raw.format, Object.values(CAREER_FORMAT), CAREER_FORMAT.DOUBLES);
  const out = {
    format,
    gender: umDe(raw.gender, CAREER_GENDERS, null),
    age: umDe(raw.age, CAREER_AGES, null),
    level_bracket: umDe(raw.level_bracket, LEVEL_BRACKETS, null),
    placement: umDe(raw.placement, Object.values(PLACEMENT), null),
  };
  if (out.age === 'other') out.age_label = txt(raw.age_label, CAREER_LIMITS.label);
  if (out.level_bracket === 'other') out.level_label = txt(raw.level_label, CAREER_LIMITS.label);
  const n = numero(raw.placement_n);
  if (out.placement === PLACEMENT.OTHER && n !== null && n >= 1 && n <= 999) out.placement_n = Math.round(n);
  const pts = numero(raw.points_declared);
  if (pts !== null && pts >= 0 && pts <= 100000) out.points_declared = Math.round(pts);
  // Simples não tem dupla. Equipe guarda a dupla de dentro da equipe (PR 3 convida).
  const partner = format === CAREER_FORMAT.SINGLES ? null : normalizePartner(raw.partner);
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
 */
export function deriveCareerStatus(startDate, { current = null, today = todayLocal() } = {}) {
  if (current === CAREER_STATUS.CANCELLED) return CAREER_STATUS.CANCELLED;
  return isISODate(startDate) && startDate > today ? CAREER_STATUS.PLANNED : CAREER_STATUS.PLAYED;
}

/**
 * O evento com o status de HOJE: o gravado é o do dia em que se salvou, e o
 * planejado cuja data passou é jogado. Aplicado na leitura (`listCareerEvents`).
 */
export function withDerivedStatus(ev, today = todayLocal()) {
  if (!ev) return ev;
  const status = deriveCareerStatus(ev.start_date, { current: ev.status, today });
  return status === ev.status ? ev : { ...ev, status };
}

/**
 * Normaliza o evento inteiro, com os limites. `{ valid, error, value }`.
 * Nome e data são obrigatórios; participação, pelo menos uma.
 */
export function normalizeCareerEvent(raw = {}, { uid = null, today = todayLocal(), nowMs = Date.now() } = {}) {
  const name = txt(raw.name, CAREER_LIMITS.name);
  if (!name) return { valid: false, error: t('Dê um nome ao torneio.'), value: null };
  const datePrecision = raw.date_precision === 'year' ? 'year' : 'day';
  const start = String(raw.start_date || '');
  if (!isISODate(start)) return { valid: false, error: t('Escolha a data do torneio.'), value: null };
  let end = isISODate(raw.end_date) ? raw.end_date : null;
  if (end && end < start) end = null;
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).slice(0, CAREER_LIMITS.entries).map(normalizeEntry);
  if (!entries.length) return { valid: false, error: t('Escolha pelo menos uma categoria.'), value: null };
  const status = deriveCareerStatus(start, { current: raw.status, today });
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
    created_at_ms: Number(raw.created_at_ms) || nowMs,
    updated_at_ms: nowMs,
  };
  if (status === CAREER_STATUS.PLANNED) value.priority = umDe(raw.priority, CAREER_PRIORITY, 'casual');
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
  if (entry.level_bracket) partes.push(entry.level_bracket === 'other' ? entry.level_label : (entry.level_bracket === 'open' ? t('Open') : entry.level_bracket));
  return partes.filter(Boolean).join(' · ');
}

/** "Campeão", "Semifinal", "5º lugar". */
export function placementText(entry) {
  if (!entry?.placement) return '';
  if (entry.placement === PLACEMENT.OTHER && entry.placement_n) return t('{n}º lugar', { n: entry.placement_n });
  return t(PLACEMENT_LABEL[entry.placement]);
}

/* ------------------------------------------------------- completude -- */

/** As camadas da ficha, em ordem. `available: false` = ainda não existe (o balanço é do PR 2). */
export const CAREER_LAYER = Object.freeze({ RESULT: 'resultado', PHOTO: 'foto', PARTNER: 'dupla', DEBRIEF: 'balanco' });
const LAYER_STEP = Object.freeze({
  resultado: tk('Diga a colocação'),
  foto: tk('Ponha a foto da medalha ou do pódio'),
  dupla: tk('Diga com quem você jogou'),
  balanco: tk('Faça o balanço do torneio'),
});

/**
 * Completude em camadas de um torneio JOGADO: `{ done, total, layers, next }`.
 * Só conta o que existe (`debrief: false` tira o balanço da conta e do
 * próximo passo). Planejado ou cancelado: `null` — não há o que completar.
 */
export function careerCompleteness(event, { debrief = false } = {}) {
  if (!event || event.status !== CAREER_STATUS.PLAYED) return null;
  const entries = event.entries || [];
  const precisaDupla = entries.filter((e) => e.format !== CAREER_FORMAT.SINGLES);
  const layers = [
    { id: CAREER_LAYER.RESULT, done: entries.length > 0 && entries.every((e) => Boolean(e.placement)), available: true },
    { id: CAREER_LAYER.PHOTO, done: (event.photos || []).length > 0, available: true },
    { id: CAREER_LAYER.PARTNER, done: precisaDupla.every((e) => Boolean(e.partner?.name)), available: true },
    { id: CAREER_LAYER.DEBRIEF, done: false, available: debrief === true },
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

/** Selo derivado (nunca gravado): `official` ou `declared`. O da dupla é do PR 3. */
export function careerSeal(event, myTournaments) {
  return isOfficialLink(event, myTournaments) ? 'official' : 'declared';
}

/* ------------------------------------------------------- modo lista -- */

/** Uma linha vazia do modo lista. */
export function emptyListRow(year = Number(todayLocal().slice(0, 4))) {
  return { year, name: '', format: CAREER_FORMAT.DOUBLES, gender: null, placement: null };
}

/**
 * Linhas do modo lista → eventos (só o ano é conhecido: `date_precision:
 * 'year'`, data 1º de janeiro, nunca no futuro). Linha sem nome é ignorada.
 * `{ events, errors }` — `errors` diz QUAL linha ficou de fora e por quê.
 */
export function listRowsToEvents(rows, { uid, today = todayLocal(), nowMs = Date.now(), rand = Math.random } = {}) {
  const anoAtual = Number(today.slice(0, 4));
  const events = [];
  const errors = [];
  (rows || []).forEach((r, i) => {
    if (!txt(r?.name, CAREER_LIMITS.name)) return;
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
    events.push({ id: newCareerEventId(uid, nowMs + i, rand()), ...value });
  });
  return { events, errors };
}

/** "7 de ~20 registrados": `null` sem a estimativa da pessoa. */
export function registeredProgress(events, estimate) {
  const total = Math.round(Number(estimate));
  // Lista que não carregou não vira "0 de ~N".
  if (!Array.isArray(events) || !Number.isFinite(total) || total <= 0) return null;
  const feitos = events.filter((e) => e.status === CAREER_STATUS.PLAYED).length;
  return { done: feitos, estimate: total, complete: feitos >= total };
}

/* -------------------------------------------- repetir o do ano passado -- */

/**
 * O rascunho de "repetir o torneio do ano passado": nome (com o ano somado
 * em 1, se o nome tiver ano), organizador, cidade e federação. A data, as
 * categorias e o resultado ficam em branco — são deste ano.
 */
export function repeatEvent(previous) {
  if (!previous) return null;
  const nome = String(previous.name || '').replace(/\b(19|20)\d{2}\b/, (a) => String(Number(a) + 1));
  const sugestao = isISODate(previous.start_date) && previous.date_precision !== 'year' ? addDays(previous.start_date, 364) : '';
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
    .filter((e) => e.status === CAREER_STATUS.PLAYED && String(e.start_date).slice(0, 4) < ano)
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
}

/**
 * As DIVISÕES da liga: quem cabe em cada uma (fonte única do cliente).
 *
 * Jeitos de dividir, gravados em `divisions.rule.kind`:
 *  - `open`: qualquer um;
 *  - `bracket`: uma faixa da lista OFICIAL de faixas da plataforma
 *    (`core/domain/levelBrackets.js`, a mesma da Carreira e do torneio). A
 *    numérica confere a média do DUPR da dupla (ou o do atleta); a descritiva
 *    (Iniciante, PRO, OPEN…) é o nome da divisão e não barra ninguém;
 *  - `dupr_range`: faixa de DUPR digitada (a da primeira versão; segue
 *    valendo, mas o seletor novo oferece a lista oficial);
 *  - `dupr_sum`: teto da SOMA da equipe, com teto individual opcional — o
 *    modelo da Minor League Pickleball (`MILP_DIVISIONS`).
 *
 * DUPR desconhecido não barra na faixa (a menos que a organização exija) e,
 * na soma, vale o padrão da divisão — a mesma regra da MiLP. O servidor refaz
 * a conta na inscrição (`functions/leaguePolicy.js`, paridade).
 */
import { tk } from '@/core/i18n';
import { bracketRange, isOfficialBracket, levelBracketText } from '@/core/domain/levelBrackets.js';
import { formatMeta } from './leagueFormats.js';

export const DIVISION_RULE = Object.freeze({ OPEN: 'open', BRACKET: 'bracket', DUPR_RANGE: 'dupr_range', DUPR_SUM: 'dupr_sum' });

export const DIVISION_RULE_LABELS = Object.freeze({
  open: tk('Livre (qualquer nível)'),
  bracket: tk('Faixa de nível (lista oficial)'),
  dupr_range: tk('Faixa de DUPR personalizada'),
  dupr_sum: tk('Teto da soma do DUPR da equipe'),
});

export const DIVISION_GENDER = Object.freeze({ OPEN: 'open', MALE: 'male', FEMALE: 'female', MIXED: 'mixed' });

export const DIVISION_GENDER_LABELS = Object.freeze({
  open: tk('Aberta'),
  male: tk('Masculina'),
  female: tk('Feminina'),
  mixed: tk('Mista'),
});

/**
 * Divisões da MiLP (regras de 9/7/2026): teto da soma, teto individual e o
 * DUPR que vale para quem não tem rating. Equipes de 4 e de 3.
 */
export const MILP_DIVISIONS = Object.freeze({
  four: Object.freeze([
    { name: 'DUPR 12', cap: 12.3, individual_cap: 3.6, unrated_value: 3.0 },
    { name: 'DUPR 14', cap: 14.3, individual_cap: 4.1, unrated_value: 3.5 },
    { name: 'DUPR 16', cap: 16.3, individual_cap: 4.6, unrated_value: 4.0 },
    { name: 'DUPR 18', cap: 18.3, individual_cap: 5.1, unrated_value: 4.5 },
    { name: 'DUPR 20', cap: 20.3, individual_cap: null, unrated_value: 5.0 },
    { name: 'DUPR 22', cap: 22.999, individual_cap: null, unrated_value: 5.5 },
  ]),
  three: Object.freeze([
    { name: 'DUPR 9', cap: 9.3, individual_cap: 3.6, unrated_value: 3.0 },
    { name: 'DUPR 11', cap: 11.3, individual_cap: 4.1, unrated_value: 3.5 },
    { name: 'DUPR 13', cap: 13.3, individual_cap: 4.6, unrated_value: 4.0 },
    { name: 'DUPR 15', cap: 15.3, individual_cap: null, unrated_value: 4.5 },
  ]),
});

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const tres = (n) => Math.round(n * 1000) / 1000;

/** A regra como a divisão a usa (campos fora do lugar caem). */
export function normalizeDivisionRule(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kind = Object.values(DIVISION_RULE).includes(r.kind) ? r.kind : DIVISION_RULE.OPEN;
  if (kind === DIVISION_RULE.DUPR_RANGE) {
    let min = num(r.min);
    let max = num(r.max);
    if (min && max && min > max) [min, max] = [max, min];
    return { kind, min, max, allow_unrated: r.allow_unrated !== false };
  }
  if (kind === DIVISION_RULE.BRACKET) {
    if (!isOfficialBracket(r.bracket)) return { kind: DIVISION_RULE.OPEN };
    const out = { kind, bracket: r.bracket, allow_unrated: r.allow_unrated !== false };
    if (r.bracket === 'other') out.label = String(r.label == null ? '' : r.label).trim().slice(0, 40);
    return out;
  }
  if (kind === DIVISION_RULE.DUPR_SUM) {
    return { kind, cap: num(r.cap), individual_cap: num(r.individual_cap), unrated_value: num(r.unrated_value) || 3.0 };
  }
  return { kind };
}

/** Os motivos de "não cabe", para a tela. */
export const ELIGIBILITY_REASON_LABELS = Object.freeze({
  below: tk('O DUPR está abaixo da faixa da divisão.'),
  above: tk('O DUPR está acima da faixa da divisão.'),
  missing_dupr: tk('Esta divisão exige DUPR de todos os atletas.'),
  over_cap: tk('A soma do DUPR passa do teto da divisão.'),
  over_individual_cap: tk('Um atleta passa do teto individual da divisão.'),
  gender: tk('A categoria dos atletas não combina com a divisão.'),
  gender_unknown: tk('Falta a categoria (masculina ou feminina) no perfil de um atleta.'),
  team_size: tk('A equipe não tem o número de atletas do formato.'),
  team_mix: tk('A equipe precisa de 2 homens e 2 mulheres.'),
  team_same: tk('Todos os atletas da equipe precisam ser da mesma categoria.'),
});

/**
 * A equipe está montada como o formato pede? (`composition` de
 * `LEAGUE_FORMAT_META`). Devolve o motivo ou `null`. Fora das equipes, `null`.
 *
 * @param {string} format
 * @param {Array<{ gender?: string|null }>} players
 */
export function teamCompositionError(format, players) {
  const meta = formatMeta(format);
  if (!meta?.composition) return null;
  const lista = Array.isArray(players) ? players : [];
  if (lista.length !== meta.players) return 'team_size';
  if (meta.composition === 'any') return null;
  const gs = lista.map((p) => p?.gender || null);
  if (gs.some((g) => g !== 'male' && g !== 'female')) return 'gender_unknown';
  if (meta.composition === 'two_two') {
    const homens = gs.filter((g) => g === 'male').length;
    return homens * 2 === gs.length ? null : 'team_mix';
  }
  return gs.every((g) => g === gs[0]) ? null : 'team_same';
}

function confereGenero(gender, players) {
  if (!gender || gender === DIVISION_GENDER.OPEN) return null;
  const gs = players.map((p) => p?.gender || null);
  if (gs.some((g) => g !== 'male' && g !== 'female')) return 'gender_unknown';
  if (gender === DIVISION_GENDER.MIXED) {
    return gs.includes('male') && gs.includes('female') ? null : 'gender';
  }
  return gs.every((g) => g === gender) ? null : 'gender';
}

/**
 * Esta inscrição cabe na divisão?
 *
 * @param {{ rule?: object, gender?: string }} division
 * @param {Array<{ dupr?: number|null, gender?: string|null }>} players
 * @returns {{ ok: boolean, reason: string|null, value: number|null, unrated: boolean }}
 */
export function divisionEligibility(division, players) {
  const lista = Array.isArray(players) ? players : [];
  const rule = normalizeDivisionRule(division?.rule);
  const genero = confereGenero(division?.gender, lista);
  const resp = (reason, value = null, unrated = false) => ({ ok: !reason, reason, value, unrated });
  if (genero) return resp(genero);
  const duprs = lista.map((p) => num(p?.dupr));
  const semDupr = duprs.some((d) => d == null);
  const faixa = rule.kind === DIVISION_RULE.BRACKET ? bracketRange(rule.bracket) : null;
  if (rule.kind === DIVISION_RULE.DUPR_RANGE || faixa) {
    const min = faixa ? faixa.min : rule.min;
    const max = faixa ? faixa.max : rule.max;
    const conhecidos = duprs.filter((d) => d != null);
    if (semDupr && !rule.allow_unrated) return resp('missing_dupr');
    if (!conhecidos.length) return resp(null, null, true);
    const media = tres(conhecidos.reduce((a, b) => a + b, 0) / conhecidos.length);
    if (min && media < min) return resp('below', media, semDupr);
    if (max && media > max) return resp('above', media, semDupr);
    return resp(null, media, semDupr);
  }
  if (rule.kind === DIVISION_RULE.DUPR_SUM) {
    const valores = duprs.map((d) => (d == null ? rule.unrated_value : d));
    const soma = tres(valores.reduce((a, b) => a + b, 0));
    if (rule.individual_cap && valores.some((v) => v > rule.individual_cap)) return resp('over_individual_cap', soma, semDupr);
    if (rule.cap && soma > rule.cap) return resp('over_cap', soma, semDupr);
    return resp(null, soma, semDupr);
  }
  return resp(null);
}

/** Resumo de uma linha da regra ("DUPR 3,500 a 4,000", "Soma até 16,300"). */
export function describeDivisionRule(division, fmt = (n) => n.toFixed(3)) {
  const r = normalizeDivisionRule(division?.rule);
  if (r.kind === DIVISION_RULE.BRACKET) return { key: 'bracket', text: levelBracketText(r.bracket, r.label), numeric: !!bracketRange(r.bracket) };
  if (r.kind === DIVISION_RULE.DUPR_RANGE) {
    if (r.min && r.max) return { key: 'range', min: fmt(r.min), max: fmt(r.max) };
    if (r.min) return { key: 'min', min: fmt(r.min) };
    if (r.max) return { key: 'max', max: fmt(r.max) };
  }
  if (r.kind === DIVISION_RULE.DUPR_SUM && r.cap) {
    return { key: r.individual_cap ? 'sum_ind' : 'sum', cap: fmt(r.cap), ind: r.individual_cap ? fmt(r.individual_cap) : null };
  }
  return { key: 'open' };
}

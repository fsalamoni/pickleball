/**
 * Leitura do RATING DUPR digitado por uma pessoa (cadastro, perfil, painel do
 * admin) — a regra única de "o que vale" e "o que a pessoa quis dizer".
 *
 * O rating DUPR é um número de 2,000 a 8,000 com três casas decimais. 🐞 Antes
 * a leitura LIMITAVA o que viesse: "4525" (o 4,525 sem a vírgula) e um ID
 * digitado no campo errado viravam 8,000 — o teto — em silêncio, e o sorteio
 * passava a tratar a pessoa como a mais forte da plataforma. Agora nada fora da
 * faixa é gravado: ou é um rating, ou a tela pergunta.
 *
 * Vírgula e ponto valem como separador decimal: um rating nunca chega a mil,
 * então "4.525" só pode ser 4,525 (nunca quatro mil).
 *
 * @typedef {{
 *   status: 'empty'|'ok'|'suggest'|'invalid',
 *   value: number|null,       // o que se grava (só em 'ok'; null em 'empty')
 *   suggestion: number|null,  // o palpite (só em 'suggest')
 *   reason: null|'decimals'|'missingComma'|'looksLikeId'|'letters'|'below'|'above'|'format',
 * }} DuprReading
 */

import { fmtNumero } from '../i18n/format.js';

export const DUPR_RATING_MIN = 2;
export const DUPR_RATING_MAX = 8;

const round3 = (n) => Math.round(n * 1000) / 1000;
const naFaixa = (n) => Number.isFinite(n) && n >= DUPR_RATING_MIN && n <= DUPR_RATING_MAX;

const ler = (status, extra = {}) => ({ status, value: null, suggestion: null, reason: null, ...extra });

/** O número está na faixa válida do DUPR (2–8)? Valor vazio não é rating. */
export function isValidDuprRating(value) {
  if (value === null || value === undefined || value === '') return false;
  return naFaixa(Number(value));
}

/**
 * Lê o que a pessoa digitou.
 * @param {*} raw
 * @returns {DuprReading}
 */
export function readDuprRating(raw) {
  const s = String(raw ?? '').replace(/\s+/g, '');
  if (!s) return ler('empty');
  if (/[a-z]/i.test(s)) return ler('invalid', { reason: 'letters' });

  const m = s.match(/^\+?(\d+)(?:[.,](\d*))?$/);
  if (m) {
    const n = Number(`${m[1]}.${m[2] || '0'}`);
    if (naFaixa(n)) {
      return round3(n) === n
        ? ler('ok', { value: n })
        : ler('suggest', { suggestion: round3(n), reason: 'decimals' });
    }
    // Seis dígitos ou mais sem separador não é rating esquecido da vírgula: é o ID.
    if (m[2] === undefined && m[1].length >= 6) return ler('invalid', { reason: 'looksLikeId' });
    if (n < DUPR_RATING_MIN) return ler('invalid', { reason: 'below' });
  }

  // O palpite: os mesmos algarismos, com a vírgula depois do primeiro.
  // "4525" → 4,525 · "45" → 4,5 · "4.525.000" → 4,525.
  const digitos = s.replace(/\D/g, '');
  if (digitos.length >= 2) {
    const palpite = round3(Number(`${digitos[0]}.${digitos.slice(1)}`));
    if (naFaixa(palpite)) return ler('suggest', { suggestion: palpite, reason: 'missingComma' });
  }
  return ler('invalid', { reason: m ? 'above' : 'format' });
}

/** O rating como a tela mostra: sempre três casas, no separador do idioma ("4,525"). */
export function formatDuprRating(value) {
  return fmtNumero(Number(value), { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false });
}

/**
 * O valor de PARTIDA do campo: o número gravado, já no formato da tela. Um
 * valor gravado FORA da regra (cadastro antigo) aparece cru, como está, para a
 * pessoa ver o que corrigir — "4525", não "4525,000".
 */
export function duprRatingToInput(value) {
  if (value === null || value === undefined || value === '') return '';
  return isValidDuprRating(value) ? formatDuprRating(value) : String(value);
}

/**
 * O ID DUPR parece outra coisa? Só letras e números (o ID numérico, como
 * 5931502152, ou o curto, como DDQ0KL). Um número com vírgula ou ponto e uma
 * casa antes dela é o RATING no campo errado.
 * @returns {null|'looksLikeRating'|'format'}
 */
export function duprIdProblem(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d[.,]\d{0,4}$/.test(s)) return 'looksLikeRating';
  if (!/^[A-Za-z0-9]{3,20}$/.test(s)) return 'format';
  return null;
}

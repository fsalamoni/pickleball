/**
 * O DUPR de um cadastro, do jeito que o admin precisa ver na lista de
 * Cadastros: o ID, o rating e o que parece errado — para corrigir ANTES de o
 * número errado entrar no sorteio e no ranking.
 *
 * O caso que motivou: a leitura antiga limitava o que fosse digitado a
 * 2,000–8,000, então "4525" (o 4,525 sem vírgula) ou um ID no campo errado
 * viravam 8,000 sem ninguém ver. Esses cadastros seguem gravados assim — nada
 * é migrado sozinho —, e um 8,000 (ou 2,000) cravado no limite é exatamente o
 * rastro desse defeito: o card aponta para o admin conferir com a pessoa.
 *
 * O que vem do login oficial do DUPR (`dupr_verified`) não é suspeito: o
 * número é o do DUPR.
 */
import {
  readDuprRating, isValidDuprRating, duprIdProblem, DUPR_RATING_MIN, DUPR_RATING_MAX,
} from '@/core/domain/duprRating';

/** Códigos dos problemas (o texto mora na tela). */
export const DUPR_ISSUE = Object.freeze({
  OUT_OF_RANGE: 'out_of_range',
  AT_LIMIT: 'at_limit',
  ID_LOOKS_LIKE_RATING: 'id_looks_like_rating',
  ID_FORMAT: 'id_format',
});

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

/**
 * @param {object} user documento `users/{uid}`
 * @returns {{
 *   id: string|null, rating: number|null, raw: string|null, verified: boolean,
 *   informed: boolean, issues: string[], suggestion: number|null,
 * }}
 */
export function duprRecordCheck(user = {}) {
  const id = vazio(user?.dupr_id) ? null : String(user.dupr_id).trim();
  const raw = vazio(user?.dupr_rating) ? null : String(user.dupr_rating);
  const verified = user?.dupr_verified === true;
  const valido = raw !== null && isValidDuprRating(user.dupr_rating);
  const rating = valido ? Number(user.dupr_rating) : null;
  const issues = [];
  let suggestion = null;

  if (!verified) {
    if (raw !== null && !valido) {
      issues.push(DUPR_ISSUE.OUT_OF_RANGE);
      const leitura = readDuprRating(raw);
      if (leitura.status === 'suggest') suggestion = leitura.suggestion;
    }
    if (rating === DUPR_RATING_MIN || rating === DUPR_RATING_MAX) issues.push(DUPR_ISSUE.AT_LIMIT);
    const problemaId = duprIdProblem(id);
    if (problemaId === 'looksLikeRating') issues.push(DUPR_ISSUE.ID_LOOKS_LIKE_RATING);
    else if (problemaId) issues.push(DUPR_ISSUE.ID_FORMAT);
  }

  return { id, rating, raw, verified, informed: id !== null || raw !== null, issues, suggestion };
}

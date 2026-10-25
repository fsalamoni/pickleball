/**
 * Acervo do clube-associação — a conta PURA (sem banco). A régua do documento é a
 * MESMA da federação (`federationAcervoPolicy.js`: arquivos, SHA-256, vídeo por
 * link, relações entre atos); o clube só usa uma LISTA MENOR de tipos (sem súmula,
 * relatório de arbitragem nem avaliação de arena) e ganha as duas marcas de leitura
 * que a regra do Firestore confere sem consultar mais nada.
 *
 * ⚠️ CÓPIA de `src/modules/clubs/domain/docs.js` (o pacote de Functions é
 * publicado isolado), com paridade em `clubDocs.parity.test.js`. Os ids de tipo
 * são GRAVADOS: nunca renomeie.
 */
const A = require('./federationAcervoPolicy.js');

/** Os tipos de documento que um clube publica (subconjunto de `A.TYPES`). */
const CLUB_DOC_TYPES = Object.freeze([
  'statute', 'bylaws', 'org_chart', 'bodies', 'ethics_code', 'disciplinary_code', 'disciplinary_decision',
  'game_rules', 'competition_rules', 'specific_rules', 'ranking_rules',
  'resolution', 'ordinance', 'deliberation', 'presidential_act', 'notice', 'official_note', 'errata',
  'convocation', 'minutes', 'attendance', 'vote_record', 'results_bulletin',
  'financial_statements', 'fiscal_opinion', 'management_report', 'agreements', 'leaders_pay', 'planning',
  'video', 'audio', 'gallery', 'annual_calendar',
]);

/** Mesma validação da federação, só com os tipos do clube. */
function validateClubDoc(input = {}) {
  const r = A.validateDoc(input);
  if (r.value.type && !CLUB_DOC_TYPES.includes(r.value.type)) {
    r.errors.type = 'Este tipo de documento não existe para clubes.';
    r.ok = false;
  }
  return r;
}

/**
 * As marcas que a REGRA lê: `pub` (qualquer pessoa, com a associação aberta) e
 * `members` (quem é membro do clube). Só o publicado, e nunca o "só a equipe".
 */
function readFlags(status, visibility) {
  const publicado = status === A.STATUS.PUBLISHED;
  return { pub: publicado && visibility === 'public', members: publicado && visibility !== 'staff' };
}

module.exports = { CLUB_DOC_TYPES, validateClubDoc, readFlags };

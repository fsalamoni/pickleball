/**
 * Domínio PURO da CAMADA DE VISUALIZAÇÃO da exportação DUPR.
 *
 * Ordenação e paginação da tabela de partidas na página "Exportar DUPR"
 * (flag `dupr_match_export`). Sem I/O e sem React — recebe as `entries` já
 * montadas por `buildDuprEntries` (cada uma com `.row`, `.at`, `.match_type`,
 * `.ready` e, opcionalmente, `.situation`/`.situationRank` da conferência) e
 * devolve listas ordenadas/paginadas para a UI. Determinístico e testável.
 *
 * A PAGINAÇÃO em si não mora mais aqui: foi para `core/domain/pagination.js`
 * quando o ranking de duplas passou a precisar da mesma coisa. Os nomes antigos
 * continuam exportados daqui (é por eles que a tabela do DUPR importa) e são
 * exatamente os de lá — reexportação, não cópia.
 */

import {
  PAGE_SIZES, DEFAULT_PAGE_SIZE, normalizePageSize, paginate,
} from '@/core/domain/pagination.js';

/** Tamanhos de página oferecidos ao admin (partidas por página). */
export const DUPR_PAGE_SIZES = PAGE_SIZES;

/** Página inicial padrão. */
export const DEFAULT_DUPR_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export { normalizePageSize, paginate };

/** Colunas ordenáveis da tabela. */
export const DUPR_SORT_KEY = Object.freeze({
  DATE: 'date',
  EVENT: 'event',
  TYPE: 'type',
  STATUS: 'status',
});

/** Sentidos de ordenação. */
export const DUPR_SORT_DIR = Object.freeze({ ASC: 'asc', DESC: 'desc' });

/**
 * Rank da situação DUPR para ordenação (pendente → confirmada). Usa o
 * `situationRank` já calculado pela conferência; na ausência dele, cai para a
 * prontidão (partidas sem ID DUPR primeiro no crescente).
 */
function statusRank(entry) {
  if (Number.isFinite(entry?.situationRank)) return entry.situationRank;
  return entry?.ready ? 1 : 0;
}

/** Comparação (estável, sem sinal de direção) de duas entries por coluna. */
function compareByKey(a, b, key) {
  switch (key) {
    case DUPR_SORT_KEY.EVENT: {
      const ea = String(a?.row?.event || '');
      const eb = String(b?.row?.event || '');
      return ea.localeCompare(eb, 'pt-BR', { sensitivity: 'base' });
    }
    case DUPR_SORT_KEY.TYPE: {
      // Duplas ('D') depois de simples ('S') no crescente.
      const ta = a?.match_type === 'D' ? 1 : 0;
      const tb = b?.match_type === 'D' ? 1 : 0;
      return ta - tb;
    }
    case DUPR_SORT_KEY.STATUS:
      return statusRank(a) - statusRank(b);
    case DUPR_SORT_KEY.DATE:
    default:
      return (Number(a?.at) || 0) - (Number(b?.at) || 0);
  }
}

/**
 * Ordena as entries por coluna e sentido, de forma ESTÁVEL (empates preservam a
 * ordem original). Devolve um novo array — não muta a entrada.
 *
 * @param {Array<object>} entries
 * @param {string} [key=DUPR_SORT_KEY.DATE]
 * @param {string} [dir=DUPR_SORT_DIR.ASC]
 * @returns {Array<object>}
 */
export function sortDuprEntries(entries = [], key = DUPR_SORT_KEY.DATE, dir = DUPR_SORT_DIR.ASC) {
  const factor = dir === DUPR_SORT_DIR.DESC ? -1 : 1;
  const decorated = entries.map((e, i) => ({ e, i }));
  decorated.sort((x, y) => {
    const cmp = compareByKey(x.e, y.e, key);
    if (cmp !== 0) return cmp * factor;
    return x.i - y.i; // estabilidade: mantém ordem original nos empates
  });
  return decorated.map((d) => d.e);
}


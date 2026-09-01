/**
 * Domínio PURO da CAMADA DE VISUALIZAÇÃO da exportação DUPR.
 *
 * Ordenação e paginação da tabela de partidas na página "Exportar DUPR"
 * (flag `dupr_match_export`). Sem I/O e sem React — recebe as `entries` já
 * montadas por `buildDuprEntries` (cada uma com `.row`, `.at`, `.match_type`,
 * `.ready` e, opcionalmente, `.situation`/`.situationRank` da conferência) e
 * devolve listas ordenadas/paginadas para a UI. Determinístico e testável.
 */

/** Tamanhos de página oferecidos ao admin (partidas por página). */
export const DUPR_PAGE_SIZES = Object.freeze([20, 50, 100]);

/** Página inicial padrão. */
export const DEFAULT_DUPR_PAGE_SIZE = 20;

/** Colunas ordenáveis da tabela. */
export const DUPR_SORT_KEY = Object.freeze({
  DATE: 'date',
  EVENT: 'event',
  TYPE: 'type',
  STATUS: 'status',
});

/** Sentidos de ordenação. */
export const DUPR_SORT_DIR = Object.freeze({ ASC: 'asc', DESC: 'desc' });

/** Garante um tamanho de página válido (um dos oferecidos), senão o padrão. */
export function normalizePageSize(size) {
  const n = Math.trunc(Number(size));
  return DUPR_PAGE_SIZES.includes(n) ? n : DEFAULT_DUPR_PAGE_SIZE;
}

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

/**
 * Recorta uma lista na página pedida, com metadados de navegação. `page` é
 * 1-based e é sempre normalizada para o intervalo válido `[1, pageCount]`.
 *
 * @param {Array<object>} items
 * @param {number} [page=1]
 * @param {number} [pageSize=DEFAULT_DUPR_PAGE_SIZE]
 * @returns {{ pageItems: Array<object>, page: number, pageCount: number,
 *   pageSize: number, total: number, from: number, to: number }}
 */
export function paginate(items = [], page = 1, pageSize = DEFAULT_DUPR_PAGE_SIZE) {
  const size = normalizePageSize(pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), pageCount);
  const start = (current - 1) * size;
  const pageItems = items.slice(start, start + size);
  return {
    pageItems,
    page: current,
    pageCount,
    pageSize: size,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}

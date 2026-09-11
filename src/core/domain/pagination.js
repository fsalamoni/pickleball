/**
 * Paginação de listas — domínio puro, sem I/O e sem React.
 *
 * Nasceu dentro da tabela de exportação DUPR e foi trazida para cá quando o
 * ranking de duplas precisou da MESMA coisa. É de propósito que não existam
 * duas paginações na plataforma: "página 3 de 7" tem de significar o mesmo em
 * qualquer tela, inclusive nos casos chatos — lista vazia, página fora do
 * intervalo, tamanho de página inventado na URL.
 *
 * Decisões que valem para todas as telas:
 *  - `page` é 1-based (é o que o usuário lê) e é sempre NORMALIZADA para o
 *    intervalo válido. Pedir a página 99 de uma lista com 2 páginas devolve a
 *    2, não uma tela vazia — inclusive quando o número veio da URL, digitado
 *    por alguém;
 *  - uma lista vazia tem 1 página (vazia), não 0: `pageCount` 0 quebraria
 *    qualquer "página X de Y" na tela;
 *  - um tamanho de página que não esteja na lista oferecida cai no padrão, em
 *    vez de virar `NaN` ou permitir `?tam=100000`.
 */

/** Tamanhos de página oferecidos ao usuário. */
export const PAGE_SIZES = Object.freeze([20, 50, 100]);

/** Tamanho padrão quando nada é escolhido (ou o escolhido é inválido). */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Garante um tamanho de página válido (um dos oferecidos), senão o padrão.
 * @param {number|string} size
 * @param {number[]} [allowed=PAGE_SIZES]
 * @returns {number}
 */
export function normalizePageSize(size, allowed = PAGE_SIZES) {
  const n = Math.trunc(Number(size));
  return allowed.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/**
 * Recorta uma lista na página pedida, com os metadados de navegação.
 *
 * @param {Array<object>} items
 * @param {number} [page=1] 1-based; normalizada para `[1, pageCount]`
 * @param {number} [pageSize=DEFAULT_PAGE_SIZE]
 * @param {number[]} [allowedSizes=PAGE_SIZES]
 * @returns {{ pageItems: Array<object>, page: number, pageCount: number,
 *   pageSize: number, total: number, from: number, to: number }}
 *   `from`/`to` são 1-based e inclusivos ("mostrando 21–40 de 137"); numa lista
 *   vazia os dois são 0.
 */
export function paginate(items = [], page = 1, pageSize = DEFAULT_PAGE_SIZE, allowedSizes = PAGE_SIZES) {
  const size = normalizePageSize(pageSize, allowedSizes);
  const lista = Array.isArray(items) ? items : [];
  const total = lista.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), pageCount);
  const start = (current - 1) * size;
  const pageItems = lista.slice(start, start + size);
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

/**
 * Até quantas páginas a barra mostra INTEIRA, sem reticências.
 * Sete cabe confortavelmente até em tela de celular.
 */
export const MAX_PAGINAS_SEM_RETICENCIAS = 7;

/**
 * Os números a desenhar na barra de navegação, com reticências quando há
 * páginas demais para caber.
 *
 * Devolve uma lista de números e da string `'…'`. A primeira e a última página
 * estão SEMPRE presentes (são os dois destinos que todo mundo procura), mais
 * uma janela ao redor da atual.
 *
 * Até `MAX_PAGINAS_SEM_RETICENCIAS` páginas, mostra TODAS: a reticência só se
 * paga quando esconde várias páginas de uma vez. Em 5 páginas ela economiza um
 * botão e cobra um clique a mais de quem quer a página 3.
 *
 * @param {number} page página atual (1-based)
 * @param {number} pageCount total de páginas
 * @param {number} [around=1] quantas páginas mostrar de cada lado da atual
 * @returns {Array<number|'…'>}
 */
export function pageNumbers(page, pageCount, around = 1) {
  const total = Math.max(1, Math.trunc(Number(pageCount)) || 1);
  const atual = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), total);
  const janela = Math.max(0, Math.trunc(Number(around)) || 0);

  if (total <= MAX_PAGINAS_SEM_RETICENCIAS) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set([1, total]);
  for (let p = atual - janela; p <= atual + janela; p += 1) {
    if (p >= 1 && p <= total) set.add(p);
  }
  const ordenadas = Array.from(set).sort((a, b) => a - b);

  const saida = [];
  ordenadas.forEach((p, i) => {
    if (i > 0 && p - ordenadas[i - 1] > 1) saida.push('…');
    saida.push(p);
  });
  return saida;
}

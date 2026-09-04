/**
 * Domínio PURO da SELEÇÃO de partidas nas tabelas da exportação DUPR.
 *
 * Regra de ouro (pedido explícito da governança): a seleção é do ADMIN, não da
 * tabela. Mudar um filtro NUNCA desmarca uma partida — os ids selecionados
 * ficam guardados mesmo quando saem da vista, e a ação em massa continua
 * valendo para todos eles. Por isso a seleção vive como um `Set` de ids, e não
 * como um campo dentro das linhas exibidas.
 *
 * Todas as funções são imutáveis (devolvem um `Set` novo) e sem React/Firebase.
 */

/** Estados possíveis do check "selecionar todos" de uma tabela. */
export const SELECT_ALL_STATE = Object.freeze({
  NONE: 'none',
  SOME: 'some',
  ALL: 'all',
});

/** Normaliza qualquer entrada (Set, array, nulo) em um `Set` de ids válidos. */
export function toSelection(input) {
  if (input instanceof Set) return new Set([...input].filter(Boolean));
  if (Array.isArray(input)) return new Set(input.filter(Boolean));
  return new Set();
}

/** Marca/desmarca UM id. Devolve um `Set` novo. */
export function toggleId(selected, id) {
  const next = toSelection(selected);
  if (!id) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Acrescenta todos os `ids` à seleção (sem remover nada). */
export function addIds(selected, ids = []) {
  const next = toSelection(selected);
  ids.forEach((id) => { if (id) next.add(id); });
  return next;
}

/** Remove os `ids` da seleção (preservando os demais — inclusive os ocultos). */
export function removeIds(selected, ids = []) {
  const next = toSelection(selected);
  ids.forEach((id) => next.delete(id));
  return next;
}

/**
 * Estado do check "selecionar todos" para o conjunto VISÍVEL de ids:
 * `all` quando todos estão marcados, `none` quando nenhum, `some` no meio.
 */
export function selectAllState(selected, ids = []) {
  if (ids.length === 0) return SELECT_ALL_STATE.NONE;
  const set = toSelection(selected);
  let marked = 0;
  ids.forEach((id) => { if (set.has(id)) marked += 1; });
  if (marked === 0) return SELECT_ALL_STATE.NONE;
  return marked === ids.length ? SELECT_ALL_STATE.ALL : SELECT_ALL_STATE.SOME;
}

/** Quantos ids selecionados estão VISÍVEIS no recorte atual. */
export function countVisibleSelected(selected, ids = []) {
  const set = toSelection(selected);
  let n = 0;
  ids.forEach((id) => { if (set.has(id)) n += 1; });
  return n;
}

/**
 * Quantos ids selecionados estão FORA do recorte atual (filtrados/paginados
 * para fora). É o número que a UI mostra para o admin não agir às cegas.
 */
export function countHiddenSelected(selected, ids = []) {
  const set = toSelection(selected);
  return Math.max(0, set.size - countVisibleSelected(set, ids));
}

/**
 * Resolve os ids selecionados nas ENTRIES correspondentes, na ordem da lista
 * de referência (normalmente a base completa). Ids sem entry conhecida são
 * descartados — nunca se age sobre uma partida que não existe mais.
 *
 * @param {Set<string>|Array<string>} selected
 * @param {Array<object>} entries  base de referência (com `.id`)
 * @returns {Array<object>}
 */
export function resolveSelectedEntries(selected, entries = []) {
  const set = toSelection(selected);
  if (set.size === 0) return [];
  return entries.filter((e) => e?.id && set.has(e.id));
}

/**
 * Poda a seleção para os ids que ainda existem na base (não para os do filtro!).
 * Serve só para higiene depois de um recarregamento em que partidas sumiram.
 */
export function pruneSelection(selected, knownIds = []) {
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds);
  const next = new Set();
  toSelection(selected).forEach((id) => { if (known.has(id)) next.add(id); });
  return next;
}

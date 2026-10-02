/**
 * syncSchedule — quando a sincronização de fundo da gamificação roda de novo.
 *
 * O XP e as conquistas são recalculados do zero a partir de fatos reais; rodar
 * a cada abertura do app seria custo sem ganho, e rodar só no hub deixava o
 * placar da temporada (que lê o XP gravado) parado para quem joga sem abri-lo.
 * O meio-termo é um intervalo — e ele é puro, para ter teste.
 */

/** De quanto em quanto tempo (ms) a progressão é recalculada em segundo plano. */
export const BACKGROUND_SYNC_MS = 12 * 3_600_000;

/**
 * A sincronização está vencida?
 * Sem registro, valor inválido ou um registro no FUTURO (relógio mexido) contam
 * como vencida: errar para o lado de sincronizar é barato; ficar sem sincronizar
 * por causa de um relógio errado, não.
 *
 * @param {string|number|null|undefined} lastMs quando rodou a última vez
 * @param {number} [now]
 * @param {number} [every]
 */
export function syncIsDue(lastMs, now = Date.now(), every = BACKGROUND_SYNC_MS) {
  const last = Number(lastMs);
  return !Number.isFinite(last) || last <= 0 || now - last >= every || last > now;
}

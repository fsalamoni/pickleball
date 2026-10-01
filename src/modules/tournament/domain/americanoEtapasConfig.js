/**
 * Configuração do AMERICANO APRIMORADO EM ETAPAS — os números da fase, sem o
 * motor de sorteio (para `phases.js`, que todo o torneio importa, não arrastar
 * o motor do Americano junto). O formato está em `americanoEtapas.js`.
 *
 * Puro — sem React, sem Firebase.
 */

/** Quantas etapas: de 1 a 12, 3 por padrão (o exemplo que originou o formato). */
export const ETAPAS_MIN = 1;
export const ETAPAS_MAX = 12;
export const ETAPAS_PADRAO = 3;

/** Tamanhos de grupo oferecidos — os que fecham um Americano exato. */
export const TAMANHOS_DE_GRUPO = Object.freeze([4, 5, 8, 9]);
export const TAMANHO_PADRAO = 4;

/** Quantas etapas a fase pede (sempre um número válido). */
export function normalizeEtapaCount(valor) {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n)) return ETAPAS_PADRAO;
  return Math.max(ETAPAS_MIN, Math.min(ETAPAS_MAX, n));
}

/** O tamanho de grupo da fase, levado ao válido mais próximo (4 por padrão). */
export function normalizeEtapaGroupSize(valor) {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n <= 0) return TAMANHO_PADRAO;
  return TAMANHOS_DE_GRUPO.reduce((melhor, t) => (Math.abs(t - n) < Math.abs(melhor - n) ? t : melhor), TAMANHO_PADRAO);
}


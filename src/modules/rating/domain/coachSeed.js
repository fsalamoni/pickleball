/**
 * Semente de rating a partir do nível validado por um professor
 * (flag coach_level_rating_seed). Lógica pura, sem I/O.
 *
 * O nível que o professor atesta (`coach_level_validations`) usa a mesma
 * tabela de nivelamento (LEVEL_TABLE) do resto da plataforma. Esta função
 * traduz esse nível na MESMA semente que `seedForProfile` já usa para o nível
 * auto-declarado — de modo que o nível validado pode assumir prioridade na
 * semente do rating (elo professor↔atleta↔ranking) sem mudar a escala.
 *
 * Está pronta para ser injetada no recompute: como afeta o ranking de TODOS,
 * o wiring no recompute (cliente + Cloud Function) é feito como passo
 * coordenado e testado à parte. Por ora, é a peça de domínio verificável.
 */

import { LEVEL_TABLE } from '@/modules/leveling/data/levels.js';
import { seedFromLevelOrdinal } from './elo.js';

/**
 * Semente (rating ELO) de um nível validado.
 * @param {string} levelId id do nível (mesmo espaço de LEVEL_TABLE)
 * @param {Array<{id:string}>} [levelTable]
 * @returns {number|undefined} semente, ou undefined se o nível é desconhecido
 */
export function seedFromValidatedLevelId(levelId, levelTable = LEVEL_TABLE) {
  if (!levelId) return undefined;
  const idx = levelTable.findIndex((lvl) => lvl?.id === levelId);
  if (idx < 0) return undefined;
  return seedFromLevelOrdinal(idx, levelTable.length);
}

/**
 * Escolhe a semente com a prioridade do produto: nível validado por professor
 * (quando houver e a flag estiver ligada) tem precedência sobre o nível
 * auto-declarado. Retorna undefined se nenhum se aplica (cai no default do
 * motor). Puro — o chamador decide se passa o nível validado (gating).
 * @param {{ validatedLevelId?: string, selfLevelId?: string }} args
 * @param {Array<{id:string}>} [levelTable]
 */
export function pickRatingSeed({ validatedLevelId, selfLevelId } = {}, levelTable = LEVEL_TABLE) {
  const fromValidated = seedFromValidatedLevelId(validatedLevelId, levelTable);
  if (Number.isFinite(fromValidated)) return fromValidated;
  return seedFromValidatedLevelId(selfLevelId, levelTable);
}

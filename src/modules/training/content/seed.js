/**
 * Biblioteca inicial PickleRush — a semente. Só import dinâmico (ver
 * seedService): o conteúdo é grande e não pode ir para o pacote de toda tela.
 * Cada tipo mora no seu arquivo em `./seed/`.
 */
import { DRILLS } from './seed/drills.js';
import { FISICOS } from './seed/fisicos.js';
import { JOGADAS } from './seed/jogadas.js';
import { FUNDAMENTOS } from './seed/fundamentos.js';
import { TREINOS } from './seed/treinos.js';
import { ESTUDOS } from './seed/estudos.js';
import { IMPORTADOS_NIVEL1 } from './seed/importados-nivel1.js';
import { IMPORTADOS_NIVEL2 } from './seed/importados-nivel2.js';
import { IMPORTADOS_NIVEL3 } from './seed/importados-nivel3.js';
import { IMPORTADOS_NIVEL4 } from './seed/importados-nivel4.js';
import { IMPORTADOS_NIVEL5 } from './seed/importados-nivel5.js';
import { TREINOS_IMPORTADOS } from './seed/treinos-importados.js';

// 2: os drills avaliados do pacote "100 drills" (um a um, em
// docs/40-CENTRO-DE-TREINO.md §8.1), corrigidos e reescritos. Os itens da
// versão 1 não mudaram — seguem com `version: 1` e não são regravados.
export const SEED_VERSION = 2;
export const SEED_ITEMS = [
  ...DRILLS, ...FISICOS, ...JOGADAS, ...FUNDAMENTOS, ...TREINOS, ...ESTUDOS,
  ...IMPORTADOS_NIVEL1, ...IMPORTADOS_NIVEL2, ...IMPORTADOS_NIVEL3, ...IMPORTADOS_NIVEL4, ...IMPORTADOS_NIVEL5,
  ...TREINOS_IMPORTADOS,
];

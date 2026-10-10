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
import { GOLPES_BASE } from './seed/golpes-base.js';
import { GOLPES_SAQUE_FUNDO } from './seed/golpes-saque-fundo.js';
import { GOLPES_COZINHA } from './seed/golpes-cozinha.js';
import { GOLPES_REDE } from './seed/golpes-rede.js';

// 2: os drills avaliados do pacote "100 drills" (um a um, em
// docs/40-CENTRO-DE-TREINO.md §8.1), corrigidos e reescritos. Os itens da
// versão 1 não mudaram — seguem com `version: 1` e não são regravados.
// 3: a TRILHA DOS GOLPES — 22 golpes e movimentos novos (`golpes-*.js`) e a
// técnica ponto a ponto (`technique`) nos 12 que já existiam, revistos.
export const SEED_VERSION = 3;
export const SEED_ITEMS = [
  ...DRILLS, ...FISICOS, ...JOGADAS, ...FUNDAMENTOS, ...TREINOS, ...ESTUDOS,
  ...IMPORTADOS_NIVEL1, ...IMPORTADOS_NIVEL2, ...IMPORTADOS_NIVEL3, ...IMPORTADOS_NIVEL4, ...IMPORTADOS_NIVEL5,
  ...TREINOS_IMPORTADOS,
  ...GOLPES_BASE, ...GOLPES_SAQUE_FUNDO, ...GOLPES_COZINHA, ...GOLPES_REDE,
];

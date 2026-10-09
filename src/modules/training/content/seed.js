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

export const SEED_VERSION = 1;
export const SEED_ITEMS = [...DRILLS, ...FISICOS, ...JOGADAS, ...FUNDAMENTOS, ...TREINOS, ...ESTUDOS];

/**
 * Planejador de GRUPOS para um número qualquer de inscritos.
 *
 * ## O problema que isto resolve
 *
 * Torneio amador quase nunca tem número redondo. Chegam 19, 23, 14 — e a
 * pergunta de quem organiza é sempre a mesma: *em quantos grupos eu divido?*
 * A plataforma respondia mal: dividia em qualquer número e, quando os grupos
 * saíam desiguais, avisava **"para grupos do mesmo tamanho use um múltiplo de
 * 4"**. Isso não é conselho — é pedir para o inscrito desistir, ou inventar
 * um. Grupo desigual é o caso NORMAL; o que muda é a regra de comparação
 * (`crossGroup.js`), não o número de inscritos.
 *
 * Este módulo faz a conta ao contrário: dado o que EXISTE, mostra as divisões
 * possíveis, o que cada uma custa em jogos e tempo, e o que cada uma deixa
 * para a fase seguinte.
 *
 * ## O que é um bom grupo (e por quê)
 *
 * | Tamanho | Jogos por atleta | Leitura |
 * |---|---|---|
 * | 2 | 1 | não é grupo, é uma partida só — quem perde vai embora |
 * | 3 | 2 | curto; com **ida e volta** vira 4, que é o que se espera de uma inscrição |
 * | **4** | **3** | o padrão dos circuitos: garante jogo e cabe no dia |
 * | **5** | **4** | ótimo quando há quadra sobrando |
 * | 6 | 5 | pesado: 15 jogos no grupo |
 * | 7+ | 6+ | o grupo vira o torneio inteiro |
 *
 * A recomendação **4 ou 5** não é gosto: é o que equilibra jogo garantido e
 * tempo de quadra nos guias de organização de pickleball.
 *
 * ## O que ele NÃO faz
 *
 * Não decide nada. Devolve as opções com as contas na mão — quem organiza
 * conhece as quadras, o horário e o público, e essas três coisas não cabem
 * numa fórmula.
 *
 * Lógica pura: sem React, sem Firebase.
 */

import { PHASE_DIVISION_MODE } from './constants.js';
import { computeGroupSizes } from './grouping.js';
import { bracketFit } from './crossGroup.js';

/** Tamanhos que os guias de organização recomendam. */
export const IDEAL_GROUP_SIZES = Object.freeze([4, 5]);
/** Abaixo disto o grupo não entrega jogo. */
export const MIN_USEFUL_GROUP_SIZE = 3;
/** Acima disto o grupo consome o dia. */
export const MAX_COMFORTABLE_GROUP_SIZE = 6;

const comb2 = (n) => (n >= 2 ? (n * (n - 1)) / 2 : 0);

/**
 * Descreve uma divisão concreta: tamanhos, jogos, rodadas e o que ela entrega
 * à fase seguinte.
 *
 * @param {number} total inscritos
 * @param {number} groupCount em quantos grupos
 * @param {{ qualifiersPerGroup?: number, legs?: number }} [options]
 *   `legs` = 1 (ida) ou 2 (ida e volta, que dobra os jogos do grupo).
 * @returns {object} o plano, com `warnings` já montados
 */
export function describeGroupPlan(total, groupCount, options = {}) {
  const n = Math.max(0, Math.floor(total) || 0);
  const legs = options.legs === 2 ? 2 : 1;
  const per = Math.max(0, Math.floor(options.qualifiersPerGroup ?? 2));
  const { sizes } = computeGroupSizes(n, {
    mode: PHASE_DIVISION_MODE.GROUP_COUNT,
    groupCount: Math.max(1, Math.floor(groupCount) || 1),
  });

  const menor = sizes.length ? Math.min(...sizes) : 0;
  const maior = sizes.length ? Math.max(...sizes) : 0;
  const uniforme = menor === maior;
  const totalMatches = sizes.reduce((soma, s) => soma + comb2(s), 0) * legs;
  // Rodadas dentro do grupo (método do círculo): tamanho par → tamanho−1.
  const rodadas = (maior % 2 === 0 ? Math.max(0, maior - 1) : maior) * legs;
  // Cada atleta joga contra todos do SEU grupo.
  const jogosPorAtleta = { min: Math.max(0, (menor - 1) * legs), max: Math.max(0, (maior - 1) * legs) };

  // Quem passa: `per` por grupo, limitado ao tamanho do menor grupo.
  const classificados = sizes.reduce((soma, s) => soma + Math.min(per, s), 0);
  const chave = bracketFit(classificados);

  const warnings = [];
  if (n === 0) {
    warnings.push({ level: 'error', text: 'Ainda não há inscritos nesta modalidade.' });
  } else if (menor < 2) {
    warnings.push({
      level: 'error',
      text: `Com ${n} inscritos em ${sizes.length} grupos sobra grupo sem adversário. Use no máximo ${Math.floor(n / 2)} grupo(s).`,
    });
  } else if (menor === 2) {
    warnings.push({
      level: 'error',
      text: 'Grupo de 2 não é grupo: é uma partida só, e quem perde vai embora depois de um jogo. Reduza o número de grupos.',
    });
  } else if (menor === 3 && legs === 1) {
    warnings.push({
      level: 'warn',
      text: 'Grupo de 3 dá só 2 jogos por atleta. Ida e volta dentro do grupo sobe para 4 — é o que os circuitos fazem com grupo pequeno.',
    });
  }

  if (maior > MAX_COMFORTABLE_GROUP_SIZE) {
    warnings.push({
      level: 'warn',
      text: `Grupo de ${maior} gera ${comb2(maior) * legs} jogos e ${rodadas} rodadas só nele. Com mais grupos o dia fica mais curto.`,
    });
  }

  if (!uniforme) {
    warnings.push({
      level: 'info',
      text: `Grupos de tamanhos diferentes (${menor} e ${maior}) — normal e permitido. Quem joga menos partidas não sai prejudicado: a comparação entre grupos é por APROVEITAMENTO, não por número de vitórias.`,
    });
  }

  if (per > 0 && classificados > 1 && !chave.perfect) {
    warnings.push({
      level: 'info',
      text: `${classificados} classificados não fecham uma chave: seriam ${chave.byes} bye(s) numa chave de ${chave.size}. Repescar ${chave.toFill} completa a chave; ${chave.dropToFill} classificado(s) a menos caberia(m) numa chave de ${chave.downTo}.`,
    });
  }

  return {
    groupCount: sizes.length,
    sizes,
    uniform: uniforme,
    smallest: menor,
    largest: maior,
    legs,
    totalMatches,
    rounds: rodadas,
    matchesPerEntrant: jogosPorAtleta,
    qualifiers: classificados,
    bracket: chave,
    warnings,
    blocked: warnings.some((w) => w.level === 'error'),
  };
}

/**
 * Nota de 0 a 100 de um plano — só para ORDENAR as sugestões.
 *
 * Pesa, nesta ordem: tamanho do menor grupo (jogo garantido), tamanhos
 * uniformes, e uma chave cheia na fase seguinte. Nunca é mostrada como
 * "nota": vira a ordem em que as opções aparecem.
 */
export function scoreGroupPlan(plan) {
  if (!plan || plan.blocked) return 0;
  let nota = 0;
  // 1) O menor grupo manda: é ele que define o pior atendido do torneio.
  if (IDEAL_GROUP_SIZES.includes(plan.smallest)) nota += 50;
  else if (plan.smallest === MIN_USEFUL_GROUP_SIZE) nota += 30;
  else if (plan.smallest === MAX_COMFORTABLE_GROUP_SIZE) nota += 25;
  else if (plan.smallest > MAX_COMFORTABLE_GROUP_SIZE) nota += 10;

  // 2) O maior não pode estourar o dia.
  if (plan.largest <= MAX_COMFORTABLE_GROUP_SIZE) nota += 15;

  // 3) Uniformidade é bônus, não exigência.
  if (plan.uniform) nota += 20;

  // 4) Chave cheia na fase seguinte evita um mata-mata cheio de byes.
  if (plan.bracket.perfect) nota += 15;
  else if (plan.bracket.byes <= plan.bracket.size / 4) nota += 7;

  return nota;
}

/**
 * Todas as divisões viáveis, da melhor para a pior.
 *
 * @param {number} total inscritos
 * @param {{ qualifiersPerGroup?: number, legs?: number, limit?: number }} [options]
 * @returns {Array<object>} planos com `score`, já ordenados
 */
export function suggestGroupPlans(total, options = {}) {
  const n = Math.max(0, Math.floor(total) || 0);
  if (n < 3) return [];
  const limite = Math.max(1, Math.floor(n / 2)); // nunca grupo de menos de 2
  const planos = [];
  for (let g = 1; g <= limite; g += 1) {
    const plano = describeGroupPlan(n, g, options);
    if (plano.blocked) continue;
    planos.push({ ...plano, score: scoreGroupPlan(plano) });
  }
  planos.sort((a, b) => (b.score - a.score)
    || (a.groupCount - b.groupCount));
  const limit = Math.max(1, Math.floor(options.limit) || 4);
  return planos.slice(0, limit);
}

/**
 * A melhor divisão para um número de inscritos — a primeira sugestão.
 * `null` quando não há inscritos suficientes para formar grupo nenhum.
 */
export function bestGroupPlan(total, options = {}) {
  return suggestGroupPlans(total, { ...options, limit: 1 })[0] || null;
}

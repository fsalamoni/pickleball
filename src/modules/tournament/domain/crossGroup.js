/**
 * Comparar quem veio de GRUPOS DIFERENTES — e de tamanhos diferentes.
 *
 * ## O problema, com número
 *
 * 19 inscritos em 4 grupos dão 3 grupos de 5 e 1 de 4. Quem está no grupo de 5
 * joga 4 partidas; quem está no de 4 joga 3. Comparar **vitórias absolutas**
 * entre eles favorece quem simplesmente teve mais jogo: 3 vitórias em 4 (75%)
 * passa à frente de 3 vitórias em 3 (100%), e o segundo não perdeu para
 * ninguém.
 *
 * Grupos desiguais não são um acidente a evitar — são o caso NORMAL de um
 * torneio amador, onde o número de inscritos raramente é múltiplo do número de
 * grupos. O que precisa existir é a regra certa para compará-los.
 *
 * ## A regra
 *
 * É a que os circuitos de pickleball usam quando as chaves têm tamanhos
 * diferentes: **percentual, não número absoluto**, e comparando primeiro quem
 * terminou na MESMA COLOCAÇÃO.
 *
 *   1. **colocação no grupo** — todos os 1ºs, depois todos os 2ºs, e assim por
 *      diante. Um 2º colocado nunca passa à frente de um 1º, por melhor que
 *      tenha sido a campanha dele: o 1º ganhou o grupo dele, e o grupo é a
 *      prova que o torneio ofereceu;
 *   2. **aproveitamento** (vitórias ÷ partidas jogadas);
 *   3. **saldo por partida** ((pontos a favor − contra) ÷ partidas);
 *   4. **pontos a favor por partida**.
 *
 * Dentro de UM grupo nada disso é usado — lá vale o desempate oficial de
 * `tiebreak.js`, com confronto direto. Aqui não pode valer confronto direto por
 * definição: são pessoas que não se enfrentaram.
 *
 * ## Para que serve
 *
 * Duas coisas, e a segunda é a que resolve o "número incomum de inscritos":
 *
 * - **ordenar a chave**: entre os 1ºs colocados, quem foi melhor pega o lado
 *   mais fácil;
 * - **repescagem** (os "melhores segundos", "melhores terceiros"): quando os
 *   classificados diretos não fecham a chave, as vagas que faltam vão para os
 *   melhores NÃO classificados da mesma colocação — em vez de uma chave cheia
 *   de byes ou de um grupo a menos.
 *
 * Lógica pura: sem React, sem Firebase.
 */

import { balanceOf } from './tiebreak.js';

/**
 * Como comparar quem veio de grupos diferentes. São três escolas, todas em uso
 * de verdade, e o organizador escolhe.
 */
export const CROSS_GROUP_METHOD = Object.freeze({
  /** Percentual (aproveitamento e saldo por partida). O padrão. */
  RATE: 'rate',
  /** Números absolutos. Só é justo com grupos do MESMO tamanho. */
  ABSOLUTE: 'absolute',
  /**
   * Descarta o resultado contra o ÚLTIMO colocado de cada grupo, para todos
   * serem comparados sobre o mesmo número de partidas. É a regra da FIFA e da
   * UEFA nos grupos desiguais.
   */
  DROP_LAST: 'drop_last',
});

export const CROSS_GROUP_METHOD_LABELS = Object.freeze({
  [CROSS_GROUP_METHOD.RATE]: 'Aproveitamento (percentual)',
  [CROSS_GROUP_METHOD.ABSOLUTE]: 'Números absolutos',
  [CROSS_GROUP_METHOD.DROP_LAST]: 'Descartar o jogo contra o último de cada grupo',
});

export const CROSS_GROUP_METHOD_HELP = Object.freeze({
  [CROSS_GROUP_METHOD.RATE]:
    'Vitórias e saldo divididos pelas partidas jogadas. É o que os circuitos de pickleball usam quando as chaves têm tamanhos diferentes: 3 vitórias em 3 vale mais que 3 em 4. Escolha esta se não tiver certeza.',
  [CROSS_GROUP_METHOD.ABSOLUTE]:
    'Compara vitórias e saldo crus. Simples e transparente, mas só é justo quando TODOS os grupos têm o mesmo tamanho — senão quem jogou mais leva vantagem por ter tido mais chance de somar.',
  [CROSS_GROUP_METHOD.DROP_LAST]:
    'Tira da conta o jogo de cada um contra o último colocado do seu grupo, de modo que todos passem a ser comparados sobre o mesmo número de partidas. É a regra da FIFA para grupos de tamanhos diferentes. Mais rigorosa, e mais difícil de explicar na beira da quadra.',
});

/** Normaliza o método (desconhecido ⇒ percentual). */
export function normalizeCrossGroupMethod(v) {
  return Object.values(CROSS_GROUP_METHOD).includes(v) ? v : CROSS_GROUP_METHOD.RATE;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Converte estatísticas absolutas em TAXAS por partida.
 *
 * `played = 0` (ninguém jogou: grupo cancelado, fase interrompida) devolve
 * zeros e `hasPlayed: false` — quem não jogou não é comparável, e a tela
 * precisa poder dizer isso em vez de mostrar 0% como se fosse um desempenho.
 *
 * @param {{ wins?: number, played?: number, points_for?: number, points_against?: number }} stats
 * @returns {{ hasPlayed: boolean, played: number, winRate: number, balanceRate: number, pointRate: number }}
 */
export function ratesOf(stats) {
  const played = num(stats?.played);
  if (played <= 0) {
    return { hasPlayed: false, played: 0, winRate: 0, balanceRate: 0, pointRate: 0 };
  }
  const pf = num(stats?.points_for);
  const pa = num(stats?.points_against);
  return {
    hasPlayed: true,
    played,
    winRate: num(stats?.wins) / played,
    balanceRate: (pf - pa) / played,
    pointRate: pf / played,
  };
}

/**
 * Compara duas entradas (melhor primeiro). 0 = empate absoluto.
 *
 * `method` escolhe a escola: percentual (padrão), absoluto, ou
 * descartar-o-último — este último já chega com as estatísticas ajustadas por
 * `withoutLastPlaced`, então aqui ele é comparado como absoluto.
 */
export function compareByRates(a, b, method = CROSS_GROUP_METHOD.RATE) {
  const modo = normalizeCrossGroupMethod(method);
  if (modo === CROSS_GROUP_METHOD.ABSOLUTE || modo === CROSS_GROUP_METHOD.DROP_LAST) {
    const sa = a?.stats || {};
    const sb = b?.stats || {};
    if (num(sb.wins) !== num(sa.wins)) return num(sb.wins) - num(sa.wins);
    const ba = balanceOf(sa);
    const bb = balanceOf(sb);
    if (bb !== ba) return bb - ba;
    return num(sb.points_for) - num(sa.points_for);
  }
  const ra = ratesOf(a?.stats);
  const rb = ratesOf(b?.stats);
  // Quem jogou vem antes de quem não jogou — 0% de quem não entrou em quadra
  // não é um desempenho, é ausência de dado.
  if (ra.hasPlayed !== rb.hasPlayed) return ra.hasPlayed ? -1 : 1;
  if (rb.winRate !== ra.winRate) return rb.winRate - ra.winRate;
  if (rb.balanceRate !== ra.balanceRate) return rb.balanceRate - ra.balanceRate;
  if (rb.pointRate !== ra.pointRate) return rb.pointRate - ra.pointRate;
  return 0;
}

/**
 * Tira do somatório de um participante o que ele fez contra o ÚLTIMO colocado
 * do grupo dele — a regra do "descartar o último".
 *
 * O último colocado do próprio grupo é devolvido sem ajuste (ele não joga
 * contra si mesmo, e descartar o jogo dele com o penúltimo seria outra regra).
 *
 * @param {object} entry entrada com `stats`
 * @param {{ ranked: Array<object>, headToHead: Map|null, idOf?: Function }} grupo
 * @returns {object} a mesma entrada, com `stats` ajustado
 */
export function withoutLastPlaced(entry, grupo) {
  const ranked = Array.isArray(grupo?.ranked) ? grupo.ranked : [];
  const headToHead = grupo?.headToHead || null;
  if (!headToHead || ranked.length < 2) return entry;
  const idOf = grupo.idOf || ((e) => String((e?.members || [])[0] ?? e?.id ?? ''));

  const ultimo = ranked[ranked.length - 1];
  const idUltimo = idOf(ultimo);
  const idEu = idOf(entry);
  if (!idUltimo || idUltimo === idEu) return entry;

  const contra = headToHead.get(`${idEu}|${idUltimo}`);
  if (!contra) return entry;

  const s = entry.stats || {};
  return {
    ...entry,
    stats: {
      ...s,
      wins: Math.max(0, num(s.wins) - num(contra.wins)),
      played: Math.max(0, num(s.played) - 1),
      points_for: Math.max(0, num(s.points_for) - num(contra.points_for)),
      points_against: Math.max(0, num(s.points_against) - num(contra.points_against)),
    },
  };
}

/**
 * Ordena entradas de grupos diferentes pelos critérios de taxa, **dentro da
 * mesma colocação**.
 *
 * A ordem de entrada é preservada nos empates absolutos (estável), então a
 * mesma tela aberta duas vezes mostra a mesma ordem.
 *
 * @param {Array<{ rank: number, stats: object }>} entries
 * @param {{ byPosition?: boolean, method?: string }} [options] `byPosition`
 *   (padrão `true`) agrupa por colocação antes de comparar. Com `false`,
 *   compara todos juntos — útil para uma lista que já é toda da mesma
 *   colocação. `method` escolhe a escola de comparação.
 * @returns {Array<object>} as mesmas entradas, ordenadas
 */
export function rankAcrossGroups(entries, options = {}) {
  const lista = Array.isArray(entries) ? entries.slice() : [];
  if (lista.length <= 1) return lista;
  const byPosition = options.byPosition !== false;
  const ordemOriginal = new Map(lista.map((e, i) => [e, i]));
  const estavel = (x, y) => (ordemOriginal.get(x) ?? 0) - (ordemOriginal.get(y) ?? 0);

  return lista.sort((x, y) => {
    if (byPosition) {
      const rx = num(x?.rank) || Number.MAX_SAFE_INTEGER;
      const ry = num(y?.rank) || Number.MAX_SAFE_INTEGER;
      if (rx !== ry) return rx - ry;
    }
    return compareByRates(x, y, options.method) || estavel(x, y);
  });
}

/**
 * Escolhe os melhores NÃO classificados para as vagas de REPESCAGEM.
 *
 * Só concorre quem ficou exatamente na colocação seguinte à do corte — os
 * "melhores terceiros" quando passam 2 por grupo. É deliberado: um 4º colocado
 * de um grupo forte não entra na frente de um 3º de um grupo fraco, porque o
 * torneio não tem como provar que ele é melhor. A repescagem premia a melhor
 * campanha ENTRE IGUAIS, não a melhor campanha absoluta.
 *
 * @param {Array<{ index?: number, ranked: Array<object> }>} groups grupos já
 *   classificados (a saída de `rankEntrantsInGroup`, na ordem de classificação)
 * @param {{ qualifiersPerGroup: number, slots: number }} options
 * @returns {{ chosen: object[], candidates: object[] }}
 *   `chosen` já vem na ordem de mérito; cada entrada carrega `_groupIndex`.
 */
export function selectWildcards(groups, options = {}) {
  const slots = Math.max(0, Math.floor(options.slots) || 0);
  const per = Math.max(0, Math.floor(options.qualifiersPerGroup) || 0);
  if (slots === 0) return { chosen: [], candidates: [] };
  const method = normalizeCrossGroupMethod(options.method);

  // A colocação que concorre. Por padrão é a imediatamente seguinte ao corte;
  // o organizador pode fixar outra (`fromPosition`) quando o regulamento dele
  // repesca de um lugar diferente.
  const fixada = Math.max(0, Math.floor(Number(options.fromPosition)) || 0);
  const posicao = fixada > 0 ? fixada : per + 1;
  const candidates = (groups || [])
    .flatMap((g, i) => {
      const ranked = Array.isArray(g?.ranked) ? g.ranked : [];
      // Com classificados por grupo diferentes, o corte de CADA grupo é o
      // dele — senão o 3º de um grupo que classifica 1 concorreria com o 3º
      // de um grupo que classifica 2, que são coisas diferentes.
      const corte = Array.isArray(options.qualifiersByGroup)
        && Number.isFinite(Number(options.qualifiersByGroup[i]))
        ? Math.max(0, Math.floor(Number(options.qualifiersByGroup[i]))) + 1
        : posicao;
      const alvo = ranked[corte - 1];
      if (!alvo) return [];
      const entrada = { ...alvo, rank: corte, _groupIndex: g?.index ?? i };
      return [method === CROSS_GROUP_METHOD.DROP_LAST ? withoutLastPlaced(entrada, g) : entrada];
    });

  const ordenados = rankAcrossGroups(candidates, { byPosition: false, method });
  return { chosen: ordenados.slice(0, slots), candidates: ordenados };
}

/**
 * Quantas vagas de repescagem faltam para fechar uma chave.
 *
 * Uma chave de mata-mata tem tamanho em potência de 2. Com 10 classificados a
 * chave é de 16 e sobram **6 byes** — metade dos jogos da primeira rodada não
 * acontece, e o torneio fica com cara de sorteio. Com 6 repescados são 16
 * cheios; com 2 a menos seriam 8. As duas saídas são legítimas, e quem organiza
 * é que escolhe — esta função só mostra as contas.
 *
 * @param {number} qualifiers classificados diretos
 * @returns {{
 *   size: number, byes: number, toFill: number,
 *   downTo: number, dropToFill: number, perfect: boolean,
 * }}
 *   `toFill` = repescados para encher a chave atual;
 *   `downTo` = a chave menor, e `dropToFill` = quantos classificados a menos
 *   ela pediria.
 */
export function bracketFit(qualifiers) {
  const n = Math.max(0, Math.floor(qualifiers) || 0);
  if (n <= 1) return { size: n, byes: 0, toFill: 0, downTo: n, dropToFill: 0, perfect: true };
  const size = 2 ** Math.ceil(Math.log2(n));
  const downTo = 2 ** Math.floor(Math.log2(n));
  return {
    size,
    byes: size - n,
    toFill: size - n,
    downTo,
    dropToFill: n - downTo,
    perfect: size === n,
  };
}

/**
 * Explicações exatas de cada formato/sistema de competição em função do número
 * de jogadores inscritos.
 *
 * Todas as funções são puras e determinísticas: dadas as mesmas entradas
 * (tipo de fase, número de jogadores, nº de grupos, cabeças-de-chave), elas
 * retornam exatamente os mesmos números de jogos, rodadas, byes e cobertura.
 *
 * O objetivo é responder, para QUALQUER número de inscritos, "o que é possível"
 * em cada modalidade/formato — total de jogos, rodadas, descansos (byes),
 * jogos por jogador e quando a configuração é perfeita ou tem limitação
 * matemática. Esses números são exibidos na interface (modal de informações da
 * modalidade e formulário de criação/edição) para que organizadores e
 * jogadores saibam de antemão como o campeonato vai rodar.
 */

import {
  MODALITY_FORMAT,
  MODALITY_FORMAT_LABELS,
  STAGE_TYPES_BY_FORMAT,
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
} from './constants.js';
import { nextPowerOfTwo, americanoMatchCount } from './draw.js';
import { recommendedSwissRounds } from './swiss.js';

/* ----------------------------- Utilitários ------------------------------ */

/** Combinações C(n, 2) = n·(n−1)/2 (número de confrontos todos-contra-todos). */
function comb2(n) {
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

/** Verdadeiro se n é potência de 2 (chave de mata-mata "cheia", sem byes). */
function isPowerOfTwo(n) {
  return n >= 1 && (n & (n - 1)) === 0;
}

/**
 * Número mínimo de jogadores para que cada formato consiga ser sorteado.
 * A Americana exige 4 (dois contra dois com rotação); os demais exigem 2.
 */
export const STAGE_MIN_PLAYERS = Object.freeze({
  [TOURNAMENT_STAGE_TYPE.ROUND_ROBIN]: 2,
  [TOURNAMENT_STAGE_TYPE.GROUPS]: 2,
  [TOURNAMENT_STAGE_TYPE.KNOCKOUT]: 2,
  [TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT]: 2,
  [TOURNAMENT_STAGE_TYPE.SWISS]: 2,
  [TOURNAMENT_STAGE_TYPE.AMERICANO]: 4,
});

/** Descrição curta (independente de N) de cada formato de inscrição. */
export const FORMAT_DESCRIPTION = Object.freeze({
  [MODALITY_FORMAT.SINGLES]:
    'Simples: a inscrição é individual — o jogador se inscreve sozinho. Conforme a estrutura escolhida, os jogos podem ser 1×1 (pontos corridos, grupos, chaves, dupla eliminação ou suíço) ou em duplas montadas por rotação (Americano).',
  [MODALITY_FORMAT.DOUBLES]:
    'Duplas (2 contra 2): cada inscrição precisa de jogador A e jogador B definidos no momento da inscrição. A dupla é fixa durante todo o torneio.',
});;

/** Descrição curta (independente de N) de cada sistema/fase de competição. */
export const STAGE_DESCRIPTION = Object.freeze({
  [TOURNAMENT_STAGE_TYPE.ROUND_ROBIN]:
    'Pontos corridos: todos jogam contra todos uma vez. A classificação final é dada pelo desempenho geral de cada participante.',
  [TOURNAMENT_STAGE_TYPE.GROUPS]:
    'Fase de grupos: participantes divididos em grupos, todos contra todos dentro do grupo, e os melhores avançam.',
  [TOURNAMENT_STAGE_TYPE.KNOCKOUT]:
    'Chaves (mata-mata): jogos eliminatórios — quem perde está fora. As partidas seguem o chaveamento sorteado.',
  [TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT]:
    'Dupla eliminação: cada participante tem direito a duas derrotas antes de ser eliminado. Quem perde uma vez vai para a chave dos perdedores.',
  [TOURNAMENT_STAGE_TYPE.SWISS]:
    'Sistema suíço: a cada rodada, participantes com pontuação semelhante são pareados, sem eliminação direta e sem repetir confrontos.',
  [TOURNAMENT_STAGE_TYPE.AMERICANO]:
    'Americana (rotação): só para inscrição individual (Simples). Os jogos são em duplas (2×2) montadas por rotação, de modo que cada jogador forma dupla com todos os demais e nenhuma dupla se repete. Exige um número de inscritos que permita exatidão (N ≡ 0 ou 1 mod 4): 4, 5, 8, 9, 12, 13, 16, 17… O total de jogos é N·(N−1)/4.',
});

/**
 * @typedef {Object} StageExplanation
 * @property {string} stageType            chave do formato (TOURNAMENT_STAGE_TYPE)
 * @property {string} label                rótulo legível em pt-BR
 * @property {number} minPlayers           mínimo de jogadores para sortear
 * @property {number} playerCount          número de jogadores considerado
 * @property {boolean} eligible            true se playerCount ≥ minPlayers
 * @property {'info'|'ok'|'warn'|'error'} status  severidade da configuração
 * @property {string} description          descrição curta do sistema
 * @property {{ totalMatches: number, rounds: number } | null} stats  números-chave
 * @property {string[]} lines              explicação exata, linha a linha, para este N
 * @property {string} [recommendation]     dica de número ideal de jogadores
 */

/* ----------------------------- Explicadores por formato ----------------- */

function explainRoundRobin(n) {
  const totalMatches = comb2(n);
  const rounds = n % 2 === 0 ? n - 1 : n;
  const lines = [
    `${n} jogadores → ${totalMatches} jogos no total (todos contra todos uma vez).`,
    `Cada jogador disputa ${n - 1} jogos.`,
    `O torneio é organizado em ${rounds} rodadas${
      n % 2 === 1 ? ' (como o número é ímpar, 1 jogador descansa por rodada)' : ''
    }.`,
  ];
  return {
    status: 'ok',
    totalMatches,
    rounds,
    lines,
    recommendation:
      n % 2 === 1
        ? 'Com número par de jogadores ninguém precisa descansar entre as rodadas.'
        : undefined,
  };
}

function explainGroups(n, groupCount) {
  const groups = Math.max(1, Math.trunc(groupCount) || 1);
  const base = Math.floor(n / groups);
  const remainder = n % groups;
  const largeGroups = remainder; // grupos com base+1 jogadores
  const smallGroups = groups - remainder; // grupos com base jogadores
  const totalMatches =
    largeGroups * comb2(base + 1) + smallGroups * comb2(base);
  // rodadas: limitada pelo maior grupo (todos-contra-todos interno)
  const largestSize = base + (remainder > 0 ? 1 : 0);
  const rounds = largestSize % 2 === 0 ? Math.max(0, largestSize - 1) : largestSize;

  const balanced = remainder === 0;
  const sizesLabel = balanced
    ? `${groups} grupos de ${base} jogadores`
    : `${largeGroups} grupo(s) de ${base + 1} e ${smallGroups} grupo(s) de ${base} jogadores`;

  const lines = [
    `${n} jogadores divididos em ${sizesLabel}.`,
    `${totalMatches} jogos na fase de grupos (todos contra todos dentro de cada grupo).`,
    `Os melhores de cada grupo avançam para a fase seguinte (mata-mata ou classificação).`,
  ];

  let status = 'ok';
  let recommendation;
  if (base < 2) {
    // pelo menos um grupo ficaria com 0 ou 1 jogador → sem jogos
    status = 'warn';
    recommendation = `Com ${n} jogadores em ${groups} grupos há grupos pequenos demais. Reduza o número de grupos ou aumente os inscritos para ter ao menos 3 jogadores por grupo.`;
  } else if (!balanced) {
    status = 'warn';
    recommendation = `Para grupos do mesmo tamanho use um número de inscritos múltiplo de ${groups} (ex.: ${
      base * groups
    } ou ${(base + 1) * groups}).`;
  }

  return { status, totalMatches, rounds, lines, recommendation };
}

function explainKnockout(n) {
  const size = nextPowerOfTwo(n);
  const byes = size - n;
  const rounds = Math.log2(size);
  const totalMatches = n - 1; // eliminação simples: cada jogo elimina 1 → N−1 jogos
  const perfect = isPowerOfTwo(n);

  const lines = [
    `${n} jogadores → chave de ${size} posições, ${totalMatches} jogos no total.`,
    `O campeão é decidido em ${rounds} rodada(s) (incluindo a final).`,
  ];
  if (perfect) {
    lines.push('Chave cheia: nenhum jogador recebe bye na primeira rodada.');
  } else {
    lines.push(
      `${byes} jogador(es) avança(m) direto (bye) na 1ª rodada, pois ${n} não é potência de 2.`,
    );
  }

  return {
    status: perfect ? 'ok' : 'info',
    totalMatches,
    rounds,
    lines,
    recommendation: perfect
      ? undefined
      : `Para uma chave perfeita (sem byes) use uma potência de 2: ${size / 2} ou ${size} jogadores.`,
  };
}

function explainDoubleKnockout(n) {
  const size = nextPowerOfTwo(n);
  const byes = size - n;
  const rounds = Math.log2(size);
  const minMatches = 2 * n - 2; // sem "bracket reset"
  const maxMatches = 2 * n - 1; // com "bracket reset" na grande final
  const perfect = isPowerOfTwo(n);

  const lines = [
    `${n} jogadores → entre ${minMatches} e ${maxMatches} jogos (depende do "reset" da grande final).`,
    'Cada jogador só é eliminado após 2 derrotas (chave de vencedores + chave de perdedores).',
    `A chave de vencedores tem ${rounds} rodada(s); a grande final reúne os campeões das duas chaves.`,
  ];
  if (!perfect) {
    lines.push(
      `${byes} jogador(es) recebe(m) bye na 1ª rodada da chave de vencedores, pois ${n} não é potência de 2.`,
    );
  }

  return {
    status: perfect ? 'ok' : 'info',
    totalMatches: minMatches,
    rounds,
    lines,
    recommendation: perfect
      ? undefined
      : `Para chaves perfeitas (sem byes) use uma potência de 2: ${size / 2} ou ${size} jogadores.`,
  };
}

function explainSwiss(n) {
  const rounds = recommendedSwissRounds(n);
  const perRound = Math.floor(n / 2);
  const totalMatches = rounds * perRound;
  const odd = n % 2 === 1;

  const lines = [
    `${n} jogadores → ${rounds} rodadas recomendadas (≈ log₂ de ${n}), ${perRound} jogo(s) por rodada.`,
    `Total aproximado de ${totalMatches} jogos. Cada jogador disputa ${rounds} jogo(s)${
      odd ? ' (1 jogador recebe bye por rodada, pois o número é ímpar)' : ''
    }.`,
    'Não há eliminação: a cada rodada quem tem pontuação parecida se enfrenta, sem repetir confrontos.',
  ];

  return {
    status: 'ok',
    totalMatches,
    rounds,
    lines,
    recommendation: odd
      ? 'Com número par de jogadores ninguém precisa receber bye entre as rodadas.'
      : undefined,
  };
}

function explainAmericano(n) {
  const check = americanoMatchCount(n);
  const totalPairs = comb2(n); // parcerias possíveis C(N,2)

  if (!check.exact) {
    // Número de inscritos não permite cobertura exata → configuração inválida.
    // O sistema não gera uma chave parcial: aponta o erro claramente.
    return {
      status: 'error',
      totalMatches: check.totalMatches,
      rounds: 0,
      lines: [
        `${n} jogadores não permitem um Americano exato.`,
        'No Americano cada jogador forma dupla com todos os demais e nenhuma dupla se repete — isso só é possível quando o número de inscritos é N ≡ 0 ou 1 (mod 4).',
        `Com ${n} inscritos sobraria(m) dupla(s) sem confronto possível, então o sistema não gera os jogos desta estrutura.`,
      ],
      recommendation:
        'Ajuste o número de inscritos para 4, 5, 8, 9, 12, 13, 16, 17… (N ≡ 0 ou 1 mod 4).',
    };
  }

  const totalMatches = check.totalMatches;
  const lines = [
    `${n} jogadores → ${totalMatches} jogos no total (cada jogo é 2 contra 2 e fecha 2 duplas).`,
    `Cobertura perfeita: cada uma das ${totalPairs} duplas possíveis acontece exatamente uma vez.`,
    `Cada jogador faz ${n - 1} jogos, formando dupla com cada outro jogador uma única vez.`,
    'Adversários perfeitamente equilibrados: você enfrenta cada outro jogador exatamente 2 vezes — não importa o número de inscritos.',
    'A grade sai em rodadas (todos jogam uma vez por rodada), o que ocupa as quadras em paralelo e iguala o tempo de espera de cada jogador.',
    'Quando há níveis e gêneros informados, o sorteio ainda tenta — sem quebrar o equilíbrio — que duplas do mesmo gênero e de níveis próximos se enfrentem.',
  ];

  return {
    status: 'ok',
    totalMatches,
    rounds: 0, // a Americana distribui em rodadas dinamicamente (1 jogo por jogador/rodada)
    lines,
  };
}

const STAGE_EXPLAINERS = {
  [TOURNAMENT_STAGE_TYPE.ROUND_ROBIN]: (n) => explainRoundRobin(n),
  [TOURNAMENT_STAGE_TYPE.GROUPS]: (n, opts) => explainGroups(n, opts.groupCount),
  [TOURNAMENT_STAGE_TYPE.KNOCKOUT]: (n) => explainKnockout(n),
  [TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT]: (n) => explainDoubleKnockout(n),
  [TOURNAMENT_STAGE_TYPE.SWISS]: (n) => explainSwiss(n),
  [TOURNAMENT_STAGE_TYPE.AMERICANO]: (n) => explainAmericano(n),
};

/* ----------------------------- API pública ------------------------------ */

/**
 * Explica, de forma exata, o que acontece em uma fase/sistema de competição
 * para um determinado número de jogadores.
 *
 * @param {{
 *   stageType: string,
 *   playerCount: number,
 *   groupCount?: number,
 *   seedCount?: number,
 * }} input
 * @returns {StageExplanation}
 */
export function explainStage(input) {
  const { stageType, playerCount, groupCount = 1 } = input || {};
  const label = TOURNAMENT_STAGE_TYPE_LABELS[stageType] || stageType || '—';
  const description = STAGE_DESCRIPTION[stageType] || 'Formato definido pelo organizador.';
  const minPlayers = STAGE_MIN_PLAYERS[stageType] ?? 2;
  const n = Math.trunc(Number(playerCount) || 0);

  const base = {
    stageType,
    label,
    minPlayers,
    playerCount: n,
    description,
  };

  const explainer = STAGE_EXPLAINERS[stageType];
  if (!explainer) {
    return {
      ...base,
      eligible: n >= minPlayers,
      status: 'info',
      stats: null,
      lines: [],
    };
  }

  if (n < minPlayers) {
    return {
      ...base,
      eligible: false,
      status: 'error',
      stats: null,
      lines: [
        `São necessários pelo menos ${minPlayers} jogadores inscritos para sortear este formato.`,
        n > 0
          ? `Atualmente há ${n} jogador(es) — faltam ${minPlayers - n}.`
          : 'Ainda não há jogadores suficientes inscritos.',
      ],
    };
  }

  const result = explainer(n, { groupCount });
  return {
    ...base,
    eligible: true,
    status: result.status,
    stats: { totalMatches: result.totalMatches, rounds: result.rounds },
    lines: result.lines,
    ...(result.recommendation ? { recommendation: result.recommendation } : {}),
  };
}

/**
 * Retorna a descrição curta do formato de inscrição (singles/doubles/americano).
 * @param {string} format
 * @returns {string}
 */
export function describeFormat(format) {
  return FORMAT_DESCRIPTION[format] || MODALITY_FORMAT_LABELS[format] || '';
}

/**
 * Retorna a descrição curta do sistema de competição (fase).
 * @param {string} stageType
 * @returns {string}
 */
export function describeStage(stageType) {
  return STAGE_DESCRIPTION[stageType] || 'Formato definido pelo organizador.';
}

/**
 * Lista as estruturas de competição compatíveis com um formato de inscrição.
 * @param {string} format
 * @returns {string[]} chaves de TOURNAMENT_STAGE_TYPE
 */
export function compatibleStageTypes(format) {
  return STAGE_TYPES_BY_FORMAT[format] || Object.values(TOURNAMENT_STAGE_TYPE);
}

/**
 * Verifica se uma estrutura de competição é compatível com o formato de
 * inscrição e, quando não é, devolve uma mensagem explicando o motivo.
 *
 * Regra: a Americana (rotação) só é compatível com inscrição individual
 * (Simples). Os demais sistemas funcionam tanto para Simples (1×1) quanto
 * para Duplas (2×2 com dupla fixa).
 *
 * @param {string} format
 * @param {string} stageType
 * @returns {{ compatible: boolean, reason: string | null }}
 */
export function stageFormatCompatibility(format, stageType) {
  const allowed = STAGE_TYPES_BY_FORMAT[format];
  if (!allowed || allowed.includes(stageType)) {
    return { compatible: true, reason: null };
  }
  const reason =
    stageType === TOURNAMENT_STAGE_TYPE.AMERICANO
      ? 'O formato Americano (rotação de duplas) só funciona com inscrição individual (Simples), pois monta as duplas sorteando parceiros. Para inscrição em Duplas, escolha Pontos corridos, Fase de grupos, Chaves, Dupla eliminação ou Sistema suíço.'
      : `O sistema "${TOURNAMENT_STAGE_TYPE_LABELS[stageType] || stageType}" não é compatível com inscrição em ${MODALITY_FORMAT_LABELS[format] || format}.`;
  return { compatible: false, reason };
}

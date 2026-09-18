/**
 * O SORTEIO DO DIA DE JOGO, num lugar só.
 *
 * O dia de jogo existe em três lugares — o do atleta (`game_days`), o da arena
 * (o mesmo `game_days`, com `arena_id`) e o do clube (`club_events/{id}/…`) —
 * e o ARMAZENAMENTO deles é diferente por motivos históricos. As REGRAS do
 * sorteio não têm por que ser.
 *
 * Eram. O painel do clube e o do atleta tinham duas cópias do mesmo
 * `handleDraw`, e elas divergiram: o do atleta ganhou Mexicano e Rei da Quadra,
 * o do clube ficou só no Americano. Quem organiza um dia de jogo pelo clube
 * não tinha como saber que estava usando uma versão mais pobre da mesma
 * ferramenta — nada na tela dizia isso.
 *
 * Esta função é a fonte única: recebe o formato, os participantes e os jogos
 * já existentes, e devolve os jogos a gravar. Quem chama só precisa saber
 * gravar. Acrescentar um formato, um critério ou uma regra aqui vale para as
 * TRÊS telas de uma vez — e não há como uma delas ficar para trás.
 *
 * O que fica de fora daqui, de propósito: a escrita (cada origem tem o seu
 * serviço) e a permissão (cada origem tem a sua regra de quem organiza).
 */
import {
  generateGameDayGames, suggestRounds, buildDrawHistory,
} from '@/modules/clubs/domain/gameDayDraw';
import { planAdditiveDraw, offsetRounds } from '@/modules/clubs/domain/gameDayDrawMerge';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS,
  generateMexicanoSchedule, kingOfCourtFirstRound,
} from '@/modules/clubs/domain/gameDayFormats';
import { fetchUnifiedLevelsByParticipant } from '@/modules/rating/services/unifiedLevelService';

/**
 * As DUPLAS VINCULADAS de uma lista de participantes — só os vínculos MÚTUOS.
 *
 * Um `partner_id` gravado de um lado só não é dupla: é dado pela metade, e
 * tratá-lo como vínculo prenderia alguém a quem não o escolheu.
 *
 * @param {Array} participants
 * @returns {Array<[string, string]>}
 */
export function mutualFixedPairs(participants = []) {
  const porId = new Map((participants || []).filter(Boolean).map((p) => [p.id, p]));
  const vistos = new Set();
  const pares = [];
  (participants || []).forEach((p) => {
    if (!p?.partner_id || vistos.has(p.id)) return;
    const outro = porId.get(p.partner_id);
    if (!outro || outro.partner_id !== p.id) return;
    vistos.add(p.id);
    vistos.add(outro.id);
    pares.push([p.id, outro.id]);
  });
  return pares;
}

/**
 * O formato honra DUPLA VINCULADA?
 *
 * O Americano sim: quem joga com quem é escolha do sorteio, e o vínculo é uma
 * restrição legítima em cima dela. Mexicano e Rei da Quadra, NÃO — neles as
 * duplas saem da classificação da rodada e do resultado da anterior, que é o
 * que define os dois formatos. Prender uma dupla ali não seria respeitar o
 * vínculo: seria deixar de ser Mexicano.
 *
 * A tela usa isto para AVISAR, em vez de ignorar o vínculo em silêncio.
 */
export function formatHonorsFixedPairs(format) {
  return !format || format === GAME_DAY_FORMAT.AMERICANO;
}

/**
 * Monta os jogos de um sorteio de dia de jogo.
 *
 * @param {object} opts
 * @param {string} [opts.format]          formato (padrão: Americano)
 * @param {Array}  opts.participants      participantes (com `id`, `name`,
 *                                        `user_id` e `partner_id` opcionais)
 * @param {Array}  [opts.games]           jogos JÁ existentes no dia
 * @param {boolean} [opts.replaceUnscored] substituir os jogos sem resultado
 * @param {number} [opts.rounds]          rodadas (0/ausente = sugerido)
 * @param {number|null} [opts.courts]     quadras simultâneas (só Americano)
 * @param {string} [opts.seed]            semente (padrão: o relógio)
 * @returns {Promise<{
 *   payload: Array, removeIds: string[], orderBase: number,
 *   label: string, fixedPairs: Array, fixedPairsIgnored: boolean,
 * }>}
 */
export async function buildGameDayDraw({
  format = GAME_DAY_FORMAT.AMERICANO,
  participants = [],
  games = [],
  replaceUnscored = false,
  rounds = 0,
  courts = null,
  seed = null,
} = {}) {
  const ids = (participants || []).map((p) => p.id).filter(Boolean);
  const semente = seed || `gd-${Date.now()}`;
  const ehAmericano = format === GAME_DAY_FORMAT.AMERICANO;
  // Quadras só se aplicam ao Americano — é o único que monta rodadas completas.
  const quadras = ehAmericano ? courts : null;
  const rodadas = rounds || suggestRounds(ids.length, quadras) || 3;

  // Sorteio ADITIVO: mantém os jogos com resultado, opcionalmente substitui os
  // sem resultado, e numera as rodadas novas depois das que já existem.
  const plan = planAdditiveDraw({ existingGames: games, replaceUnscored });

  // Nível na régua unificada (DUPR informado → rating 2.0–8.0 → ELO → nível
  // indicado). Best-effort: sem ele o sorteio acontece igual, só sem o
  // critério de equilíbrio de força.
  let levels = null;
  try {
    levels = await fetchUnifiedLevelsByParticipant(participants);
  } catch {
    levels = null;
  }

  const fixedPairs = mutualFixedPairs(participants);
  const honra = formatHonorsFixedPairs(format);

  let raw;
  if (format === GAME_DAY_FORMAT.MEXICANO) {
    raw = generateMexicanoSchedule(ids, { rounds: rodadas, seed: semente, levels });
  } else if (format === GAME_DAY_FORMAT.KING_OF_COURT) {
    raw = kingOfCourtFirstRound(ids, { seed: semente, levels });
  } else {
    // Americano ciente do histórico do dia: leva em conta as DUPLAS e os
    // ADVERSÁRIOS já ocorridos para variar as formações, e equilibra a
    // PARTICIPAÇÃO por rodada presente. `formationGames` são TODOS os jogos do
    // dia (inclusive os que vão ser substituídos), para o sorteio novo não
    // repetir exatamente as parcerias que acabaram de sair.
    const history = buildDrawHistory(plan.keptGames, ids, { formationGames: games });
    raw = generateGameDayGames(ids, {
      rounds: rodadas, seed: semente, history, courts: quadras, levels,
      fixedPairs: honra ? fixedPairs : null,
    });
  }

  // Cada lado embute o `user_id` real do participante: assim o jogo é
  // autossuficiente para o espelhamento no ranking, mesmo que o id do
  // participante mude depois.
  const porId = new Map((participants || []).map((p) => [p.id, p]));
  const slot = (id) => {
    const p = porId.get(id);
    return { id, name: p?.name || 'Jogador', user_id: p?.user_id || null };
  };
  const payload = offsetRounds(raw, plan.roundBase).map((g) => ({
    round: g.round,
    court: g.court ?? null,
    kind: 'doubles',
    side_a: g.side_a.map(slot),
    side_b: g.side_b.map(slot),
  }));

  return {
    payload,
    removeIds: plan.removeIds,
    orderBase: plan.orderBase,
    label: GAME_DAY_FORMAT_LABELS[format] || 'Americano',
    fixedPairs,
    // A tela avisa quando havia vínculo e o formato não o honra.
    fixedPairsIgnored: fixedPairs.length > 0 && !honra,
  };
}

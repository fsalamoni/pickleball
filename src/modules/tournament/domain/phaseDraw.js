/**
 * Geração dos jogos de UMA fase multi-fase a partir dos grupos já formados.
 *
 * Reaproveita integralmente o motor de sorteio existente (`generateDraw`),
 * apenas operando sobre "entrants" (que podem ser duplas formadas) e mapeando
 * de volta para os ids de inscrição em cada lado dos jogos. Assim, as REGRAS de
 * cada formato (americano, pontos corridos, mata-mata, dupla eliminação, suíço)
 * permanecem EXATAMENTE as mesmas já validadas — esta camada só organiza.
 *
 * Pura e determinística (sem I/O).
 */

import { MODALITY_FORMAT, TOURNAMENT_STAGE_TYPE } from './constants.js';
import { generateDraw, nextPowerOfTwo } from './draw.js';
import { supportsGroups, BRACKET_FORMATS } from './phases.js';

/** Dentro de um grupo, qual formato de jogo se aplica ao tipo da fase. */
function withinGroupFormat(stageType) {
  if (stageType === TOURNAMENT_STAGE_TYPE.AMERICANO) return TOURNAMENT_STAGE_TYPE.AMERICANO;
  // 'groups' e 'round_robin' jogam pontos corridos dentro do grupo.
  return TOURNAMENT_STAGE_TYPE.ROUND_ROBIN;
}

/**
 * Gera o sorteio de um único "pote" de entrants com um formato dado, devolvendo
 * jogos cujos lados já são arrays de ids de inscrição (membros do entrant).
 *
 * @param {Array<{ id: string, members: string[] }>} entrants
 * @param {string} stageType
 * @param {{ seed?: string, seedCount?: number, playerMetaByMember?: Record<string, object>|null }} [options]
 * @returns {{ stageType: string, matches: object[] }}
 */
export function buildPoolDraw(entrants, stageType, options = {}) {
  const { seed = 'pool', seedCount = 0, playerMetaByMember = null } = options;
  const tokens = entrants.map((e) => e.id);
  const membersByToken = new Map(entrants.map((e) => [e.id, e.members || [e.id]]));

  // A Americana é por jogador: o token coincide com o (único) membro do entrant.
  let playerMeta = null;
  if (stageType === TOURNAMENT_STAGE_TYPE.AMERICANO && playerMetaByMember) {
    playerMeta = {};
    tokens.forEach((t) => {
      const members = membersByToken.get(t) || [t];
      playerMeta[t] = playerMetaByMember[members[0]] || {};
    });
  }

  const draw = generateDraw({
    format: MODALITY_FORMAT.SINGLES, // operamos sobre tokens 1×1 e mapeamos depois
    stageType,
    participants: tokens,
    groupCount: 1,
    seedCount,
    seed,
    playerMeta,
  });

  const mapSide = (side) => {
    if (side == null) return null;
    if (Array.isArray(side)) return side.flatMap((t) => membersByToken.get(t) || [t]);
    return membersByToken.get(side) || side;
  };

  return {
    ...draw,
    matches: draw.matches.map((m) => ({
      ...m,
      side_a: mapSide(m.side_a),
      side_b: mapSide(m.side_b),
    })),
  };
}

/**
 * Constrói a 1ª rodada de uma chave pareando os entrants NA ORDEM dada (slot 0
 * × slot 1, slot 2 × slot 3, …). É o que materializa o chaveamento "grupo A ×
 * grupo B, grupo C × grupo D" quando a fase é alimentada pelos classificados na
 * ordem dos grupos. As rodadas seguintes saem do avanço normal da fase.
 *
 * @param {Array<{ id: string, members: string[] }>} entrants em ordem de chave
 * @param {string} stageType
 * @returns {object[]} jogos da rodada 1
 */
export function buildOrderedBracketRound1(entrants, stageType) {
  const size = nextPowerOfTwo(entrants.length);
  const slots = entrants.slice();
  while (slots.length < size) slots.push(null);
  const bracket = stageType === TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT ? 'wb' : null;
  const sideOf = (e) => (e ? e.members || [e.id] : null);
  const matches = [];
  for (let i = 0; i < size; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    matches.push({
      bracket,
      round: 1,
      position: i / 2 + 1,
      side_a: sideOf(a),
      side_b: sideOf(b),
      bye: !a || !b,
    });
  }
  return matches;
}

/**
 * Gera o sorteio completo de uma fase a partir dos grupos já formados.
 *
 * @param {object} phase fase normalizada (de phases.js)
 * @param {Array<{ name: string, entrants: object[] }>} groups grupos já formados
 * @param {{ seed?: string, playerMetaByMember?: Record<string, object>|null, ordered?: boolean }} [options]
 *   `ordered` (usado na progressão entre fases): em chaves, pareia os entrants
 *   na ordem dada (A×B, C×D) em vez de espalhar cabeças-de-chave.
 * @returns {{ stageType: string, groups?: Array<{ name: string, participants: string[] }>, matches: object[] }}
 */
export function buildPhaseDraw(phase, groups, options = {}) {
  const seed = options.seed || 'phase';
  const playerMetaByMember = options.playerMetaByMember || null;

  if (supportsGroups(phase.type)) {
    const within = withinGroupFormat(phase.type);
    const isSingle = groups.length <= 1;
    const matches = [];
    groups.forEach((g) => {
      const d = buildPoolDraw(g.entrants, within, {
        seed: `${seed}:${g.name}`,
        playerMetaByMember,
      });
      d.matches.forEach((m) => matches.push({ ...m, group: isSingle ? null : g.name }));
    });
    return {
      stageType: phase.type,
      // Persistimos os grupos apenas quando há subdivisão real (>1 grupo).
      groups: isSingle
        ? undefined
        : groups.map((g) => ({
            name: g.name,
            participants: g.entrants.flatMap((e) => e.members || [e.id]),
          })),
      matches,
    };
  }

  // Formatos de chave/suíço: um único pote.
  const pool = (groups[0] && groups[0].entrants) || [];

  // Progressão entre fases em chave "cruzada": respeita a ordem (A×B, C×D, …).
  if (options.ordered && BRACKET_FORMATS.has(phase.type)) {
    return { stageType: phase.type, matches: buildOrderedBracketRound1(pool, phase.type) };
  }

  const d = buildPoolDraw(pool, phase.type, {
    seed,
    seedCount: options.seedCount != null ? options.seedCount : phase.seed_count || 0,
    playerMetaByMember,
  });
  return { stageType: phase.type, matches: d.matches };
}

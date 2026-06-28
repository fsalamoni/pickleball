/**
 * Serviço de sorteio: orquestra a geração e persistência das chaves/grupos,
 * o equilíbrio das duplas/adversários (nível e gênero, dentro do possível) e o
 * agendamento automático dos jogos em quadras e horários.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { generateDraw, buildGroupMatches, shuffle, seededRng } from '../domain/draw.js';
import { stageFormatCompatibility } from '../domain/formatExplain.js';
import { balancedParticipantOrder, levelRank } from '../domain/seeding.js';
import { listRegistrations } from './registrationService.js';
import { persistMatches } from './matchService.js';
import { getModality } from './modalityService.js';
import { getTournament } from './tournamentService.js';
import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  GENDER_CATEGORY,
  COMPETITION_GENDER,
  TOURNAMENT_STAGE_TYPE,
} from '../domain/constants.js';

/**
 * Deriva o gênero competitivo de uma inscrição, dentro do que é conhecido:
 *  - Se a modalidade já é exclusivamente masculina/feminina, todas as duplas
 *    são desse gênero.
 *  - Caso contrário (aberta/mista), usa o gênero competitivo informado por
 *    jogador; em duplas só conclui quando ambos são do mesmo gênero conhecido.
 */
function deriveGender(reg, modality) {
  if (modality.gender_category === GENDER_CATEGORY.MALE) return COMPETITION_GENDER.MALE;
  if (modality.gender_category === GENDER_CATEGORY.FEMALE) return COMPETITION_GENDER.FEMALE;

  const a = reg.player_a_competition_gender || null;
  if (modality.format !== MODALITY_FORMAT.DOUBLES) return a;

  const b = reg.player_b_competition_gender || null;
  if (a && b && a === b) return a;
  return null; // misto ou desconhecido → preferência de gênero não se aplica
}

/**
 * Monta os metadados (nível e gênero) de cada inscrição confirmada, para o
 * equilíbrio do sorteio.
 */
function buildMeta(registrations, modality) {
  return registrations.map((reg) => ({
    id: reg.id,
    level: reg.player_a_level || null,
    partner_level: modality.format === MODALITY_FORMAT.DOUBLES ? reg.player_b_level || null : null,
    gender: deriveGender(reg, modality),
  }));
}

/**
 * Metadados por jogador para o equilíbrio secundário da Americana (gênero e
 * nível). A inscrição é individual (Simples), então cada inscrição é um jogador.
 *  - gender: 1 (masculino), 0 (feminino) ou null (desconhecido/misto);
 *  - level: força numérica do nível (maior = mais forte) ou null.
 *
 * @param {Array<object>} registrations
 * @param {object} modality
 * @returns {Record<string, { gender: 0|1|null, level: number|null }>}
 */
function buildAmericanoPlayerMeta(registrations, modality) {
  const meta = {};
  registrations.forEach((reg) => {
    const g = deriveGender(reg, modality);
    let gender = null;
    if (g === COMPETITION_GENDER.MALE) gender = 1;
    else if (g === COMPETITION_GENDER.FEMALE) gender = 0;
    const rank = levelRank(reg.player_a_level);
    meta[reg.id] = { gender, level: rank >= 0 ? rank : null };
  });
  return meta;
}

/**
 * Executa o sorteio de uma determinada fase de uma modalidade.
 *
 * @param {object} params
 * @param {string} params.tournamentId
 * @param {string} params.modalityId
 * @param {number} params.stageIndex
 * @param {string} [params.seed] — semente do RNG; se ausente, gerada automaticamente
 * @param {Array<string>} [params.participantOrder] — ordem manual (sobrescreve registrations)
 * @param {object} actor
 * @returns {Promise<object>}
 */
export async function runDraw(params, actor) {
  const { tournamentId, modalityId, stageIndex, seed: providedSeed, participantOrder } = params;
  const modality = await getModality(modalityId);
  if (!modality) throw new Error('Modalidade não encontrada.');
  if (modality.tournament_id !== tournamentId) throw new Error('Modalidade não pertence ao torneio.');
  const stage = modality.stages?.[stageIndex];
  if (!stage) throw new Error('Fase não encontrada na modalidade.');

  // A estrutura escolhida precisa ser compatível com o formato de inscrição
  // (ex.: Americano exige inscrição Simples). Falha cedo com mensagem clara.
  const compat = stageFormatCompatibility(modality.format, stage.type);
  if (!compat.compatible) throw new Error(compat.reason);

  const registrations = await listRegistrations(modalityId);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  if (confirmed.length < 2) throw new Error('São necessários ao menos 2 inscritos confirmados.');

  // Define a ordem dos participantes:
  //  1) ordem manual explícita, se fornecida;
  //  2) ordem por cabeças-de-chave (seed) quando o admin definiu seeds;
  //  3) equilíbrio automático por nível/gênero (dentro do possível);
  //  4) ordem de inscrição (fallback estável).
  const hasManualSeeds = confirmed.some((r) => Number.isFinite(Number(r.seed)));
  const byCreation = confirmed
    .slice()
    .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity));

  let participants;
  let balanced = false;
  if (participantOrder && participantOrder.length > 0) {
    participants = participantOrder;
  } else if (hasManualSeeds) {
    participants = byCreation.map((r) => r.id);
  } else {
    const meta = buildMeta(byCreation, modality);
    const ordered = balancedParticipantOrder(meta);
    if (ordered) {
      participants = ordered;
      balanced = true;
    } else {
      participants = byCreation.map((r) => r.id);
    }
  }

  const seed = providedSeed || `${tournamentId}_${modalityId}_${stageIndex}_${Date.now()}`;

  // Quando o equilíbrio por nível foi aplicado:
  //  - grupos usam distribuição "tiered" (grupos homogêneos por nível/gênero);
  //  - chaves usam o nível como cabeça-de-chave (fortes em lados opostos,
  //    encontrando-se nas fases finais).
  const groupStrategy = balanced ? 'tiered' : 'shuffle';
  let seedCount = stage.seed_count || 0;
  const bracketTypes = [
    TOURNAMENT_STAGE_TYPE.KNOCKOUT,
    TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT,
  ];
  if (balanced && bracketTypes.includes(stage.type)) {
    // Em chaves, o nível vira cabeça-de-chave: os mais fortes ficam em lados
    // opostos e só se encontram nas fases finais.
    seedCount = participants.length;
  }

  // Para a Americana, o equilíbrio de adversários (regra absoluta) é resolvido
  // pelo motor de sorteio; aqui apenas fornecemos os metadados de gênero/nível
  // por jogador para a preferência secundária (mesmo gênero/nível se enfrentam).
  const playerMeta =
    stage.type === TOURNAMENT_STAGE_TYPE.AMERICANO
      ? buildAmericanoPlayerMeta(byCreation, modality)
      : null;

  const draw = generateDraw({
    format: modality.format,
    stageType: stage.type,
    participants,
    groupCount: stage.group_count || 1,
    seedCount,
    seed,
    groupStrategy,
    playerMeta,
  });

  const tournament = await getTournament(tournamentId);
  const { scheduleWarnings } = await persistMatches(
    tournamentId,
    modalityId,
    stageIndex,
    draw,
    actor,
    {
      schedulingConfig: modality,
      fallbackDate: tournament?.starts_at || null,
    },
  );

  return { ...draw, seed_used: seed, balanced, scheduleWarnings: scheduleWarnings || [] };
}

/**
 * Lê os grupos já sorteados de uma fase (composição preservada).
 * @returns {Array<{ name: string, participants: string[] }>}
 */
async function readStageGroups(modalityId, stageIndex) {
  const snap = await getDocs(
    query(
      collection(db, 'tournament_groups'),
      where('modality_id', '==', modalityId),
      where('stage_index', '==', Number(stageIndex)),
    ),
  );
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .map((g) => ({
      name: g.name,
      participants: Array.isArray(g.participants) && g.participants.length
        ? g.participants
        : (g.entrants || []).flatMap((e) => e.members || [e.id]),
    }))
    .filter((g) => g.participants.length > 0);
}

/**
 * Re-sorteia os JOGOS de uma fase de grupos MANTENDO os grupos (composição
 * inalterada). Regenera o round-robin completo de cada grupo já existente — útil
 * quando faltam jogos ou para reorganizar a ordem das rodadas — sem redistribuir
 * os jogadores. Substitui os jogos atuais da fase (placares são perdidos).
 *
 * @param {{ tournamentId: string, modalityId: string, stageIndex?: number }} params
 * @param {object} actor
 * @returns {Promise<{ matches: number, groups: number, scheduleWarnings: string[] }>}
 */
export async function redrawGroupMatchesKeepingGroups(params, actor) {
  const { tournamentId, modalityId, stageIndex = 0 } = params;
  const modality = await getModality(modalityId);
  if (!modality) throw new Error('Modalidade não encontrada.');
  if (modality.tournament_id !== tournamentId) throw new Error('Modalidade não pertence ao torneio.');
  const stage = modality.stages?.[stageIndex];
  if (!stage) throw new Error('Fase não encontrada na modalidade.');
  if (stage.type !== TOURNAMENT_STAGE_TYPE.GROUPS) {
    throw new Error('Esta opção é apenas para fases de grupos. Para os demais formatos, use "Sortear".');
  }

  const groups = await readStageGroups(modalityId, stageIndex);
  if (groups.length === 0) {
    throw new Error('Nenhum grupo sorteado encontrado nesta fase. Use "Sortear" para criar os grupos primeiro.');
  }

  // Reembaralha a ordem interna de cada grupo (varia a arrumação das rodadas),
  // preservando a composição. O conjunto de confrontos round-robin é o mesmo.
  const seed = `${tournamentId}_${modalityId}_${stageIndex}_regroupgames_${Date.now()}`;
  const rng = seededRng(seed);
  const reshuffled = groups.map((g) => ({ name: g.name, participants: shuffle(g.participants, rng) }));

  // draw SEM `groups` → persistMatches não recria/altera tournament_groups,
  // apenas substitui os jogos da fase pelos novos.
  const draw = { stageType: stage.type, matches: buildGroupMatches(reshuffled) };

  const tournament = await getTournament(tournamentId);
  const { scheduleWarnings } = await persistMatches(tournamentId, modalityId, stageIndex, draw, actor, {
    schedulingConfig: modality,
    fallbackDate: tournament?.starts_at || null,
  });

  return { matches: draw.matches.length, groups: groups.length, scheduleWarnings: scheduleWarnings || [] };
}

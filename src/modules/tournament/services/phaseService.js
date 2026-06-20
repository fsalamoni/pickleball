/**
 * Serviço de fases (multi-fase) de uma modalidade.
 *
 * Orquestra, com I/O no Firestore:
 *  - a montagem dos "entrants" da 1ª fase a partir das inscrições confirmadas
 *    (lista única — a inscrição é feita na modalidade);
 *  - a divisão em grupos equilibrados (sorteio) ou a montagem manual;
 *  - a geração e persistência dos jogos de cada fase (por grupo/chave);
 *  - a PROGRESSÃO entre fases: classifica os grupos, escolhe os classificados,
 *    forma os entrants da próxima fase (fundindo grupos, formando duplas, etc.)
 *    e gera os jogos seguintes.
 *
 * Toda a matemática vem dos módulos puros e testados (grouping, phases,
 * phaseDraw, phaseProgression). Aqui só há leitura/escrita e auditoria.
 *
 * IMPORTANTE: este serviço é usado apenas pela funcionalidade multi-fase (atrás
 * da feature flag). O fluxo de fase única existente (drawService/matchService)
 * permanece intacto e inalterado.
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  GENDER_CATEGORY,
  COMPETITION_GENDER,
  PHASE_BRACKET_SEEDING,
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
} from '../domain/constants.js';
import { combinedStrength } from '../domain/seeding.js';
import { normalizePhases, BRACKET_FORMATS } from '../domain/phases.js';
import { drawGroups } from '../domain/grouping.js';
import { americanoMatchCount } from '../domain/draw.js';
import { buildPhaseDraw } from '../domain/phaseDraw.js';
import { rankEntrantsInGroup, buildNextPhaseEntrants } from '../domain/phaseProgression.js';
import { normalizeScoringConfig } from '../domain/scoring.js';
import { stageFormatCompatibility } from '../domain/formatExplain.js';
import { listRegistrations } from './registrationService.js';
import { getModality } from './modalityService.js';
import { getTournament } from './tournamentService.js';
import { persistMatches, listMatches } from './matchService.js';

const GROUPS_COL = 'tournament_groups';

/* --------------------------- entrants & metadados ------------------------ */

/** Bucket de gênero competitivo de uma inscrição: 'male' | 'female' | null. */
function genderBucketOf(reg, modality) {
  if (modality.gender_category === GENDER_CATEGORY.MALE) return 'male';
  if (modality.gender_category === GENDER_CATEGORY.FEMALE) return 'female';
  const a = reg.player_a_competition_gender || null;
  if (modality.format !== MODALITY_FORMAT.DOUBLES) {
    if (a === COMPETITION_GENDER.MALE) return 'male';
    if (a === COMPETITION_GENDER.FEMALE) return 'female';
    return null;
  }
  const b = reg.player_b_competition_gender || null;
  if (a && b && a === b) return a === COMPETITION_GENDER.MALE ? 'male' : 'female';
  return null;
}

/** Converte uma inscrição confirmada em um entrant da 1ª fase. */
function registrationToEntrant(reg, modality) {
  const strength = combinedStrength({
    level: reg.player_a_level || null,
    partner_level: modality.format === MODALITY_FORMAT.DOUBLES ? reg.player_b_level || null : null,
  });
  return {
    id: reg.id,
    members: [reg.id],
    label: reg.label || reg.player_a_name || reg.id,
    gender: genderBucketOf(reg, modality),
    strength,
  };
}

/** Metadados por id de inscrição (gênero/nível) para o equilíbrio da Americana. */
function buildPlayerMetaByMember(entrants) {
  const meta = {};
  entrants.forEach((e) => {
    (e.members || []).forEach((m) => {
      meta[m] = {
        gender: e.gender === 'male' ? 1 : e.gender === 'female' ? 0 : null,
        level: Number.isFinite(e.strength) && e.strength >= 0 ? e.strength : null,
      };
    });
  });
  return meta;
}

/* ------------------------------- grupos ---------------------------------- */

/** Lê os grupos persistidos de uma fase (com a estrutura de entrants). */
export async function listPhaseGroups(modalityId, stageIndex) {
  const q = query(
    collection(db, GROUPS_COL),
    where('modality_id', '==', modalityId),
    where('stage_index', '==', Number(stageIndex)),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.group_index ?? 0) - (b.group_index ?? 0));
}

/** Reconstrói os entrants de um grupo persistido (com fallback p/ legado). */
function groupEntrants(group) {
  if (Array.isArray(group.entrants) && group.entrants.length > 0) return group.entrants;
  // Compat: grupos antigos só têm `participants` (ids individuais).
  return (group.participants || []).map((id) => ({ id, members: [id] }));
}

/**
 * Verifica se os grupos formados para uma fase podem realmente ser sorteados no
 * formato escolhido, devolvendo mensagens claras e acionáveis quando não.
 * @param {object} phase fase normalizada
 * @param {Array<{ name: string, entrants: object[] }>} groups
 * @returns {string[]} problemas encontrados (vazio = ok)
 */
function phaseDrawIssues(phase, groups) {
  const issues = [];
  groups.forEach((g) => {
    const n = (g.entrants || []).length;
    const name = g.name || 'único';
    if (phase.type === TOURNAMENT_STAGE_TYPE.AMERICANO) {
      if (n < 4) {
        issues.push(`o grupo "${name}" ficaria com ${n} atleta(s), e o Americano exige ao menos 4`);
      } else if (!americanoMatchCount(n).exact) {
        issues.push(
          `o grupo "${name}" ficaria com ${n} atletas, número incompatível com o Americano `
          + '(use 4, 5, 8, 9, 12, 13, 16, 17…)',
        );
      }
    } else if (phase.type === TOURNAMENT_STAGE_TYPE.MEXICANO) {
      if (n < 4) issues.push(`o grupo "${name}" ficaria com ${n} atleta(s), e o Mexicano exige ao menos 4`);
    } else if (n < 2) {
      issues.push(`o grupo "${name}" ficaria com ${n} atleta(s), e são necessários ao menos 2`);
    }
  });
  return issues;
}

/* ------------------------- entrants da 1ª fase --------------------------- */

/**
 * Entrants da 1ª fase a partir das inscrições confirmadas (lista única).
 * @param {string} modalityId
 * @param {object} modality
 * @returns {Promise<object[]>}
 */
export async function getFirstPhaseEntrants(modalityId, modality) {
  const regs = await listRegistrations(modalityId);
  const active = regs.filter(
    (r) => r.status === REGISTRATION_STATUS.CONFIRMED || r.status === REGISTRATION_STATUS.CHECKED_IN,
  );
  return active.map((r) => registrationToEntrant(r, modality));
}

/* --------------------------- persistência -------------------------------- */

async function deletePhaseGroups(batch, modalityId, stageIndex) {
  const q = query(
    collection(db, GROUPS_COL),
    where('modality_id', '==', modalityId),
    where('stage_index', '==', Number(stageIndex)),
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => batch.delete(d.ref));
}

/** Grava os grupos (com entrants) de uma fase. */
async function writePhaseGroups(tournamentId, modalityId, stageIndex, groups) {
  const batch = writeBatch(db);
  await deletePhaseGroups(batch, modalityId, stageIndex);
  groups.forEach((g, i) => {
    const id = doc(collection(db, GROUPS_COL)).id;
    batch.set(doc(db, GROUPS_COL, id), {
      id,
      tournament_id: tournamentId,
      modality_id: modalityId,
      stage_index: Number(stageIndex),
      group_index: i,
      name: g.name,
      entrants: g.entrants.map((e) => ({
        id: e.id,
        members: e.members || [e.id],
        label: e.label || e.id,
        gender: e.gender ?? null,
        strength: Number.isFinite(e.strength) ? e.strength : -1,
      })),
      // Lista achatada de ids para leitores genéricos (compat).
      participants: g.entrants.flatMap((e) => e.members || [e.id]),
      created_at: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Gera (ou regenera) os grupos e os jogos de UMA fase.
 *
 * @param {object} params
 * @param {string} params.tournamentId
 * @param {string} params.modalityId
 * @param {number} params.stageIndex
 * @param {string} [params.seed]
 * @param {Array<{ name: string, entrants: object[] }>} [params.manualGroups] grupos montados manualmente
 * @param {Array<object>} [params.entrants] entrants já conhecidos (p/ fases > 0)
 * @param {boolean} [params.ordered] chave por ordem (progressão entre fases)
 * @param {object} actor
 */
export async function runPhaseDraw(params, actor) {
  const { tournamentId, modalityId, stageIndex, seed: providedSeed, manualGroups } = params;
  const modality = await getModality(modalityId);
  if (!modality) throw new Error('Modalidade não encontrada.');
  if (modality.tournament_id !== tournamentId) throw new Error('Modalidade não pertence ao torneio.');

  const phases = normalizePhases(modality.stages);
  const phase = phases[stageIndex];
  if (!phase) throw new Error('Fase não encontrada na modalidade.');

  const compat = stageFormatCompatibility(modality.format, phase.type);
  if (!compat.compatible) throw new Error(compat.reason);

  // Entrants: explícitos (fases > 0), ou das inscrições (1ª fase).
  let entrants = params.entrants;
  if (!entrants) {
    if (stageIndex === 0) {
      entrants = await getFirstPhaseEntrants(modalityId, modality);
    } else {
      throw new Error('Defina os classificados desta fase avançando a fase anterior.');
    }
  }
  if (entrants.length < 2) throw new Error('São necessários ao menos 2 participantes confirmados.');

  const seed = providedSeed || `${tournamentId}_${modalityId}_${stageIndex}_${Date.now()}`;

  // Forma os grupos: manual (validado) ou sorteio equilibrado.
  let groups;
  if (manualGroups && manualGroups.length > 0) {
    groups = manualGroups;
  } else {
    groups = drawGroups(entrants, {
      mode: phase.division_mode,
      groupCount: phase.group_count,
      maxPerGroup: phase.max_per_group,
      seed,
    });
  }

  // Confere se cada grupo comporta o formato escolhido (mensagem clara).
  const drawIssues = phaseDrawIssues(phase, groups);
  if (drawIssues.length > 0) {
    const label = TOURNAMENT_STAGE_TYPE_LABELS[phase.type] || phase.type;
    throw new Error(
      `Não é possível sortear esta fase (${label}): ${drawIssues[0]}. `
      + 'Ajuste o número de grupos, o número de inscritos ou o formato da fase.',
    );
  }

  const playerMetaByMember = buildPlayerMetaByMember(entrants);
  const draw = buildPhaseDraw(phase, groups, {
    seed,
    playerMetaByMember,
    ordered: Boolean(params.ordered),
    seedCount: params.seedCount,
  });

  const tournament = await getTournament(tournamentId);
  // Persiste os jogos (sem deixar persistMatches mexer nos grupos — gravamos a
  // estrutura rica de grupos nós mesmos logo abaixo).
  const { scheduleWarnings } = await persistMatches(
    tournamentId,
    modalityId,
    stageIndex,
    { ...draw, groups: undefined },
    actor,
    { schedulingConfig: modality, fallbackDate: tournament?.starts_at || null },
  );

  // Persiste os grupos só quando há subdivisão real (mais de 1 grupo).
  if (groups.length > 1) {
    await writePhaseGroups(tournamentId, modalityId, stageIndex, groups);
  } else {
    const batch = writeBatch(db);
    await deletePhaseGroups(batch, modalityId, stageIndex);
    await batch.commit();
  }

  await createAuditLog({
    action: 'tournament_groups_set',
    actor,
    details: {
      tournament_id: tournamentId,
      modality_id: modalityId,
      stage_index: stageIndex,
      groups: groups.length,
      manual: Boolean(manualGroups && manualGroups.length > 0),
    },
  });

  return { groups, matches: draw.matches.length, scheduleWarnings: scheduleWarnings || [] };
}

/**
 * Avança para a PRÓXIMA fase: classifica os grupos da fase atual, escolhe os
 * classificados, forma os entrants da próxima fase e gera seus jogos.
 *
 * @param {object} params
 * @param {string} params.tournamentId
 * @param {string} params.modalityId
 * @param {number} params.stageIndex fase atual (a que será classificada)
 * @param {string} [params.seed]
 * @param {object} actor
 */
export async function advanceToNextPhase(params, actor) {
  const { tournamentId, modalityId, stageIndex, seed: providedSeed } = params;
  const modality = await getModality(modalityId);
  if (!modality) throw new Error('Modalidade não encontrada.');

  const phases = normalizePhases(modality.stages);
  const prevPhase = phases[stageIndex];
  const nextPhase = phases[stageIndex + 1];
  if (!prevPhase) throw new Error('Fase atual não encontrada.');
  if (!nextPhase) throw new Error('Esta já é a última fase — não há próxima fase para gerar.');

  const scoringConfig = normalizeScoringConfig(modality.scoring_override || {});
  const matches = await listMatches(modalityId, stageIndex);
  if (matches.length === 0) throw new Error('Sorteie e dispute a fase atual antes de avançar.');

  const undecided = matches.filter(
    (m) => m.status !== 'finished' && m.status !== 'walkover',
  );
  if (undecided.length > 0) {
    throw new Error(`Conclua todos os jogos da fase atual (${undecided.length} pendente(s)).`);
  }

  // Reconstrói os grupos da fase atual (ou um grupo único, se não houver subdivisão).
  let storedGroups = await listPhaseGroups(modalityId, stageIndex);
  if (storedGroups.length === 0) {
    // Fase de grupo único: monta um grupo a partir dos ids dos jogos, enriquecendo
    // cada entrant com gênero/nível/rótulo das inscrições (essencial para a
    // classificação "melhor de cada gênero").
    const regs = await listRegistrations(modalityId);
    const entrantByReg = new Map(
      regs.map((r) => [r.id, registrationToEntrant(r, modality)]),
    );
    const ids = new Set();
    matches.forEach((m) => {
      (m.side_a_ids || []).forEach((id) => ids.add(id));
      (m.side_b_ids || []).forEach((id) => ids.add(id));
    });
    storedGroups = [
      {
        name: 'Grupo único',
        group_index: 0,
        entrants: [...ids].map((id) => entrantByReg.get(id) || { id, members: [id] }),
      },
    ];
  }

  // Classifica cada grupo a partir dos seus jogos.
  const groupsRanked = storedGroups.map((g, i) => {
    const entrants = groupEntrants(g);
    const memberSet = new Set(entrants.flatMap((e) => e.members || [e.id]));
    const groupMatches = matches.filter((m) => {
      if (m.group) return m.group === g.name;
      // grupo único: todos os jogos pertencem a ele
      return (m.side_a_ids || []).some((id) => memberSet.has(id));
    });
    return {
      index: i,
      name: g.name,
      ranked: rankEntrantsInGroup(entrants, groupMatches, scoringConfig),
    };
  });

  const seed = providedSeed || `${tournamentId}_${modalityId}_${stageIndex + 1}_${Date.now()}`;
  const { groups: nextGroups, entrants: nextEntrants, bracketSeeding } = buildNextPhaseEntrants(
    groupsRanked,
    prevPhase,
    nextPhase,
    { seed },
  );

  const nextLabel = TOURNAMENT_STAGE_TYPE_LABELS[nextPhase.type] || nextPhase.type;
  if (!nextEntrants || nextEntrants.length === 0) {
    throw new Error(
      'Nenhum atleta se classificou para a próxima fase. Revise o critério de classificação — '
      + 'em especial "por gênero", que exige o gênero informado em cada inscrição.',
    );
  }

  // Antes de gerar, confere se cada grupo da próxima fase comporta o formato
  // escolhido (ex.: Americano precisa de ≥ 4 atletas por grupo). Mensagem clara.
  const issues = phaseDrawIssues(nextPhase, nextGroups);
  if (issues.length > 0) {
    throw new Error(
      `Não é possível gerar a próxima fase (${nextLabel}): ${issues[0]}. `
      + 'Ajuste os classificados por grupo na fase anterior, o número de grupos desta fase '
      + 'ou escolha outro formato.',
    );
  }

  // Em chaves: "cruzado" (adjacente, A×B/C×D) ou "clássico" (cabeças-de-chave
  // espalhadas, com a ordem já preparada por colocação em buildNextPhaseEntrants).
  const nextIsBracket = BRACKET_FORMATS.has(nextPhase.type);
  const adjacent = nextIsBracket && bracketSeeding === PHASE_BRACKET_SEEDING.ADJACENT;
  const standardSeedCount = nextIsBracket && !adjacent ? nextEntrants.length : undefined;

  const result = await runPhaseDraw(
    {
      tournamentId,
      modalityId,
      stageIndex: stageIndex + 1,
      seed,
      entrants: nextEntrants,
      manualGroups: nextGroups,
      ordered: adjacent,
      seedCount: standardSeedCount,
    },
    actor,
  );

  await createAuditLog({
    action: 'tournament_phase_advanced',
    actor,
    details: {
      tournament_id: tournamentId,
      modality_id: modalityId,
      from_stage: stageIndex,
      to_stage: stageIndex + 1,
      qualifiers: nextEntrants.length,
    },
  });

  return { nextStageIndex: stageIndex + 1, ...result };
}

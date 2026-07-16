/**
 * Vagas fictícias no sorteio (lógica pura, sem I/O).
 *
 * Quando a modalidade define um número EXATO de participantes e ainda faltam
 * inscrições, o admin pode preencher as vagas com atletas fictícios para já
 * sortear os jogos. Cada fictício é rotulado "Atleta N" (N = número do atleta na
 * ordem de inscrição, continuando após os inscritos reais) e entra no sorteio
 * com o gênero da modalidade (se ela for de gênero) e o nível padrão dela.
 *
 * Fictícios são inscrições marcadas com `is_placeholder: true`, sem conta
 * (sem user_id) e sem e-mail — logo, não contam para o ranking e não ocupam
 * vaga de inscrições reais (ver `countOccupiedRegistrations`).
 */

import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  GENDER_CATEGORY,
  COMPETITION_GENDER,
} from './constants.js';

/** Rótulo do atleta fictício de número `n`. */
export function placeholderLabel(n) {
  return `Atleta ${n}`;
}

/**
 * Quantos fictícios são necessários para completar as vagas.
 * @param {number} confirmedRealCount inscritos reais confirmados
 * @param {number|null|undefined} maxEntries número exato de participantes
 * @returns {number} 0 quando ilimitado/indefinido ou já completo
 */
export function neededPlaceholderCount(confirmedRealCount, maxEntries) {
  const max = Number(maxEntries);
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, max - Math.max(0, Number(confirmedRealCount) || 0));
}

/** Gênero competitivo herdado da modalidade (ou null se aberta/mista). */
export function placeholderGenderFor(modality) {
  if (modality?.gender_category === GENDER_CATEGORY.MALE) return COMPETITION_GENDER.MALE;
  if (modality?.gender_category === GENDER_CATEGORY.FEMALE) return COMPETITION_GENDER.FEMALE;
  return null;
}

/**
 * Campos de uma inscrição fictícia (sem id/tournament_id/modality_id/created_by/
 * timestamps, que a camada de serviço acrescenta).
 *
 * @param {object} modality
 * @param {number} athleteNumber número do atleta (para o rótulo "Atleta N")
 * @returns {object}
 */
export function buildPlaceholderRegistrationFields(modality, athleteNumber) {
  const label = placeholderLabel(athleteNumber);
  const gender = placeholderGenderFor(modality);
  const level = modality?.skill_level || null;
  const isDoubles = modality?.format === MODALITY_FORMAT.DOUBLES;
  return {
    is_placeholder: true,
    is_provisional: false,
    format: modality?.format,
    status: REGISTRATION_STATUS.CONFIRMED,
    user_id: null,
    player_a_user_id: null,
    player_a_name: label,
    player_a_email: '',
    player_a_email_lc: '',
    player_a_level: level,
    player_a_competition_gender: gender,
    player_a_photo: null,
    player_a_provisional: false,
    player_b_user_id: null,
    player_b_name: isDoubles ? label : '',
    player_b_email: '',
    player_b_email_lc: '',
    player_b_level: isDoubles ? level : null,
    player_b_competition_gender: isDoubles ? gender : null,
    player_b_photo: null,
    player_b_provisional: false,
    seed: null,
    label,
  };
}

/**
 * Duplicação de torneios (lógica pura, sem I/O).
 *
 * Estas funções montam os campos copiáveis de um torneio, de suas modalidades
 * e das inscrições, a partir dos documentos de origem. Não geram ids nem
 * timestamps nem tocam no Firestore — isso fica na camada de serviço. Ficam
 * isoladas aqui para serem testáveis sem UI nem rede.
 *
 * Regras de duplicação:
 *  - O novo torneio nasce como rascunho, com novo código de convite e tendo o
 *    ator como owner (definido na camada de serviço).
 *  - "Definições" (opcional): descrição, local, regras, datas, acesso e capa.
 *    O nome é sempre copiado (com sufixo "(cópia)" por padrão).
 *  - Modalidades: escolhidas uma a uma; cada uma copia sua configuração
 *    (formato, nível, categorias, vagas, taxa, regras, fases e agendamento).
 *  - Inscritos: por modalidade, opcionalmente; inscrições canceladas nunca são
 *    copiadas. O sorteio (grupos/jogos/ranking) nunca é copiado.
 */

import { REGISTRATION_STATUS } from './constants.js';

const DEFAULT_COPY_SUFFIX = ' (cópia)';

/**
 * Monta os campos do novo torneio. Quando `copyDefinitions` é falso, apenas o
 * nome é levado (o restante assume os padrões de `createTournament`).
 *
 * @param {object} source torneio de origem
 * @param {{ copyDefinitions?: boolean, name?: string }} [options]
 * @returns {object}
 */
export function duplicatedTournamentFields(source = {}, options = {}) {
  const { copyDefinitions = true, name } = options;
  const trimmedName = String(name ?? '').trim();
  const finalName = trimmedName || `${String(source.name || 'Torneio').trim()}${DEFAULT_COPY_SUFFIX}`;

  if (!copyDefinitions) {
    return { name: finalName };
  }

  return {
    name: finalName,
    description: source.description || '',
    city: source.city || '',
    state: source.state || '',
    venue: source.venue || '',
    ruleset: source.ruleset || source.scoring?.ruleset || 'cbp',
    scoring: source.scoring || null,
    visibility: source.visibility || 'private',
    cover_image_url: source.cover_image_url || '',
    starts_at: source.starts_at || null,
    ends_at: source.ends_at || null,
    registration_deadline: source.registration_deadline || null,
  };
}

/**
 * Monta os campos copiáveis de uma modalidade (sem id/tournament_id/timestamps,
 * que a camada de serviço acrescenta ao criar). Copia apenas configuração —
 * nunca grupos, jogos ou ranking, que vivem em outras coleções.
 *
 * @param {object} modality
 * @returns {object}
 */
export function duplicatedModalityFields(modality = {}) {
  return {
    name: modality.name || 'Modalidade',
    format: modality.format,
    skill_level: modality.skill_level,
    gender_category: modality.gender_category,
    age_category: modality.age_category,
    max_entries: modality.max_entries,
    entry_fee_cents: modality.entry_fee_cents,
    scoring_override: modality.scoring_override || null,
    stages: modality.stages,
    court_count: modality.court_count,
    match_duration_minutes: modality.match_duration_minutes,
    play_date: modality.play_date,
    play_start_time: modality.play_start_time,
    play_end_time: modality.play_end_time,
    notes: modality.notes || '',
  };
}

/** Uma inscrição é copiável se não estiver cancelada. */
export function isRegistrationCopyable(reg = {}) {
  return reg.status !== REGISTRATION_STATUS.CANCELLED;
}

/** Filtra as inscrições copiáveis (exclui as canceladas). */
export function copyableRegistrations(registrations = []) {
  return (registrations || []).filter(isRegistrationCopyable);
}

/**
 * Monta os campos copiáveis de uma inscrição (sem id/tournament_id/modality_id/
 * created_by/timestamps, que a camada de serviço acrescenta). Preserva os
 * dados dos jogadores e o status; zera o seed (o sorteio é refeito no destino).
 *
 * @param {object} reg
 * @returns {object}
 */
export function duplicatedRegistrationFields(reg = {}) {
  return {
    format: reg.format,
    is_provisional: Boolean(reg.is_provisional),
    user_id: reg.user_id || reg.player_a_user_id || null,
    player_a_user_id: reg.player_a_user_id || null,
    player_a_name: reg.player_a_name || '',
    player_a_email: reg.player_a_email || '',
    player_a_email_lc: reg.player_a_email_lc || reg.player_a_email || '',
    player_a_level: reg.player_a_level || null,
    player_a_competition_gender: reg.player_a_competition_gender || null,
    player_a_photo: reg.player_a_photo || null,
    player_a_provisional: Boolean(reg.player_a_provisional),
    player_b_user_id: reg.player_b_user_id || null,
    player_b_name: reg.player_b_name || '',
    player_b_email: reg.player_b_email || '',
    player_b_email_lc: reg.player_b_email_lc || reg.player_b_email || '',
    player_b_level: reg.player_b_level || null,
    player_b_competition_gender: reg.player_b_competition_gender || null,
    player_b_photo: reg.player_b_photo || null,
    player_b_provisional: Boolean(reg.player_b_provisional),
    status: reg.status || REGISTRATION_STATUS.CONFIRMED,
    seed: null,
    label: reg.label || '',
  };
}

/**
 * Valida um plano de duplicação. Retorna `null` quando válido ou uma mensagem
 * de erro pronta para a UI.
 *
 * @param {{ modalitySelections?: Array<{ selected: boolean }> }} plan
 * @returns {string|null}
 */
export function validateDuplicationPlan(plan = {}) {
  const anyModality = (plan.modalitySelections || []).some((m) => m.selected);
  if (!plan.copyDefinitions && !anyModality) {
    return 'Selecione ao menos as definições ou uma modalidade para duplicar.';
  }
  return null;
}

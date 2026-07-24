/**
 * Domínio puro de nível validado por professor (flag coach_leveling).
 *
 * Um professor pode atestar o nível de um aluno vinculado, gerando um registro
 * público (`coach_level_validations/{coachId_studentId}`) que vira um selo
 * "nível validado por professor" no perfil do atleta. Aditivo: não altera o
 * rating nem o ranking — é apenas um atestado de credibilidade.
 *
 * Sem I/O — testável isoladamente. A tabela de níveis vem do módulo de
 * nivelamento (dados puros).
 */

import { LEVEL_TABLE } from '../../leveling/data/levels.js';

const str = (v) => String(v ?? '').trim();

export const VALIDATION_NOTE_MAX = 280;

/** Opções de nível para o professor escolher (id, nome, selo USAP). */
export const VALIDATION_LEVEL_OPTIONS = Object.freeze(
  LEVEL_TABLE.map((l) => ({ id: l.id, name: l.name, badge: l.badge })),
);

const LEVEL_BY_ID = (() => {
  const map = {};
  VALIDATION_LEVEL_OPTIONS.forEach((l) => { map[l.id] = l; });
  return map;
})();

/** id determinístico do registro de validação. */
export function validationDocId(coachId, studentId) {
  return `${str(coachId)}_${str(studentId)}`;
}

/** Um id de nível é válido quando existe na tabela de nivelamento. */
export function isValidLevelId(levelId) {
  return Boolean(LEVEL_BY_ID[str(levelId)]);
}

/**
 * Normaliza e valida uma validação de nível.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeValidation(input = {}) {
  const coach_id = str(input.coach_id);
  const student_id = str(input.student_id);
  const level_id = str(input.level_id);

  if (!coach_id || !student_id) {
    return { valid: false, error: 'Professor e aluno são obrigatórios.', value: {} };
  }
  const level = LEVEL_BY_ID[level_id];
  if (!level) {
    return { valid: false, error: 'Selecione um nível válido.', value: {} };
  }

  const value = {
    coach_id,
    coach_name: str(input.coach_name).slice(0, 140),
    student_id,
    student_name: str(input.student_name).slice(0, 140),
    level_id,
    level_name: level.name,
    level_badge: level.badge,
    note: str(input.note).slice(0, VALIDATION_NOTE_MAX),
  };
  return { valid: true, error: null, value };
}

/** Retorna a validação mais recente de uma lista (ou null). */
export function latestValidation(list) {
  const items = Array.isArray(list) ? list.filter(Boolean) : [];
  if (items.length === 0) return null;
  return items.reduce((best, cur) => {
    const b = Number(best?.created_at_ms) || 0;
    const c = Number(cur?.created_at_ms) || 0;
    return c >= b ? cur : best;
  });
}

/** Texto curto do selo (ex.: "Nível 3.5 validado por Fulano"). */
export function validationBadgeText(v) {
  if (!v) return '';
  const by = str(v.coach_name);
  const badge = str(v.level_badge) || str(v.level_name);
  const base = `Nível ${badge} validado`;
  return by ? `${base} por ${by}` : base;
}

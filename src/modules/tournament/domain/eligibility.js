/**
 * Regras de elegibilidade do jogador em uma modalidade.
 *
 * Cada modalidade declara critérios de gênero, faixa etária e nível.
 * Este módulo expõe funções puras para validar se um jogador (perfil)
 * atende aos critérios e produzir mensagens claras para a UI.
 *
 * Idade:
 *  - "open"  → qualquer idade
 *  - "u19"   → até 18 anos (sub-19)
 *  - "35+"   → 35 anos ou mais
 *  - "50+"   → 50 anos ou mais
 *  - "60+"   → 60 anos ou mais
 *  - "70+"   → 70 anos ou mais
 *
 * Gênero (categoria competitiva, não identidade):
 *  - "open"  → qualquer pessoa
 *  - "male"  → competition_gender = "male"
 *  - "female"→ competition_gender = "female"
 *  - "mixed" → em duplas, requer um "male" + um "female"
 *
 * Nível: comparado pelo intervalo USAP da modalidade. A engine não bloqueia,
 * apenas devolve um aviso (a auto-declaração do jogador é aceita).
 */

import {
  AGE_CATEGORY,
  AGE_CATEGORY_LABELS,
  GENDER_CATEGORY,
  GENDER_CATEGORY_LABELS,
  COMPETITION_GENDER,
  MODALITY_FORMAT,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_USAP_RANGE,
} from './constants.js';
import { calculateAge } from '@/core/lib/profileValidation';

const MIN_AGE_BY_CATEGORY = Object.freeze({
  [AGE_CATEGORY.A35]: 35,
  [AGE_CATEGORY.A50]: 50,
  [AGE_CATEGORY.A60]: 60,
  [AGE_CATEGORY.A70]: 70,
});

const MAX_AGE_BY_CATEGORY = Object.freeze({
  [AGE_CATEGORY.U19]: 18, // sub-19 (18 anos ou menos)
});

function ageIssue(category, age) {
  const label = AGE_CATEGORY_LABELS[category];
  const min = MIN_AGE_BY_CATEGORY[category];
  const max = MAX_AGE_BY_CATEGORY[category];
  if (age == null) {
    return `Esta modalidade tem categoria de idade (${label}). Informe sua data de nascimento no perfil para se inscrever.`;
  }
  if (min != null && age < min) {
    return `Categoria ${label} exige idade mínima de ${min} anos (você tem ${age}).`;
  }
  if (max != null && age > max) {
    return `Categoria ${label} exige idade máxima de ${max} anos (você tem ${age}).`;
  }
  return null;
}

function genderIssueForSingle(category, profile) {
  const label = GENDER_CATEGORY_LABELS[category];
  const declared = profile?.competition_gender;
  if (category === GENDER_CATEGORY.MALE && declared !== COMPETITION_GENDER.MALE) {
    return `Esta modalidade é ${label}. Defina "Competir na categoria masculina" no seu perfil.`;
  }
  if (category === GENDER_CATEGORY.FEMALE && declared !== COMPETITION_GENDER.FEMALE) {
    return `Esta modalidade é ${label}. Defina "Competir na categoria feminina" no seu perfil.`;
  }
  return null;
}

function levelWarning(modality, profile) {
  if (!modality?.skill_level || !profile?.leveling_level) return null;
  if (modality.skill_level === profile.leveling_level) return null;
  const range = SKILL_LEVEL_USAP_RANGE[modality.skill_level];
  if (!range) return null;
  const playerRange = SKILL_LEVEL_USAP_RANGE[profile.leveling_level];
  if (!playerRange) return null;
  // Aviso: nível do jogador fora do intervalo da modalidade.
  if (playerRange[1] < range[0]) {
    return `O nível recomendado é ${SKILL_LEVEL_LABELS[modality.skill_level]}. Seu nível atual (${SKILL_LEVEL_LABELS[profile.leveling_level]}) é inferior — a organização pode validar a inscrição.`;
  }
  if (playerRange[0] > range[1]) {
    return `O nível recomendado é ${SKILL_LEVEL_LABELS[modality.skill_level]}. Seu nível atual (${SKILL_LEVEL_LABELS[profile.leveling_level]}) é superior — a organização pode validar a inscrição.`;
  }
  return null;
}

/**
 * Valida um jogador individual contra a modalidade. Retorna { errors, warnings }.
 *
 * @param {object} modality
 * @param {object} profile - userProfile (precisa ter birth_date, competition_gender, leveling_level quando aplicável)
 */
export function evaluatePlayerEligibility(modality, profile) {
  const errors = [];
  const warnings = [];

  if (modality.age_category && modality.age_category !== AGE_CATEGORY.OPEN) {
    const age = profile?.birth_date ? calculateAge(profile.birth_date) : null;
    const issue = ageIssue(modality.age_category, age);
    if (issue) errors.push(issue);
  }

  if (modality.gender_category && modality.gender_category !== GENDER_CATEGORY.OPEN
      && modality.gender_category !== GENDER_CATEGORY.MIXED) {
    const issue = genderIssueForSingle(modality.gender_category, profile);
    if (issue) errors.push(issue);
  }

  // Para Mista em formato não-duplas (raro), apenas avisa que não há checagem de dupla.
  const warn = levelWarning(modality, profile);
  if (warn) warnings.push(warn);

  return { errors, warnings };
}

/**
 * Para Duplas Mistas: exige um jogador masculino + um feminino.
 *
 * @param {object} modality
 * @param {object} profileA
 * @param {object} profileB - pode ser nulo (parceiro provisório sem conta) → emite aviso
 */
export function evaluateMixedDoublesEligibility(modality, profileA, profileB) {
  const errors = [];
  const warnings = [];

  if (modality?.gender_category !== GENDER_CATEGORY.MIXED) return { errors, warnings };
  if (modality?.format !== MODALITY_FORMAT.DOUBLES) return { errors, warnings };

  const a = profileA?.competition_gender;
  const b = profileB?.competition_gender;

  if (!profileB) {
    warnings.push('Duplas Mistas exigem um jogador masculino e outra feminina. Como o parceiro(a) ainda não tem perfil na plataforma, a organização pode pedir confirmação na hora.');
    return { errors, warnings };
  }
  if (!a || !b) {
    errors.push('Para Duplas Mistas é necessário que ambos os jogadores tenham definido a categoria competitiva (masculino/feminino) no perfil.');
    return { errors, warnings };
  }
  if (a === b) {
    errors.push('Duplas Mistas exigem um jogador masculino e outra feminina.');
  }
  return { errors, warnings };
}

/**
 * Avalia ambos os jogadores (A e B) de uma inscrição. Concatena os resultados.
 */
export function evaluateRegistrationEligibility(modality, profileA, profileB) {
  const issues = { errors: [], warnings: [] };
  const a = evaluatePlayerEligibility(modality, profileA);
  a.errors.forEach((e) => issues.errors.push(`Jogador A: ${e}`));
  a.warnings.forEach((w) => issues.warnings.push(`Jogador A: ${w}`));

  if (modality?.format === MODALITY_FORMAT.DOUBLES && profileB !== undefined) {
    if (profileB) {
      const b = evaluatePlayerEligibility(modality, profileB);
      b.errors.forEach((e) => issues.errors.push(`Jogador B: ${e}`));
      b.warnings.forEach((w) => issues.warnings.push(`Jogador B: ${w}`));
    }
    const mixed = evaluateMixedDoublesEligibility(modality, profileA, profileB);
    issues.errors.push(...mixed.errors);
    issues.warnings.push(...mixed.warnings);
  }

  return issues;
}
